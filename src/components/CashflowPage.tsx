import React, { useMemo, useState } from 'react';
import { AppState, UtilitySettings, User } from '../types';
import { formatCurrency, formatMonthShort } from '../lib/storage';
import { db, doc, setDoc, waitForPendingWrites } from '../lib/firebase';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Save,
  Settings2,
  TrendingUp,
} from 'lucide-react';

// CASHFLOW_V8_EXPENSE_TIMESTAMP_FIX_2026_08_18
// Regra: saldo atual = dinheiro real; gastos = compras reais após o marco;
// recebido e a receber são informativos; saldo projetado = saldo atual + a receber.
// Custo do pote permanece somente na Produção/precificação.

interface CashflowPageProps {
  state: AppState;
  onStateChange: (newState: AppState) => void;
  selectedMonth: string;
  currentUser: User;
}

const parseMoney = (value: string) =>
  Number(value.replace(/\./g, '').replace(',', '.')) || 0;

const expenseMonthKey = (expense: { date?: string; monthKey?: string }) => {
  if (expense.date) {
    const parsed = new Date(expense.date);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
      }).format(parsed);
    }
  }
  return expense.monthKey || '';
};

const monthKeyFromIso = (iso?: string) => {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).format(parsed);
};

const expenseMovementTime = (expense: { updatedAt?: string; date?: string }) => {
  const source = expense.updatedAt || expense.date;
  if (!source) return NaN;
  return new Date(source).getTime();
};

