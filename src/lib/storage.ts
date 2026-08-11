import { AppState, User } from '../types';
import { INITIAL_STATE } from '../data/initialData';
import { mergeAppStates, recordTimestamp, stripDeletedRecords } from './syncState';
import {
  APP_STATE_DOC_REF,
  db,
  collection,
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  getDocs,
  deleteField,
  waitForPendingWrites,
} from './firebase';

const CURRENT_USER_KEY = 'marisimas_current_user_v1';
const LISTENERS: Array<(state: AppState) => void> = [];

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';
let currentSyncStatus: SyncStatus = navigator.onLine ? 'synced' : 'offline';
const SYNC_STATUS_LISTENERS: Array<(status: SyncStatus) => void> = [];

export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}

export function subscribeSyncStatus(callback: (status: SyncStatus) => void): () => void {
  SYNC_STATUS_LISTENERS.push(callback);
  return () => {
    const idx = SYNC_STATUS_LISTENERS.indexOf(callback);
    if (idx >= 0) SYNC_STATUS_LISTENERS.splice(idx, 1);
  };
}

function notifySyncStatus(status: SyncStatus): void {
  currentSyncStatus = status;
  SYNC_STATUS_LISTENERS.forEach((cb) => cb(status));
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifySyncStatus('syncing');
  });
  window.addEventListener('offline', () => {
    notifySyncStatus('offline');
  });
}

function logFirestoreWriteError(collectionName: string, id: string, error: any, payload: any) {
  notifySyncStatus('error');
  console.error(
    `FIRESTORE WRITE FAILED\ncollection: ${collectionName}\nid: ${id}\nerror.code: ${error?.code || 'unknown'}\nerror.message: ${error?.message || error}\npayload:`,
    payload
  );
}

export function removeUndefinedDeep(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Preserve arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => removeUndefinedDeep(item));
  }

  // Preserve FieldValue sentinels (e.g. deleteField(), serverTimestamp(), etc.)
  if (obj.constructor && obj.constructor.name !== 'Object') {
    return obj;
  }

  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value !== undefined) {
      cleaned[key] = removeUndefinedDeep(value);
    }
  }
  return cleaned;
}

function getStoredCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredCurrentUser(user: User | null): void {
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch (err) {
    console.error('Error saving current user:', err);
  }
}

let inMemoryAppState: AppState = {
  ...INITIAL_STATE,
  currentUser: getStoredCurrentUser(),
};

export { mergeAppStates, stripDeletedRecords } from './syncState';

function isItemEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

let migrationPromise: Promise<void> | null = null;

export async function runMigrationIfNeeded(): Promise<void> {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    const migrationRef = doc(db, 'system', 'migration');
    const migrationSnap = await getDoc(migrationRef);

    if (migrationSnap.exists() && (migrationSnap.data()?.version || 0) >= 2) {
      return;
    }

    console.log('Running safe Firestore collection migration (version 2)...');

    let legacyState: Partial<AppState> | null = null;
    try {
      const legacySnap = await getDoc(APP_STATE_DOC_REF);
      if (legacySnap.exists()) {
        legacyState = legacySnap.data() as Partial<AppState>;
      }
    } catch (err) {
      console.warn('Could not read legacy app_data/main doc:', err);
    }

    if (!legacyState || (!legacyState.sales?.length && !legacyState.buyers?.length)) {
      try {
        const rawLocal = localStorage.getItem('marisimas_doces_app_v1');
        if (rawLocal) {
          legacyState = JSON.parse(rawLocal);
        }
      } catch (e) {
        console.warn('Could not read legacy localStorage:', e);
      }
    }

    const sourceData: AppState = {
      ...INITIAL_STATE,
      ...legacyState,
      users: legacyState?.users?.length ? legacyState.users : INITIAL_STATE.users,
      departments: legacyState?.departments?.length ? legacyState.departments : INITIAL_STATE.departments,
      sweets: legacyState?.sweets?.length ? legacyState.sweets : INITIAL_STATE.sweets,
      batches: legacyState?.batches?.length ? legacyState.batches : INITIAL_STATE.batches,
      inventory: legacyState?.inventory?.length ? legacyState.inventory : INITIAL_STATE.inventory,
      recipes: legacyState?.recipes?.length ? legacyState.recipes : INITIAL_STATE.recipes,
      buyers: legacyState?.buyers || [],
      sales: legacyState?.sales || [],
      payments: legacyState?.payments || [],
      expenses: legacyState?.expenses || [],
      utilitySettings: legacyState?.utilitySettings || [],
    };

    const migrateCollection = async (
      collectionName: string,
      items: any[],
      getId: (item: any) => string,
      mapItem?: (item: any) => any
    ) => {
      const writePromises: Promise<void>[] = [];
      for (const item of items) {
        if (!item) continue;
        const itemId = getId(item);
        if (!itemId) continue;
        const payload = mapItem ? mapItem(item) : item;
        const safePayload = removeUndefinedDeep(payload);
        const itemRef = doc(db, collectionName, itemId);
        writePromises.push(
          setDoc(itemRef, safePayload, { merge: true }).catch((err) => {
            logFirestoreWriteError(collectionName, itemId, err, safePayload);
            throw err;
          })
        );
      }
      await Promise.all(writePromises);
    };

    await migrateCollection('users', sourceData.users, (u) => u.id);
    await migrateCollection(
      'departments',
      sourceData.departments,
      (d) => (typeof d === 'string' ? d : d.id),
      (d) => (typeof d === 'string' ? { id: d, name: d } : d)
    );
    await migrateCollection('sweets', sourceData.sweets, (s) => s.id);
    await migrateCollection('batches', sourceData.batches, (b) => b.id);
    await migrateCollection('buyers', sourceData.buyers, (b) => b.id);
    await migrateCollection('sales', sourceData.sales, (s) => s.id);
    await migrateCollection('payments', sourceData.payments, (p) => p.id);
    await migrateCollection('inventory', sourceData.inventory, (i) => i.id);
    await migrateCollection('recipes', sourceData.recipes, (r) => r.id);
    await migrateCollection('expenses', sourceData.expenses, (e) => e.id);
    await migrateCollection('utilitySettings', sourceData.utilitySettings, (item) => item.id);

    // Record migration flag ONLY after all collections succeeded
    await setDoc(migrationRef, {
      version: 2,
      migratedAt: new Date().toISOString(),
    });

    console.log('Safe Firestore collection migration completed successfully!');
  })().catch((err) => {
    migrationPromise = null; // Allow future retry on failure
    console.error('Error during Firestore migration:', err);
    throw err;
  });

  return migrationPromise;
}

