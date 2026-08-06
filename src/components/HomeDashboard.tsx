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
  const salesInMonth = state.sales.filter((s) => s.monthKey === selectedMonth);
  const totalSalesCount = salesInMonth.length;
  const totalSweetsSold = salesInMonth.reduce((acc, curr) => acc + curr.quantity, 0);

  // Billing stats
  const totalGross = salesInMonth.reduce((acc, curr) => acc + curr.totalPrice, 0);
  const paidUpfront = salesInMonth
    .filter((s) => s.isPaidImmediately)
    .reduce((acc, curr) => acc + curr.totalPrice, 0);
  const settledPayments = state.payments
    .filter((p) => p.monthKey === selectedMonth)
    .reduce((acc, curr) => acc + curr.amountPaid, 0);
  const totalReceived = Math.min(totalGross, paidUpfront + settledPayments);
  const totalPending = Math.max(0, totalGross - totalReceived);

  // Active production batch
  const activeBatch = state.batches.find((b) => b.status === 'active') || state.batches[0];
  const stockRemaining = activeBatch
    ? Math.max(0, activeBatch.totalProduced - activeBatch.totalSold)
    : 0;

  // Inventory alert count
  const lowStockCount = state.inventory.filter((item) => item.quantity <= (item.minAlertQuantity || 3)).length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 overflow-x-hidden">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-purple-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-amber-500/30">
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-amber-400 shadow-xl shrink-0">
            <img
              src={appIconImg}
              alt="Ícone Mari Simas Doces"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-amber-950/40 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-300 border border-amber-500/40">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-brand text-lg text-gold-shimmer font-bold tracking-wide">Mari Simas Doces</span>
              <span className="text-amber-300/80">• Painel {selectedMonth}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-100">
              Olá, {currentUser.name}! 👋
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg">
              Sistema com controle total de compras no <strong>Almoxarifado</strong>, cálculo de ficha técnica no <strong>Livro de Receitas</strong>, vendas por repartição e <strong>Caixa consolidado</strong>.
            </p>
          </div>
        </div>

        <div className="bg-amber-500/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-amber-500/30 text-center md:text-right shrink-0 w-full sm:w-auto">
          <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">
            Estoque Ativo na Semana
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
            {stockRemaining} potes
          </div>
          <div className="text-[10px] text-amber-200 font-medium">
            {activeBatch ? activeBatch.sweetName : 'Nenhum lote'}
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
