import React, { useState } from 'react';
import { AppState, InventoryItem, ProductionBatch, Recipe, RecipeIngredient, User } from '../types';
import { saveState, formatCurrency } from '../lib/storage';
import {
  Package,
  BookOpen,
  Trash2,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  ChefHat,
  Plus,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Sparkles,
  Layers,
  ShoppingBag,
} from 'lucide-react';

interface InventoryPageProps {
  state: AppState;
  onStateChange: (newState: AppState) => void;
  selectedMonth: string;
  currentUser: User;
}

type InventorySubView = 'selector' | 'almoxarifado' | 'livro_receitas';

interface RecipeIngredientRow {
  id: string;
  inventoryItemId: string;
  quantityUsed: number;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({
  state,
  onStateChange,
  selectedMonth,
}) => {
  const [activeSubView, setActiveSubView] = useState<InventorySubView>('selector');

  // ALMOXARIFADO: FORM STATES
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState<'ingrediente' | 'embalagem' | 'utensilio' | 'outro'>('ingrediente');
  const [itemExpiry, setItemExpiry] = useState('2026-09-30');
  const [itemCost, setItemCost] = useState<number>(0);
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemUnit, setItemUnit] = useState<string>('caixa');
  const [minAlertQty, setMinAlertQty] = useState<number>(3);

  // LIVRO DE RECEITAS: FORM STATES (INTEGRADO AO ALMOXARIFADO)
  const [recipeSweetName, setRecipeSweetName] = useState('');
  const [recipeYieldsCount, setRecipeYieldsCount] = useState<number>(20);
  
  // Initialize default recipe ingredient rows from inventory
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientRow[]>(() => {
    if (state.inventory.length >= 2) {
      return [
        { id: '1', inventoryItemId: state.inventory[0].id, quantityUsed: 4 },
        { id: '2', inventoryItemId: state.inventory[1].id, quantityUsed: 4 },
      ];
    }
    return state.inventory.length > 0
      ? [{ id: '1', inventoryItemId: state.inventory[0].id, quantityUsed: 1 }]
      : [];
  });
  
  const [manualFinalPrice, setManualFinalPrice] = useState<number>(13.00);

  // Filter low-stock items in Almoxarifado
  const lowStockItems = state.inventory.filter(
    (item) => item.remainingQuantity <= (item.minAlertQuantity || 3)
  );

  // Dynamic ingredient row handlers
  const handleAddIngredientRow = () => {
    if (state.inventory.length === 0) {
      alert('Atenção: Adicione primeiro insumos ao Almoxarifado para poder selecioná-los na receita!');
      setActiveSubView('almoxarifado');
      return;
    }
    setRecipeIngredients([
      ...recipeIngredients,
      {
        id: Date.now().toString(),
        inventoryItemId: state.inventory[0]?.id || '',
        quantityUsed: 1,
      },
    ]);
  };