type CollectionKey =
  | 'buyers'
  | 'sweets'
  | 'batches'
  | 'sales'
  | 'payments'
  | 'inventory'
  | 'recipes'
  | 'expenses'
  | 'utilitySettings'
  | 'users'
  | 'departments';

const COLLECTIONS: CollectionKey[] = [
  'buyers',
  'sweets',
  'batches',
  'sales',
  'payments',
  'inventory',
  'recipes',
  'expenses',
  'utilitySettings',
  'users',
  'departments',
];

const collectionDataMap: Record<string, any[]> = {
  buyers: [],
  sweets: [],
  batches: [],
  sales: [],
  payments: [],
  inventory: [],
  recipes: [],
  expenses: [],
  utilitySettings: [],
  users: [],
  departments: [],
};

const collectionPendingMap: Record<string, boolean> = {};
const collectionReadyMap: Record<string, boolean> = {};
const collectionFromCacheMap: Record<string, boolean> = {};

function buildAppStateFromCollections(): AppState {
  const users = collectionDataMap.users.length ? collectionDataMap.users : INITIAL_STATE.users;

  const departments = collectionDataMap.departments
    .filter((d: any) => !d?.deletedAt)
    .map((d: any) => (typeof d === 'string' ? d : d.name || d.id));
  const finalDepts = departments.length ? departments : INITIAL_STATE.departments;

  return {
    users,
    currentUser: getStoredCurrentUser(),
    departments: finalDepts,
    buyers: collectionDataMap.buyers || [],
    sweets: collectionDataMap.sweets || [],
    batches: collectionDataMap.batches || [],
    sales: collectionDataMap.sales || [],
    payments: collectionDataMap.payments || [],
    inventory: collectionDataMap.inventory || [],
    recipes: collectionDataMap.recipes || [],
    expenses: collectionDataMap.expenses || [],
    utilitySettings: collectionDataMap.utilitySettings || [],
  };
}

