import React from 'react';
import { AppState, User } from '../types';
import { formatCurrency } from '../lib/storage';
import { ShoppingBag, Receipt, Wallet, Package, ArrowRight, Sparkles, Smartphone } from 'lucide-react';
import { TabType } from './Navigation';

import appIconImg from '../assets/images/mari_simas_app_icon_1785897100847.jpg';
import goldLogoImg from '../assets/images/mari_simas_logo_1785897108954.jpg';

interface HomeDashboardProps {
  state: AppState;
  selectedMonth: string;
  currentUser: User;
  onSelectTab: (tab: TabType) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  state,
  selectedMonth,
  currentUser,
  onSelectTab,
}) => {
  // Stats calculation
  const salesInMonth = state.sales.filter(
    (s) => s.monthKey === selectedMonth || (s.saleDate && s.saleDate.startsWith(selectedMonth))
  );
  const totalSalesCount = salesInMonth.length;
  const totalSweetsSold = salesInMonth.reduce((acc, curr) => acc + (curr.quantity || 1), 0);

  // Billing stats
  const totalGross = salesInMonth.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
  const paidUpfront = salesInMonth
    .filter((s) => s.isPaidImmediately)
    .reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
  const settledPayments = state.payments
    .filter((p) => p.monthKey === selectedMonth)
    .reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);
  const totalReceived = Math.min(totalGross, paidUpfront + settledPayments);
  const totalPending = Math.max(0, totalGross - totalReceived);

  // Active production batches & stock calculations
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayLocalStr = new Date().toLocaleDateString('sv-SE');
  const todayBR = new Date().toLocaleDateString('pt-BR');

  const batchesToday = state.batches.filter((b) => {
    if (!b.createdAt && !b.startDate) return false;
    const d = (b.createdAt || b.startDate).slice(0, 10);
    return d === todayISO || d === todayLocalStr;
  });

  const recipesToday = state.recipes.filter((r) => {
    if (!r.updatedAt) return false;
    return r.updatedAt.slice(0, 10) === todayISO || r.updatedAt.slice(0, 10) === todayLocalStr;
  });

  const totalFromBatchesToday = batchesToday.reduce((acc, b) => acc + (b.totalProduced || 0), 0);
  const totalFromRecipesToday = recipesToday.reduce((acc, r) => acc + (r.yieldsCount || 0), 0);
  const producedToday = Math.max(totalFromBatchesToday, totalFromRecipesToday);

  // Total sales made today (summing doces quantities sold)
  const salesToday = state.sales.filter((s) => {
    if (!s.saleDate) return false;
    const saleDateObj = new Date(s.saleDate);
    if (isNaN(saleDateObj.getTime())) return false;
    const saleBR = saleDateObj.toLocaleDateString('pt-BR');
    const d = s.saleDate.slice(0, 10);
    return saleBR === todayBR || d === todayISO || d === todayLocalStr;
  });
  const totalSoldToday = salesToday.reduce((acc, s) => acc + (s.quantity || 1), 0);

  // Active production batches
  const activeBatches = state.batches.filter((b) => b.status === 'active');
  const activeBatch = activeBatches[0] || state.batches[0];

  // Calculate total sold directly from sales for active batches
  const activeBatchIds = new Set(activeBatches.map((b) => b.id));
  const activeSweetNames = new Set(activeBatches.map((b) => b.sweetName?.toLowerCase()));

  const salesForActiveBatch = state.sales.filter((s) => {
    if (s.batchId && activeBatchIds.has(s.batchId)) return true;
    if (s.sweetName && activeSweetNames.has(s.sweetName.toLowerCase())) {
      return true;
    }
    return false;
  });

  const totalSoldFromBatchSales = salesForActiveBatch.reduce((acc, s) => acc + (s.quantity || 1), 0);

  // Derive maximum sold potes from all valid sources
  const totalActiveSold = Math.max(
    totalSoldToday,
    totalSoldFromBatchSales,
    activeBatches.reduce((acc, b) => acc + (b.totalSold || 0), 0)
  );

  const totalActiveProduced = activeBatches.length > 0
    ? activeBatches.reduce((acc, b) => acc + (b.totalProduced || 0), 0)
    : (producedToday > 0 ? producedToday : (state.recipes[0]?.yieldsCount || 33));

  // Available potes remaining (deducts exact quantity of doces sold)
  const availableToSellToday = Math.max(0, totalActiveProduced - totalActiveSold);
  const stockRemaining = availableToSellToday;

  // Inventory alert count
  const lowStockCount = state.inventory.filter((item) => item.quantity <= (item.minAlertQuantity || 3)).length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 overflow-x-hidden">
      {/* Centered Purple & Gold Brand Hero Card */}
      <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-purple-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-purple-700 text-center flex flex-col items-center justify-center space-y-4">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-8 -top-8 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center space-y-3 max-w-lg mx-auto">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-amber-400/90 shadow-xl bg-white/10 p-1 shrink-0">
            <img
              src={appIconImg}
              alt="Mari Simas Doces"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>

          <div className="inline-flex items-center justify-center gap-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-brand text-base text-gold-shimmer font-bold">Mari Simas Doces Gourmet</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Olá, {currentUser.name}! 👋
          </h2>

          <p className="text-xs sm:text-sm text-purple-200 font-medium leading-relaxed">
            Seu painel completo de controle de vendas, estoque e cobranças.
          </p>

          <div className="bg-purple-950/80 backdrop-blur-md border border-purple-700/80 px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner text-left mt-2 w-full max-w-xl">
            {/* Disponíveis p/ Venda Hoje (Diminui conforme vende!) */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center text-xl shrink-0 border border-amber-400/30">
                🧁
              </div>
              <div>
                <div className="text-[10px] uppercase font-black text-amber-300 tracking-wider">
                  Disponíveis p/ Venda Hoje
                </div>
                <div className="text-base sm:text-lg font-black text-white font-mono">
                  {availableToSellToday} <span className="text-xs font-semibold text-purple-200">potes p/ vender {totalActiveSold > 0 ? `(${totalActiveSold} já vendidos hoje)` : `(de ${totalActiveProduced} prod.)`}</span>
                </div>
              </div>
            </div>

            <div className="h-8 w-px bg-purple-700/80 hidden sm:block" />

            {/* Estoque em Lote Ativo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-800/80 text-purple-200 flex items-center justify-center text-xl shrink-0 border border-purple-600">
                📦
              </div>
              <div>
                <div className="text-[10px] uppercase font-black text-purple-300 tracking-wider">
                  Estoque Lote Ativo
                </div>
                <div className="text-sm sm:text-base font-black text-white font-mono">
                  {stockRemaining} potes <span className="text-xs font-normal text-purple-300">({activeBatch ? activeBatch.sweetName : 'Sem lote ativo'})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 MAIN OPERATIONAL MENU BLOCKS: PRODUÇÃO, VENDA, COBRANÇA, CAIXA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
        {/* 1. PRODUÇÃO */}
        <button
          type="button"
          onClick={() => onSelectTab('inventory')}
          className="group relative bg-white border-2 border-slate-200 hover:border-amber-600 rounded-3xl p-6 shadow-sm hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 text-left flex flex-col justify-between space-y-4 cursor-pointer overflow-hidden hover:ring-4 hover:ring-amber-100"
        >
          <div className="flex items-start justify-between">
            <div className="w-14 h-14 bg-amber-100 border border-amber-200 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 group-hover:bg-amber-600 transition-all duration-300 group-hover:text-white">
              📦
            </div>
            <ArrowRight className="w-5 h-5 text-amber-600 group-hover:translate-x-1 transition-transform" />
          </div>

          <div>
            <h3 className="text-2xl font-black text-slate-900 group-hover:text-amber-700 transition-colors">
              Produção
            </h3>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-700">
            <span>Almoxarifado & Ficha Técnica</span>
            {lowStockCount > 0 ? (
              <span className="text-[11px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">
                ⚠️ {lowStockCount} p/ comprar
              </span>
            ) : (
              <span className="text-[11px] text-emerald-700 font-bold">
                ✓ Insumos Ok
              </span>
            )}
          </div>
        </button>

        {/* 2. VENDA */}
        <button
          type="button"
          onClick={() => onSelectTab('sales')}
          className="group relative bg-white border-2 border-slate-200 hover:border-purple-600 rounded-3xl p-6 shadow-sm hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 text-left flex flex-col justify-between space-y-4 cursor-pointer overflow-hidden hover:ring-4 hover:ring-purple-100"
        >
          <div className="flex items-start justify-between">
            <div className="w-14 h-14 bg-purple-100 border border-purple-200 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 group-hover:bg-purple-600 transition-all duration-300 group-hover:text-white">
              🛍️
            </div>
            <ArrowRight className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" />
          </div>

          <div>
            <h3 className="text-2xl font-black text-slate-900 group-hover:text-purple-700 transition-colors">
              Venda
            </h3>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-700">
            <span>Lançamento Rápido</span>
            <span className="text-[11px] text-slate-500 font-semibold">
              {totalSalesCount} vendas no mês
            </span>
          </div>
        </button>

        {/* 3. COBRANÇA */}
        <button
          type="button"
          onClick={() => onSelectTab('billing')}
          className="group relative bg-white border-2 border-slate-200 hover:border-emerald-600 rounded-3xl p-6 shadow-sm hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 text-left flex flex-col justify-between space-y-4 cursor-pointer overflow-hidden hover:ring-4 hover:ring-emerald-100"
        >
          <div className="flex items-start justify-between">
            <div className="w-14 h-14 bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 group-hover:bg-emerald-600 transition-all duration-300 group-hover:text-white">
              📋
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
          </div>

          <div>
            <h3 className="text-2xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
              Cobrança
            </h3>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
            <span>Resumo de Vendas & Quitação</span>
            <span className="text-[11px] text-amber-700 font-black">
              A receber: {formatCurrency(totalPending)}
            </span>
          </div>
        </button>

        {/* 4. CAIXA */}
        <button
          type="button"
          onClick={() => onSelectTab('cashflow')}
          className="group relative bg-white border-2 border-slate-200 hover:border-indigo-600 rounded-3xl p-6 shadow-sm hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 text-left flex flex-col justify-between space-y-4 cursor-pointer overflow-hidden hover:ring-4 hover:ring-indigo-100"
        >
          <div className="flex items-start justify-between">
            <div className="w-14 h-14 bg-indigo-100 border border-indigo-200 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 group-hover:bg-indigo-600 transition-all duration-300 group-hover:text-white">
              💰
            </div>
            <ArrowRight className="w-5 h-5 text-indigo-600 group-hover:translate-x-1 transition-transform" />
          </div>

          <div>
            <h3 className="text-2xl font-black text-slate-900 group-hover:text-indigo-700 transition-colors">
              Caixa
            </h3>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-700">
            <span>Caixa Anual & Mensal</span>
            <span className="text-[11px] text-slate-500 font-semibold">
              Lucro Mês: {formatCurrency(totalReceived)}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
