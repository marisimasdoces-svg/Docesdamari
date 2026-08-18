import { ProductionBatch, Sale, UtilitySettings } from '../types';

const normalizedName = (value?: string) => (value || '').trim().toLocaleLowerCase('pt-BR');

export const sameSweet = (batch: ProductionBatch, sweetId?: string, sweetName?: string) =>
  (!!batch.sweetId && !!sweetId && batch.sweetId === sweetId)
  || normalizedName(batch.sweetName) === normalizedName(sweetName);

/**
 * O histórico anterior ao marco NÃO é reconstruído. O usuário confirmou
 * fisicamente quantos potes existiam naquele momento. Daí em diante, o saldo
 * é: marco + novas produções - novas vendas. Nenhum registro antigo é alterado.
 */
export const getReadyStockOpening = (settings: UtilitySettings[] = []) => {
  const financial = settings.find((item) => item.id === 'financial-settings');
  return {
    quantity: financial?.readyStockOpening ?? 13,
    date: financial?.readyStockOpeningDate || '2026-08-18T09:55:00-03:00',
  };
};

export const getAvailableReadyStock = (
  batches: ProductionBatch[],
  sales: Sale[],
  settings: UtilitySettings[] = [],
  sweetId?: string,
  sweetName?: string,
) => {
  const opening = getReadyStockOpening(settings);
  const anchor = new Date(opening.date).getTime();
  const producedAfter = batches
    .filter((batch) => !batch.deletedAt && new Date(batch.createdAt).getTime() > anchor && (!sweetId && !sweetName || sameSweet(batch, sweetId, sweetName)))
    .reduce((sum, batch) => sum + (batch.totalProduced || 0), 0);
  const soldAfter = sales
    .filter((sale) => !sale.deletedAt && !sale.isRetroactive && new Date(sale.saleDate).getTime() > anchor && (!sweetId && !sweetName || (!!sale.sweetId && sale.sweetId === sweetId) || normalizedName(sale.sweetName) === normalizedName(sweetName)))
    .reduce((sum, sale) => sum + (sale.quantity || 0), 0);
  return Math.max(0, opening.quantity + producedAfter - soldAfter);
};

// Mantido apenas por compatibilidade com chamadas existentes. Não reescreve lotes históricos.
export const reconcileReadyStockBatches = (batches: ProductionBatch[], _sales: Sale[]) => batches;