  const handleUpdateIngredientRow = (
    id: string,
    field: 'inventoryItemId' | 'quantityUsed',
    value: any
  ) => {
    setRecipeIngredients(
      recipeIngredients.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const handleRemoveIngredientRow = (id: string) => {
    if (recipeIngredients.length === 1) return;
    setRecipeIngredients(recipeIngredients.filter((l) => l.id !== id));
  };

  // Recipe cost calculations derived strictly from Almoxarifado
  const totalIngredientsCost = recipeIngredients.reduce((acc, row) => {
    const invItem = state.inventory.find((i) => i.id === row.inventoryItemId);
    if (!invItem) return acc;
    const unitCost = invItem.totalQuantityBought > 0 
      ? invItem.totalCostPaid / invItem.totalQuantityBought 
      : invItem.unitCost;
    return acc + (Number(row.quantityUsed) || 0) * unitCost;
  }, 0);

  const calculatedUnitCost = recipeYieldsCount > 0 ? totalIngredientsCost / recipeYieldsCount : 0;
  const suggestedUnitPrice = calculatedUnitCost * 2.5;
  const estimatedProfitPerUnit = manualFinalPrice - calculatedUnitCost;

  // SUBMIT ALMOXARIFADO: NOVO INSUMO
  const handleAddInsumo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    const qty = Number(itemQty);
    const cost = Number(itemCost);

    const newInsumo: InventoryItem = {
      id: `inv-${Date.now()}`,
      name: itemName.trim(),
      category: itemCategory,
      unit: itemUnit as any,
      totalQuantityBought: qty,
      remainingQuantity: qty,
      totalCostPaid: cost,
      unitCost: qty > 0 ? cost / qty : cost,
      expirationDate: itemExpiry,
      purchaseDate: new Date().toISOString(),
      minAlertQuantity: Number(minAlertQty) || 3,
    };

    const newExpense = {
      id: `exp-${Date.now()}`,
      description: `Compra: ${itemName.trim()} (${itemQty} ${itemUnit})`,
      category: itemCategory === 'embalagem' ? ('embalagens' as const) : ('ingredientes' as const),
      totalCost: cost,
      date: new Date().toISOString(),
      monthKey: selectedMonth,
    };

    const newState: AppState = {
      ...state,
      inventory: [newInsumo, ...state.inventory],
      expenses: [newExpense, ...state.expenses],
    };

    saveState(newState);
    onStateChange(newState);

    setItemName('');
    setItemCost(0);
    setItemQty(1);
    alert('✅ Compra registrada no Almoxarifado!');
  };

  // DELETE INSUMO IN ALMOXARIFADO
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteInsumo = (id: string) => {
    // Perform deletion on inventory and sync with recipe ingredients
    const updatedInventory = state.inventory.filter((i) => i.id !== id);
    const newState: AppState = {
      ...state,
      inventory: updatedInventory,
    };

    saveState(newState);
    onStateChange(newState);

    // Filter out deleted inventory items from local recipe form
    setRecipeIngredients((prev) => prev.filter((row) => row.inventoryItemId !== id));
    setConfirmDeleteId(null);
  };

  // SUBMIT LIVRO DE RECEITAS: NOVA FICHA TÉCNICA (INTEGRADA AO ALMOXARIFADO & VENDAS)
  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeSweetName.trim()) {
      alert('Por favor, informe o nome do doce!');
      return;
    }
    if (recipeIngredients.length === 0) {
      alert('Adicione pelo menos um ingrediente do Almoxarifado na receita!');
      return;
    }

    const compiledIngredients: RecipeIngredient[] = recipeIngredients.map((row) => {
      const inv = state.inventory.find((i) => i.id === row.inventoryItemId);
      const unitCost = inv && inv.totalQuantityBought > 0 ? inv.totalCostPaid / inv.totalQuantityBought : (inv?.unitCost || 0);
      return {
        inventoryItemId: row.inventoryItemId,
        inventoryItemName: inv ? inv.name : 'Insumo',
        quantityUsed: Number(row.quantityUsed) || 0,
        unit: inv?.unit || 'unidade',
        estimatedCost: (Number(row.quantityUsed) || 0) * unitCost,
      };
    });

    const newSweetId = `sw-${Date.now()}`;
    const existingSweet = state.sweets.find(
      (s) => s.name.toLowerCase() === recipeSweetName.trim().toLowerCase()
    );
    const targetSweetId = existingSweet ? existingSweet.id : newSweetId;

    const newRecipe: Recipe = {
      id: `rec-${Date.now()}`,
      sweetId: targetSweetId,
      sweetName: recipeSweetName.trim(),
      yieldsCount: Number(recipeYieldsCount),
      ingredients: compiledIngredients,
      packagingCostPerUnit: 0,
      calculatedUnitCost,
      updatedAt: new Date().toISOString(),
    };

