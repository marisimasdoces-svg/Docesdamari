import { AppState } from '../types';

export const isActiveRecord = <T extends { deletedAt?: string }>(
  item: T | null | undefined
): item is T => Boolean(item && !item.deletedAt);

export function stripDeletedRecords(state: AppState): AppState {
  return {
    ...state,
    buyers: (state.buyers || []).filter(isActiveRecord),
    sweets: (state.sweets || []).filter(isActiveRecord),
    batches: (state.batches || []).filter(isActiveRecord),
    sales: (state.sales || []).filter(isActiveRecord),
    payments: (state.payments || []).filter(isActiveRecord),
    inventory: (state.inventory || []).filter(isActiveRecord),
    recipes: (state.recipes || []).filter(isActiveRecord),
    expenses: (state.expenses || []).filter(isActiveRecord),
    utilitySettings: (state.utilitySettings || []).filter(isActiveRecord),
  };
}

export function recordTimestamp(item: Record<string, unknown> | null | undefined): number {
  if (!item) return 0;
  const candidates = [
    item.deletedAt,
    item.updatedAt,
    item.createdAt,
    item.paymentDate,
    item.saleDate,
    item.purchaseDate,
    item.date,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const parsed = new Date(candidate).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function chooseNewest<T extends { id: string; deletedAt?: string }>(remote: T, local: T): T {
  const remoteTime = recordTimestamp(remote as Record<string, unknown>);
  const localTime = recordTimestamp(local as Record<string, unknown>);

  // A deletion marker wins over a stale copy from an offline device.
  if (remote.deletedAt && !local.deletedAt && remoteTime >= localTime) return remote;
  if (local.deletedAt && !remote.deletedAt && localTime >= remoteTime) return local;
  if (remoteTime > localTime) return remote;
  return local;
}

function mergeEntityArrays<T extends { id: string; deletedAt?: string }>(
  remoteItems: T[] = [],
  localItems: T[] = []
): T[] {
  const merged = new Map<string, T>();
  remoteItems.forEach((item) => item?.id && merged.set(item.id, item));
  localItems.forEach((item) => {
    if (!item?.id) return;
    const remote = merged.get(item.id);
    merged.set(item.id, remote ? chooseNewest(remote, item) : item);
  });
  return Array.from(merged.values());
}

/**
 * Preserves records created on another device and keeps deletion markers.
 * The interface receives stripDeletedRecords(state); the sync engine keeps the
 * raw result so an offline device cannot accidentally resurrect deleted data.
 */
export function mergeAppStates(remoteState: AppState, localState: AppState): AppState {
  return {
    ...remoteState,
    ...localState,
    currentUser: localState.currentUser || remoteState.currentUser,
    users: localState.users?.length ? localState.users : remoteState.users,
    departments: Array.from(new Set([...(remoteState.departments || []), ...(localState.departments || [])])),
    buyers: mergeEntityArrays(remoteState.buyers, localState.buyers),
    sweets: mergeEntityArrays(remoteState.sweets, localState.sweets),
    batches: mergeEntityArrays(remoteState.batches, localState.batches),
    sales: mergeEntityArrays(remoteState.sales, localState.sales),
    payments: mergeEntityArrays(remoteState.payments, localState.payments),
    inventory: mergeEntityArrays(remoteState.inventory, localState.inventory),
    recipes: mergeEntityArrays(remoteState.recipes, localState.recipes),
    expenses: mergeEntityArrays(remoteState.expenses, localState.expenses),
    utilitySettings: mergeEntityArrays(remoteState.utilitySettings, localState.utilitySettings),
  };
}
