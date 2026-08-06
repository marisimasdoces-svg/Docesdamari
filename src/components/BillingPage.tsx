import React, { useState } from 'react';
import { AppState, Buyer, PaymentRecord, Sale, User } from '../types';
import { saveState, formatCurrency, formatMonthShort } from '../lib/storage';
import confetti from 'canvas-confetti';
import {
  Receipt,
  CheckCircle2,
  Clock,
  Search,
  MessageCircle,
  X,
  Building2,
  Phone,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Calendar,
  Users,
} from 'lucide-react';

interface BillingPageProps {
  state: AppState;
  onStateChange: (newState: AppState) => void;
  selectedMonth: string;
  currentUser: User;
}

export const BillingPage: React.FC<BillingPageProps> = ({
  state,
  onStateChange,
  selectedMonth,
  currentUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('pending');

  // Floating Panel State
  const [activeBuyerSummary, setActiveBuyerSummary] = useState<BuyerBillingSummary | null>(null);
  const [showBuyerListModal, setShowBuyerListModal] = useState(false);

  // Sales in selected month
  const salesInMonth = state.sales.filter((s) => s.monthKey === selectedMonth);

  // Group sales per buyer
  interface BuyerBillingSummary {
    buyer: Buyer;
    totalDoces: number;
    totalGrossValue: number;
    paidImmediatelyValue: number;
    settledPaymentsValue: number;
    totalPaidValue: number;
    pendingBalance: number;
    salesList: Sale[];
    isFullyPaid: boolean;
    lastSaleDate: string;
  }

  const buyerSummaries: BuyerBillingSummary[] = state.buyers
    .map((buyer) => {
      const buyerSales = salesInMonth.filter((s) => s.buyerId === buyer.id || s.buyerName.toLowerCase() === buyer.name.toLowerCase());
      const totalDoces = buyerSales.reduce((acc, curr) => acc + curr.quantity, 0);
      const totalGrossValue = buyerSales.reduce((acc, curr) => acc + curr.totalPrice, 0);

      const paidImmediatelyValue = buyerSales
        .filter((s) => s.isPaidImmediately)
        .reduce((acc, curr) => acc + curr.totalPrice, 0);

      const buyerPayments = state.payments.filter(
        (p) => p.buyerId === buyer.id && p.monthKey === selectedMonth
      );
      const settledPaymentsValue = buyerPayments.reduce((acc, curr) => acc + curr.amountPaid, 0);

      const totalPaidValue = Math.min(totalGrossValue, paidImmediatelyValue + settledPaymentsValue);
      const pendingBalance = Math.max(0, totalGrossValue - totalPaidValue);
      const isFullyPaid = totalGrossValue > 0 && pendingBalance === 0;

      const lastSaleDate = buyerSales.length > 0 ? buyerSales[0].saleDate : '';

      return {
        buyer,
        totalDoces,
        totalGrossValue,
        paidImmediatelyValue,
        settledPaymentsValue,
        totalPaidValue,
        pendingBalance,
        salesList: buyerSales,
        isFullyPaid,
        lastSaleDate,
      };
    })
    .filter((summary) => summary.totalDoces > 0);

  // Totals
  const totalSweetsSold = salesInMonth.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalMonthPaid = buyerSummaries.reduce((acc, curr) => acc + curr.totalPaidValue, 0);
  const totalMonthPending = buyerSummaries.reduce((acc, curr) => acc + curr.pendingBalance, 0);

  // Filtered summaries
  const filteredSummaries = buyerSummaries.filter((sum) => {
    const matchesSearch =
      sum.buyer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sum.buyer.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === 'all' || sum.buyer.department === deptFilter;
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'pending'
        ? sum.pendingBalance > 0
        : sum.isFullyPaid;

    return matchesSearch && matchesDept && matchesStatus;
  });

  // Mark full amount as paid
  const handleMarkAsPaid = (sum: BuyerBillingSummary) => {
    const newPaymentRecord: PaymentRecord = {
      id: `pay-${Date.now()}`,
      buyerId: sum.buyer.id,
      buyerName: sum.buyer.name,
      monthKey: selectedMonth,
      amountPaid: sum.pendingBalance,
      paymentDate: new Date().toISOString(),
      paymentMethod: 'pix',
      notes: 'Quitação direta pelo card flutuante de cobrança',
      registeredBy: currentUser.name,
    };

    const updatedSales = state.sales.map((sale) => {
      if ((sale.buyerId === sum.buyer.id || sale.buyerName.toLowerCase() === sum.buyer.name.toLowerCase()) && sale.monthKey === selectedMonth) {
        return { ...sale, paymentStatus: 'paid' as const, paymentMethod: 'pix' };
      }
      return sale;
    });

    const newState = {
      ...state,
      sales: updatedSales,
      payments: [newPaymentRecord, ...state.payments],
    };

    saveState(newState);
    onStateChange(newState);

    confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    setActiveBuyerSummary(null);
  };

  // WhatsApp Message
  const handleWhatsAppBill = (sum: BuyerBillingSummary) => {
    const phone = sum.buyer.phone || (sum.salesList[0] ? state.buyers.find(b => b.id === sum.salesList[0].buyerId)?.phone : '');
    const text = `Olá ${sum.buyer.name.split(' ')[0]}! Tudo bem? 🧁\n\nReferente às suas compras de doces no mês de ${selectedMonth} (${sum.totalDoces} potes):\n\n*Valor a pagar: ${formatCurrency(sum.pendingBalance)}*\n\nChave PIX para pagamento: marisimasdoces@gmail.com\nMuito obrigado! 🙏`;
    const encoded = encodeURIComponent(text);
    const url = phone
      ? `https://wa.me/55${phone.replace(/\D/g, '')}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-24 overflow-x-hidden">
      {/* 1. BLOCO SUPERIOR DE SUMMARY CARDS */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Resumo das Vendas — {formatMonthShort(selectedMonth)}
        </h2>

        {/* 3 SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Card 1: Quanto vendeu */}
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl space-y-1">
            <div className="text-xs font-bold uppercase text-purple-800 tracking-wider">
              1. Doces Vendidos no Mês
            </div>
            <div className="text-3xl font-black text-purple-950 font-mono">
              {totalSweetsSold} <span className="text-sm font-semibold">potes</span>
            </div>
            <div className="text-[11px] text-purple-700 font-medium">
              Total em {formatMonthShort(selectedMonth)}
            </div>
          </div>

          {/* Card 2: Quanto recebeu */}
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-1">
            <div className="text-xs font-bold uppercase text-emerald-800 tracking-wider">
              2. Total Recebido (Pago)
            </div>
            <div className="text-3xl font-black text-emerald-700 font-mono">
              {formatCurrency(totalMonthPaid)}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium">
              Valor já quitado no mês
            </div>
          </div>

          {/* Card 3: Quanto tem a receber */}
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-1">
            <div className="text-xs font-bold uppercase text-amber-800 tracking-wider">
              3. Total a Receber (Fiado)
            </div>
            <div className="text-3xl font-black text-amber-700 font-mono">
              {formatCurrency(totalMonthPending)}
            </div>
            <div className="text-[11px] text-amber-700 font-medium">
              Saldo fiado pendente
            </div>
          </div>
        </div>
      </div>

      {/* 2. SELEÇÃO DO COMPRADOR NA LISTA DO MÊS */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Vendas — {formatMonthShort(selectedMonth)}
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Selecione o comprador para abrir instantaneamente o card flutuante de cobrança.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* BOTÃO QUE ABRE A LISTA DE COMPRADORES */}
          <button
            type="button"
            onClick={() => setShowBuyerListModal(true)}
            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-sm rounded-2xl shadow-md hover:shadow-purple-200 transition-all cursor-pointer flex items-center justify-center gap-2 group"
          >
            <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span>Abrir Lista de Compradores do Mês ({buyerSummaries.length})</span>
          </button>

          {/* DROPDOWN SELECTOR DIRETO */}
          <select
            value=""
            onChange={(e) => {
              const found = buyerSummaries.find(s => s.buyer.id === e.target.value);
              if (found) setActiveBuyerSummary(found);
            }}
            className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-purple-600 cursor-pointer shadow-xs"
          >
            <option value="">-- Selecione o Comprador na Lista do Mês --</option>
            {buyerSummaries.map((sum) => (
              <option key={sum.buyer.id} value={sum.buyer.id}>
                👤 {sum.buyer.name} ({sum.buyer.department}) — {sum.pendingBalance > 0 ? `Pendente: ${formatCurrency(sum.pendingBalance)}` : '✓ Quitado'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* MODAL DE LISTA DE COMPRADORES DO MÊS */}
      {showBuyerListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Lista de Compradores — {formatMonthShort(selectedMonth)}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Clique no nome para abrir o card flutuante com todas as informações do comprador.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowBuyerListModal(false)}
                className="p-2 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter controls inside modal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative sm:col-span-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar comprador ou repartição..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-600"
                />
              </div>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-600 cursor-pointer"
              >
                <option value="all">Repartição: Todas</option>
                {state.departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`flex-1 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${
                    statusFilter === 'pending' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Pendentes ({buyerSummaries.filter((s) => s.pendingBalance > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('paid')}
                  className={`flex-1 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${
                    statusFilter === 'paid' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Quitados ({buyerSummaries.filter((s) => s.isFullyPaid).length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`flex-1 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${
                    statusFilter === 'all' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Todos ({buyerSummaries.length})
                </button>
              </div>
            </div>

            {/* LIST TABLE */}
            {filteredSummaries.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-semibold">
                Nenhum comprador encontrado em {formatMonthShort(selectedMonth)}.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider bg-slate-50">
                      <th className="py-3 px-4">Comprador</th>
                      <th className="py-3 px-4">Repartição</th>
                      <th className="py-3 px-4 text-center">Potes Comprados</th>
                      <th className="py-3 px-4">Valor Total</th>
                      <th className="py-3 px-4">Saldo Pendente</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSummaries.map((sum) => (
                      <tr
                        key={sum.buyer.id}
                        onClick={() => {
                          setShowBuyerListModal(false);
                          setActiveBuyerSummary(sum);
                        }}
                        className="hover:bg-purple-50/70 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 font-black text-slate-900 group-hover:text-purple-700 transition-colors whitespace-nowrap">
                          👤 {sum.buyer.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 font-semibold whitespace-nowrap">
                          🏢 {sum.buyer.department}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                          {sum.totalDoces} potes
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800 whitespace-nowrap">
                          {formatCurrency(sum.totalGrossValue)}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-black whitespace-nowrap">
                          <span className={sum.pendingBalance > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                            {sum.pendingBalance > 0 ? formatCurrency(sum.pendingBalance) : 'R$ 0,00'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {sum.isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] px-2.5 py-1 rounded-full font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Quitado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-200 text-[10px] px-2.5 py-1 rounded-full font-bold">
                              <Clock className="w-3 h-3 text-amber-600" /> Pendente
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="text-[11px] font-bold text-purple-700 bg-purple-100 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded-xl inline-flex items-center gap-1 transition-all">
                            <span>Abrir Card</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CARD FLUTUANTE (FLOATING CARD MODAL) AO CLICAR NO NOME DO COMPRADOR */}
      {activeBuyerSummary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            {/* Header Card Flutuante */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-0.5 rounded-full">
                  Card Flutuante de Cobrança
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  👤 {activeBuyerSummary.buyer.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  🏢 Repartição: {activeBuyerSummary.buyer.department}
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  📞 Contato: {activeBuyerSummary.buyer.phone || (activeBuyerSummary.salesList[0] ? state.buyers.find(b => b.id === activeBuyerSummary.salesList[0].buyerId)?.phone : 'Não informado')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveBuyerSummary(null)}
                className="p-2 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of Itemized Purchases */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Vendas para este cliente em {selectedMonth} ({activeBuyerSummary.totalDoces} potes):
              </h4>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 divide-y divide-slate-200">
                {activeBuyerSummary.salesList.map((sale) => (
                  <div key={sale.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{sale.sweetName}</div>
                      <div className="text-[10px] text-slate-500">
                        {sale.quantity}x a {formatCurrency(sale.unitPrice)} • Data: {new Date(sale.saleDate).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <div className="font-black text-slate-900">
                      {formatCurrency(sale.totalPrice)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Balance */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-900">Saldo Pendente de Cobrança:</div>
                  <div className="text-2xl font-black text-amber-800 font-mono">
                    {formatCurrency(activeBuyerSummary.pendingBalance)}
                  </div>
                </div>
                {activeBuyerSummary.isFullyPaid && (
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-300">
                    ✓ Totalmente Quitado
                  </span>
                )}
              </div>
            </div>

            {/* Actions in Floating Card */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              {activeBuyerSummary.pendingBalance > 0 && (
                <button
                  type="button"
                  onClick={() => handleMarkAsPaid(activeBuyerSummary)}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-md hover:scale-[1.01] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>MARCAR COMO PAGO / QUITADO</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleWhatsAppBill(activeBuyerSummary)}
                className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-2xl shadow-md hover:scale-[1.01] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>ENVIAR COBRANÇA VIA WHATSAPP COM PIX</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
