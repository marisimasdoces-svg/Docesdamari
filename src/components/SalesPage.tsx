import React, { useState } from 'react';
import { AppState, Sale, User } from '../types';
import { deleteDepartmentFromCloud, formatCurrency, formatDateBR, getSaoPauloDateKey } from '../lib/storage';
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
  Edit2,
  QrCode,
} from 'lucide-react';
import { PixPaymentModal } from './PixPaymentModal';
import { getAvailableReadyStock, reconcileReadyStockBatches } from '../lib/readyStock';

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
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showDeptsModal, setShowDeptsModal] = useState(false);
  const [newDeptInput, setNewDeptInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // RETROACTIVE SALES MODAL STATES
  const [showRetroactiveModal, setShowRetroactiveModal] = useState(false);
  const [retroBuyerName, setRetroBuyerName] = useState('');
  const [retroDept, setRetroDept] = useState(state.departments[0] || '1º Esqd C Mec');
  const [retroPhone, setRetroPhone] = useState('');
  const [retroSweetName, setRetroSweetName] = useState('Bolo de Pote');
  const [retroQuantityStr, setRetroQuantityStr] = useState('10');
  const [retroUnitPriceStr, setRetroUnitPriceStr] = useState('13.00');
  const [retroUnitCostStr, setRetroUnitCostStr] = useState('5.00'); // Gasto aproximado por pote
  const [retroDate, setRetroDate] = useState(() => `${selectedMonth}-01`);
  const [retroIsPaid, setRetroIsPaid] = useState(true);
  const [retroPaymentMethod, setRetroPaymentMethod] = useState<'pix' | 'dinheiro'>('pix');
  const [retroNotes, setRetroNotes] = useState('Venda realizada no início do mês (Anterior ao App)');

  // EDIT SALE MODAL STATES
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editUnitPrice, setEditUnitPrice] = useState<number>(13.0);
  const [editStatus, setEditStatus] = useState<'paid' | 'pending'>('pending');
  const [showInstantPix, setShowInstantPix] = useState(false);
  const [instantPixAmount, setInstantPixAmount] = useState(0);
  const [instantPixDescription, setInstantPixDescription] = useState('Pagamento Doces da Mari');

  const financialSettings = state.utilitySettings?.find((item) => item.id === 'financial-settings');
  const pixKey = financialSettings?.pixKey || 'mdamerso@hotmail.com';
  const pixRecipientName = financialSettings?.pixRecipientName || 'Mariane Simas';
  const pixCity = financialSettings?.pixCity || 'SANTANA LIVRAM';

  // Submit Retroactive Sale
  const handleRegisterRetroactiveSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!retroBuyerName.trim() || !retroSweetName.trim()) {
      alert('Por favor, preencha o nome do cliente e o nome do doce.');
      return;
    }

    const qty = parseInt(retroQuantityStr, 10) || 1;
    const unitPrice = parseFloat(retroUnitPriceStr.replace(',', '.')) || 13.0;
    const unitCost = parseFloat(retroUnitCostStr.replace(',', '.')) || 5.0;
    const totalPrice = qty * unitPrice;
    const nowIso = new Date().toISOString();

    let buyer = state.buyers.find(
      (b) => b.name.toLowerCase() === retroBuyerName.trim().toLowerCase()
    );

    let updatedBuyers = [...state.buyers];
    if (!buyer) {
      buyer = {
        id: `buyer-${Date.now()}`,
        name: retroBuyerName.trim(),
        department: retroDept.trim(),
        phone: retroPhone.trim(),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      updatedBuyers = [buyer, ...updatedBuyers];
    }

    const saleISO = new Date(`${retroDate}T12:00:00`).toISOString();

    const newSale: Sale = {
      id: `sale-retro-${Date.now()}`,
      buyerId: buyer.id,
      buyerName: buyer.name,
      department: retroDept,
      sweetId: `sweet-retro-${Date.now()}`,
      sweetName: retroSweetName.trim(),
      batchId: 'batch-retroactive',
      quantity: qty,
      unitPrice,
      totalPrice,
      saleDate: saleISO,
      monthKey: selectedMonth,
      weekLabel: 'Vendas Anteriores',
      isPaidImmediately: retroIsPaid,
      paymentStatus: retroIsPaid ? 'paid' : 'pending',
      paymentDate: retroIsPaid ? saleISO : undefined,
      paymentMethod: retroIsPaid ? retroPaymentMethod : 'fiado',
      registeredBy: currentUser.name,
      notes: retroNotes.trim(),
      isRetroactive: true,
      estimatedUnitCost: unitCost,
      updatedAt: nowIso,
    };

    const newState: AppState = {
      ...state,
      buyers: updatedBuyers,
      sales: [newSale, ...state.sales],
    };

    onStateChange(newState);

    setShowRetroactiveModal(false);
    setRetroBuyerName('');
    alert(`🎉 Venda retroativa de ${qty}x ${retroSweetName} (R$ ${totalPrice.toFixed(2)}) cadastrada com sucesso e contabilizada no lucro!`);
  };

  // Estoque de doces prontos: permanente e somado em todos os lotes ativos do doce.
  const reconciledBatches = reconcileReadyStockBatches(state.batches, state.sales);
  const activeBatches = reconciledBatches.filter((b) => b.status === 'active');
  const selectedSweet = state.sweets.find((s) => s.id === selectedSweetId) || state.sweets[0];
  const batchesForSelectedSweet = activeBatches
    .filter((b) => selectedSweet && (b.sweetId === selectedSweet.id || b.sweetName.toLowerCase() === selectedSweet.name.toLowerCase()))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const sweetStockRemaining = selectedSweet
    ? getAvailableReadyStock(state.batches, state.sales, state.utilitySettings, selectedSweet.id, selectedSweet.name)
    : getAvailableReadyStock(state.batches, state.sales, state.utilitySettings);

  const allocateReadyStock = (batches: typeof state.batches, sweetId: string, sweetName: string, quantity: number) => {
    let remaining = quantity;
    const allocations: Array<{ batchId: string; quantity: number }> = [];
    let weightedCost = 0;
    const eligible = batches
      .filter((b) => b.status === 'active' && (b.sweetId === sweetId || b.sweetName.toLowerCase() === sweetName.toLowerCase()))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const updated = batches.map((batch) => {
      const eligibleBatch = eligible.find((item) => item.id === batch.id);
      if (!eligibleBatch || remaining <= 0) return batch;
      const available = Math.max(0, batch.totalProduced - batch.totalSold);
      const take = Math.min(available, remaining);
      if (take <= 0) return batch;
      remaining -= take;
      allocations.push({ batchId: batch.id, quantity: take });
      weightedCost += take * (batch.unitCost || 0);
      return { ...batch, totalSold: batch.totalSold + take, updatedAt: new Date().toISOString() };
    });
    if (remaining > 0) {
      const fallback = [...eligible].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (fallback) allocations.push({ batchId: fallback.id, quantity: remaining });
      remaining = 0;
    }
    return { ok: true, batches: updated, allocations, unitCost: quantity > 0 && weightedCost > 0 ? weightedCost / quantity : 0 };
  };

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

    const nowIso = new Date().toISOString();

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
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      updatedBuyers = [buyer, ...updatedBuyers];
    } else if (buyerPhone && buyerPhone !== buyer.phone) {
      updatedBuyers = updatedBuyers.map((b) =>
        b.id === buyer!.id ? { ...b, phone: buyerPhone.trim(), updatedAt: nowIso } : b
      );
    }

    const sweet = state.sweets.find((s) => s.id === selectedSweetId) || state.sweets[0];
    const unitPrice = sweet ? sweet.price : 13.0;
    const quantity = Number(saleQuantity);
    const totalPrice = quantity * unitPrice;

    if (!sweet) {
      alert('Cadastre um doce antes de registrar a venda.');
      return;
    }
    if (quantity > sweetStockRemaining) {
      alert(`Estoque insuficiente de ${sweet.name}. Disponível agora: ${sweetStockRemaining} potes.`);
      return;
    }

    const allocation = allocateReadyStock(reconciledBatches, sweet.id, sweet.name, quantity);
    if (!allocation.ok) {
      alert('Não foi possível reservar os potes nos lotes disponíveis. Atualize a tela e tente novamente.');
      return;
    }
    const updatedBatches = allocation.batches;
    const saleUnitCost = allocation.unitCost || state.recipes.find(
      (recipe) => recipe.sweetId === sweet.id || recipe.sweetName.toLowerCase() === sweet.name.toLowerCase()
    )?.calculatedUnitCost;
    const targetBatchId = allocation.allocations[0]?.batchId || 'batch-default';
    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      buyerId: buyer.id,
      buyerName: buyer.name,
      department: buyerDept,
      sweetId: sweet ? sweet.id : 'sweet-default',
      sweetName: sweet ? sweet.name : 'Bolo de Pote',
      batchId: targetBatchId,
      quantity,
      unitPrice,
      totalPrice,
      saleDate: nowIso,
      updatedAt: nowIso,
      monthKey: selectedMonth,
      weekLabel: state.batches.find((b) => b.id === targetBatchId)?.weekLabel || 'Semana Atual',
      isPaidImmediately: isPaid,
      paymentStatus: isPaid ? 'paid' : 'pending',
      paymentDate: isPaid ? nowIso : undefined,
      paymentMethod: isPaid ? paymentMethod : 'fiado',
      registeredBy: currentUser.name,
      notes: saleNotes.trim(),
      estimatedUnitCost: saleUnitCost,
      batchAllocations: allocation.allocations,
    };

    const newState: AppState = {
      ...state,
      buyers: updatedBuyers,
      sales: [newSale, ...state.sales],
      batches: updatedBatches,
    };

    onStateChange(newState);
    if (isPaid && paymentMethod === 'pix') {
      setInstantPixAmount(totalPrice);
      setInstantPixDescription(`${buyer.name} · ${quantity}x ${sweet.name}`);
      setShowInstantPix(true);
    }

    // Reset form
    setSelectedBuyerId('');
    setBuyerName('');
    setBuyerPhone('');
    setSaleQuantity(1);
    setIsPaid(false);
    setSaleNotes('');
    setShowSaleForm(false);
  };

  // DELETE SALE
  const handleDeleteSale = (saleId: string) => {
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale) return;

    if (window.confirm(`Cancelar a venda de ${sale.quantity}x ${sale.sweetName} para ${sale.buyerName}?`)) {
      const nowIso = new Date().toISOString();
      const updatedSales = state.sales.map((item) =>
        item.id === saleId ? { ...item, deletedAt: nowIso, updatedAt: nowIso } : item
      );
      const allocations = sale.batchAllocations?.length ? sale.batchAllocations : [{ batchId: sale.batchId, quantity: sale.quantity }];
      const updatedBatches = state.batches.map((b) => {
        const returned = allocations.filter((item) => item.batchId === b.id).reduce((sum, item) => sum + item.quantity, 0);
        return returned > 0 ? { ...b, totalSold: Math.max(0, b.totalSold - returned), updatedAt: nowIso } : b;
      });

      const newState: AppState = {
        ...state,
        sales: updatedSales,
        batches: updatedBatches,
      };

      onStateChange(newState);
    }
  };

  // OPEN EDIT SALE
  const handleOpenEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setEditQuantity(sale.quantity);
    setEditUnitPrice(sale.unitPrice);
    setEditStatus(sale.paymentStatus);
  };

  // SAVE EDIT SALE
  const handleSaveEditSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;

    const nowIso = new Date().toISOString();
    const newQty = Math.max(1, editQuantity);
    const qtyDiff = newQty - editingSale.quantity;
    const newUnitPrice = editUnitPrice;
    const newTotalPrice = newQty * newUnitPrice;
    const isNowPaid = editStatus === 'paid';

    let updatedBatches = [...reconcileReadyStockBatches(state.batches, state.sales)];
    let nextAllocations = editingSale.batchAllocations?.length
      ? editingSale.batchAllocations.map((item) => ({ ...item }))
      : [{ batchId: editingSale.batchId, quantity: editingSale.quantity }];

    if (qtyDiff > 0) {
      const allocation = allocateReadyStock(updatedBatches, editingSale.sweetId, editingSale.sweetName, qtyDiff);
      if (!allocation.ok) {
        const availableNow = updatedBatches
          .filter((b) => b.status === 'active' && (b.sweetId === editingSale.sweetId || b.sweetName.toLowerCase() === editingSale.sweetName.toLowerCase()))
          .reduce((sum, b) => sum + Math.max(0, b.totalProduced - b.totalSold), 0);
        alert(`Não há doces suficientes para aumentar esta venda. Disponível para acrescentar: ${availableNow}.`);
        return;
      }
      updatedBatches = allocation.batches;
      allocation.allocations.forEach((extra) => {
        const existing = nextAllocations.find((item) => item.batchId === extra.batchId);
        if (existing) existing.quantity += extra.quantity; else nextAllocations.push(extra);
      });
    } else if (qtyDiff < 0) {
      let toReturn = Math.abs(qtyDiff);
      const returnedByBatch = new Map<string, number>();
      for (let i = nextAllocations.length - 1; i >= 0 && toReturn > 0; i -= 1) {
        const allocation = nextAllocations[i];
        const giveBack = Math.min(allocation.quantity, toReturn);
        allocation.quantity -= giveBack;
        toReturn -= giveBack;
        returnedByBatch.set(allocation.batchId, (returnedByBatch.get(allocation.batchId) || 0) + giveBack);
      }
      nextAllocations = nextAllocations.filter((item) => item.quantity > 0);
      updatedBatches = updatedBatches.map((b) => {
        const returned = returnedByBatch.get(b.id) || 0;
        return returned ? { ...b, totalSold: Math.max(0, b.totalSold - returned), updatedAt: nowIso } : b;
      });
    }

    const updatedSales = state.sales.map((s) => {
      if (s.id === editingSale.id) {
        return {
          ...s,
          quantity: newQty,
          unitPrice: newUnitPrice,
          totalPrice: newTotalPrice,
          paymentStatus: editStatus,
          isPaidImmediately: isNowPaid,
          paymentDate: isNowPaid ? (s.paymentDate || nowIso) : undefined,
          batchId: nextAllocations[0]?.batchId || s.batchId,
          batchAllocations: nextAllocations,
          updatedAt: nowIso,
        };
      }
      return s;
    });

    const newState: AppState = {
      ...state,
      sales: updatedSales,
      batches: updatedBatches,
    };

    onStateChange(newState);
    setEditingSale(null);
    alert(`🎉 Venda para ${editingSale.buyerName} alterada para ${newQty}x ${editingSale.sweetName} (Total: ${formatCurrency(newTotalPrice)})!`);
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
    setNewDeptInput('');
  };

  const handleDeleteDept = (deptToDelete: string) => {
    if (window.confirm(`Deseja remover a repartição "${deptToDelete}"?`)) {
      const updated = state.departments.filter((d) => d !== deptToDelete);
      deleteDepartmentFromCloud(deptToDelete);
      onStateChange({ ...state, departments: updated });
    }
  };

  // SEND WHATSAPP
  const handleSendWhatsApp = (sale: Sale) => {
    const phone = sale.buyerId ? state.buyers.find((b) => b.id === sale.buyerId)?.phone : '';
    const text = `Olá, ${sale.buyerName.split(' ')[0]}. Tudo bem?\n\nEstou entrando em contato sobre a sua compra na Doces da Mari:\n${sale.quantity}x ${sale.sweetName}\n\n*Valor pendente: ${formatCurrency(sale.totalPrice)}*\n\nPIX (e-mail): mdamerso@hotmail.com\nFavorecida: Mariane Simas\n\nApós o pagamento, pode enviar o comprovante por aqui. Obrigado.`;
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

  const countFiado = fiadoSales.reduce((total, sale) => total + sale.quantity, 0);
  const countPaid = paidSales.reduce((total, sale) => total + sale.quantity, 0);
  const countTotal = monthSales.reduce((total, sale) => total + sale.quantity, 0);
  const ordersTotal = monthSales.length;

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
                {countFiado} <span className="text-xs font-bold text-amber-700">potes</span>
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
                {countPaid} <span className="text-xs font-bold text-emerald-700">potes</span>
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
                {countTotal} <span className="text-xs font-bold text-purple-700">potes</span>
                <span className="block text-[10px] font-bold text-purple-600 mt-1">{ordersTotal} {ordersTotal === 1 ? 'pedido' : 'pedidos'}</span>
              </div>
            </div>
            <div className="w-10 h-10 bg-purple-200/60 rounded-xl flex items-center justify-center text-xl">
              📊
            </div>
          </div>
        </div>

        {/* Action buttons bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowSaleForm(!showSaleForm)}
            className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-sm rounded-2xl shadow-md hover:shadow-purple-200 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <Plus className="w-5 h-5" />
            <span>{showSaleForm ? 'Fechar Lançamento' : '+ Lançar Nova Venda'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRetroactiveModal(true)}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 border border-amber-600/30"
          >
            <Clock className="w-5 h-5 text-slate-950" />
            <span>📅 Lançar Vendas Anteriores</span>
          </button>



          <button
            type="button"
            onClick={() => setShowNominalSalesModal(true)}
            className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <Eye className="w-5 h-5 text-purple-400" />
            <span>Visualizar Vendas</span>
          </button>
        </div>
      </div>

      {/* REGISTRATION FORM MODAL (FLOATING OVERLAY) */}
      {showSaleForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-purple-300 rounded-3xl p-6 sm:p-7 w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <span>Lançar Nova Venda</span>
              </div>
              <div className="flex items-center gap-3">
                {sweetStockRemaining > 0 && (
                  <span className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full">
                    Estoque: {sweetStockRemaining} potes
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowSaleForm(false)}
                  className="p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-600 transition-colors cursor-pointer"
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
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-600 transition-colors cursor-pointer"
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
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-purple-900 focus:bg-white focus:outline-none focus:border-purple-600 transition-colors cursor-pointer"
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSaleQuantity((prev) => Math.max(1, prev - 1))}
                      className="w-10 h-10 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-black text-lg flex items-center justify-center transition-colors cursor-pointer border border-purple-300"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={saleQuantity}
                      onChange={(e) => setSaleQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      required
                      className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-black text-slate-900 focus:bg-white focus:outline-none focus:border-purple-600 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setSaleQuantity((prev) => prev + 1)}
                      className="w-10 h-10 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-black text-lg flex items-center justify-center transition-colors cursor-pointer border border-purple-300"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
                    {[1, 2, 3, 4, 5, 10].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSaleQuantity(preset)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                          saleQuantity === preset
                            ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {preset}x
                      </button>
                    ))}
                  </div>
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
                          ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-xs ring-2 ring-amber-200'
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
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-900 shadow-xs ring-2 ring-emerald-200'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      ✅ Pagou
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-4 bg-purple-600 hover:bg-purple-700 text-white font-black text-sm rounded-2xl shadow-lg hover:shadow-purple-200 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <Plus className="w-5 h-5" />
                  <span>CONFIRMAR E REGISTRAR VENDA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaleForm(false)}
                  className="px-5 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                            {formatDateBR(sale.saleDate)}
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
                                onClick={() => handleOpenEditSale(sale)}
                                className="p-1.5 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-200 rounded-xl transition-all cursor-pointer"
                                title="Editar Quantidade / Venda"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
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
                            <td className="py-1">{formatDateBR(s.saleDate)}</td>
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

      {/* RETROACTIVE SALES MODAL */}
      {showRetroactiveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-amber-400 rounded-3xl p-6 sm:p-7 w-full max-w-xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Lançamento de Vendas Anteriores
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500">
                    Contabilize vendas feitas no início do mês antes do aplicativo estar pronto!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRetroactiveModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-900 space-y-1">
              <span className="font-bold block">💡 Sem necessidade de Livro de Receitas:</span>
              <p className="leading-relaxed">
                Neste formulário, você digita o <strong>gasto aproximado por pote</strong> que teve ao fazer o doce. O sistema calcula seu lucro líquido real para o mês sem exigir receitas ou estoque cadastrados.
              </p>
            </div>

            <form onSubmit={handleRegisterRetroactiveSale} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Data da Venda:
                  </label>
                  <input
                    type="date"
                    value={retroDate}
                    onChange={(e) => setRetroDate(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Repartição:
                  </label>
                  <select
                    value={retroDept}
                    onChange={(e) => setRetroDept(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                  >
                    {state.departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Nome do Cliente / Comprador:
                  </label>
                  <input
                    type="text"
                    value={retroBuyerName}
                    onChange={(e) => setRetroBuyerName(e.target.value)}
                    placeholder="Ex: Maj Carlos, Cap Silva, Maria..."
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Telefone (Opcional):
                  </label>
                  <input
                    type="text"
                    value={retroPhone}
                    onChange={(e) => setRetroPhone(e.target.value)}
                    placeholder="Ex: 55999999999"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Doce Vendido:
                  </label>
                  <input
                    type="text"
                    value={retroSweetName}
                    onChange={(e) => setRetroSweetName(e.target.value)}
                    placeholder="Ex: Bolo de Pote Ninho"
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Quantidade:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={retroQuantityStr}
                    onChange={(e) => setRetroQuantityStr(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Preço Venda / Pote (R$):
                  </label>
                  <input
                    type="text"
                    value={retroUnitPriceStr}
                    onChange={(e) => setRetroUnitPriceStr(e.target.value)}
                    required
                    className="w-full p-2.5 bg-white border-2 border-amber-400 rounded-xl font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="bg-amber-50/80 border border-amber-300 p-3.5 rounded-2xl space-y-2">
                <label className="block text-amber-950 font-black text-xs">
                  💰 Gasto Aproximado por Pote (Custo de Produção Estimado R$):
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={retroUnitCostStr}
                    onChange={(e) => setRetroUnitCostStr(e.target.value)}
                    placeholder="Ex: 5,00"
                    required
                    className="w-36 p-2.5 bg-white border-2 border-amber-500 rounded-xl font-mono text-base font-black text-amber-950"
                  />
                  <span className="text-[11px] text-amber-800 font-semibold leading-tight">
                    Multiplicado por {retroQuantityStr || 1} potes = R$ {( (parseFloat(retroQuantityStr) || 1) * (parseFloat(retroUnitCostStr) || 0) ).toFixed(2)} de custo aproximado total.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Status do Pagamento:
                  </label>
                  <select
                    value={retroIsPaid ? 'paid' : 'pending'}
                    onChange={(e) => setRetroIsPaid(e.target.value === 'paid')}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                  >
                    <option value="paid">✅ Já Pago (Entrou no Caixa)</option>
                    <option value="pending">⏳ Fiado / A Receber (Pendente)</option>
                  </select>
                </div>

                {retroIsPaid && (
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Forma de Recebimento:
                    </label>
                    <select
                      value={retroPaymentMethod}
                      onChange={(e) => setRetroPaymentMethod(e.target.value as 'pix' | 'dinheiro')}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                    >
                      <option value="pix">📱 PIX</option>
                      <option value="dinheiro">💵 Dinheiro</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Observações:
                </label>
                <input
                  type="text"
                  value={retroNotes}
                  onChange={(e) => setRetroNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm rounded-xl shadow-md cursor-pointer transition-colors"
              >
                Lançar Venda Anteriore e Calcular Lucro
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SALE QUANTITY & DETAILS MODAL */}
      {editingSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-purple-400 rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm sm:text-base">Editar Venda</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {editingSale.buyerName} — {editingSale.sweetName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSale(null)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSale} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Quantidade Vendida (Potes):
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditQuantity((prev) => Math.max(1, prev - 1))}
                    className="w-11 h-11 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-black text-xl flex items-center justify-center transition-colors cursor-pointer border border-purple-300"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    required
                    className="flex-1 p-2.5 bg-slate-50 border-2 border-purple-300 rounded-xl text-center text-lg font-black text-slate-900 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setEditQuantity((prev) => prev + 1)}
                    className="w-11 h-11 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-black text-xl flex items-center justify-center transition-colors cursor-pointer border border-purple-300"
                  >
                    +
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1">
                  {[1, 2, 3, 4, 5, 10].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditQuantity(preset)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                        editQuantity === preset
                          ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {preset}x
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Preço Unitário (R$):
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={editUnitPrice}
                  onChange={(e) => setEditUnitPrice(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Status de Pagamento:
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'paid' | 'pending')}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                >
                  <option value="pending">📋 Fiado / A Receber</option>
                  <option value="paid">✅ Já Pago (Caixa)</option>
                </select>
              </div>

              <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 flex justify-between items-center text-xs">
                <span className="font-bold text-purple-900">Novo Valor Total:</span>
                <span className="font-black font-mono text-base text-purple-950">
                  {formatCurrency(editQuantity * editUnitPrice)}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  Salvar Alterações
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
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
      <PixPaymentModal open={showInstantPix} onClose={() => setShowInstantPix(false)} amount={instantPixAmount} description={instantPixDescription} pixKey={pixKey} recipientName={pixRecipientName} city={pixCity} />
    </div>
  );
};
