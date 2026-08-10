import { AppState } from '../types';
import { INITIAL_STATE } from '../data/initialData';
import { APP_STATE_DOC_REF, db, onSnapshot, setDoc, getDoc, runTransaction } from './firebase';

const STORAGE_KEY = 'marisimas_doces_app_v1';
const LISTENERS: Array<(state: AppState) => void> = [];

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';
let currentSyncStatus: SyncStatus = navigator.onLine ? 'synced' : 'offline';
const SYNC_STATUS_LISTENERS: Array<(status: SyncStatus) => void> = [];

let isApplyingRemoteUpdate = false;
let isSavingToFirebase = false;
let isSyncPending = false;

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

// Window online/offline listener setup
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifySyncStatus('syncing');
    syncToFirebase();
  });
  window.addEventListener('offline', () => {
    notifySyncStatus('offline');
  });
}

/**
 * Extracts or infers an ISO timestamp for any entity item.
 */
function getItemTimestamp(item: any): string {
  if (!item || typeof item !== 'object') return '2026-01-01T00:00:00.000Z';
  if (item.updatedAt) return item.updatedAt;
  if (item.deletedAt) return item.deletedAt;
  if (item.createdAt) return item.createdAt;
  if (item.saleDate) return item.saleDate;
  if (item.paymentDate) return item.paymentDate;
  if (item.purchaseDate) return item.purchaseDate;
  if (item.date) return item.date;
  if (item.startDate) return item.startDate;
  return '2026-01-01T00:00:00.000Z';
}

/**
 * Merges tombstones local and remote preserving max(timestampLocal, timestampRemote) for each key.
 */
export function mergeTombstones(
  localTombstones: Record<string, string> = {},
  remoteTombstones: Record<string, string> = {}
): Record<string, string> {
  const merged: Record<string, string> = {};
  const allKeys = new Set([
    ...Object.keys(localTombstones || {}),
    ...Object.keys(remoteTombstones || {}),
  ]);

  allKeys.forEach((key) => {
    const localTs = localTombstones[key] || '';
    const remoteTs = remoteTombstones[key] || '';
    const maxTs = remoteTs > localTs ? remoteTs : localTs;
    if (maxTs) {
      merged[key] = maxTs;
    }
  });

  return merged;
}

/**
 * Merges two entity arrays using deterministic timestamp comparison and tombstone resolution.
 */
function mergeEntitiesById<T extends { id: string; updatedAt?: string; deletedAt?: string; paymentStatus?: string; isPaidImmediately?: boolean }>(
  entityType: string,
  arrLocal: T[] = [],
  arrRemote: T[] = [],
  tombstones: Record<string, string> = {}
): T[] {
  const localMap = new Map<string, T>();
  const remoteMap = new Map<string, T>();

  (arrLocal || []).forEach((item) => {
    if (item && item.id) localMap.set(item.id, item);
  });
  (arrRemote || []).forEach((item) => {
    if (item && item.id) remoteMap.set(item.id, item);
  });

  const allIds = new Set<string>([
    ...Array.from(localMap.keys()),
    ...Array.from(remoteMap.keys()),
  ]);

  const activeMerged: T[] = [];

  allIds.forEach((id) => {
    const localItem = localMap.get(id);
    const remoteItem = remoteMap.get(id);

    const localTs = localItem ? getItemTimestamp(localItem) : '';
    const remoteTs = remoteItem ? getItemTimestamp(remoteItem) : '';

    // Check tombstone with typed key first (entityType:id), fallback to raw id for legacy compatibility
    const tombstoneTs = tombstones[`${entityType}:${id}`] || tombstones[id] || '';

    // Determine candidate item with newest timestamp
    let winnerItem: T | undefined;
    let winnerTs = '';

    if (localItem && remoteItem) {
      if (remoteTs > localTs) {
        winnerItem = { ...remoteItem };
        winnerTs = remoteTs;
      } else if (localTs > remoteTs) {
        winnerItem = { ...localItem };
        winnerTs = localTs;
      } else {
        // Equal timestamps: merge fields non-destructively
        const isPaid = remoteItem.paymentStatus === 'paid' || remoteItem.isPaidImmediately || localItem.paymentStatus === 'paid' || localItem.isPaidImmediately;
        winnerItem = {
          ...localItem,
          ...remoteItem,
          paymentStatus: isPaid ? 'paid' : (remoteItem.paymentStatus || localItem.paymentStatus),
          isPaidImmediately: isPaid ? true : (remoteItem.isPaidImmediately ?? localItem.isPaidImmediately),
        };
        winnerTs = localTs || remoteTs;
      }
    } else if (localItem) {
      winnerItem = localItem;
      winnerTs = localTs;
    } else if (remoteItem) {
      winnerItem = remoteItem;
      winnerTs = remoteTs;
    }

    // Check if item was deleted via tombstone
    if (tombstoneTs && tombstoneTs >= winnerTs) {
      return; // Skip deleted item
    }

    if (winnerItem) {
      activeMerged.push({
        ...winnerItem,
        updatedAt: winnerTs || new Date().toISOString(),
      });
    }
  });

  return activeMerged;
}

