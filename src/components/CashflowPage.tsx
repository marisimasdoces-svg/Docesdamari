import React, { useState } from 'react';
import { AppState, Sale, User } from '../types';
import { formatCurrency, formatMonthShort } from '../lib/storage';
import { BarChart3, Calendar, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

interface CashflowPageProps {
  state: AppState;
  onStateChange: (newState: AppState) => void;
  selectedMonth: string;
  currentUser: User;
}

const saleCost = (state: AppState, sale: Sale) => {
  if (typeof sale.estimatedUnitCost === 'number' && sale.estimatedUnitCost >= 0) {
    return sale.quantity * sale.estimatedUnitCost;
  }
  const batch = state.batches.find((item) => item.id === sale.batchId);
  if (typeof batch?.unitCost === 'number' && batch.unitCost >= 0) {
    return sale.quantity * batch.unitCost;
  }
  const recipe = state.recipes.find(
    (item) => item.sweetId === sale.sweetId || item.sweetName.toLowerCase() === sale.sweetName.toLowerCase()
  );
  return sale.quantity * (recipe?.calculatedUnitCost || 0);
};

const receivedFromSales = (sales: Sale[]) => sales
  .filter((sale) => sale.isPaidImmediately)
  .reduce((total, sale) => total + sale.totalPrice, 0);

export const CashflowPage: React.FC<CashflowPageProps> = ({ state, selectedMonth: initialMonth }) => {
  const [currentMonthKey, setCurrentMonthKey] = useState(initialMonth || '2026-08');

  React.useEffect(() => {
    if (initialMonth) setCurrentMonthKey(initialMonth);
  }, [initialMonth]);

  const monthOptions = React.useMemo(() => {
    const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return Array.from({ length: 60 }, (_, index) => {
      const year = 2026 + Math.floor(index / 12);
      const month = (index % 12) + 1;
      const mm = String(month).padStart(2, '0');
      return { key: `${year}-${mm}`, label: `${names[month - 1]} / ${year}` };
    });
  }, []);

  const selectedYear = currentMonthKey.slice(0, 4);
  const yearSales = state.sales.filter((sale) => sale.monthKey.startsWith(selectedYear));
  const yearPayments = state.payments.filter((payment) => payment.monthKey.startsWith(selectedYear));
  const yearPurchases = state.expenses.filter((expense) => expense.monthKey.startsWith(selectedYear));
  const yearBatches = state.batches.filter((batch) => (batch.createdAt || batch.startDate).startsWith(selectedYear));

  const yearRevenue = yearSales.reduce((total, sale) => total + sale.totalPrice, 0);
  const yearReceived = receivedFromSales(yearSales) + yearPayments.reduce((total, payment) => total + payment.amountPaid, 0);
  const yearPending = yearSales.filter((sale) => sale.paymentStatus === 'pending').reduce((total, sale) => total + sale.totalPrice, 0);
  const yearStockPurchases = yearPurchases.reduce((total, expense) => total + expense.totalCost, 0);
  const yearSoldCost = yearSales.reduce((total, sale) => total + saleCost(state, sale), 0);
  const yearRecordedProductionCost = yearBatches.reduce((total, batch) => total + (batch.productionCost || 0), 0);
  const yearLegacyProductionCost = yearBatches.reduce((total, batch) => {
    if (typeof batch.productionCost === 'number') return total;
    const recipe = state.recipes.find((item) => item.id === batch.recipeId || item.sweetId === batch.sweetId || item.sweetName.toLowerCase() === batch.sweetName.toLowerCase());
    return total + batch.totalProduced * (recipe?.calculatedUnitCost || 0);
  }, 0);
  const yearProductionCost = yearRecordedProductionCost + yearLegacyProductionCost;
  const yearExpectedProfit = yearRevenue - yearSoldCost;

  // Nova lógica de caixa:
  // O dinheiro que permanece na conta do negócio é tratado como lucro acumulado disponível.
  // Compras de estoque são saídas de caixa, mas o que ainda existe no depósito continua sendo patrimônio.
  const allReceived = receivedFromSales(state.sales) + state.payments.reduce((total, payment) => total + payment.amountPaid, 0);
  const allStockPurchases = state.expenses.reduce((total, expense) => total + expense.totalCost, 0);
  const accumulatedAvailableProfit = allReceived - allStockPurchases;

  const inventoryValue = state.inventory.reduce((total, item) => {
    const unitCost = item.totalQuantityBought > 0 ? item.totalCostPaid / item.totalQuantityBought : item.unitCost;
    return total + item.remainingQuantity * unitCost;
  }, 0);

  const businessPatrimony = accumulatedAvailableProfit + inventoryValue;

  const monthSales = state.sales.filter((sale) => sale.monthKey === currentMonthKey);
  const monthPayments = state.payments.filter((payment) => payment.monthKey === currentMonthKey);
  const monthPurchases = state.expenses.filter((expense) => expense.monthKey === currentMonthKey);
  const monthBatches = state.batches.filter((batch) => (batch.createdAt || batch.startDate).startsWith(currentMonthKey));
  const monthRevenue = monthSales.reduce((total, sale) => total + sale.totalPrice, 0);
  const monthReceived = receivedFromSales(monthSales) + monthPayments.reduce((total, payment) => total + payment.amountPaid, 0);
  const monthPending = monthSales.filter((sale) => sale.paymentStatus === 'pending').reduce((total, sale) => total + sale.totalPrice, 0);
  const monthStockPurchases = monthPurchases.reduce((total, expense) => total + expense.totalCost, 0);
  const monthSoldCost = monthSales.reduce((total, sale) => total + saleCost(state, sale), 0);
  const monthExpectedProfit = monthRevenue - monthSoldCost;
  const monthCashMovement = monthReceived - monthStockPurchases;
  const monthProducedUnits = monthBatches.reduce((total, batch) => total + batch.totalProduced, 0);
  const monthSoldUnits = monthSales.reduce((total, sale) => total + sale.quantity, 0);

  const weekLabels = ['1–7', '8–14', '15–21', '22–28', '29–31'];
  const weeklyChart = weekLabels.map((label, index) => {
    const sales = monthSales.filter((sale) => {
      const day = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit' }).format(new Date(sale.saleDate)));
      return Math.min(4, Math.floor((Math.max(1, day) - 1) / 7)) === index;
    });
    const faturamento = sales.reduce((total, sale) => total + sale.totalPrice, 0);
    const recebido = receivedFromSales(sales) + monthPayments.filter((payment) => {
      const day = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit' }).format(new Date(payment.paymentDate)));
      return Math.min(4, Math.floor((Math.max(1, day) - 1) / 7)) === index;
    }).reduce((total, payment) => total + payment.amountPaid, 0);
    return { label, faturamento, recebido };
  });
  const graphMaximum = Math.max(1, ...weeklyChart.flatMap((week) => [week.faturamento, week.recebido]));

  const moveMonth = (offset: number) => {
    const index = monthOptions.findIndex((month) => month.key === currentMonthKey);
    const next = monthOptions[index + offset];
    if (next) setCurrentMonthKey(next.key);
  };

  const yearCards = [
    ['Faturamento', yearRevenue, 'Tudo que foi vendido no ano, pago ou pendente', 'indigo'],
    ['Total recebido', yearReceived, 'Dinheiro que realmente entrou no ano', 'emerald'],
    ['Total a receber', yearPending, 'Fiados do ano que ainda estão pendentes', 'amber'],
    ['Compras para o estoque', yearStockPurchases, 'Valor pago em ingredientes e embalagens no ano', 'rose'],
    ['Custo da produção', yearProductionCost, 'Custo dos lotes produzidos no ano', 'orange'],
    ['Lucro previsto nas vendas', yearExpectedProfit, 'Faturamento menos custo dos potes vendidos', 'purple'],
    ['Lucro acumulado disponível', accumulatedAvailableProfit, 'Dinheiro acumulado na conta após as compras de estoque registradas', 'slate'],
    ['Patrimônio do negócio', businessPatrimony, 'Lucro disponível + valor atual estimado do estoque', 'teal'],
  ] as const;

  const monthCards = [
    ['Faturamento', monthRevenue, `${monthSoldUnits} potes em ${monthSales.length} pedidos`, 'indigo'],
    ['Total recebido', monthReceived, 'Dinheiro que já entrou no mês', 'emerald'],
    ['Total a receber', monthPending, 'Saldo de vendas pendentes', 'amber'],
    ['Custo vendido', monthSoldCost, 'Custo dos potes que foram vendidos', 'rose'],
    ['Lucro previsto', monthExpectedProfit, 'Faturamento menos custo dos potes vendidos', 'purple'],
    ['Compras de estoque', monthStockPurchases, 'Dinheiro gasto para abastecer o Depósito', 'orange'],
    ['Movimento líquido do mês', monthCashMovement, 'Recebido no mês menos compras de estoque do mês', 'slate'],
    ['Produção', monthProducedUnits, 'Quantidade de potes produzidos no mês', 'teal'],
  ] as const;

  const cardClass: Record<string, string> = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900', emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900', rose: 'bg-rose-50 border-rose-200 text-rose-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900', teal: 'bg-teal-50 border-teal-200 text-teal-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900', slate: 'bg-slate-50 border-slate-200 text-slate-900',
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8 pb-24 overflow-x-hidden">
      <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-indigo-800 font-extrabold text-lg"><TrendingUp className="w-5 h-5" /> Caixa anual — {selectedYear}</div>
          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-3 py-1 rounded-full">Caixa e patrimônio separados</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {yearCards.map(([label, value, help, tone]) => (
            <div key={label} className={`border p-4 rounded-2xl space-y-1 ${cardClass[tone]}`}>
              <div className="text-[10px] font-black uppercase tracking-wider">{label}</div>
              <div className="text-2xl font-black font-mono">{formatCurrency(value)}</div>
              <p className="text-[10px] opacity-80 font-medium">{help}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
          <strong>Leitura do patrimônio:</strong> o dinheiro que permanece na conta aparece como <strong>lucro acumulado disponível</strong>.
          O que ainda existe no Depósito continua sendo patrimônio e aparece somado apenas no card <strong>Patrimônio do negócio</strong>.
        </div>
      </section>

      <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div><span className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase"><Calendar className="w-4 h-4" /> Visão mensal</span><h3 className="text-2xl font-black text-slate-900 mt-1">Caixa de {formatMonthShort(currentMonthKey)}</h3></div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl">
            <button type="button" onClick={() => moveMonth(-1)} className="p-2 hover:bg-white rounded-xl"><ChevronLeft className="w-4 h-4" /></button>
            <select value={currentMonthKey} onChange={(event) => setCurrentMonthKey(event.target.value)} className="bg-transparent font-black text-sm text-purple-900 px-2 py-1 focus:outline-none">
              {monthOptions.map((month) => <option key={month.key} value={month.key}>{month.label}</option>)}
            </select>
            <button type="button" onClick={() => moveMonth(1)} className="p-2 hover:bg-white rounded-xl"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {monthCards.map(([label, value, help, tone]) => (
            <div key={label} className={`border p-4 rounded-2xl space-y-1 ${cardClass[tone]}`}>
              <div className="text-[10px] font-black uppercase tracking-wider">{label}</div>
              <div className="text-2xl font-black font-mono">{label === 'Produção' ? `${value} potes` : formatCurrency(value)}</div>
              <p className="text-[10px] opacity-80 font-medium">{help}</p>
            </div>
          ))}
        </div>

        <div className="cash-chart-card">
          <div className="cash-chart-card__heading">
            <div><span><BarChart3 className="w-4 h-4" /> Movimentação financeira</span><h4>Vendido e recebido por semana</h4></div>
            <div className="cash-chart-legend"><span><i className="cash-chart-dot cash-chart-dot--revenue" /> Vendido</span><span><i className="cash-chart-dot cash-chart-dot--profit" /> Recebido</span></div>
          </div>
          <div className="cash-chart" role="img" aria-label="Gráfico semanal dos valores vendidos e recebidos">
            {weeklyChart.map((week) => (
              <div className="cash-chart-week" key={week.label}>
                <div className="cash-chart-values"><span>{week.faturamento ? formatCurrency(week.faturamento) : '—'}</span><span>{week.recebido ? formatCurrency(week.recebido) : '—'}</span></div>
                <div className="cash-chart-bars">
                  <span className="cash-chart-bar cash-chart-bar--revenue" style={{ height: week.faturamento ? `${(week.faturamento / graphMaximum) * 100}%` : '0' }} title={`Vendido: ${formatCurrency(week.faturamento)}`} />
                  <span className="cash-chart-bar cash-chart-bar--profit" style={{ height: week.recebido ? `${(week.recebido / graphMaximum) * 100}%` : '0' }} title={`Recebido: ${formatCurrency(week.recebido)}`} />
                </div>
                <strong>{week.label}</strong>
              </div>
            ))}
          </div>
          <p className="cash-chart-caption">Cada grupo representa os dias do mês. Roxo = vendido; verde = dinheiro recebido.</p>
        </div>
      </section>
    </div>
  );
};