    // Integrate with sweets table
    const updatedSweets = existingSweet
      ? state.sweets.map((s) =>
          s.id === existingSweet.id
            ? { ...s, price: manualFinalPrice, recipeId: newRecipe.id }
            : s
        )
      : [
          ...state.sweets,
          {
            id: targetSweetId,
            name: recipeSweetName.trim(),
            price: manualFinalPrice,
            recipeId: newRecipe.id,
            active: true,
            category: 'Doce de Pote',
          },
        ];

    const newState: AppState = {
      ...state,
      recipes: [newRecipe, ...state.recipes],
      sweets: updatedSweets,
    };

    saveState(newState);
    onStateChange(newState);

    setRecipeSweetName('');
    alert(
      `🎉 Receita de "${recipeSweetName}" salva e integrada!\n\n• Custo de Produção por Doce: ${formatCurrency(calculatedUnitCost)}\n• Seu Preço de Venda Definido: ${formatCurrency(manualFinalPrice)}\n• Lucro Estimado por Doce: ${formatCurrency(estimatedProfitPerUnit)}\n\nEsta opção já está disponível para seleção nas Vendas!`
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-24 overflow-x-hidden">
      {/* 1. SELETOR DE BLOCOS (ALMOXARIFADO VS LIVRO DE RECEITAS) */}
      {activeSubView === 'selector' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* BLOCO 1: ALMOXARIFADO */}
          <button
            type="button"
            onClick={() => setActiveSubView('almoxarifado')}
            className="group bg-white border-2 border-slate-200 hover:border-amber-600 rounded-3xl p-6 shadow-sm hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 text-left flex flex-col justify-between space-y-5 cursor-pointer hover:ring-4 hover:ring-amber-100"
          >
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 bg-amber-100 border border-amber-200 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                📦
              </div>
              <span className="text-xs font-black uppercase text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                Almoxarifado
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-900 group-hover:text-amber-700 transition-colors">
                Almoxarifado
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Controle de compras de materiais, insumos, latas, creme de leite, embalagens e calculador de custos unitários.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-700">
              <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Abrir Almoxarifado <ArrowRight className="w-4 h-4" />
              </span>
              {lowStockItems.length > 0 ? (
                <span className="text-[11px] bg-rose-100 text-rose-800 font-extrabold px-2.5 py-0.5 rounded-full">
                  ⚠️ {lowStockItems.length} p/ reposição
                </span>
              ) : (
                <span className="text-[11px] text-emerald-700 font-bold">✓ Estoque em ordem</span>
              )}
            </div>
          </button>

          {/* BLOCO 2: LIVRO DE RECEITAS */}
          <button
            type="button"
            onClick={() => setActiveSubView('livro_receitas')}
            className="group bg-white border-2 border-slate-200 hover:border-purple-600 rounded-3xl p-6 shadow-sm hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 text-left flex flex-col justify-between space-y-5 cursor-pointer hover:ring-4 hover:ring-purple-100"
          >
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 bg-purple-100 border border-purple-200 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                📖
              </div>
              <span className="text-xs font-black uppercase text-purple-800 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                Livro de Receitas
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-900 group-hover:text-purple-700 transition-colors">
                Livro de Receitas
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Selecione insumos do Almoxarifado, calcule o custo de produção exato de cada pote e estipule seu preço final de venda.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-700">
              <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Abrir Livro de Receitas <ArrowRight className="w-4 h-4" />
              </span>
              <span className="text-[11px] text-purple-700 font-bold">
                {state.recipes.length} receitas integradas
              </span>
            </div>
          </button>
        </div>
      )}

      {/* 2. ALMOXARIFADO */}
      {activeSubView === 'almoxarifado' && (
        <div className="space-y-6">
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Módulo 1 de 2</span>
              <h2 className="text-xl font-black text-slate-900">Almoxarifado & Compras</h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubView('selector')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 hover:text-amber-950 cursor-pointer bg-amber-100 px-3 py-1.5 rounded-full border border-amber-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Menu</span>
            </button>
          </div>

          {/* AVISO DE ESTOQUE BAIXO */}
          {lowStockItems.length > 0 && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-black text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>⚠️ ALERTA DE REPOSIÇÃO (INSUMOS ACABANDO)</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {lowStockItems.map((i) => (
                  <span
                    key={i.id}
                    className="bg-white border border-rose-300 text-rose-900 font-extrabold text-xs px-3 py-1 rounded-xl shadow-2xs"
                  >
                    🛒 {i.name}: Restam apenas {i.remainingQuantity} {i.unit}!
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* FORMULARIO DE COMPRA */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Package className="w-5 h-5 text-amber-600" />
              <span>Registrar Compra de Material / Insumo no Almoxarifado</span>
            </h3>

            <form onSubmit={handleAddInsumo} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nome do Insumo:
                  </label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Ex: Leite Condensado Moça, Pote Plástico 250ml"
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Data de Validade:
                  </label>
                  <input
                    type="date"
                    value={itemExpiry}
                    onChange={(e) => setItemExpiry(e.target.value)}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Quantidade Comprada:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={itemQty}
                    onChange={(e) => setItemQty(parseInt(e.target.value) || 0)}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unidade / Medida:</label>
                  <select
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="caixa">caixa</option>
                    <option value="lata">lata</option>
                    <option value="g">gramas (g)</option>
                    <option value="kg">quilos (kg)</option>
                    <option value="ml">mililitros (ml)</option>
                    <option value="L">litros (L)</option>
                    <option value="unidade">unidade</option>
                    <option value="pct">pacote (pct)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Valor Total Pago (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemCost}
                    onChange={(e) => setItemCost(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Qtd Mínima (Aviso Reposição):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={minAlertQty}
                    onChange={(e) => setMinAlertQty(parseInt(e.target.value) || 3)}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-rose-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer transition-all"
              >
                REGISTRAR COMPRA NO ALMOXARIFADO
              </button>
            </form>
          </div>

          {/* TABELA DE ESTOQUE */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">
              Itens em Estoque no Almoxarifado ({state.inventory.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider bg-slate-50">
                    <th className="py-3 px-3">Insumo / Material</th>
                    <th className="py-3 px-3">Validade</th>
                    <th className="py-3 px-3 text-center">Quantidade Total</th>
                    <th className="py-3 px-3">Custo Unitário Calculado</th>
                    <th className="py-3 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.inventory.map((item) => {
                    const calculatedUnitCost = item.totalQuantityBought > 0 
                      ? item.totalCostPaid / item.totalQuantityBought 
                      : item.unitCost;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-bold text-slate-900">📦 {item.name}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {item.expirationDate ? new Date(item.expirationDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-center font-black text-slate-900">
                          {item.remainingQuantity} / {item.totalQuantityBought} {item.unit}
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-700">
                          {formatCurrency(calculatedUnitCost)} por {item.unit}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {confirmDeleteId === item.id ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDeleteInsumo(item.id)}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg shadow-xs cursor-pointer transition-all"
                              >
                                Confirmar Exclusão
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-slate-400 hover:text-slate-600 font-bold text-[10px] px-1.5 py-1 cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer p-1 rounded-md hover:bg-rose-50 transition-colors"
                              title="Excluir este insumo do Almoxarifado"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. LIVRO DE RECEITAS (STRICT INTEGRATION WITH ALMOXARIFADO & VENDAS) */}
      {activeSubView === 'livro_receitas' && (
        <div className="space-y-6">
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">Módulo 2 de 2</span>
              <h2 className="text-xl font-black text-slate-900">Livro de Receitas (Ficha Técnica)</h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubView('selector')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-900 hover:text-purple-950 cursor-pointer bg-purple-100 px-3 py-1.5 rounded-full border border-purple-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Menu</span>
            </button>
          </div>

          {/* BANNER DE INSTRUÇÕES DA INTEGRAÇÃO */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-3xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-purple-900 font-black text-sm">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span>Integração Total: Almoxarifado ➔ Livro de Receitas ➔ Vendas & Caixa</span>
            </div>
            <p className="text-xs text-purple-800 leading-relaxed font-medium">
              Selecione os ingredientes registrados no <strong>Almoxarifado</strong>, informe a quantidade utilizada nesta receita e a quantidade de potes rendidos. O sistema calculará o <strong>custo exato de produção por doce</strong> e permitirá estipular seu <strong>preço de venda</strong>.
            </p>
          </div>

          {/* FORMULÁRIO COMPLETO DO LIVRO DE RECEITAS */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <ChefHat className="w-5 h-5 text-purple-600" />
              <span>Criar Nova Receita com Insumos do Almoxarifado</span>
            </h3>

            <form onSubmit={handleSaveRecipe} className="space-y-6 text-xs">
              {/* NOME DO DOCE & RENDIMENTO DA RECEITA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-extrabold text-slate-800 mb-1">
                    1. Nome do Doce de Pote:
                  </label>
                  <input
                    type="text"
                    value={recipeSweetName}
                    onChange={(e) => setRecipeSweetName(e.target.value)}
                    placeholder="Ex: Bolo de Pote Ninho com Nutella"
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-800 mb-1">
                    2. Quantidade de Doces Rendidos (Potes Feitos):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={recipeYieldsCount}
                    onChange={(e) => setRecipeYieldsCount(parseInt(e.target.value) || 1)}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-purple-950 focus:bg-white"
                  />
                </div>
              </div>

              {/* SELEÇÃO EXCLUSIVA DE INGREDIENTES DO ALMOXARIFADO */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <label className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-600" />
                      3. Escolher Ingredientes Registrados no Almoxarifado:
                    </label>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Somente insumos cadastrados no almoxarifado podem ser selecionados para garantir precisão.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="inline-flex items-center gap-1 bg-purple-100 text-purple-900 hover:bg-purple-600 hover:text-white font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Linha de Insumo</span>
                  </button>
                </div>

                {state.inventory.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center space-y-2">
                    <p className="text-amber-900 font-bold">Nenhum insumo cadastrado no Almoxarifado ainda!</p>
                    <button
                      type="button"
                      onClick={() => setActiveSubView('almoxarifado')}
                      className="bg-amber-600 text-white font-black px-4 py-2 rounded-xl hover:bg-amber-700 transition-colors cursor-pointer"
                    >
                      + Cadastrar Insumos no Almoxarifado Primeiro
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    {recipeIngredients.map((row, index) => {
                      const selectedInvItem = state.inventory.find((i) => i.id === row.inventoryItemId);
                      const unitCost = selectedInvItem
                        ? (selectedInvItem.totalQuantityBought > 0 ? selectedInvItem.totalCostPaid / selectedInvItem.totalQuantityBought : selectedInvItem.unitCost)
                        : 0;
                      const lineTotalCost = (row.quantityUsed || 0) * unitCost;

                      return (
                        <div key={row.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-3 border border-slate-200 rounded-xl shadow-2xs">
                          <span className="font-bold text-slate-400 sm:col-span-1 text-center">{index + 1}.</span>

                          {/* SELECT DO ALMOXARIFADO */}
                          <div className="sm:col-span-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Insumo do Almoxarifado:</label>
                            <select
                              value={row.inventoryItemId}
                              onChange={(e) => handleUpdateIngredientRow(row.id, 'inventoryItemId', e.target.value)}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 cursor-pointer focus:bg-white"
                            >
                              {state.inventory.map((inv) => {
                                const invUnitCost = inv.totalQuantityBought > 0 ? inv.totalCostPaid / inv.totalQuantityBought : inv.unitCost;
                                return (
                                  <option key={inv.id} value={inv.id}>
                                    📦 {inv.name} ({formatCurrency(invUnitCost)} / {inv.unit})
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* QUANTIDADE UTILIZADA NA RECEITA */}
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Qtd Utilizada ({selectedInvItem?.unit || 'un'}):</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={row.quantityUsed}
                              onChange={(e) => handleUpdateIngredientRow(row.id, 'quantityUsed', parseFloat(e.target.value) || 0)}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:bg-white"
                            />
                          </div>

                          {/* CUSTO PROPORCIONAL CALCULADO */}
                          <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                            <div className="text-right">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase">Fornada:</span>
                              <span className="font-mono font-bold text-slate-700">{formatCurrency(lineTotalCost)}</span>
                              {recipeYieldsCount > 0 && (
                                <span className="block font-mono text-[10px] font-black text-purple-700">
                                  ({formatCurrency(lineTotalCost / recipeYieldsCount)} / pote)
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveIngredientRow(row.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                              title="Remover insumo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CARD RESUMO DE CUSTO DE PRODUÇÃO & DETERMINAÇÃO DO PREÇO DE VENDA */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-purple-50 border-2 border-purple-200 rounded-2xl p-5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                    Custo Total da Receita:
                  </span>
                  <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                    {formatCurrency(totalIngredientsCost)}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">Custo bruto dos insumos</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1">
                    <Calculator className="w-3.5 h-3.5 text-purple-600" /> Custo Produção (1 Doce):
                  </span>
                  <div className="text-2xl font-black text-purple-950 font-mono mt-0.5">
                    {formatCurrency(calculatedUnitCost)}
                  </div>
                  <span className="text-[10px] text-purple-700 font-semibold">Regra de 3: Total / {recipeYieldsCount} potes</span>
                </div>

                <div>
                  <label className="block font-black text-slate-900 uppercase text-[10px] tracking-wider mb-1">
                    4. Preço de Venda q Eu Estipulo (R$):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={manualFinalPrice}
                    onChange={(e) => setManualFinalPrice(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full p-2.5 bg-white border-2 border-purple-500 rounded-xl font-mono font-black text-lg text-purple-950 focus:outline-none shadow-xs"
                  />
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Lucro Estimado por Doce:
                  </span>
                  <div className="text-2xl font-black text-emerald-700 font-mono mt-0.5">
                    {formatCurrency(estimatedProfitPerUnit)}
                  </div>
                  <span className="text-[10px] text-emerald-800 font-bold">
                    Margem: {manualFinalPrice > 0 ? ((estimatedProfitPerUnit / manualFinalPrice) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-black text-sm rounded-2xl shadow-md cursor-pointer transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>SALVAR RECEITA & INTEGRAR COM VENDAS E CAIXA</span>
              </button>
            </form>
          </div>

          {/* LISTA DE RECEITAS SALVAS */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">
              Receitas Cadastradas no Livro ({state.recipes.length})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {state.recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between font-black text-slate-900 text-sm border-b border-slate-200 pb-2">
                    <span>🧁 {recipe.sweetName}</span>
                    <span className="text-purple-900 font-mono bg-purple-100 border border-purple-200 px-2.5 py-0.5 rounded-full text-xs">
                      {formatCurrency(recipe.calculatedUnitCost)} / pote
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 font-medium space-y-1">
                    <div>Rendimento: <strong>{recipe.yieldsCount} potes</strong> por receita</div>
                    <div>Preço de Venda Cadastrado: <strong className="text-emerald-700">{formatCurrency(state.sweets.find(s => s.name === recipe.sweetName || s.recipeId === recipe.id)?.price || 13)}</strong></div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Insumos do Almoxarifado:</span>
                    <div className="flex flex-wrap gap-1">
                      {recipe.ingredients.map((ing, idx) => (
                        <span key={idx} className="bg-white border border-slate-200 px-2 py-1 rounded-md text-[10px] text-slate-700 font-bold">
                          {ing.inventoryItemName}: {ing.quantityUsed} {ing.unit} ({formatCurrency(ing.estimatedCost)})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