export const CashflowPage: React.FC<CashflowPageProps> = ({
  state,
  onStateChange,
  selectedMonth: initialMonth,
}) => {
  const [currentMonthKey, setCurrentMonthKey] = useState(initialMonth || '2026-08');
  const [showSetup, setShowSetup] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const financialSettings = state.utilitySettings?.find(
    (item) => item.id === 'financial-settings'
  );

  const [openingBalanceStr, setOpeningBalanceStr] = useState(
    String(financialSettings?.openingBalance ?? '').replace('.', ',')
  );
  const [pixKey, setPixKey] = useState(
    financialSettings?.pixKey || 'mdamerso@hotmail.com'
  );
  const [pixRecipientName, setPixRecipientName] = useState(
    financialSettings?.pixRecipientName || 'Mariane Simas'
  );
  const [pixCity, setPixCity] = useState(
    financialSettings?.pixCity || 'SANTANA LIVRAM'
  );

  const [historyMonth, setHistoryMonth] = useState('2026-01');
  const [historyRevenueStr, setHistoryRevenueStr] = useState('');
  const [historyCostStr, setHistoryCostStr] = useState('');

  React.useEffect(() => {
    if (initialMonth) setCurrentMonthKey(initialMonth);
  }, [initialMonth]);

  const monthOptions = useMemo(() => {
    const names = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    return Array.from({ length: 60 }, (_, index) => {
      const year = 2026 + Math.floor(index / 12);
      const month = (index % 12) + 1;
      const mm = String(month).padStart(2, '0');
      return {
        key: `${year}-${mm}`,
        label: `${names[month - 1]} / ${year}`,
      };
    });
  }, []);

  const openingBalance = financialSettings?.openingBalance || 0;
  const openingDateMs = financialSettings?.openingDate
    ? new Date(financialSettings.openingDate).getTime()
    : null;
  const openingMonthKey = monthKeyFromIso(financialSettings?.openingDate);

  const postAnchorImmediate = openingDateMs
    ? state.sales
        .filter(
          (sale) =>
            !sale.deletedAt &&
            sale.isPaidImmediately &&
            new Date(sale.saleDate).getTime() > openingDateMs
        )
        .reduce((sum, sale) => sum + sale.totalPrice, 0)
    : 0;

  const postAnchorPayments = openingDateMs
    ? state.payments
        .filter(
          (payment) =>
            !payment.deletedAt &&
            new Date(payment.paymentDate).getTime() > openingDateMs
        )
        .reduce((sum, payment) => sum + payment.amountPaid, 0)
    : 0;

  const postAnchorPurchases = openingDateMs
    ? state.expenses
        .filter((expense) => {
          if (expense.deletedAt) return false;
          const expenseMs = expenseMovementTime(expense);
          return !Number.isNaN(expenseMs) && expenseMs > openingDateMs;
        })
        .reduce((sum, expense) => sum + expense.totalCost, 0)
    : 0;

  const currentBalance =
    openingBalance +
    postAnchorImmediate +
    postAnchorPayments -
    postAnchorPurchases;

  const monthSales = state.sales.filter(
    (sale) => !sale.deletedAt && sale.monthKey === currentMonthKey
  );

  const monthRevenue = monthSales.reduce(
    (total, sale) => total + sale.totalPrice,
    0
  );

  const monthImmediateReceived = monthSales
    .filter((sale) => sale.isPaidImmediately)
    .reduce((total, sale) => total + sale.totalPrice, 0);

  const monthPayments = state.payments
    .filter(
      (payment) =>
        !payment.deletedAt && payment.monthKey === currentMonthKey
    )
    .reduce((total, payment) => total + payment.amountPaid, 0);

  const monthReceived = Math.min(
    monthRevenue,
    monthImmediateReceived + monthPayments
  );

  const monthPending = Math.max(0, monthRevenue - monthReceived);

  const monthPurchasesAfterAnchor = state.expenses.filter((expense) => {
    if (expense.deletedAt) return false;
    if (expenseMonthKey(expense) !== currentMonthKey) return false;

    if (!openingDateMs) return false;

    const expenseMs = expenseMovementTime(expense);
    if (Number.isNaN(expenseMs)) return false;

    if (currentMonthKey === openingMonthKey) {
      return expenseMs > openingDateMs;
    }

    if (currentMonthKey > openingMonthKey) {
      return true;
    }

    return false;
  });

  const monthExpenses = monthPurchasesAfterAnchor.reduce(
    (total, expense) => total + expense.totalCost,
    0
  );

  const projectedBalance = currentBalance + monthPending;

  const totalPostAnchorExpenses = state.expenses
    .filter((expense) => {
      if (expense.deletedAt) return false;
      if (!openingDateMs) return false;
      const expenseMs = expenseMovementTime(expense);
      return !Number.isNaN(expenseMs) && expenseMs > openingDateMs;
    })
    .reduce((sum, expense) => sum + expense.totalCost, 0);

  const saveFinancialSetup = async () => {
    const nowIso = new Date().toISOString();
    const previous = financialSettings;

    const record: UtilitySettings = {
      id: 'financial-settings',
      referenceMonth: 'financial',
      gasCylinderPrice: 0,
      electricityBill: 0,
      electricityKwh: 0,
      waterBill: 0,
      productionCycles: 0,
      ...(previous || {}),
      openingBalance: parseMoney(openingBalanceStr),
      openingDate: nowIso,
      readyStockOpening: previous?.readyStockOpening ?? 13,
      readyStockOpeningDate: previous?.readyStockOpeningDate || nowIso,
      pixKey: pixKey.trim(),
      pixRecipientName: pixRecipientName.trim(),
      pixCity: pixCity.trim().toUpperCase(),
      updatedAt: nowIso,
    };

    const utilitySettings = previous
      ? state.utilitySettings.map((item) =>
          item.id === record.id ? record : item
        )
      : [record, ...(state.utilitySettings || [])];

    // Atualiza a interface imediatamente.
    onStateChange({ ...state, utilitySettings });

    // Persistência crítica: grava o marco financeiro diretamente no Firestore
    // e aguarda a confirmação antes de informar sucesso ao usuário.
    try {
      await setDoc(doc(db, 'utilitySettings', 'financial-settings'), record, { merge: true });
      await waitForPendingWrites(db);
      setShowSetup(false);
      alert('✅ Saldo / PIX salvo e confirmado no Firebase.');
    } catch (error) {
      console.error('Erro ao persistir Saldo / PIX:', error);
      alert('⚠️ O valor apareceu na tela, mas o Firebase não confirmou a gravação. Não feche o app e tente salvar novamente.');
    }
  };

  const saveHistoricalMonth = () => {
    const revenue = parseMoney(historyRevenueStr);
    if (!historyMonth || revenue <= 0) {
      alert('Informe o mês e o total vendido.');
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = state.utilitySettings.find(
      (item) =>
        item.referenceMonth === historyMonth &&
        item.id !== 'financial-settings'
    );

    const record: UtilitySettings = {
      id: existing?.id || `utilities-${historyMonth}`,
      referenceMonth: historyMonth,
      gasCylinderPrice: existing?.gasCylinderPrice || 0,
      electricityBill: existing?.electricityBill || 0,
      electricityKwh: existing?.electricityKwh || 0,
      waterBill: existing?.waterBill || 0,
      productionCycles: existing?.productionCycles || 0,
      ...(existing || {}),
      historicalRevenue: revenue,
      historicalEstimatedCost: historyCostStr.trim()
        ? parseMoney(historyCostStr)
        : undefined,
      updatedAt: nowIso,
    };

    const utilitySettings = existing
      ? state.utilitySettings.map((item) =>
          item.id === existing.id ? record : item
        )
      : [record, ...state.utilitySettings];

    onStateChange({ ...state, utilitySettings });
    setHistoryRevenueStr('');
    setHistoryCostStr('');
    alert('✅ Histórico mensal salvo.');
  };

  const moveMonth = (offset: number) => {
    const index = monthOptions.findIndex(
      (month) => month.key === currentMonthKey
    );
    const next = monthOptions[index + offset];
    if (next) setCurrentMonthKey(next.key);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-24 overflow-x-hidden">
      <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <span className="text-xs font-black uppercase text-indigo-700 flex items-center gap-1.5">
              <Landmark className="w-4 h-4" /> Caixa simples
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-1">
              Visão do negócio
            </h2>
            <p className="text-xs text-slate-500">
              Só dinheiro real movimenta este caixa. O custo do pote continua na Produção e não é descontado duas vezes.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
            >
              Meses anteriores
            </button>
            <button
              onClick={() => setShowSetup(!showSetup)}
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Settings2 className="w-4 h-4" /> Saldo / PIX
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-black text-emerald-700">
              Saldo atual
            </span>
            <strong className="block text-2xl font-black mt-1">
              {financialSettings ? formatCurrency(currentBalance) : 'Definir saldo'}
            </strong>
            <small className="text-emerald-700">
              Dinheiro que existe agora na conta
            </small>
          </div>

          <div className="border border-orange-200 bg-orange-50 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-black text-orange-700">
              Gastos do mês
            </span>
            <strong className="block text-2xl font-black mt-1">
              {formatCurrency(totalPostAnchorExpenses)}
            </strong>
            <small className="text-orange-700">
              Somente compras registradas depois do marco financeiro
            </small>
          </div>

          <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-black text-amber-700">
              A receber no mês
            </span>
            <strong className="block text-2xl font-black mt-1">
              {formatCurrency(monthPending)}
            </strong>
            <small className="text-amber-700">
              Vendas ainda não pagas
            </small>
          </div>

          <div className="border border-indigo-200 bg-indigo-50 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-black text-indigo-700">
              Saldo projetado
            </span>
            <strong className="block text-2xl font-black mt-1">
              {financialSettings ? formatCurrency(projectedBalance) : 'Definir saldo'}
            </strong>
            <small className="text-indigo-700">
              Saldo atual + o que ainda falta receber
            </small>
          </div>
        </div>
      </section>

      {showSetup && (
        <section className="bg-white border-2 border-indigo-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="font-black text-slate-900">Marco financeiro e PIX</h3>
          <p className="text-xs text-slate-500">
            Informe o saldo que existe AGORA. Tudo que aconteceu antes fica absorvido nesse valor.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={openingBalanceStr}
              onChange={(e) => setOpeningBalanceStr(e.target.value)}
              placeholder="Saldo atual da conta (R$)"
              className="p-3 rounded-xl border border-slate-200"
            />
            <input
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="Chave PIX"
              className="p-3 rounded-xl border border-slate-200"
            />
            <input
              value={pixRecipientName}
              onChange={(e) => setPixRecipientName(e.target.value)}
              placeholder="Nome do recebedor"
              className="p-3 rounded-xl border border-slate-200"
            />
            <input
              value={pixCity}
              onChange={(e) => setPixCity(e.target.value)}
              placeholder="Cidade PIX"
              className="p-3 rounded-xl border border-slate-200"
            />
          </div>

          <button
            onClick={saveFinancialSetup}
            className="px-5 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Salvar saldo atual
          </button>
        </section>
      )}

      {showHistory && (
        <section className="bg-white border-2 border-amber-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="font-black text-slate-900">Histórico anterior ao aplicativo</h3>
          <p className="text-xs text-slate-500">
            Mantido apenas como histórico comercial; não altera o saldo atual.
          </p>

          <div className="grid sm:grid-cols-3 gap-3">
            <input
              type="month"
              value={historyMonth}
              onChange={(e) => setHistoryMonth(e.target.value)}
              className="p-3 rounded-xl border border-slate-200"
            />
            <input
              value={historyRevenueStr}
              onChange={(e) => setHistoryRevenueStr(e.target.value)}
              placeholder="Total vendido no mês"
              className="p-3 rounded-xl border border-slate-200"
            />
            <input
              value={historyCostStr}
              onChange={(e) => setHistoryCostStr(e.target.value)}
              placeholder="Gasto estimado (opcional)"
              className="p-3 rounded-xl border border-slate-200"
            />
          </div>

          <button
            onClick={saveHistoricalMonth}
            className="px-5 py-3 rounded-2xl bg-amber-500 text-slate-950 font-black text-sm flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Salvar histórico
          </button>
        </section>
      )}

      <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <span className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Visão mensal
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              {formatMonthShort(currentMonthKey)}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => moveMonth(-1)}
              className="p-2 rounded-xl bg-slate-100 text-slate-700"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={currentMonthKey}
              onChange={(e) => setCurrentMonthKey(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold bg-white"
            >
              {monthOptions.map((month) => (
                <option key={month.key} value={month.key}>
                  {month.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => moveMonth(1)}
              className="p-2 rounded-xl bg-slate-100 text-slate-700"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-black text-emerald-700">Saldo atual</span>
            <strong className="block text-xl font-black mt-1">
              {financialSettings ? formatCurrency(currentBalance) : 'Definir saldo'}
            </strong>
            <small className="text-emerald-700">Valor real na conta</small>
          </div>

          <div className="border border-orange-200 bg-orange-50 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-black text-orange-700">Gastos do mês</span>
            <strong className="block text-xl font-black mt-1">
              {formatCurrency(monthExpenses)}
            </strong>
            <small className="text-orange-700">Somente compras registradas depois do marco financeiro</small>
          </div>

          <div className="border border-sky-200 bg-sky-50 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-black text-sky-700">Já recebido</span>
            <strong className="block text-xl font-black mt-1">
              {formatCurrency(monthReceived)}
            </strong>
            <small className="text-sky-700">Das vendas deste mês</small>
          </div>

          <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-black text-amber-700">A receber</span>
            <strong className="block text-xl font-black mt-1">
              {formatCurrency(monthPending)}
            </strong>
            <small className="text-amber-700">Fiados ainda pendentes</small>
          </div>

          <div className="border border-indigo-200 bg-indigo-50 rounded-2xl p-4">
            <span className="text-[10px] uppercase font-black text-indigo-700">Saldo projetado</span>
            <strong className="block text-xl font-black mt-1">
              {financialSettings ? formatCurrency(projectedBalance) : 'Definir saldo'}
            </strong>
            <small className="text-indigo-700">Saldo atual + a receber</small>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-indigo-600 mt-0.5" />
          <div>
            <strong className="text-sm text-slate-900">
              Custo do pote continua ativo na Produção
            </strong>
            <p className="text-xs text-slate-500 mt-1">
              Ingredientes, embalagem, água, luz e gás continuam calculados para precificação e reposição. Eles não são descontados novamente deste Caixa.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