function cleanFictitiousData(state: AppState): AppState {
  const cleanSales = (state.sales || []).filter(
    (s) => s.id !== 'sale-1' && s.id !== 'sale-2' && s.notes !== 'Venda presencial (1 doce)'
  );
  const cleanPayments = (state.payments || []).filter(
    (p) => p.id !== 'pay-1' && p.id !== 'pay-2' && p.notes !== 'Quitação da venda presencial'
  );
  return {
    ...state,
    sales: cleanSales,
    payments: cleanPayments,
  };
}

/**
 * Detects deleted items between old state and new state and updates the tombstones map with entity-scoped keys.
 */
function detectAndRecordTombstones(oldState: AppState, newState: AppState): Record<string, string> {
  const tombstones: Record<string, string> = mergeTombstones(
    oldState.tombstones || {},
    newState.tombstones || {}
  );

  const nowIso = new Date().toISOString();

  const checkArrayDeletions = (entityType: string, oldArr: any[] = [], newArr: any[] = []) => {
    const newSet = new Set((newArr || []).map((x) => x && x.id).filter(Boolean));
    (oldArr || []).forEach((oldItem) => {
      if (oldItem && oldItem.id && !newSet.has(oldItem.id)) {
        const key = `${entityType}:${oldItem.id}`;
        if (!tombstones[key]) {
          tombstones[key] = nowIso;
        }
      }
    });
  };

  checkArrayDeletions('sales', oldState.sales, newState.sales);
  checkArrayDeletions('buyers', oldState.buyers, newState.buyers);
  checkArrayDeletions('payments', oldState.payments, newState.payments);
  checkArrayDeletions('batches', oldState.batches, newState.batches);
  checkArrayDeletions('inventory', oldState.inventory, newState.inventory);
  checkArrayDeletions('recipes', oldState.recipes, newState.recipes);
  checkArrayDeletions('expenses', oldState.expenses, newState.expenses);
  checkArrayDeletions('sweets', oldState.sweets, newState.sweets);

  return tombstones;
}

/**
 * Ensures all entity items have an updatedAt field.
 */
function ensureItemTimestamps(state: AppState): AppState {
  const tagArray = <T extends { id: string; updatedAt?: string }>(arr: T[] = []): T[] => {
    return (arr || []).map((item) => {
      if (!item) return item;
      return {
        ...item,
        updatedAt: item.updatedAt || getItemTimestamp(item),
      };
    });
  };

  return {
    ...state,
    sales: tagArray(state.sales),
    buyers: tagArray(state.buyers),
    payments: tagArray(state.payments),
    batches: tagArray(state.batches),
    inventory: tagArray(state.inventory),
    recipes: tagArray(state.recipes),
    expenses: tagArray(state.expenses),
    sweets: tagArray(state.sweets),
  };
}

