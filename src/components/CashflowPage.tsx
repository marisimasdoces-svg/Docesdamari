import React, { useState } from 'react';
import { AppState, Sale, UtilitySettings, User } from '../types';
import { formatCurrency, formatMonthShort } from '../lib/storage';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Landmark, Save, Settings2, TrendingUp } from 'lucide-react';

interface CashflowPageProps {
  state: AppState;
  onStateChange: (newState: AppState) => void;
  selectedMonth: string;
  currentUser: User;
}

const expenseMonthKey = (expense: { date?: string; monthKey?: string }) => {
  if (expense.date) {
    const parsed = new Date(expense.date);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(parsed);
    }
  }
  return expense.monthKey || '';
};

const saleCost = (state: AppState, sale: Sale) => {
  if (typeof sale.estimatedUnitCost === 'number' && sale.estimatedUnitCost >= 0) return sale.quantity * sale.estimatedUnitCost;
  const allocations = sale.batchAllocations?.length ? sale.batchAllocations : [{ batchId: sale.batchId, quantity: sale.quantity }];
  const allocationCost = allocations.reduce((sum, allocation) => {
    const batch = state.batches.find((item) => item.id === allocation.batchId);
    return sum + allocation.quantity * (batch?.unitCost || 0);
  }, 0);
  if (allocationCost > 0) return allocationCost;
  const batch = state.batches.find((item) => item.id === sale.batchId);
  if (typeof batch?.unitCost === 'number' && batch.unitCost >= 0) return sale.quantity * batch.unitCost;
  const recipe = state.recipes.find((item) => item.sweetId === sale.sweetId || item.sweetName.toLowerCase() === sale.sweetName.toLowerCase());
  return sale.quantity * (recipe?.calculatedUnitCost || 0);
};

const receivedFromSales = (sales: Sale[]) => sales.filter((sale) => sale.isPaidImmediately).reduce((total, sale) => total + sale.totalPrice, 0);
const parseMoney = (value: string) => Number(value.replace(/\./g, '').replace(',', '.')) || 0;