export function initFirebaseSync(onRemoteUpdate: (state: AppState) => void): () => void {
  let destroyed = false;
  const unsubscribes: Array<() => void> = [];

  (async () => {
    try {
      await runMigrationIfNeeded();
    } catch (err) {
      console.error('Migration failed before starting listeners:', err);
      // Starting offline must not disable real-time sync for the whole
      // session. Listeners use the local Firestore cache now and reconnect
      // automatically when the device regains internet access.
      notifySyncStatus(navigator.onLine ? 'error' : 'offline');
    }

    if (destroyed) return;

    COLLECTIONS.forEach((colName) => {
      collectionReadyMap[colName] = false;
      try {
        const colRef = collection(db, colName);
        const unsub = onSnapshot(
          colRef,
          { includeMetadataChanges: true },
          (snapshot) => {
            if (destroyed) return;
            const items = snapshot.docs.map((docSnap) => {
              const data = docSnap.data();
              return { ...data, id: data.id || docSnap.id };
            });
            collectionDataMap[colName] = items;
            collectionPendingMap[colName] = snapshot.metadata.hasPendingWrites;
            collectionFromCacheMap[colName] = snapshot.metadata.fromCache;
            collectionReadyMap[colName] = true;

            const hasPending = Object.values(collectionPendingMap).some(Boolean);
            const allCollectionsReady = COLLECTIONS.every((name) => collectionReadyMap[name]);
            const hasCachedCollection = Object.values(collectionFromCacheMap).some(Boolean);

            if (!navigator.onLine) {
              notifySyncStatus('offline');
            } else if (!allCollectionsReady || hasPending || hasCachedCollection) {
              notifySyncStatus('syncing');
            } else {
              notifySyncStatus('synced');
            }

            // Never expose a partially loaded database. Partial arrays were
            // the main source of cross-device records being overwritten.
            if (!allCollectionsReady) return;

            const state = buildAppStateFromCollections();
            inMemoryAppState = state;
            notifyListeners(state);
            onRemoteUpdate(state);
          },
          (error) => {
            console.warn(`Firestore listener error on ${colName}:`, error.message);
            notifySyncStatus(navigator.onLine ? 'error' : 'offline');
          }
        );
        unsubscribes.push(unsub);
      } catch (err) {
        console.error(`Failed to attach listener for ${colName}:`, err);
      }
    });
  })();

  return () => {
    destroyed = true;
    unsubscribes.forEach((unsub) => unsub());
  };
}

export function getStoredState(): AppState {
  return stripDeletedRecords({
    ...inMemoryAppState,
    currentUser: getStoredCurrentUser() || inMemoryAppState.currentUser,
  });
}

export function saveState(state: AppState, options: { replace?: boolean } = {}): void {
  try {
    setStoredCurrentUser(state.currentUser);
    notifySyncStatus(navigator.onLine ? 'syncing' : 'offline');
    const baseState = inMemoryAppState;
    const deletionTimestamp = new Date().toISOString();

    const syncEntityCollection = <T extends { id: string }>(
      colName: string,
      newArr: T[] = [],
      oldArr: T[] = []
    ) => {
      const oldMap = new Map((oldArr || []).map((item) => [item.id, item]));
      const newMap = new Map((newArr || []).map((item) => [item.id, item]));

      newArr.forEach((newItem) => {
        if (!newItem || !newItem.id) return;
        const oldItem = oldMap.get(newItem.id);
        const newTime = recordTimestamp(newItem as Record<string, unknown>);
        const oldTime = recordTimestamp(oldItem as Record<string, unknown> | undefined);

        // Never let an outdated offline copy revive or overwrite a newer
        // record received from another device.
        if (oldItem && (oldItem as any).deletedAt && !(newItem as any).deletedAt && oldTime >= newTime) {
          return;
        }
        if (oldItem && oldTime > newTime && !options.replace) {
          return;
        }
        if (!oldItem || !isItemEqual(newItem, oldItem)) {
          const payload: Record<string, any> = { ...newItem };

          if (oldItem) {
            Object.keys(oldItem).forEach((key) => {
              if (newItem[key as keyof T] === undefined) {
                payload[key] = deleteField();
              }
            });
          }

          if (colName === 'sales' && (newItem as any).paymentStatus === 'pending' && !(newItem as any).paymentDate) {
            payload.paymentDate = deleteField();
          }

          const safePayload = removeUndefinedDeep(payload);

          setDoc(doc(db, colName, newItem.id), safePayload, { merge: true }).catch((err) => {
            logFirestoreWriteError(colName, newItem.id, err, safePayload);
          });
        }
      });

      // Missing records are intentionally ignored during normal saves. A form
      // may have been opened before another device created a new record. Only
      // an explicit replacement/import is allowed to tombstone missing data.
      if (options.replace) {
        oldArr.forEach((oldItem) => {
          if (!oldItem || !oldItem.id || newMap.has(oldItem.id)) return;
          const tombstone = removeUndefinedDeep({
            ...oldItem,
            deletedAt: deletionTimestamp,
            updatedAt: deletionTimestamp,
          });
          setDoc(doc(db, colName, oldItem.id), tombstone, { merge: true }).catch((err) => {
            logFirestoreWriteError(colName, oldItem.id, err, tombstone);
          });
        });
      }
    };

    syncEntityCollection('sales', state.sales, baseState.sales);
    syncEntityCollection('buyers', state.buyers, baseState.buyers);
    syncEntityCollection('payments', state.payments, baseState.payments);
    syncEntityCollection('batches', state.batches, baseState.batches);
    syncEntityCollection('inventory', state.inventory, baseState.inventory);
    syncEntityCollection('recipes', state.recipes, baseState.recipes);
    syncEntityCollection('expenses', state.expenses, baseState.expenses);
    syncEntityCollection('utilitySettings', state.utilitySettings, baseState.utilitySettings);
    syncEntityCollection('sweets', state.sweets, baseState.sweets);
    syncEntityCollection('users', state.users, baseState.users);

    const oldDepts = new Set(baseState.departments || []);
    const newDepts = new Set(state.departments || []);

    newDepts.forEach((dept) => {
      if (!oldDepts.has(dept)) {
        const payload = { id: dept, name: dept };
        const safePayload = removeUndefinedDeep(payload);
        setDoc(doc(db, 'departments', dept), safePayload, { merge: true }).catch((err) => {
          logFirestoreWriteError('departments', dept, err, safePayload);
        });
      }
    });

    inMemoryAppState = {
      ...(options.replace ? state : mergeAppStates(baseState, state)),
      currentUser: getStoredCurrentUser(),
    };
    notifyListeners(inMemoryAppState);
  } catch (err) {
    console.error('Error in saveState:', err);
  }
}