function mergeWithDefaults(parsed: Partial<AppState>, currentLocal?: Partial<AppState>): AppState {
  const mergedTombstones = mergeTombstones(
    currentLocal?.tombstones || {},
    parsed?.tombstones || {}
  );

  const mergedSales = mergeEntitiesById('sales', currentLocal?.sales || [], parsed?.sales || [], mergedTombstones);
  const mergedBuyers = mergeEntitiesById('buyers', currentLocal?.buyers || [], parsed?.buyers || [], mergedTombstones);
  const mergedPayments = mergeEntitiesById('payments', currentLocal?.payments || [], parsed?.payments || [], mergedTombstones);
  const mergedBatches = mergeEntitiesById('batches', currentLocal?.batches || [], parsed?.batches || [], mergedTombstones);
  const mergedExpenses = mergeEntitiesById('expenses', currentLocal?.expenses || [], parsed?.expenses || [], mergedTombstones);
  const mergedInventory = mergeEntitiesById('inventory', currentLocal?.inventory || [], parsed?.inventory || [], mergedTombstones);
  const mergedRecipes = mergeEntitiesById('recipes', currentLocal?.recipes || [], parsed?.recipes || [], mergedTombstones);
  const mergedSweets = mergeEntitiesById('sweets', currentLocal?.sweets || [], parsed?.sweets || [], mergedTombstones);

  const mergedDepts = Array.from(
    new Set([
      ...(INITIAL_STATE.departments || []),
      ...(parsed?.departments || []),
      ...(currentLocal?.departments || []),
    ])
  );

  // Dynamically calculate totalSold for batches based on active sales
  const batchSoldMap = new Map<string, number>();
  mergedSales.forEach((s) => {
    if (s.batchId) {
      batchSoldMap.set(s.batchId, (batchSoldMap.get(s.batchId) || 0) + (s.quantity || 1));
    }
  });

  const updatedBatches = mergedBatches.map((b) => {
    const soldFromSales = batchSoldMap.get(b.id);
    if (soldFromSales !== undefined) {
      return { ...b, totalSold: Math.max(b.totalSold || 0, soldFromSales) };
    }
    return b;
  });

  const merged: AppState = {
    ...INITIAL_STATE,
    ...currentLocal,
    ...parsed,
    users: parsed?.users?.length ? parsed.users : (currentLocal?.users?.length ? currentLocal.users : INITIAL_STATE.users),
    departments: mergedDepts,
    buyers: mergedBuyers,
    sweets: mergedSweets.length ? mergedSweets : INITIAL_STATE.sweets,
    batches: updatedBatches.length ? updatedBatches : INITIAL_STATE.batches,
    sales: mergedSales,
    payments: mergedPayments,
    inventory: mergedInventory.length ? mergedInventory : INITIAL_STATE.inventory,
    recipes: mergedRecipes.length ? mergedRecipes : INITIAL_STATE.recipes,
    expenses: mergedExpenses,
    tombstones: mergedTombstones,
    lastUpdated: new Date().toISOString(),
  };

  return cleanFictitiousData(ensureItemTimestamps(merged));
}

export function getStoredState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return ensureItemTimestamps(INITIAL_STATE);
    }
    const parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch (err) {
    console.error('Error reading state from localStorage:', err);
    return ensureItemTimestamps(INITIAL_STATE);
  }
}

export function saveState(state: AppState, skipFirebaseSync = false): void {
  try {
    const currentState = getStoredState();
    const tombstones = detectAndRecordTombstones(currentState, state);

    const stateWithTombstones: AppState = {
      ...state,
      tombstones,
      lastUpdated: new Date().toISOString(),
    };

    const cleaned = cleanFictitiousData(ensureItemTimestamps(stateWithTombstones));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    notifyListeners(cleaned);

    if (!skipFirebaseSync && !isApplyingRemoteUpdate) {
      syncToFirebase();
    }
  } catch (err) {
    console.error('Error saving state to localStorage:', err);
  }
}

function hasLocalChangesNeedingUpload(localState: Partial<AppState>, remoteState: Partial<AppState>): boolean {
  if (!localState) return false;
  if (!remoteState) return true;

  const entityKeys: (keyof AppState)[] = ['sales', 'buyers', 'payments', 'batches', 'inventory', 'recipes', 'expenses', 'sweets'];

  for (const key of entityKeys) {
    const localArr = (localState[key] as any[]) || [];
    const remoteArr = (remoteState[key] as any[]) || [];
    const remoteMap = new Map(remoteArr.map((item) => [item.id, item]));

    for (const localItem of localArr) {
      if (!localItem || !localItem.id) continue;
      const remoteItem = remoteMap.get(localItem.id);
      if (!remoteItem) {
        return true; // Local item missing in remote
      }
      const localTs = getItemTimestamp(localItem);
      const remoteTs = getItemTimestamp(remoteItem);
      if (localTs > remoteTs) {
        return true; // Local item newer than remote
      }
    }
  }

  // Check tombstones
  const localTombstones = localState.tombstones || {};
  const remoteTombstones = remoteState.tombstones || {};
  for (const k of Object.keys(localTombstones)) {
    if (!remoteTombstones[k] || localTombstones[k] > remoteTombstones[k]) {
      return true; // Local tombstone newer or missing in remote
    }
  }

  return false;
}

