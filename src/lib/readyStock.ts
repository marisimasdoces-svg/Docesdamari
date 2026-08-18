import { ProductionBatch, UtilitySettings } from '../types';

/**
 * Estoque físico de potes prontos.
 *
 * A partir desta versão NÃO tentamos mais reconstruir o saldo usando lotes e
 * vendas antigas. O histórico do app passou por várias versões e não é uma
 * fonte segura para determinar o que existe fisicamente no mostruário hoje.
 *
 * O usuário confirmou em 18/08/2026 que o saldo físico correto neste marco é
 * 5 potes. Daqui em diante este contador é persistido e movimentado somente
 * por eventos novos: produção (+), venda (-), edição (+/- diferença) e
 * exclusão de venda (+ devolução).
 */
export const READY_STOCK_CURRENT_DEFAULT = 5;

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

/** Aplica uma movimentação ao saldo físico e devolve a lista de configurações atualizada. */
export const applyReadyStockDelta = (
  settings: UtilitySettings[] = [],
  delta: number,
  nowIso = new Date().toISOString(),
) => {
  const previous = getFinancialSettings(settings);
  const current = Math.max(0, previous?.readyStockCurrent ?? READY_STOCK_CURRENT_DEFAULT);
  const next = Math.max(0, current + delta);

  const financial: UtilitySettings = {
    id: 'financial-settings',
    referenceMonth: 'financial',
    gasCylinderPrice: 0,
    electricityBill: 0,
    electricityKwh: 0,
    waterBill: 0,
    productionCycles: 0,
    ...(previous || {}),
    // Mantemos os campos antigos apenas por compatibilidade. Eles não entram
    // mais no cálculo do estoque físico atual.
    readyStockOpening: previous?.readyStockOpening ?? READY_STOCK_CURRENT_DEFAULT,
    readyStockOpeningDate: previous?.readyStockOpeningDate || nowIso,
    readyStockCurrent: next,
    readyStockCurrentUpdatedAt: nowIso,
    updatedAt: nowIso,
  };

  return previous
    ? settings.map((item) => item.id === 'financial-settings' ? financial : item)
    : [financial, ...settings];
};

/** Define explicitamente o saldo físico, sem tocar em vendas ou produções históricas. */
export const setReadyStockCurrent = (
  settings: UtilitySettings[] = [],
  quantity: number,
  nowIso = new Date().toISOString(),
) => {
  const current = getAvailableReadyStock([], [], settings);
  return applyReadyStockDelta(settings, Math.max(0, quantity) - current, nowIso);
};

// Compatibilidade com imports das versões anteriores. Não reescreve lotes.
export const reconcileReadyStockBatches = (batches: ProductionBatch[], _sales: unknown[]) => batches;