export const CashflowPage: React.FC<CashflowPageProps> = ({ state, onStateChange, selectedMonth: initialMonth }) => {
  const [currentMonthKey, setCurrentMonthKey] = useState(initialMonth || '2026-08');
  const [showDetails, setShowDetails] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const financialSettings = state.utilitySettings?.find((item) => item.id === 'financial-settings');
  const [openingBalanceStr, setOpeningBalanceStr] = useState(String(financialSettings?.openingBalance ?? '').replace('.', ','));
  const [pixKey, setPixKey] = useState(financialSettings?.pixKey || 'mdamerso@hotmail.com');
  const [pixRecipientName, setPixRecipientName] = useState(financialSettings?.pixRecipientName || 'Mariane Simas');
  const [pixCity, setPixCity] = useState(financialSettings?.pixCity || 'SANTANA LIVRAM');
  const [historyMonth, setHistoryMonth] = useState('2026-01');
  const [historyRevenueStr, setHistoryRevenueStr] = useState('');
  const [historyCostStr, setHistoryCostStr] = useState('');

  React.useEffect(() => { if (initialMonth) setCurrentMonthKey(initialMonth); }, [initialMonth]);

  const monthOptions = React.useMemo(() => {
    const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return Array.from({ length: 60 }, (_, index) => {
      const year = 2026 + Math.floor(index / 12); const month = (index % 12) + 1; const mm = String(month).padStart(2, '0');
      return { key: `${year}-${mm}`, label: `${names[month - 1]} / ${year}` };
    });
  }, []);

  const selectedYear = currentMonthKey.slice(0, 4);
  const monthSales = state.sales.filter((sale) => sale.monthKey === currentMonthKey);
  const monthPayments = state.payments.filter((payment) => payment.monthKey === currentMonthKey);
  const monthPurchases = state.expenses.filter((expense) => expenseMonthKey(expense) === currentMonthKey);
  const monthRevenue = monthSales.reduce((total, sale) => total + sale.totalPrice, 0);
  const monthReceived = receivedFromSales(monthSales) + monthPayments.reduce((total, payment) => total + payment.amountPaid, 0);
  const monthPending = monthSales.filter((sale) => sale.paymentStatus === 'pending').reduce((total, sale) => total + sale.totalPrice, 0);
  const monthPurchasesTotal = monthPurchases.reduce((total, expense) => total + expense.totalCost, 0);
  const monthSoldCost = monthSales.reduce((total, sale) => total + saleCost(state, sale), 0);
  const monthProfit = monthRevenue - monthSoldCost;

  const yearSales = state.sales.filter((sale) => sale.monthKey.startsWith(selectedYear));
  const yearPayments = state.payments.filter((payment) => payment.monthKey.startsWith(selectedYear));
  const yearPurchases = state.expenses.filter((expense) => expenseMonthKey(expense).startsWith(selectedYear));
  const actualRevenueByMonth = new Map<string, number>();
  yearSales.forEach((sale) => actualRevenueByMonth.set(sale.monthKey, (actualRevenueByMonth.get(sale.monthKey) || 0) + sale.totalPrice));
  const historicalRows = (state.utilitySettings || []).filter((item) => item.referenceMonth?.startsWith(selectedYear) && typeof item.historicalRevenue === 'number');
  const historicalRevenue = historicalRows.reduce((sum, row) => actualRevenueByMonth.has(row.referenceMonth) ? sum : sum + (row.historicalRevenue || 0), 0);
  const historicalKnownProfit = historicalRows.reduce((sum, row) => {
    if (actualRevenueByMonth.has(row.referenceMonth) || typeof row.historicalEstimatedCost !== 'number') return sum;
    return sum + (row.historicalRevenue || 0) - row.historicalEstimatedCost;
  }, 0);
  const yearRevenue = yearSales.reduce((total, sale) => total + sale.totalPrice, 0) + historicalRevenue;
  const yearReceived = receivedFromSales(yearSales) + yearPayments.reduce((total, payment) => total + payment.amountPaid, 0);
  const yearPending = yearSales.filter((sale) => sale.paymentStatus === 'pending').reduce((total, sale) => total + sale.totalPrice, 0);
  const yearPurchasesTotal = yearPurchases.reduce((total, expense) => total + expense.totalCost, 0);
  const yearSoldCost = yearSales.reduce((total, sale) => total + saleCost(state, sale), 0);
  const yearKnownProfit = yearSales.reduce((total, sale) => total + sale.totalPrice, 0) - yearSoldCost + historicalKnownProfit;

  const openingBalance = financialSettings?.openingBalance || 0;
  const openingDate = financialSettings?.openingDate ? new Date(financialSettings.openingDate).getTime() : null;
  const postAnchorImmediate = openingDate ? state.sales.filter((sale) => sale.isPaidImmediately && new Date(sale.saleDate).getTime() > openingDate).reduce((sum, sale) => sum + sale.totalPrice, 0) : 0;
  const postAnchorPayments = openingDate ? state.payments.filter((payment) => new Date(payment.paymentDate).getTime() > openingDate).reduce((sum, payment) => sum + payment.amountPaid, 0) : 0;
  const postAnchorPurchases = openingDate ? state.expenses.filter((expense) => new Date(expense.date).getTime() > openingDate).reduce((sum, expense) => sum + expense.totalCost, 0) : 0;
  const accumulatedBalance = openingBalance + postAnchorImmediate + postAnchorPayments - postAnchorPurchases;

  const saveFinancialSetup = () => {
    const nowIso = new Date().toISOString();
    const previous = financialSettings;
    const record: UtilitySettings = {
      id: 'financial-settings', referenceMonth: 'financial', gasCylinderPrice: 0, electricityBill: 0, electricityKwh: 0, waterBill: 0, productionCycles: 0,
      ...(previous || {}), openingBalance: parseMoney(openingBalanceStr), openingDate: nowIso, pixKey: pixKey.trim(), pixRecipientName: pixRecipientName.trim(), pixCity: pixCity.trim().toUpperCase(), updatedAt: nowIso,
    };
    const utilitySettings = previous ? state.utilitySettings.map((item) => item.id === record.id ? record : item) : [record, ...(state.utilitySettings || [])];
    onStateChange({ ...state, utilitySettings }); setShowSetup(false);
    alert('✅ Saldo atual e dados do PIX definidos como novo marco financeiro. Nenhum histórico foi alterado.');
  };

  const saveHistoricalMonth = () => {
    const revenue = parseMoney(historyRevenueStr); if (!historyMonth || revenue <= 0) { alert('Informe o mês e o total vendido.'); return; }
    const nowIso = new Date().toISOString();
    const existing = state.utilitySettings.find((item) => item.referenceMonth === historyMonth && item.id !== 'financial-settings');
    const record: UtilitySettings = {
      id: existing?.id || `utilities-${historyMonth}`, referenceMonth: historyMonth,
      gasCylinderPrice: existing?.gasCylinderPrice || 0, electricityBill: existing?.electricityBill || 0, electricityKwh: existing?.electricityKwh || 0,
      waterBill: existing?.waterBill || 0, productionCycles: existing?.productionCycles || 0, ...(existing || {}),
      historicalRevenue: revenue, historicalEstimatedCost: historyCostStr.trim() ? parseMoney(historyCostStr) : undefined, updatedAt: nowIso,
    };
    const utilitySettings = existing ? state.utilitySettings.map((item) => item.id === existing.id ? record : item) : [record, ...state.utilitySettings];
    onStateChange({ ...state, utilitySettings }); setHistoryRevenueStr(''); setHistoryCostStr('');
    alert('✅ Histórico mensal salvo. Se já existirem vendas individuais nesse mês, o sistema prioriza as vendas reais e não soma o histórico duas vezes.');
  };

  const moveMonth = (offset: number) => { const index = monthOptions.findIndex((month) => month.key === currentMonthKey); const next = monthOptions[index + offset]; if (next) setCurrentMonthKey(next.key); };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-24 overflow-x-hidden">
      <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div><span className="text-xs font-black uppercase text-indigo-700 flex items-center gap-1.5"><Landmark className="w-4 h-4"/> Caixa simples</span><h2 className="text-2xl font-black text-slate-900 mt-1">Visão do negócio</h2><p className="text-xs text-slate-500">Compra é saída financeira. Custo do pote é usado para lucro — nunca cobrado duas vezes.</p></div>
          <div className="flex gap-2"><button onClick={() => setShowHistory(!showHistory)} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">Meses anteriores</button><button onClick={() => setShowSetup(!showSetup)} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5"><Settings2 className="w-4 h-4"/> Saldo / PIX</button></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-indigo-200 bg-indigo-50 rounded-2xl p-4"><span className="text-[10px] uppercase font-black text-indigo-700">Vendas no ano</span><strong className="block text-2xl font-black mt-1">{formatCurrency(yearRevenue)}</strong><small className="text-indigo-700">Reais + histórico consolidado</small></div>
          <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-4"><span className="text-[10px] uppercase font-black text-emerald-700">Lucro acumulado / conta</span><strong className="block text-2xl font-black mt-1">{financialSettings ? formatCurrency(accumulatedBalance) : 'Definir saldo'}</strong><small className="text-emerald-700">Saldo-base + movimentações posteriores</small></div>
          <div className="border border-orange-200 bg-orange-50 rounded-2xl p-4"><span className="text-[10px] uppercase font-black text-orange-700">Compras no ano</span><strong className="block text-2xl font-black mt-1">{formatCurrency(yearPurchasesTotal)}</strong><small className="text-orange-700">Aquisições efetivamente pagas</small></div>
          <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4"><span className="text-[10px] uppercase font-black text-amber-700">A receber</span><strong className="block text-2xl font-black mt-1">{formatCurrency(yearPending)}</strong><small className="text-amber-700">Vendas ainda pendentes</small></div>
        </div>
      </section>

      {showSetup && <section className="bg-white border-2 border-indigo-200 rounded-3xl p-6 shadow-sm space-y-4"><h3 className="font-black text-slate-900">Marco financeiro e PIX</h3><p className="text-xs text-slate-500">Informe o saldo que existe AGORA na conta dos doces. Ao salvar, o sistema cria um novo marco neste instante; não mexe em vendas antigas.</p><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><input value={openingBalanceStr} onChange={(e)=>setOpeningBalanceStr(e.target.value)} placeholder="Saldo atual da conta (R$)" className="p-3 rounded-xl border border-slate-200"/><input value={pixKey} onChange={(e)=>setPixKey(e.target.value)} placeholder="Chave PIX" className="p-3 rounded-xl border border-slate-200"/><input value={pixRecipientName} onChange={(e)=>setPixRecipientName(e.target.value)} placeholder="Nome do recebedor" className="p-3 rounded-xl border border-slate-200"/><input value={pixCity} onChange={(e)=>setPixCity(e.target.value)} placeholder="Cidade PIX" className="p-3 rounded-xl border border-slate-200"/></div><button onClick={saveFinancialSetup} className="px-5 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center gap-2"><Save className="w-4 h-4"/> Salvar marco atual</button></section>}

      {showHistory && <section className="bg-white border-2 border-amber-200 rounded-3xl p-6 shadow-sm space-y-4"><h3 className="font-black text-slate-900">Histórico anterior ao aplicativo</h3><p className="text-xs text-slate-500">Você pode informar só o total vendido. O custo é opcional. Meses que já possuem vendas individuais não serão somados novamente.</p><div className="grid sm:grid-cols-3 gap-3"><input type="month" value={historyMonth} onChange={(e)=>setHistoryMonth(e.target.value)} className="p-3 rounded-xl border border-slate-200"/><input value={historyRevenueStr} onChange={(e)=>setHistoryRevenueStr(e.target.value)} placeholder="Total vendido no mês" className="p-3 rounded-xl border border-slate-200"/><input value={historyCostStr} onChange={(e)=>setHistoryCostStr(e.target.value)} placeholder="Custo estimado (opcional)" className="p-3 rounded-xl border border-slate-200"/></div><button onClick={saveHistoricalMonth} className="px-5 py-3 rounded-2xl bg-amber-500 text-slate-950 font-black text-sm">Salvar mês anterior</button></section>}

      <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4"><div><span className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase"><Calendar className="w-4 h-4"/> Visão mensal</span><h3 className="text-2xl font-black text-slate-900 mt-1">{formatMonthShort(currentMonthKey)}</h3></div><div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl"><button onClick={()=>moveMonth(-1)} className="p-2"><ChevronLeft className="w-4 h-4"/></button><select value={currentMonthKey} onChange={(e)=>setCurrentMonthKey(e.target.value)} className="bg-transparent font-black text-sm px-2">{monthOptions.map((month)=><option key={month.key} value={month.key}>{month.label}</option>)}</select><button onClick={()=>moveMonth(1)} className="p-2"><ChevronRight className="w-4 h-4"/></button></div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-indigo-200 bg-indigo-50 rounded-2xl p-4"><span className="text-[10px] uppercase font-black">Vendas</span><strong className="block text-2xl font-black">{formatCurrency(monthRevenue)}</strong><small>{monthSales.reduce((s,x)=>s+x.quantity,0)} potes vendidos</small></div>
          <div className="border border-purple-200 bg-purple-50 rounded-2xl p-4"><span className="text-[10px] uppercase font-black">Lucro dos doces</span><strong className="block text-2xl font-black">{formatCurrency(monthProfit)}</strong><small>Vendas − custo dos potes vendidos</small></div>
          <div className="border border-orange-200 bg-orange-50 rounded-2xl p-4"><span className="text-[10px] uppercase font-black">Compras</span><strong className="block text-2xl font-black">{formatCurrency(monthPurchasesTotal)}</strong><small>Dinheiro gasto em novas aquisições</small></div>
          <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-4"><span className="text-[10px] uppercase font-black">Recebido</span><strong className="block text-2xl font-black">{formatCurrency(monthReceived)}</strong><small>{formatCurrency(monthPending)} ainda a receber</small></div>
        </div>
        <button type="button" onClick={()=>setShowDetails(!showDetails)} className="text-xs font-black text-slate-600 flex items-center gap-1">Ver detalhes matemáticos <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}/></button>
        {showDetails && <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 rounded-2xl p-4 text-xs"><div><span className="text-slate-500">Custo dos potes vendidos</span><strong className="block text-lg">{formatCurrency(monthSoldCost)}</strong></div><div><span className="text-slate-500">Fluxo financeiro do mês</span><strong className="block text-lg">{formatCurrency(monthReceived-monthPurchasesTotal)}</strong></div><div><span className="text-slate-500">Lucro conhecido do ano</span><strong className="block text-lg">{formatCurrency(yearKnownProfit)}</strong></div><div><span className="text-slate-500">Recebido registrado no ano</span><strong className="block text-lg">{formatCurrency(yearReceived)}</strong></div></div>}
      </section>
    </div>
  );
};

