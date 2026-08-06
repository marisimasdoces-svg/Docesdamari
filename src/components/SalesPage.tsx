import React, { useState } from 'react';
import { AppState, Sale, User } from '../types';
import { saveState, formatCurrency } from '../lib/storage';
import {
  ShoppingBag,
  Plus,
  Trash2,
  MessageCircle,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  X,
  Eye,
  Settings,
  Building2,
} from 'lucide-react';

interface SalesPageProps {
  state: AppState;
  onStateChange: (newState: AppState) => void;
  selectedMonth: string;
  currentUser: User;
}

export const SalesPage: React.FC<SalesPageProps> = ({
  state,
  onStateChange,
  selectedMonth,
  currentUser,
}) => {
  // FORM STATES
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerDept, setBuyerDept] = useState(state.departments[0] || '1º Esqd C Mec');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [selectedSweetId, setSelectedSweetId] = useState(state.sweets[0]?.id || '');
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [isPaid, setIsPaid] = useState(false); // false = Pendurou (Fiado), true = Pagou no ato
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'dinheiro'>('pix');
  const [saleNotes, setSaleNotes] = useState('');

  // MODAL STATES
  const [showNominalSalesModal, setShowNominalSalesModal] = useState(false);
  const [showDeptsModal, setShowDeptsModal] = useState(false);
  const [newDeptInput, setNewDeptInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Active production batch & sweets stock
  const activeBatches = state.batches.filter((b) => b.status === 'active');
  const activeBatch = activeBatches[0] || state.batches[0];

  const selectedSweet = state.sweets.find((s) => s.id === selectedSweetId) || state.sweets[0];
  const sweetBatch = state.batches.find((b) => b.sweetId === selectedSweetId && b.status === 'active') || activeBatch;
  const sweetStockRemaining = sweetBatch ? Math.max(0, sweetBatch.totalProduced - sweetBatch.totalSold) : 0;

  // Handle buyer dropdown select
  const handleSelectBuyerChange = (buyerId: string) => {
    setSelectedBuyerId(buyerId);
    if (buyerId === 'new' || !buyerId) {
      setBuyerName('');
      setBuyerPhone('');
    } else {
      const b = state.buyers.find((item) => item.id === buyerId);
      if (b) {
        setBuyerName(b.name);
        setBuyerDept(b.department);
        setBuyerPhone(b.phone || '');
      }
    }
  };

  // SUBMIT: REGISTER SALE
  const handleRegisterSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim()) return;

    let buyer = state.buyers.find(
      (b) => b.name.toLowerCase() === buyerName.trim().toLowerCase()
    );

    let updatedBuyers = [...state.buyers];
    if (!buyer) {
      buyer = {
        id: `buyer-${Date.now()}`,
        name: buyerName.trim(),
        department: buyerDept.trim(),
        phone: buyerPhone.trim(),
        createdAt: new Date().toISOString(),
      };
      updatedBuyers = [buyer, ...updatedBuyers];
    } else if (buyerPhone && buyerPhone !== buyer.phone) {
      updatedBuyers = updatedBuyers.map((b) =>
        b.id === buyer!.id ? { ...b, phone: buyerPhone.trim() } : b
      );
    }

    const sweet = state.sweets.find((s) => s.id === selectedSweetId) || state.sweets[0];
    const unitPrice = sweet ? sweet.price : 13.0;
    const quantity = Number(saleQuantity);
    const totalPrice = quantity * unitPrice;

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      buyerId: buyer.id,
      buyerName: buyer.name,
      department: buyerDept,
      sweetId: sweet.id,
      sweetName: sweet.name,
      batchId: sweetBatch ? sweetBatch.id : 'batch-default',
      quantity,
      unitPrice,
      totalPrice,
      saleDate: new Date().toISOString(),
      monthKey: selectedMonth,
      weekLabel: sweetBatch ? sweetBatch.weekLabel : 'Semana Atual',
      isPaidImmediately: isPaid,
      paymentStatus: isPaid ? 'paid' : 'pending',
      paymentDate: isPaid ? new Date().toISOString() : undefined,
      paymentMethod: isPaid ? paymentMethod : 'fiado',
      registeredBy: currentUser.name,
      notes: saleNotes.trim(),
    };

    const updatedBatches = state.batches.map((b) => {
      if (sweetBatch && b.id === sweetBatch.id) {
        return { ...b, totalSold: b.totalSold + quantity };
      }
      return b;
    });

    const newState: AppState = {
      ...state,
      buyers: updatedBuyers,
      sales: [newSale, ...state.sales],
      batches: updatedBatches,
    };

    saveState(newState);
    onStateChange(newState);

    // Reset form
    setSelectedBuyerId('');
    setBuyerName('');
    setBuyerPhone('');
    setSaleQuantity(1);
    setIsPaid(false);
    setSaleNotes('');
  };

  // DELETE SALE
  const handleDeleteSale = (saleId: string) => {
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale) return;

    if (window.confirm(`Cancelar a venda de ${sale.quantity}x ${sale.sweetName} para ${sale.buyerName}?`)) {
      const updatedSales = state.sales.filter((s) => s.id !== saleId);
      const updatedBatches = state.batches.map((b) => {
        if (b.id === sale.batchId) {
          return { ...b, totalSold: Math.max(0, b.totalSold - sale.quantity) };
        }
        return b;
      });

      const newState: AppState = {
        ...state,
        sales: updatedSales,
        batches: updatedBatches,
      };

      saveState(newState);
      onStateChange(newState);
    }
  };

  // REPARTIÇÃO MANAGEMENT
  const handleAddDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptInput.trim()) return;
    const name = newDeptInput.trim();
    if (state.departments.includes(name)) {
      alert('Esta repartição já existe.');
      return;
    }
    const updated = [...state.departments, name];
    onStateChange({ ...state, departments: updated });
    saveState({ ...state, departments: updated });
    setNewDeptInput('');
  };

  const handleDeleteDept = (deptToDelete: string) => {
    if (window.confirm(`Deseja remover a repartição "${deptToDelete}"?`)) {
      const updated = state.departments.filter((d) => d !== deptToDelete);
      onStateChange({ ...state, departments: updated });
      saveState({ ...state, departments: updated });
    }
  };

  // SEND WHATSAPP
  const handleSendWhatsApp = (sale: Sale) => {
    const phone = sale.buyerId ? state.buyers.find((b) => b.id === sale.buyerId)?.phone : '';
    const text = `Olá ${sale.buyerName.split(' ')[0]}! Tudo bem? 🧁\n\nConfirmando sua compra de ${sale.quantity}x ${sale.sweetName} (*${formatCurrency(sale.totalPrice)}*).\n\nChave PIX para pagamento: marisimasdoces@gmail.com\nMuito obrigado! 🙏`;
    const url = phone
      ? `https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // PRINT PDF BY REPARTIÇÃO
  const handlePrintPDF = () => {
    window.print();
  };

  // Monthly statistics numbers
  const monthSales = state.sales.filter((s) => s.monthKey === selectedMonth);
  const fiadoSales = monthSales.filter((s) => s.paymentStatus === 'pending');
  const paidSales = monthSales.filter((s) => s.paymentStatus === 'paid');

  const countFiado = fiadoSales.length;
  const countPaid = paidSales.length;
  const countTotal = monthSales.length;

  const filteredSales = monthSales.filter(
    (s) =>
      s.buyerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.sweetName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-24 overflow-x-hidden">
      {/* ITEM 1: MENU DE VENDAS (NUMBERS ONLY SUMMARY + ACTION BUTTON) */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-800 border border-purple-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Menu de Vendas</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Vendas Registradas no Mês ({selectedMonth})
            </h2>
          </div>

          {/* Discrete Repartição Settings Option */}
          <button
            type="button"
            onClick={() => setShowDeptsModal(true)}
            className="text-xs font-bold text-slate-500 hover:text-purple-700 bg-slate-100 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Gerenciar Repartições</span>
          </button>
        </div>

        {/* Pure Numeric Counters (No names, just numbers!) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-amber-800 tracking-wider">
                Vendas Fiado
              </div>
              <div className="text-3xl font-black text-amber-950 font-mono mt-1">
                {countFiado} <span className="text-xs font-bold text-amber-700">vendas</span>
              </div>
            </div>
            <div className="w-10 h-10 bg-amber-200/60 rounded-xl flex items-center justify-center text-xl">
              📋
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-emerald-800 tracking-wider">
                Vendas Pagas
              </div>
              <div className="text-3xl font-black text-emerald-950 font-mono mt-1">
                {countPaid} <span className="text-xs font-bold text-emerald-700">vendas</span>
              </div>
            </div>
            <div className="w-10 h-10 bg-emerald-200/60 rounded-xl flex items-center justify-center text-xl">
              ✅
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-purple-800 tracking-wider">
                Total do Mês
              </div>
              <div className="text-3xl font-black text-purple-950 font-mono mt-1">
                {countTotal} <span className="text-xs font-bold text-purple-700">vendas</span>
              </div>
            </div>
            <div className="w-10 h-10 bg-purple-200/60 rounded-xl flex items-center justify-center text-xl">
              📊
            </div>
          </div>
        </div>

        {/* Button below numbers to open Floating Nominal Sales Panel */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowNominalSalesModal(true)}
            className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-sm rounded-2xl shadow-md hover:shadow-purple-200 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Eye className="w-5 h-5" />
            <span>Visualizar Vendas</span>
          </button>
        </div>
      </div>

      {/* REGISTRATION FORM CARD */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
            <Plus className="w-5 h-5 text-purple-600" />
            <span>Lançamento Rápido de Venda</span>
          </div>
          {sweetStockRemaining > 0 && (
            <span className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full">
              Estoque: {sweetStockRemaining} potes
            </span>
          )}
        </div>

        <form onSubmit={handleRegisterSale} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Buyer Select or New */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Comprador Cadastrado:
              </label>
              <select
                value={selectedBuyerId}
                onChange={(e) => handleSelectBuyerChange(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-600 transition-colors"
              >
                <option value="">-- Cadastrar Novo Comprador Abaixo --</option>
                {state.buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.department})
                  </option>
                ))}
              </select>
            </div>

            {/* Buyer Name Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nome do Comprador <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Ex: Zezinho, Sgt. Oliveira, Dr. Paulo..."
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-purple-600 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Repartição Select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Repartição / Setor <span className="text-rose-500">*</span>
              </label>
              <select
                value={buyerDept}
                onChange={(e) => setBuyerDept(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-600 transition-colors"
              >
                {state.departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                WhatsApp do Comprador (para cobranças):
              </label>
              <input
                type="text"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="(61) 99999-8888"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-600 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Product Sweet Select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Produto / Doce:
              </label>
              <select
                value={selectedSweetId}
                onChange={(e) => setSelectedSweetId(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-purple-900 focus:bg-white focus:outline-none focus:border-purple-600 transition-colors"
              >
                {state.sweets.map((sw) => (
                  <option key={sw.id} value={sw.id}>
                    {sw.name} — {formatCurrency(sw.price)}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Quantidade de Potes:
              </label>
              <input
                type="number"
                min="1"
                value={saleQuantity}
                onChange={(e) => setSaleQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-slate-900 focus:bg-white focus:outline-none focus:border-purple-600 transition-colors"
              />
            </div>

            {/* Status: Fiado vs Pagou no ato */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Status do Pagamento:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaid(false)}
                  className={`p-3 rounded-2xl border text-xs font-bold cursor-pointer transition-all ${
                    !isPaid
                      ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  📋 Fiado
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaid(true)}
                  className={`p-3 rounded-2xl border text-xs font-bold cursor-pointer transition-all ${
                    isPaid
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-900 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  ✅ Pagou
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-black text-sm rounded-2xl shadow-lg hover:shadow-purple-200 hover:scale-[1.005] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 border border-purple-500"
          >
            <Plus className="w-5 h-5" />
            <span>CONFIRMAR E REGISTRAR VENDA</span>
          </button>
        </form>
      </div>

      {/* FLOATING PANEL FOR NOMINAL SALES (PAINEL FLUTUANTE) */}
      {showNominalSalesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:static print:bg-transparent print:p-0">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 w-full max-w-5xl shadow-2xl space-y-5 my-auto max-h-[90vh] flex flex-col print:max-h-none print:shadow-none print:border-none print:w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0 print:hidden">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
                <Eye className="w-5 h-5 text-purple-600" />
                <span>Painel de Vendas Nominais ({selectedMonth})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintPDF}
                  className="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir em PDF por Repartição</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowNominalSalesModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Only Header (Shows on PDF generation) */}
            <div className="hidden print:block text-center space-y-1 mb-6 border-b pb-4">
              <h1 className="text-2xl font-black text-black uppercase">MARISIMAS DOCES</h1>
              <h2 className="text-lg font-bold text-gray-800">
                Relatório de Vendas e Cobrança por Repartição — {selectedMonth}
              </h2>
              <p className="text-xs text-gray-500">
                Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
              </p>
            </div>

            {/* Search filter in modal */}
            <div className="flex items-center justify-between gap-3 shrink-0 print:hidden">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar comprador, doce ou setor..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-600"
                />
              </div>
              <div className="text-xs font-bold text-slate-500 whitespace-nowrap">
                {filteredSales.length} vendas listadas
              </div>
            </div>

            {/* Standard Screen Nominal List Table */}
            <div className="overflow-y-auto flex-1 space-y-6 print:hidden">
              {filteredSales.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                  Nenhuma venda cadastrada neste mês.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider bg-slate-50 sticky top-0">
                        <th className="py-3 px-3">Data</th>
                        <th className="py-3 px-3">Comprador</th>
                        <th className="py-3 px-3">Repartição</th>
                        <th className="py-3 px-3">Produto</th>
                        <th className="py-3 px-3 text-center">Qtd</th>
                        <th className="py-3 px-3">Valor Total</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-purple-50/50 transition-colors">
                          <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                            {new Date(sale.saleDate).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {sale.buyerName}
                          </td>
                          <td className="py-3 px-3 text-slate-700 whitespace-nowrap font-semibold">
                            🏢 {sale.department}
                          </td>
                          <td className="py-3 px-3 font-semibold text-purple-800 whitespace-nowrap">
                            {sale.sweetName}
                          </td>
                          <td className="py-3 px-3 text-center font-black text-slate-900">
                            {sale.quantity}x
                          </td>
                          <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap">
                            {formatCurrency(sale.totalPrice)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {sale.paymentStatus === 'paid' ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] px-2.5 py-1 rounded-full font-bold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Pagou
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-200 text-[10px] px-2.5 py-1 rounded-full font-bold">
                                <Clock className="w-3 h-3 text-amber-600" /> Fiado
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSendWhatsApp(sale)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded-xl transition-all cursor-pointer"
                                title="Enviar WhatsApp"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSale(sale.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                title="Excluir Venda"
                              >
                                <Trash2 className="w-4 h-4" />
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

            {/* PDF PRINT STRUCTURE (Divided cleanly per Repartição) */}
            <div className="hidden print:block space-y-8 text-black">
              {state.departments.map((dept) => {
                const deptSales = monthSales.filter((s) => s.department === dept);
                if (deptSales.length === 0) return null;

                const deptTotalVal = deptSales.reduce((acc, s) => acc + s.totalPrice, 0);
                const deptPendingVal = deptSales
                  .filter((s) => s.paymentStatus === 'pending')
                  .reduce((acc, s) => acc + s.totalPrice, 0);

                return (
                  <div key={dept} className="border border-black rounded p-4 space-y-3 page-break-inside-avoid">
                    <div className="flex justify-between items-center border-b border-black pb-2">
                      <h3 className="text-lg font-black uppercase">REPARTIÇÃO: {dept}</h3>
                      <div className="text-xs font-bold">
                        Total Pendente: {formatCurrency(deptPendingVal)} | Total Geral: {formatCurrency(deptTotalVal)}
                      </div>
                    </div>

                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-400 font-bold uppercase text-[10px]">
                          <th className="py-1">Data</th>
                          <th className="py-1">Comprador</th>
                          <th className="py-1">Produto</th>
                          <th className="py-1 text-center">Qtd</th>
                          <th className="py-1">Valor</th>
                          <th className="py-1 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {deptSales.map((s) => (
                          <tr key={s.id}>
                            <td className="py-1">{new Date(s.saleDate).toLocaleDateString('pt-BR')}</td>
                            <td className="py-1 font-bold">{s.buyerName}</td>
                            <td className="py-1">{s.sweetName}</td>
                            <td className="py-1 text-center">{s.quantity}</td>
                            <td className="py-1 font-mono">{formatCurrency(s.totalPrice)}</td>
                            <td className="py-1 text-right uppercase font-bold">
                              {s.paymentStatus === 'paid' ? 'PAGO' : 'PENDENTE (FIADO)'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DISCRETE MODAL FOR MANAGING REPARTIÇÕES */}
      {showDeptsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
                <Building2 className="w-5 h-5 text-purple-600" />
                <span>Gerenciar Repartições</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDeptsModal(false)}
                className="text-slate-400 hover:text-slate-800 text-lg font-bold px-2"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Adicione novas repartições ou exclua as existentes discretamente.
            </p>

            {/* Form to Add New Department */}
            <form onSubmit={handleAddDept} className="flex gap-2">
              <input
                type="text"
                value={newDeptInput}
                onChange={(e) => setNewDeptInput(e.target.value)}
                placeholder="Ex: 4º Esqd C Mec, Comando..."
                className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:border-purple-600"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Adicionar
              </button>
            </form>

            {/* List of Departments */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {state.departments.map((d) => (
                <div
                  key={d}
                  className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <span>🏢 {d}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteDept(d)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Excluir Repartição"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
