import { ProductionBatch, UtilitySettings } from '../types';

/**
 * Estoque físico de potes prontos.
 * Fonte única de verdade a partir de 18/08/2026.
 */
export const READY_STOCK_CURRENT_DEFAULT = 0;
export const READY_STOCK_LEDGER_VERSION = '2026-08-18-v3-persist';
export const READY_STOCK_BASELINE_DATE = '2026-08-18';
export const READY_STOCK_BASELINE_SOLD = 13;

export const saoPauloDateKey = (date: Date | string = new Date()) => {
  const parsed = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
};

export const getFinancialSettings = (settings: UtilitySettings[] = []) =>
  settings.find((item) => item.id === 'financial-settings');

export const getAvailableReadyStock = (
  _batches: unknown[] = [],
  _sales: unknown[] = [],
  settings: UtilitySettings[] = [],
  _sweetId?: string,
  _sweetName?: string,
) => {
  const financial = getFinancialSettings(settings);
  return Math.max(0, financial?.readyStockCurrent ?? READY_STOCK_CURRENT_DEFAULT);
};

export const getReadyStockSoldToday = (
  settings: UtilitySettings[] = [],
  now: Date | string = new Date(),
) => {
  const financial = getFinancialSettings(settings);
  const todayKey = saoPauloDateKey(now);
  if (!financial || financial.readyStockSoldTodayDate !== todayKey) return 0;
  return Math.max(0, financial.readyStockSoldTodayQuantity ?? 0);
};

export const applyReadyStockDelta = (
  settings: UtilitySettings[] = [],
  delta: number,
  nowIso = new Date().toISOString(),
  soldDelta = 0,
) => {
  const previous = getFinancialSettings(settings);
  const current = Math.max(0, previous?.readyStockCurrent ?? READY_STOCK_CURRENT_DEFAULT);
  const next = Math.max(0, current + delta);
  const todayKey = saoPauloDateKey(nowIso);
  const previousSoldToday = previous?.readyStockSoldTodayDate === todayKey
    ? Math.max(0, previous?.readyStockSoldTodayQuantity ?? 0)
    : 0;
  const nextSoldToday = Math.max(0, previousSoldToday + soldDelta);

  const financial: UtilitySettings = {
    id: 'financial-settings',
    referenceMonth: 'financial',
    gasCylinderPrice: 0,
    electricityBill: 0,
    electricityKwh: 0,
    waterBill: 0,
    productionCycles: 0,
    ...(previous || {}),
    readyStockOpening: previous?.readyStockOpening ?? READY_STOCK_CURRENT_DEFAULT,
    readyStockOpeningDate: previous?.readyStockOpeningDate || nowIso,
    readyStockCurrent: next,
    readyStockCurrentUpdatedAt: nowIso,
    readyStockSoldTodayDate: todayKey,
    readyStockSoldTodayQuantity: nextSoldToday,
    readyStockLedgerVersion: READY_STOCK_LEDGER_VERSION,
    updatedAt: nowIso,
  };

  return previous
    ? settings.map((item) => item.id === 'financial-settings' ? financial : item)
    : [financial, ...settings];
};

/**
 * Marco físico confirmado em 18/08/2026:
 * 13 potes disponíveis no início do dia, 13 vendidos, 0 restantes.
 * Não altera vendas, clientes, pagamentos ou lotes históricos.
 */
export const ensureReadyStockLedgerBaseline = (
  settings: UtilitySettings[] = [],
  nowIso = new Date().toISOString(),
) => {
  const previous = getFinancialSettings(settings);
  if (previous?.readyStockLedgerVersion === READY_STOCK_LEDGER_VERSION) return settings;

  const financial: UtilitySettings = {
    id: 'financial-settings',
    referenceMonth: 'financial',
    gasCylinderPrice: 0,
    electricityBill: 0,
    electricityKwh: 0,
    waterBill: 0,
    productionCycles: 0,
    ...(previous || {}),
    readyStockOpening: previous?.readyStockOpening ?? 13,
    readyStockOpeningDate: previous?.readyStockOpeningDate || nowIso,
    readyStockCurrent: 0,
    readyStockCurrentUpdatedAt: nowIso,
    readyStockSoldTodayDate: READY_STOCK_BASELINE_DATE,
    readyStockSoldTodayQuantity: READY_STOCK_BASELINE_SOLD,
    readyStockLedgerVersion: READY_STOCK_LEDGER_VERSION,
    updatedAt: nowIso,
  };

  return previous
    ? settings.map((item) => item.id === 'financial-settings' ? financial : item)
    : [financial, ...settings];
};

export const setReadyStockCurrent = (
  settings: UtilitySettings[] = [],
  quantity: number,
  nowIso = new Date().toISOString(),
) => {
  const current = getAvailableReadyStock([], [], settings);
  return applyReadyStockDelta(settings, Math.max(0, quantity) - current, nowIso);
};

export const addSaleDailyMovement = (
  movements: Record<string, number> | undefined,
  nowIso: string,
  delta: number,
) => {
  const key = saoPauloDateKey(nowIso);
  if (!key || delta === 0) return movements || {};
  return {
    ...(movements || {}),
    [key]: (movements?.[key] || 0) + delta,
  };
};

export const reconcileReadyStockBatches = (batches: ProductionBatch[], _sales: unknown[]) => batches;
