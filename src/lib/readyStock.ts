import { ProductionBatch, Sale } from '../types';

const normalizedName = (value?: string) => (value || '').trim().toLocaleLowerCase('pt-BR');

const sameSweet = (batch: ProductionBatch, sale: Sale) =>
  (!!batch.sweetId && !!sale.sweetId && batch.sweetId === sale.sweetId)
  || normalizedName(batch.sweetName) === normalizedName(sale.sweetName);

/**
 * Reconstrói o total vendido dos lotes usando as vendas reais já registradas.
 * Isso corrige lotes legados cujo totalSold ficou zerado/defasado sem alterar
 * ou apagar nenhuma venda existente.
 */
export const reconcileReadyStockBatches = (batches: ProductionBatch[], sales: Sale[]): ProductionBatch[] => {
  const activeBatches = batches.filter((batch) => !batch.deletedAt);
  const soldByBatch = new Map<string, number>();
  const batchById = new Map(activeBatches.map((batch) => [batch.id, batch]));

  const addSold = (batchId: string, requested: number) => {
    const batch = batchById.get(batchId);
    if (!batch || requested <= 0) return 0;
    const already = soldByBatch.get(batchId) || 0;
    const capacity = Math.max(0, (batch.totalProduced || 0) - already);
    const applied = Math.min(capacity, requested);
    if (applied > 0) soldByBatch.set(batchId, already + applied);
    return applied;
  };

  const orderedSales = [...sales]
    .filter((sale) => !sale.deletedAt && !sale.isRetroactive && sale.quantity > 0)
    .sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime());

  for (const sale of orderedSales) {
    let remaining = sale.quantity;

    // Vendas novas podem guardar a divisão exata entre lotes.
    if (sale.batchAllocations?.length) {
      for (const allocation of sale.batchAllocations) {
        if (remaining <= 0) break;
        const applied = addSold(allocation.batchId, Math.min(allocation.quantity, remaining));
        remaining -= applied;
      }
    }

    // Compatibilidade com vendas antigas que guardavam apenas batchId.
    if (remaining > 0 && sale.batchId && batchById.has(sale.batchId)) {
      remaining -= addSold(sale.batchId, remaining);
    }

    // Compatibilidade máxima: vendas legadas sem lote confiável são abatidas
    // dos lotes do mesmo doce em ordem de produção (FIFO).
    if (remaining > 0) {
      const candidates = activeBatches
        .filter((batch) => batch.status === 'active' && sameSweet(batch, sale))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      for (const batch of candidates) {
        if (remaining <= 0) break;
        remaining -= addSold(batch.id, remaining);
      }
    }
  }

  return batches.map((batch) => {
    if (batch.deletedAt) return batch;
    const reconciledSold = soldByBatch.get(batch.id) || 0;
    return { ...batch, totalSold: Math.min(batch.totalProduced || 0, reconciledSold) };
  });
};

export const getAvailableReadyStock = (batches: ProductionBatch[], sales: Sale[]) =>
  reconcileReadyStockBatches(batches, sales)
    .filter((batch) => batch.status === 'active' && !batch.deletedAt)
    .reduce((total, batch) => total + Math.max(0, (batch.totalProduced || 0) - (batch.totalSold || 0)), 0);