export async function syncToFirebase(): Promise<void> {
  if (isSavingToFirebase) {
    isSyncPending = true;
    return;
  }
  if (!navigator.onLine) {
    notifySyncStatus('offline');
    return;
  }

  try {
    isSavingToFirebase = true;
    notifySyncStatus('syncing');

    let finalState: AppState = getStoredState();

    // Use Firestore runTransaction for atomic read-merge-write
    await runTransaction(db, async (transaction) => {
      const localStateForTxn = getStoredState();
      const docSnap = await transaction.get(APP_STATE_DOC_REF);
      let remoteData: Partial<AppState> = {};
      if (docSnap.exists()) {
        remoteData = docSnap.data() as Partial<AppState>;
      }
      finalState = mergeWithDefaults(remoteData, localStateForTxn);
      transaction.set(APP_STATE_DOC_REF, finalState);
    });

    // Protect local state from race conditions if local edits happened during transaction
    const latestLocalState = getStoredState();
    const safeFinalState = mergeWithDefaults(finalState, latestLocalState);

    // Update local storage and listeners with safe merged state
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeFinalState));
    notifyListeners(safeFinalState);
    notifySyncStatus('synced');
  } catch (err) {
    console.warn('Firebase Firestore transaction sync failed (offline or error):', err);
    notifySyncStatus(navigator.onLine ? 'error' : 'offline');
  } finally {
    isSavingToFirebase = false;
    if (isSyncPending) {
      isSyncPending = false;
      // Re-trigger sync using the latest local state
      syncToFirebase();
    }
  }
}

export async function fetchCloudState(): Promise<AppState | null> {
  if (!navigator.onLine) {
    notifySyncStatus('offline');
    return getStoredState();
  }

  try {
    notifySyncStatus('syncing');
    const docSnap = await getDoc(APP_STATE_DOC_REF);
    if (docSnap.exists()) {
      const remoteData = docSnap.data() as Partial<AppState>;
      if (remoteData && typeof remoteData === 'object') {
        const localRaw = localStorage.getItem(STORAGE_KEY);
        const localParsed = localRaw ? JSON.parse(localRaw) : {};
        const remoteMerged = mergeWithDefaults(remoteData, localParsed);

        isApplyingRemoteUpdate = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteMerged));
        notifyListeners(remoteMerged);
        isApplyingRemoteUpdate = false;
        notifySyncStatus('synced');

        // ONLY push back to Firebase if local state has newer data or tombstones not yet in remote
        if (hasLocalChangesNeedingUpload(localParsed, remoteData)) {
          syncToFirebase();
        }

        return remoteMerged;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch state directly from Firestore:', err);
    notifySyncStatus('offline');
  }
  return null;
}

export function initFirebaseSync(onRemoteUpdate: (state: AppState) => void): () => void {
  try {
    const unsubscribe = onSnapshot(
      APP_STATE_DOC_REF,
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = docSnap.data() as Partial<AppState>;
          if (remoteData && typeof remoteData === 'object') {
            isApplyingRemoteUpdate = true;

            const localRaw = localStorage.getItem(STORAGE_KEY);
            const localParsed = localRaw ? JSON.parse(localRaw) : {};
            const remoteMerged = mergeWithDefaults(remoteData, localParsed);

            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteMerged));
            notifyListeners(remoteMerged);
            onRemoteUpdate(remoteMerged);
            notifySyncStatus('synced');

            isApplyingRemoteUpdate = false;
          }
        } else {
          // First time initialization in Firebase: push local state to cloud if local state has data
          const currentState = getStoredState();
          if (currentState.sales.length > 0 || currentState.buyers.length > 0) {
            syncToFirebase();
          }
        }
      },
      (error) => {
        console.warn('Firestore subscription status:', error.message);
        notifySyncStatus(navigator.onLine ? 'error' : 'offline');
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to initialize Firebase snapshot listener:', err);
    notifySyncStatus('offline');
    return () => {};
  }
}

export function isFirebaseConnected(): boolean {
  return currentSyncStatus === 'synced';
}

export async function forceSyncCloud(): Promise<boolean> {
  try {
    notifySyncStatus('syncing');
    await syncToFirebase();
    return true;
  } catch (err) {
    console.error('Force sync failed:', err);
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
  saveState(INITIAL_STATE);
  return INITIAL_STATE;
}

export function exportDatabaseJSON(): string {
  const currentState = getStoredState();
  return JSON.stringify(currentState, null, 2);
}

export function importDatabaseJSON(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.buyers)) {
      saveState(parsed);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Invalid JSON import:', err);
    return false;
  }
}

export function getCurrentMonthKey(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
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
    return d.toLocaleDateString('pt-BR');
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
