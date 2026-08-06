import { AppState } from '../types';
import { INITIAL_STATE } from '../data/initialData';

const STORAGE_KEY = 'marisimas_doces_app_v1';
const LISTENERS: Array<(state: AppState) => void> = [];

export function getStoredState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveState(INITIAL_STATE);
      return INITIAL_STATE;
    }
    const parsed = JSON.parse(raw);
    // Ensure all required fields exist
    return {
      ...INITIAL_STATE,
      ...parsed,
      users: parsed.users?.length ? parsed.users : INITIAL_STATE.users,
      departments: parsed.departments?.length ? parsed.departments : INITIAL_STATE.departments,
      buyers: parsed.buyers || INITIAL_STATE.buyers,
      sweets: parsed.sweets || INITIAL_STATE.sweets,
      batches: parsed.batches || INITIAL_STATE.batches,
      sales: parsed.sales || INITIAL_STATE.sales,
      payments: parsed.payments || INITIAL_STATE.payments,
      inventory: parsed.inventory || INITIAL_STATE.inventory,
      recipes: parsed.recipes || INITIAL_STATE.recipes,
      expenses: parsed.expenses || INITIAL_STATE.expenses,
    };
  } catch (err) {
    console.error('Error reading state from localStorage:', err);
    return INITIAL_STATE;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notifyListeners(state);
  } catch (err) {
    console.error('Error saving state to localStorage:', err);
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
