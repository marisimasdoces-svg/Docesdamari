import { AppState } from '../types';
import { INITIAL_STATE } from '../data/initialData';
import { APP_STATE_DOC_REF, onSnapshot, setDoc, getDoc } from './firebase';

const STORAGE_KEY = 'marisimas_doces_app_v1';
const LISTENERS: Array<(state: AppState) => void> = [];
let firebaseSyncActive = false;
let isSavingToFirebase = false;

export function getStoredState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveState(INITIAL_STATE);
      return INITIAL_STATE;
    }
    const parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch (err) {
    console.error('Error reading state from localStorage:', err);
    return INITIAL_STATE;
  }
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

function mergeWithDefaults(parsed: Partial<AppState>): AppState {
  const merged: AppState = {
    ...INITIAL_STATE,
    ...parsed,
    users: parsed?.users?.length ? parsed.users : INITIAL_STATE.users,
    departments: parsed?.departments?.length ? parsed.departments : INITIAL_STATE.departments,
    buyers: Array.isArray(parsed?.buyers) ? parsed.buyers : [],
    sweets: Array.isArray(parsed?.sweets) && parsed.sweets.length ? parsed.sweets : INITIAL_STATE.sweets,
    batches: Array.isArray(parsed?.batches) ? parsed.batches : INITIAL_STATE.batches,
    sales: Array.isArray(parsed?.sales) ? parsed.sales : [],
    payments: Array.isArray(parsed?.payments) ? parsed.payments : [],
    inventory: Array.isArray(parsed?.inventory) ? parsed.inventory : INITIAL_STATE.inventory,
    recipes: Array.isArray(parsed?.recipes) ? parsed.recipes : INITIAL_STATE.recipes,
    expenses: Array.isArray(parsed?.expenses) ? parsed.expenses : [],
  };
  return cleanFictitiousData(merged);
}

export function saveState(state: AppState, skipFirebaseSync = false): void {
  try {
    const cleaned = cleanFictitiousData(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    notifyListeners(cleaned);

    if (!skipFirebaseSync) {
      syncToFirebase(cleaned);
    }
  } catch (err) {
    console.error('Error saving state to localStorage:', err);
  }
}

async function syncToFirebase(state: AppState) {
  try {
    isSavingToFirebase = true;
    await setDoc(APP_STATE_DOC_REF, {
      ...state,
      lastUpdated: new Date().toISOString(),
    });
    firebaseSyncActive = true;
  } catch (err) {
    console.warn('Firebase Firestore save warning (offline mode fallback active):', err);
  } finally {
    isSavingToFirebase = false;
  }
}

export async function fetchCloudState(): Promise<AppState | null> {
  try {
    const docSnap = await getDoc(APP_STATE_DOC_REF);
    if (docSnap.exists()) {
      firebaseSyncActive = true;
      const remoteData = docSnap.data() as Partial<AppState>;
      if (remoteData && typeof remoteData === 'object') {
        const remoteMerged = mergeWithDefaults(remoteData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteMerged));
        notifyListeners(remoteMerged);
        return remoteMerged;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch state directly from Firestore:', err);
  }
  return null;
}

export function initFirebaseSync(onRemoteUpdate: (state: AppState) => void): () => void {
  try {
    const unsubscribe = onSnapshot(
      APP_STATE_DOC_REF,
      (docSnap) => {
        if (docSnap.exists()) {
          firebaseSyncActive = true;
          const remoteData = docSnap.data() as Partial<AppState>;
          if (remoteData && typeof remoteData === 'object') {
            const remoteMerged = mergeWithDefaults(remoteData);

            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteMerged));
            notifyListeners(remoteMerged);
            onRemoteUpdate(remoteMerged);
          }
        } else {
          // First time initialization in Firebase: push local state to cloud
          const currentState = getStoredState();
          syncToFirebase(currentState);
        }
      },
      (error) => {
        console.warn('Firestore subscription status:', error.message);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to initialize Firebase snapshot listener:', err);
    return () => {};
  }
}

export function isFirebaseConnected(): boolean {
  return firebaseSyncActive;
}

export async function forceSyncCloud(): Promise<boolean> {
  try {
    const remoteState = await fetchCloudState();
    if (remoteState) {
      return true;
    }
    const state = getStoredState();
    await syncToFirebase(state);
    return true;
  } catch (err) {
    console.error('Force sync failed:', err);
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
