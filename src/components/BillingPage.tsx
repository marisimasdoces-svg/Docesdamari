import React, { useState } from 'react';
import { AppState, Buyer, PaymentRecord, Sale, User } from '../types';
import { formatCurrency, formatDateBR, formatMonthShort } from '../lib/storage';
import { applyReadyStockDelta, saoPauloDateKey } from '../lib/readyStock';
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
  Trash2,
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');

  // Floating Panel State
  const [activeBuyerSummary, setActiveBuyerSummary] = useState<BuyerBillingSummary | null>(null);
  const [showBuyerListModal, setShowBuyerListModal] = useState(false);

  // Filter sales for selected month (or all if selectedMonth is empty)
  const salesInMonth = state.sales.filter((s) => !selectedMonth || s.monthKey === selectedMonth);

  // Construct complete buyer map combining state.buyers and any buyers present in sales
  const buyerMap = new Map<string, Buyer>();
  state.buyers.forEach((b) => {
    if (b && b.id) buyerMap.set(b.id, b);
  });
  state.sales.forEach((s) => {
    const key = s.buyerId || `name-${(s.buyerName || '').trim().toLowerCase()}`;
    if (!buyerMap.has(key)) {
      buyerMap.set(key, {
        id: s.buyerId || `buyer-${Date.now()}`,
        name: s.buyerName || 'Comprador Sem Nome',
        department: s.department || 'outros',
        createdAt: s.saleDate,
      });
    }
  });
  const allBuyers = Array.from(buyerMap.values());

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

  const buyerSummaries: BuyerBillingSummary[] = allBuyers
    .map((buyer) => {
      const buyerSales = salesInMonth.filter(
        (s) =>
          (s.buyerId && s.buyerId === buyer.id) ||
          (s.buyerName && s.buyerName.trim().toLowerCase() === buyer.name.trim().toLowerCase())
      );
      const totalDoces = buyerSales.reduce((acc, curr) => acc + curr.quantity, 0);
      const totalGrossValue = buyerSales.reduce((acc, curr) => acc + curr.totalPrice, 0);

      const paidImmediatelyValue = buyerSales
        .filter((s) => s.isPaidImmediately)
        .reduce((acc, curr) => acc + curr.totalPrice, 0);

      const buyerPayments = state.payments.filter(
        (p) =>
          ((p.buyerId && p.buyerId === buyer.id) ||
            (p.buyerName && p.buyerName.trim().toLowerCase() === buyer.name.trim().toLowerCase())) &&
          (!selectedMonth || p.monthKey === selectedMonth)
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
    const nowIso = new Date().toISOString();
    const newPaymentRecord: PaymentRecord = {
      id: `pay-${Date.now()}`,
      buyerId: sum.buyer.id,
      buyerName: sum.buyer.name,
      monthKey: selectedMonth,
      amountPaid: sum.pendingBalance,
      paymentDate: nowIso,
      updatedAt: nowIso,
      paymentMethod: 'pix',
      notes: 'Quitação direta pelo card flutuante de cobrança',
      registeredBy: currentUser.name,
    };

    const updatedSales = state.sales.map((sale) => {
      if (
        (sale.buyerId === sum.buyer.id ||
          sale.buyerName.trim().toLowerCase() === sum.buyer.name.trim().toLowerCase()) &&
        (!selectedMonth || sale.monthKey === selectedMonth)
      ) {
        return {
          ...sale,
          paymentStatus: 'paid' as const,
          paymentMethod: 'pix',
          updatedAt: nowIso,
        };
      }
      return sale;
    });

    const newState = {
      ...state,
      sales: updatedSales,
      payments: [newPaymentRecord, ...state.payments],
    };

    onStateChange(newState);

    confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    setActiveBuyerSummary(null);
  };

  // Revert payment status (desfazer quitação)
  const handleUnmarkAsPaid = (sum: BuyerBillingSummary) => {
    if (window.confirm(`Desfazer a quitação das vendas de ${sum.buyer.name}? Elas voltarão a ficar pendentes.`)) {
      const nowIso = new Date().toISOString();
      const updatedSales = state.sales.map((sale) => {
        if (
          (sale.buyerId === sum.buyer.id ||
            sale.buyerName.trim().toLowerCase() === sum.buyer.name.trim().toLowerCase()) &&
          (!selectedMonth || sale.monthKey === selectedMonth)
        ) {
          return {
            ...sale,
            paymentStatus: sale.isPaidImmediately ? ('paid' as const) : ('pending' as const),
            updatedAt: nowIso,
          };
        }
        return sale;
      });

      const updatedPayments = state.payments.map((payment) => {
        const matchesBuyer = payment.buyerId === sum.buyer.id ||
          payment.buyerName.trim().toLowerCase() === sum.buyer.name.trim().toLowerCase();
        const matchesMonth = !selectedMonth || payment.monthKey === selectedMonth;
        return matchesBuyer && matchesMonth
          ? { ...payment, deletedAt: nowIso, updatedAt: nowIso }
          : payment;
      });

      const newState: AppState = {
        ...state,
        sales: updatedSales,
        payments: updatedPayments,
      };

      onStateChange(newState);
      setActiveBuyerSummary(null);
    }
  };

  // Delete all sales & records for a buyer in current month
  const handleDeleteBuyerData = (sum: BuyerBillingSummary) => {
    if (
      window.confirm(
        `Excluir todos os lançamentos de ${sum.buyer.name}? As vendas deste comprador serão apagadas e os potes devolvidos ao estoque.`
      )
    ) {
      const nowIso = new Date().toISOString();
      const saleIdsToDelete = new Set(sum.salesList.map((s) => s.id));

      const updatedBatches = state.batches.map((b) => {
        const soldInBatch = sum.salesList
          .filter((s) => s.batchId === b.id)
          .reduce((acc, curr) => acc + curr.quantity, 0);
        if (soldInBatch > 0) {
          return { ...b, totalSold: Math.max(0, b.totalSold - soldInBatch), updatedAt: nowIso };
        }
        return b;
      });

      const updatedSales = state.sales.map((sale) => {
        const matchesBuyer = sale.buyerId === sum.buyer.id ||
          sale.buyerName.trim().toLowerCase() === sum.buyer.name.trim().toLowerCase();
        const matchesMonth = !selectedMonth || sale.monthKey === selectedMonth;
        return saleIdsToDelete.has(sale.id) || (matchesBuyer && matchesMonth)
          ? { ...sale, deletedAt: nowIso, updatedAt: nowIso }
          : sale;
      });

      const updatedPayments = state.payments.map((payment) => {
        const matchesBuyer = payment.buyerId === sum.buyer.id ||
          payment.buyerName.trim().toLowerCase() === sum.buyer.name.trim().toLowerCase();
        const matchesMonth = !selectedMonth || payment.monthKey === selectedMonth;
        return matchesBuyer && matchesMonth
          ? { ...payment, deletedAt: nowIso, updatedAt: nowIso }
          : payment;
      });

      const stockToReturn = sum.salesList.reduce(
        (total, sale) => total + Math.max(0, sale.readyStockMovementQuantity ?? 0),
        0,
      );
      const soldTodayToReverse = sum.salesList.reduce(
        (total, sale) => total + Math.max(0, sale.readyStockDailyMovements?.[saoPauloDateKey(nowIso)] ?? 0),
        0,
      );

      const newState: AppState = {
        ...state,
        sales: updatedSales,
        payments: updatedPayments,
        batches: updatedBatches,
        utilitySettings: applyReadyStockDelta(
          state.utilitySettings,
          stockToReturn,
          nowIso,
          -soldTodayToReverse,
        ),
      };

      onStateChange(newState);
      setActiveBuyerSummary(null);
    }
  };

  // Delete a sale
  const handleDeleteSale = (saleId: string) => {
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale) return;

    if (window.confirm(`Excluir a venda de ${sale.quantity}x ${sale.sweetName} para ${sale.buyerName}?`)) {
      const nowIso = new Date().toISOString();
      const updatedSales = state.sales.map((item) =>
        item.id === saleId ? { ...item, deletedAt: nowIso, updatedAt: nowIso } : item
      );
      const updatedBatches = state.batches.map((b) => {
        if (b.id === sale.batchId) {
          return { ...b, totalSold: Math.max(0, b.totalSold - sale.quantity), updatedAt: nowIso };
        }
        return b;
      });

      const stockToReturn = Math.max(0, sale.readyStockMovementQuantity ?? 0);
      const soldTodayToReverse = Math.max(0, sale.readyStockDailyMovements?.[saoPauloDateKey(nowIso)] ?? 0);
      const newState: AppState = {
        ...state,
        sales: updatedSales,
        batches: updatedBatches,
        utilitySettings: applyReadyStockDelta(
          state.utilitySettings,
          stockToReturn,
          nowIso,
          -soldTodayToReverse,
        ),
      };

      onStateChange(newState);
      setActiveBuyerSummary(null);
    }
  };

  // WhatsApp Message
  const handleWhatsAppBill = (sum: BuyerBillingSummary) => {
    const phone = sum.buyer.phone || (sum.salesList[0] ? state.buyers.find(b => b.id === sum.salesList[0].buyerId)?.phone : '');
    const purchaseSummary = Array.from(
      sum.salesList.reduce((items, sale) => {
        items.set(sale.sweetName, (items.get(sale.sweetName) || 0) + sale.quantity);
        return items;
      }, new Map<string, number>())
    ).map(([name, quantity]) => `${quantity}x ${name}`).join(', ');
    const text = `Olá, ${sum.buyer.name.split(' ')[0]}. Tudo bem?\n\nEstou entrando em contato sobre as compras na Doces da Mari referentes a ${formatMonthShort(selectedMonth)}:\n${purchaseSummary || `${sum.totalDoces} potes`}\n\n*Valor pendente: ${formatCurrency(sum.pendingBalance)}*\n\nPIX (e-mail): mdamerso@hotmail.com\nFavorecida: Mariane Simas\n\nApós o pagamento, pode enviar o comprovante por aqui. Obrigado.`;
    const encoded = encodeURIComponent(text);
    const url = phone
      ? `https://wa.me/55${phone.replace(/\D/g, '')}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-24 overflow-x-hidden">
      {/* 1. BLOCO SUPERIOR COM BOTÃO PRINCIPAL "DÉBITOS MÊS DE:" */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-800 border border-purple-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <Receipt className="w-3.5 h-3.5" />
              <span>Controle de Cobrança Rápida</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Gestão de Devedores
            </h2>
          </div>

          {/* BOTÃO SOLICITADO: DÉBITOS MÊS DE: */}
          <button
            type="button"
            onClick={() => setShowBuyerListModal(true)}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-purple-700 via-purple-600 to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white font-black text-sm rounded-2xl shadow-lg hover:shadow-purple-200 transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-95 border border-purple-500"
          >
            <Calendar className="w-5 h-5 text-amber-300" />
            <span>Débitos Mês de: {formatMonthShort(selectedMonth)}</span>
            <span className="bg-amber-400 text-slate-950 text-xs px-2 py-0.5 rounded-full font-black ml-1">
              {buyerSummaries.filter((s) => s.pendingBalance > 0).length} devedores
            </span>
          </button>
        </div>

        {/* 3 SUMMARY CARDS EXCLUSIVOS DE COBRANÇA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          {/* Card 1: Quanto tem a receber */}
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-1">
            <div className="text-xs font-bold uppercase text-amber-800 tracking-wider">
              1. Saldo Fiado Pendente
            </div>
            <div className="text-3xl font-black text-amber-800 font-mono">
              {formatCurrency(totalMonthPending)}
            </div>
            <div className="text-[11px] text-amber-700 font-medium">
              Valor total a cobrar em {formatMonthShort(selectedMonth)}
            </div>
          </div>

          {/* Card 2: Quanto recebeu */}
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-1">
            <div className="text-xs font-bold uppercase text-emerald-800 tracking-wider">
              2. Total Já Quitado
            </div>
            <div className="text-3xl font-black text-emerald-700 font-mono">
              {formatCurrency(totalMonthPaid)}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium">
              Total pago / recebido no mês
            </div>
          </div>

          {/* Card 3: Inadimplentes */}
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl space-y-1">
            <div className="text-xs font-bold uppercase text-purple-800 tracking-wider">
              3. Clientes Inadimplentes
            </div>
            <div className="text-3xl font-black text-purple-950 font-mono">
              {buyerSummaries.filter((s) => s.pendingBalance > 0).length} <span className="text-sm font-semibold">compradores</span>
            </div>
            <div className="text-[11px] text-purple-700 font-medium">
              Clientes com saldo pendente no mês
            </div>
          </div>
        </div>
      </div>

      {/* MODAL / CARD FLUTUANTE DE DÉBITOS DO MÊS */}
      {showBuyerListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full mb-1">
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Chave Pix: mdamerso@hotmail.com</span>
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  Débitos Mês de: {formatMonthShort(selectedMonth)}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Envie a cobrança com o Pix diretamente para o WhatsApp do devedor ou quite seu saldo.
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
                  placeholder="Buscar devedor ou repartição..."
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
                  Devedores ({buyerSummaries.filter((s) => s.pendingBalance > 0).length})
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

            {/* DEBTORS LIST TABLE INSIDE MODAL */}
            {filteredSummaries.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl text-slate-400 text-xs font-semibold">
                Nenhum devedor encontrado para o mês de {formatMonthShort(selectedMonth)}.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider bg-slate-50">
                      <th className="py-3 px-4">Devedor</th>
                      <th className="py-3 px-4">Repartição</th>
                      <th className="py-3 px-4 text-center">Potes</th>
                      <th className="py-3 px-4">Valor Total</th>
                      <th className="py-3 px-4">Saldo Pendente</th>
                      <th className="py-3 px-4 text-right">Ação de Cobrança</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSummaries.map((sum) => (
                      <tr key={sum.buyer.id} className="hover:bg-purple-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-black text-slate-900 whitespace-nowrap">
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
                          <span className={sum.pendingBalance > 0 ? 'text-amber-700 font-black' : 'text-emerald-700 font-bold'}>
                            {sum.pendingBalance > 0 ? formatCurrency(sum.pendingBalance) : 'R$ 0,00'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {sum.pendingBalance > 0 ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleWhatsAppBill(sum)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                                  title="Enviar Cobrança WhatsApp com Pix"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>Whats</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleMarkAsPaid(sum)}
                                  className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                                  title="Quitar Débito"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Quitar</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-1 rounded-full font-bold">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Quitado
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUnmarkAsPaid(sum)}
                                  className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                  title="Desfazer quitação (voltar para pendente)"
                                >
                                  Desfazer
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteBuyerData(sum)}
                              className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Excluir este comprador/vendas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* 2. DIRECT LIST OF BUYERS AND BILLING CONTROLS */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Lista de Compradores & Cobrança Rápida ({formatMonthShort(selectedMonth)})
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Envie mensagens via WhatsApp ou quite o fiado diretamente nos botões abaixo.
            </p>
          </div>

          {/* Direct Dropdown for Fast Select */}
          <div className="w-full md:w-80">
            <select
              value=""
              onChange={(e) => {
                const found = buyerSummaries.find(s => s.buyer.id === e.target.value);
                if (found) setActiveBuyerSummary(found);
              }}
              className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-purple-600 cursor-pointer shadow-2xs"
            >
              <option value="">-- Buscar Comprador para Card Flutuante --</option>
              {buyerSummaries.map((sum) => (
                <option key={sum.buyer.id} value={sum.buyer.id}>
                  👤 {sum.buyer.name} ({sum.buyer.department}) — {sum.pendingBalance > 0 ? `Pendente: ${formatCurrency(sum.pendingBalance)}` : '✓ Quitado'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="relative sm:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar comprador ou repartição..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-600"
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-600 cursor-pointer"
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

        {/* LIST TABLE DIRECTLY ON PAGE */}
        {filteredSummaries.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-semibold">
            Nenhum comprador encontrado em {formatMonthShort(selectedMonth)}.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider bg-slate-50">
                  <th className="py-3 px-4">Comprador</th>
                  <th className="py-3 px-4">Repartição</th>
                  <th className="py-3 px-4 text-center">Potes Comprados</th>
                  <th className="py-3 px-4">Valor Total</th>
                  <th className="py-3 px-4">Saldo Pendente</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações de Cobrança</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSummaries.map((sum) => (
                  <tr key={sum.buyer.id} className="hover:bg-purple-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-black text-slate-900 whitespace-nowrap">
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
                      <span className={sum.pendingBalance > 0 ? 'text-amber-700 font-extrabold' : 'text-emerald-700 font-bold'}>
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
                      <div className="flex items-center justify-end gap-1.5">
                        {sum.pendingBalance > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleMarkAsPaid(sum)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                            title="Quitar Venda"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Quitar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUnmarkAsPaid(sum)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 border border-amber-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                            title="Desfazer quitação (voltar a ficar pendente)"
                          >
                            <span>Desfazer</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleWhatsAppBill(sum)}
                          className="p-1.5 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                          title="Enviar Cobrança via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Cobrar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveBuyerSummary(sum)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                          title="Abrir Card Flutuante"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Card</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBuyerData(sum)}
                          className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="Excluir lançamentos e comprador"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                  <div key={sale.id} className="pt-2 first:pt-0 flex items-center justify-between text-xs gap-2">
                    <div>
                      <div className="font-bold text-slate-900">{sale.sweetName}</div>
                      <div className="text-[10px] text-slate-500">
                        {sale.quantity}x a {formatCurrency(sale.unitPrice)} • Data: {formatDateBR(sale.saleDate)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-black text-slate-900">
                        {formatCurrency(sale.totalPrice)}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSale(sale.id)}
                        className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Excluir esta venda"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
              {activeBuyerSummary.pendingBalance > 0 ? (
                <button
                  type="button"
                  onClick={() => handleMarkAsPaid(activeBuyerSummary)}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-md hover:scale-[1.01] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>MARCAR COMO PAGO / QUITADO</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleUnmarkAsPaid(activeBuyerSummary)}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-2xl shadow-md hover:scale-[1.01] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>DESFAZER QUITAÇÃO (VOLTAR A FICAR PENDENTE)</span>
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

              <button
                type="button"
                onClick={() => handleDeleteBuyerData(activeBuyerSummary)}
                className="w-full py-3 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 font-extrabold text-xs rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>EXCLUIR TODAS AS VENDAS DESTE COMPRADOR</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
