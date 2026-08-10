import React, { useState } from 'react';
import { AppState, User } from '../types';
import { formatCurrency, formatMonthShort } from '../lib/storage';
import {
  Wallet,
  TrendingUp,
  Calendar,
  ArrowDownCircle,
  BarChart3,
  DollarSign,
  PiggyBank,
  ChevronLeft,
  ChevronRight,
  Calculator,
  CheckCircle2,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface CashflowPageProps {
  state: AppState;
  onStateChange: (newState: AppState) => void;
  selectedMonth: string;
  currentUser: User;
}

export const CashflowPage: React.FC<CashflowPageProps> = ({
  state,
  selectedMonth: initialMonth,
}) => {
  // Calendar month selection automatically synced with global selectedMonth
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(initialMonth || '2026-08');

  React.useEffect(() => {
    if (initialMonth) {
      setCurrentMonthKey(initialMonth);
    }
  }, [initialMonth]);

  // Month list builder from 2026-01 to 2030-12
  const generateMonthList = () => {
    const list: { key: string; label: string }[] = [];
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    for (let year = 2026; year <= 2030; year++) {
      for (let month = 1; month <= 12; month++) {
        const mm = String(month).padStart(2, '0');
        const key = `${year}-${mm}`;
        const label = `${monthNames[month - 1]} / ${year}`;
        list.push({ key, label });
      }
    }
    return list;
  };

  const monthOptions = generateMonthList();

  // 1. CUMULATIVE STATS (CAIXA ACUMULADO CONSOLIDADO)
  const allSalesUpfront = state.sales
    .filter((s) => s.isPaidImmediately)
    .reduce((acc, curr) => acc + curr.totalPrice, 0);
  const allSettlements = state.payments.reduce((acc, curr) => acc + curr.amountPaid, 0);
  const totalCumulativeReceived = allSalesUpfront + allSettlements;

  // Cumulative production cost calculated from receipts or estimated unit costs for retroactive sales
  const cumulativeProductionCostFromSales = state.sales.reduce((acc, s) => {
    if (typeof s.estimatedUnitCost === 'number' && s.estimatedUnitCost >= 0) {
      return acc + (s.quantity * s.estimatedUnitCost);
    }
    const recipe = state.recipes.find(
      (r) => r.sweetId === s.sweetId || r.sweetName.toLowerCase() === s.sweetName.toLowerCase()
    );
    const unitCost = recipe ? recipe.calculatedUnitCost : 4.95;
    return acc + (s.quantity * unitCost);
  }, 0);

  const cumulativeExpenses = state.expenses.reduce((acc, curr) => acc + curr.totalCost, 0);
  const totalCumulativeExpenses = Math.max(cumulativeProductionCostFromSales, cumulativeExpenses);
  const totalCumulativeProfit = totalCumulativeReceived - totalCumulativeExpenses;

  // 2. MONTH BY MONTH STATS (CAIXA MÊS A MÊS INTEGRADO)
  const salesInMonth = state.sales.filter((s) => s.monthKey === currentMonthKey);
  const paymentsInMonth = state.payments.filter((p) => p.monthKey === currentMonthKey);
  const expensesInMonth = state.expenses.filter((e) => e.monthKey === currentMonthKey);

  // Indicator 1: Gasto com produção (Interligado com Almoxarifado ➔ Receita ➔ Vendas)
  const gastoProducaoVendasMonth = salesInMonth.reduce((acc, s) => {
    if (typeof s.estimatedUnitCost === 'number' && s.estimatedUnitCost >= 0) {
      return acc + (s.quantity * s.estimatedUnitCost);
    }
    const recipe = state.recipes.find(
      (r) => r.sweetId === s.sweetId || r.sweetName.toLowerCase() === s.sweetName.toLowerCase()
    );
    const unitCost = recipe ? recipe.calculatedUnitCost : 4.95;
    return acc + (s.quantity * unitCost);
  }, 0);

  const expensesCostMonth = expensesInMonth.reduce((acc, curr) => acc + curr.totalCost, 0);
  const gastoProducaoMonth = gastoProducaoVendasMonth > 0 ? gastoProducaoVendasMonth : expensesCostMonth;

  // Indicator 2: Total recebido (Immediate paid sales + settlements in month)
  const upfrontReceivedMonth = salesInMonth
    .filter((s) => s.isPaidImmediately)
    .reduce((acc, curr) => acc + curr.totalPrice, 0);
  const settlementsReceivedMonth = paymentsInMonth.reduce((acc, curr) => acc + curr.amountPaid, 0);
  const totalRecebidoMonth = upfrontReceivedMonth + settlementsReceivedMonth;

  // Indicator 3: Total a receber (Pending fiado sales in month)
  const totalAReceberMonth = salesInMonth
    .filter((s) => s.paymentStatus === 'pending')
    .reduce((acc, curr) => acc + curr.totalPrice, 0);

  // Indicator 4: Lucro do Mês (Total Recebido - Gasto com Produção)
  const lucroMonth = totalRecebidoMonth - gastoProducaoMonth;

  // Extra metrics for Regra de 3 explanation
  const totalDocesVendidosMonth = salesInMonth.reduce((acc, s) => acc + s.quantity, 0);
  const totalFaturamentoBrutoMonth = salesInMonth.reduce((acc, s) => acc + s.totalPrice, 0);

  const handlePrevMonth = () => {
    const idx = monthOptions.findIndex((m) => m.key === currentMonthKey);
    if (idx > 0) {
      setCurrentMonthKey(monthOptions[idx - 1].key);
    }
  };

  const handleNextMonth = () => {
    const idx = monthOptions.findIndex((m) => m.key === currentMonthKey);
    if (idx < monthOptions.length - 1) {
      setCurrentMonthKey(monthOptions[idx + 1].key);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8 pb-24 overflow-x-hidden">
      {/* SECTION 1: CAIXA ANUAL */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-indigo-800 font-extrabold text-lg">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <span>Caixa Anual</span>
          </div>
          <span className="text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-3 py-1 rounded-full">
            Visão Consolidada do Ano
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl space-y-1">
            <div className="text-xs font-bold uppercase text-emerald-800 tracking-wider">
              Receita Total Recebida
            </div>
            <div className="text-3xl font-black text-emerald-700 font-mono">
              {formatCurrency(totalCumulativeReceived)}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium">
              Soma de todas as entradas quitadas
            </div>
          </div>

          <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl space-y-1">
            <div className="text-xs font-bold uppercase text-rose-800 tracking-wider">
              Despesas / Produção Acumulada
            </div>
            <div className="text-3xl font-black text-rose-700 font-mono">
              {formatCurrency(totalCumulativeExpenses)}
            </div>
            <div className="text-[11px] text-rose-700 font-medium">
              Soma de todos os custos de produção
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 p-5 rounded-2xl space-y-1">
            <div className="text-xs font-bold uppercase text-purple-800 tracking-wider">
              Lucro Acumulado Total
            </div>
            <div className="text-3xl font-black text-purple-800 font-mono">
              {formatCurrency(totalCumulativeProfit)}
            </div>
            <div className="text-[11px] text-purple-700 font-medium">
              Lucro consolidado total do negócio
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: CAIXA DO MÊS CORRENTE */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span>Visão Mensal Integrada</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Caixa de {formatMonthShort(currentMonthKey)}
            </h3>
          </div>

          {/* Calendário/Picker desde Janeiro de 2026 */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 hover:bg-white text-slate-600 rounded-xl transition-colors cursor-pointer"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={currentMonthKey}
              onChange={(e) => setCurrentMonthKey(e.target.value)}
              className="bg-transparent font-black text-sm text-purple-900 px-2 py-1 focus:outline-none cursor-pointer"
            >
              {monthOptions.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 hover:bg-white text-slate-600 rounded-xl transition-colors cursor-pointer"
              title="Próximo Mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* RESUMO DO CAIXA DO MÊS COM OS 4 INDICADORES SOLICITADOS */}
        <div className="space-y-4">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Resumo do Caixa de {formatMonthShort(currentMonthKey)}:
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Gasto com produção */}
            <div className="bg-rose-50 border-2 border-rose-200 p-5 rounded-2xl space-y-2">
              <div className="text-xs font-bold uppercase text-rose-800 tracking-wider">
                1. Gasto com Produção
              </div>
              <div className="text-2xl font-black text-rose-950 font-mono">
                {formatCurrency(gastoProducaoMonth)}
              </div>
              <p className="text-[11px] text-rose-700 font-medium">
                Custo de produção dos insumos calculados do Almoxarifado/Receita.
              </p>
            </div>

            {/* 2. Total recebido */}
            <div className="bg-emerald-50 border-2 border-emerald-200 p-5 rounded-2xl space-y-2">
              <div className="text-xs font-bold uppercase text-emerald-800 tracking-wider">
                2. Total Recebido
              </div>
              <div className="text-2xl font-black text-emerald-950 font-mono">
                {formatCurrency(totalRecebidoMonth)}
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">
                Soma de vendas pagas no ato e quitações de cobrança do mês.
              </p>
            </div>

            {/* 3. Total a receber */}
            <div className="bg-amber-50 border-2 border-amber-200 p-5 rounded-2xl space-y-2">
              <div className="text-xs font-bold uppercase text-amber-800 tracking-wider">
                3. Total a Receber
              </div>
              <div className="text-2xl font-black text-amber-950 font-mono">
                {formatCurrency(totalAReceberMonth)}
              </div>
              <p className="text-[11px] text-amber-700 font-medium">
                Saldo pendente em fiado a cobrar dos clientes no mês.
              </p>
            </div>

            {/* 4. Lucro */}
            <div className="bg-purple-50 border-2 border-purple-300 p-5 rounded-2xl space-y-2">
              <div className="text-xs font-bold uppercase text-purple-800 tracking-wider">
                4. Lucro do Mês
              </div>
              <div className="text-2xl font-black text-purple-950 font-mono">
                {formatCurrency(lucroMonth)}
              </div>
              <p className="text-[11px] text-purple-700 font-medium">
                Resultado líquido (Total recebido menos gasto com produção).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