export async function fetchCloudState(): Promise<AppState | null> {
  try {
    await runMigrationIfNeeded();
    await Promise.all(
      COLLECTIONS.map(async (colName) => {
        const snapshot = await getDocs(collection(db, colName));
        collectionDataMap[colName] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return { ...data, id: data.id || docSnap.id };
        });
        collectionReadyMap[colName] = true;
        collectionPendingMap[colName] = snapshot.metadata.hasPendingWrites;
        collectionFromCacheMap[colName] = snapshot.metadata.fromCache;
      })
    );
    const state = buildAppStateFromCollections();
    inMemoryAppState = state;
    notifyListeners(state);
    return state;
  } catch (err) {
    console.warn('Could not refresh cloud state:', err);
    notifySyncStatus(navigator.onLine ? 'error' : 'offline');
    return getStoredState();
  }
}

export function deleteDepartmentFromCloud(department: string): void {
  const timestamp = new Date().toISOString();
  const tombstone = { id: department, name: department, deletedAt: timestamp, updatedAt: timestamp };
  notifySyncStatus(navigator.onLine ? 'syncing' : 'offline');
  setDoc(doc(db, 'departments', department), tombstone, { merge: true }).catch((err) => {
    logFirestoreWriteError('departments', department, err, tombstone);
  });
}

export function isFirebaseConnected(): boolean {
  return currentSyncStatus === 'synced';
}

export async function forceSyncCloud(): Promise<boolean> {
  notifySyncStatus('syncing');
  try {
    await waitForPendingWrites(db);
    notifySyncStatus(navigator.onLine ? 'synced' : 'offline');
    return true;
  } catch (err) {
    console.error('Error waiting for pending writes:', err);
    notifySyncStatus(navigator.onLine ? 'error' : 'offline');
    return false;
  }
}

export function subscribeState(callback: (state: AppState) => void): () => void {
  LISTENERS.push(callback);
  return () => {
    const idx = LISTENERS.indexOf(callback);
    if (idx >= 0) LISTENERS.splice(idx, 1);
  };
}

function notifyListeners(state: AppState): void {
  LISTENERS.forEach((cb) => cb(state));
}

export function resetToInitialData(): AppState {
  saveState(INITIAL_STATE, { replace: true });
  return INITIAL_STATE;
}

export function exportDatabaseJSON(): string {
  return JSON.stringify(getStoredState(), null, 2);
}

export function importDatabaseJSON(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.buyers)) {
      saveState(parsed, { replace: true });
      return true;
    }
    return false;
  } catch (err) {
    console.error('Invalid JSON import:', err);
    return false;
  }
}

export function getSaoPauloDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getCurrentMonthKey(date = new Date()): string {
  return getSaoPauloDateKey(date).slice(0, 7);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount || 0);
}

export function formatDateBR(dateString: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return dateString;
  }
}

export function formatMonthShort(monthKey: string): string {
  if (!monthKey) return '';
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const year = parts[0];
  const month = parts[1];
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const mIndex = parseInt(month, 10) - 1;
  const shortYear = year ? year.slice(2) : '26';
  if (mIndex >= 0 && mIndex < 12) {
    return `${months[mIndex]} ${shortYear}`;
  }
  return monthKey;
}
