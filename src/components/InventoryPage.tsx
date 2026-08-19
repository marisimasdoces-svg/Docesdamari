import React, { useState } from 'react';
import { AppState, InventoryItem, ProductionBatch, Recipe, RecipeIngredient, User, UtilitySettings } from '../types';
import { applyReadyStockDelta } from '../lib/readyStock';
import { formatCurrency, formatMonthShort, getSaoPauloDateKey } from '../lib/storage';
import {
  Package,
  Trash2,
  AlertTriangle,
  ChefHat,
  Plus,
  ArrowRight,
  Scale,
  X,
  BookOpen,
  Search,
  CheckCircle2,
  Flame,
  Zap,
  Droplets,
  Layers,
  Settings,
  Info,
  Sparkles,
} from 'lucide-react';

interface InventoryPageProps {
  state: AppState;
  onStateChange: (newState: AppState) => void;
  selectedMonth: string;
  currentUser: User;
}

interface RecipeIngredientRow {
  id: string;
  inventoryItemId: string;
  quantityUsedStr: string;
}

interface RepeatIngredientRow {
  inventoryItemId: string;
  inventoryItemName: string;
  unit: string;
  quantityUsedStr: string;
}

// Helper to safely parse localized numbers typed with comma or dot (e.g. "7,98" or "7.98")
const parseFormattedNumber = (val: string | number): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const normalized = val.toString().trim().replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

export const InventoryPage: React.FC<InventoryPageProps> = ({
  state,
  onStateChange,
  selectedMonth,
}) => {
  const selectedMonthDate = new Date(`${selectedMonth || '2026-08'}-01T12:00:00`);
  selectedMonthDate.setMonth(selectedMonthDate.getMonth() - 1);
  const utilityReferenceMonth = `${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const savedUtilitySettings = state.utilitySettings?.find((item) => item.referenceMonth === utilityReferenceMonth);

  // MODAL STATES (CARDS FLUTUANTES)
  const [showAddInsumoModal, setShowAddInsumoModal] = useState(false);
  const [showStockListModal, setShowStockListModal] = useState(false);
  const [showNewRecipeModal, setShowNewRecipeModal] = useState(false);
  const [showRecipeBookModal, setShowRecipeBookModal] = useState(false);
  const [repeatRecipe, setRepeatRecipe] = useState<Recipe | null>(null);
  const [repeatQuantityStr, setRepeatQuantityStr] = useState('');
  const [repeatIngredients, setRepeatIngredients] = useState<RepeatIngredientRow[]>([]);

  // ESTOQUE: FORM STATES
  const [itemName, setItemName] = useState('');
  const [existingItemId, setExistingItemId] = useState<string>('new');
  const [itemCategory, setItemCategory] = useState<'ingrediente' | 'embalagem' | 'utensilio' | 'outro'>('ingrediente');
  const [itemExpiry, setItemExpiry] = useState('2026-10-30');
  const [itemPurchaseDate, setItemPurchaseDate] = useState<string>(() => getSaoPauloDateKey());
  const [itemCostStr, setItemCostStr] = useState<string>('');
  const [itemQtyStr, setItemQtyStr] = useState<string>('1');
  const [itemUnit, setItemUnit] = useState<string>('caixa');
  const [minAlertQtyStr, setMinAlertQtyStr] = useState<string>('3');

  // CALCULADORA IMPLÍCITA DE BOLACHA (ESTOQUE)
  const [showBiscuitCalc, setShowBiscuitCalc] = useState(false);
  const [biscuitPkgCountStr, setBiscuitPkgCountStr] = useState('3');
  const [biscuitPkgWeightStr, setBiscuitPkgWeightStr] = useState('360');
  const [biscuitPkgPriceStr, setBiscuitPkgPriceStr] = useState('7,98');
  const [biscuitNameInput, setBiscuitNameInput] = useState('Bolacha Maizena');

  // BUSCA NO ESTOQUE
  const [stockSearchTerm, setStockSearchTerm] = useState('');

  // LIVRO DE RECEITAS: FORM STATES
  const [recipeSweetName, setRecipeSweetName] = useState('');
  const [recipeYieldsCountStr, setRecipeYieldsCountStr] = useState<string>('20');

  // UTILIDADES (GÁS, LUZ, ÁGUA)
  const [stoveGasMinutesStr, setStoveGasMinutesStr] = useState<string>('25');
  const [electricOvenMinutesStr, setElectricOvenMinutesStr] = useState<string>('40');
  const [waterCleaningCostStr, setWaterCleaningCostStr] = useState<string>(() => {
    const perProduction = savedUtilitySettings
      ? savedUtilitySettings.waterBill / Math.max(1, savedUtilitySettings.productionCycles)
      : 1;
    return perProduction.toFixed(2).replace('.', ',');
  });
  const [gasCylinderPriceStr, setGasCylinderPriceStr] = useState<string>(() =>
    String(savedUtilitySettings?.gasCylinderPrice ?? 115).replace('.', ',')
  );
  const [kwhPriceStr, setKwhPriceStr] = useState<string>(() => {
    const rate = savedUtilitySettings
      ? savedUtilitySettings.electricityBill / Math.max(1, savedUtilitySettings.electricityKwh)
      : 0.9;
    return rate.toFixed(4).replace('.', ',');
  });
  const [electricityBillStr, setElectricityBillStr] = useState<string>(() =>
    String(savedUtilitySettings?.electricityBill ?? 180).replace('.', ',')
  );
  const [electricityKwhStr, setElectricityKwhStr] = useState<string>(() =>
    String(savedUtilitySettings?.electricityKwh ?? 200).replace('.', ',')
  );
  const [waterBillStr, setWaterBillStr] = useState<string>(() =>
    String(savedUtilitySettings?.waterBill ?? 80).replace('.', ',')
  );
  const [productionCyclesStr, setProductionCyclesStr] = useState<string>(() =>
    String(savedUtilitySettings?.productionCycles ?? 20)
  );
  const [showUtilityRates, setShowUtilityRates] = useState<boolean>(false);
  const [useManualUtilityCost, setUseManualUtilityCost] = useState<boolean>(false);
  const [manualRecipeIndirectCostStr, setManualRecipeIndirectCostStr] = useState<string>('3,50');

  // CONVERSOR DE BISCOITO EM GRAMAS NA RECEITA
  const [activeConverterRowId, setActiveConverterRowId] = useState<string | null>(null);
  const [converterUnitsCountStr, setConverterUnitsCountStr] = useState('10');
  const [converterUnitWeightGramsStr, setConverterUnitWeightGramsStr] = useState('5,2');

  const [manualFinalPriceStr, setManualFinalPriceStr] = useState<string>('13,00');

  // AJUSTE RÁPIDO DE QUANTIDADE DO ESTOQUE (+ / -)
  const handleAdjustQuantity = (itemId: string, delta: number) => {
    const nowIso = new Date().toISOString();
    const updatedInventory = state.inventory.map((item) => {
      if (item.id === itemId) {
        const newRemaining = Math.max(0, item.remainingQuantity + delta);
        return {
          ...item,
          remainingQuantity: newRemaining,
          updatedAt: nowIso,
        };
      }
      return item;
    });

    const newState: AppState = {
      ...state,
      inventory: updatedInventory,
    };

    onStateChange(newState);
  };

  // EXCLUIR ITEM DO ESTOQUE
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteInsumo = (id: string) => {
    const nowIso = new Date().toISOString();
    const itemToDelete = state.inventory.find((item) => item.id === id);

    const updatedInventory = state.inventory.map((item) =>
      item.id === id ? { ...item, deletedAt: nowIso, updatedAt: nowIso } : item
    );

    // INVENTORY_DELETE_EXPENSE_REVERSAL_V9_2026_08_18
    // Excluir um item/compra do Depósito também exclui o gasto correspondente.
    // Para compras novas usamos o vínculo por inventoryItemId.
    // Para compras antigas (criadas antes desse vínculo), usamos o nome da compra
    // como compatibilidade, permitindo estornar inclusive o teste "Parafuso".
    const updatedExpenses = state.expenses.map((expense) => {
      if (expense.deletedAt || !itemToDelete) return expense;

      const linkedById = expense.notes?.includes(`inventoryItemId=${id}`) ?? false;
      const linkedLegacy =
        expense.description === `Compra: ${itemToDelete.name}` ||
        expense.description.startsWith(`Compra: ${itemToDelete.name} (`);

      return linkedById || linkedLegacy
        ? { ...expense, deletedAt: nowIso, updatedAt: nowIso }
        : expense;
    });

    const newState: AppState = {
      ...state,
      inventory: updatedInventory,
      expenses: updatedExpenses,
    };

    onStateChange(newState);
    setConfirmDeleteId(null);
  };

  // CALCULADORA DE BOLACHA IMPLÍCITA: APLICAR NO CADASTRO DE COMPRA
  const handleApplyImplicitBiscuitCalc = () => {
    const pkgs = parseFormattedNumber(biscuitPkgCountStr) || 1;
    const gPerPkg = parseFormattedNumber(biscuitPkgWeightStr) || 360;
    const pricePerPkg = parseFormattedNumber(biscuitPkgPriceStr) || 7.98;

    const totalGrams = pkgs * gPerPkg;
    const totalPrice = pkgs * pricePerPkg;

    setItemName(biscuitNameInput.trim() || 'Bolacha Maizena');
    setItemUnit('g');
    setItemQtyStr(totalGrams.toString());
    setItemCostStr(totalPrice.toFixed(2).replace('.', ','));
    setShowBiscuitCalc(false);
  };

  // RECEITE INGREDIENT ROWS
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientRow[]>(() => {
    if (state.inventory.length >= 2) {
      return [
        { id: '1', inventoryItemId: state.inventory[0].id, quantityUsedStr: '4' },
        { id: '2', inventoryItemId: state.inventory[1].id, quantityUsedStr: '4' },
      ];
    }
    return state.inventory.length > 0
      ? [{ id: '1', inventoryItemId: state.inventory[0].id, quantityUsedStr: '1' }]
      : [];
  });

  const handleAddIngredientRow = () => {
    if (state.inventory.length === 0) {
      alert('Atenção: adicione primeiro os insumos no Depósito para selecioná-los na receita.');
      setShowAddInsumoModal(true);
      return;
    }
    setRecipeIngredients([
      ...recipeIngredients,
      {
        id: Date.now().toString(),
        inventoryItemId: state.inventory[0]?.id || '',
        quantityUsedStr: '1',
      },
    ]);
  };

  const handleUpdateIngredientRow = (
    id: string,
    field: 'inventoryItemId' | 'quantityUsedStr',
    value: string
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

  // CALCULOS DE UTILIDADES (GÁS, LUZ, ÁGUA)
  const gasCylinderPrice = parseFormattedNumber(gasCylinderPriceStr) || 115;
  const kwhPrice = parseFormattedNumber(kwhPriceStr) || 0.9;
  const stoveGasMinutes = parseFormattedNumber(stoveGasMinutesStr);
  const electricOvenMinutes = parseFormattedNumber(electricOvenMinutesStr);
  const waterCleaningCost = parseFormattedNumber(waterCleaningCostStr);

  const computedGasCost = stoveGasMinutes * (gasCylinderPrice / 3500);
  const computedElectricCost = electricOvenMinutes * (1.5 * kwhPrice / 60);
  const autoCalculatedIndirectCost = computedGasCost + computedElectricCost + waterCleaningCost;

  const indirectCost = useManualUtilityCost
    ? parseFormattedNumber(manualRecipeIndirectCostStr)
    : autoCalculatedIndirectCost;

  const totalIngredientsCost = recipeIngredients.reduce((acc, row) => {
    const invItem = state.inventory.find((i) => i.id === row.inventoryItemId);
    if (!invItem) return acc;
    const unitCost = invItem.unitCost;
    const qty = parseFormattedNumber(row.quantityUsedStr);
    return acc + qty * unitCost;
  }, 0);

  const totalRecipeCost = totalIngredientsCost + indirectCost;
  const yieldsCount = parseFormattedNumber(recipeYieldsCountStr) || 1;
  const calculatedUnitCost = yieldsCount > 0 ? totalRecipeCost / yieldsCount : 0;
  const manualFinalPrice = parseFormattedNumber(manualFinalPriceStr);
  const estimatedProfitPerUnit = manualFinalPrice - calculatedUnitCost;

  const handleSaveUtilityRates = () => {
    const nowIso = new Date().toISOString();
    const electricityBill = parseFormattedNumber(electricityBillStr);
    const electricityKwh = Math.max(1, parseFormattedNumber(electricityKwhStr));
    const waterBill = parseFormattedNumber(waterBillStr);
    const productionCycles = Math.max(1, parseFormattedNumber(productionCyclesStr));
    const gasCylinderPrice = parseFormattedNumber(gasCylinderPriceStr);
    const setting: UtilitySettings = {
      id: `utilities-${utilityReferenceMonth}`,
      referenceMonth: utilityReferenceMonth,
      gasCylinderPrice,
      electricityBill,
      electricityKwh,
      waterBill,
      productionCycles,
      updatedAt: nowIso,
    };
    const alreadyExists = state.utilitySettings?.some((item) => item.id === setting.id);
    const utilitySettings = alreadyExists
      ? state.utilitySettings.map((item) => item.id === setting.id ? setting : item)
      : [setting, ...(state.utilitySettings || [])];

    setKwhPriceStr((electricityBill / electricityKwh).toFixed(4).replace('.', ','));
    setWaterCleaningCostStr((waterBill / productionCycles).toFixed(2).replace('.', ','));
    onStateChange({ ...state, utilitySettings });
    setShowUtilityRates(false);
    alert('✅ Contas do mês anterior salvas. Luz e água já entraram no cálculo desta receita.');
  };

  const consumeInventoryForRecipe = (
    recipe: Recipe,
    producedQuantity: number,
    nowIso: string,
    actualIngredients?: RecipeIngredient[]
  ): InventoryItem[] | null => {
    const factor = producedQuantity / Math.max(1, recipe.yieldsCount);
    const usage = new Map<string, number>();
    (actualIngredients || recipe.ingredients).forEach((ingredient) => {
      usage.set(
        ingredient.inventoryItemId,
        (usage.get(ingredient.inventoryItemId) || 0) + ingredient.quantityUsed * (actualIngredients ? 1 : factor)
      );
    });
    const shortages = state.inventory
      .filter((item) => (usage.get(item.id) || 0) > item.remainingQuantity)
      .map((item) => `${item.name}: precisa ${(usage.get(item.id) || 0).toFixed(2)} ${item.unit}, há ${item.remainingQuantity.toFixed(2)} ${item.unit}`);
    if (shortages.length) {
      alert(`Não há quantidade suficiente no Depósito:\n\n${shortages.join('\n')}\n\nRegistre a compra antes de confirmar a produção.`);
      return null;
    }
    return state.inventory.map((item) => {
      const used = usage.get(item.id) || 0;
      return used > 0
        ? { ...item, remainingQuantity: Math.max(0, item.remainingQuantity - used), updatedAt: nowIso }
        : item;
    });
  };

  // SUBMIT CADASTRO COMPRA (ESTOQUE)
  const handleAddInsumo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    const qty = parseFormattedNumber(itemQtyStr) || 1;
    const cost = parseFormattedNumber(itemCostStr);
    const minQty = parseFormattedNumber(minAlertQtyStr) || 3;
    const nowIso = new Date().toISOString();
    const purchaseDateKey = itemPurchaseDate || getSaoPauloDateKey();
    const purchaseDateIso = new Date(`${purchaseDateKey}T12:00:00-03:00`).toISOString();

    const existing = existingItemId !== 'new' ? state.inventory.find((item) => item.id === existingItemId) : undefined;
    const purchaseName = existing?.name || itemName.trim();
    if (!purchaseName) return;

    const newInsumo: InventoryItem = existing ? {
      ...existing,
      totalQuantityBought: existing.totalQuantityBought + qty,
      remainingQuantity: existing.remainingQuantity + qty,
      totalCostPaid: existing.totalCostPaid + cost,
      unitCost: (existing.remainingQuantity + qty) > 0 ? ((existing.remainingQuantity * existing.unitCost) + cost) / (existing.remainingQuantity + qty) : cost,
      expirationDate: itemExpiry || existing.expirationDate,
      updatedAt: nowIso,
      minAlertQuantity: minQty || existing.minAlertQuantity,
    } : {
      id: `inv-${Date.now()}`,
      name: purchaseName,
      category: itemCategory,
      unit: itemUnit as any,
      totalQuantityBought: qty,
      remainingQuantity: qty,
      totalCostPaid: cost,
      unitCost: qty > 0 ? cost / qty : cost,
      expirationDate: itemExpiry,
      purchaseDate: purchaseDateIso,
      updatedAt: nowIso,
      minAlertQuantity: minQty,
    };

    const newExpense = {
      id: `exp-${Date.now()}`,
      description: `Compra: ${purchaseName} (${qty} ${existing?.unit || itemUnit})`,
      category: itemCategory === 'embalagem' ? ('embalagens' as const) : ('ingredientes' as const),
      totalCost: cost,
      date: purchaseDateIso,
      updatedAt: nowIso,
      monthKey: purchaseDateKey.slice(0, 7),
      // INVENTORY_EXPENSE_LINK_V9_2026_08_18
      // Vínculo explícito para que excluir a compra/item também estorne o Caixa.
      notes: `inventoryItemId=${newInsumo.id}`,
    };

    const newState: AppState = {
      ...state,
      inventory: existing ? state.inventory.map((item) => item.id === existing.id ? newInsumo : item) : [newInsumo, ...state.inventory],
      expenses: [newExpense, ...state.expenses],
    };

    onStateChange(newState);

    setItemName('');
    setExistingItemId('new');
    setItemCostStr('');
    setItemQtyStr('1');
    setItemPurchaseDate(getSaoPauloDateKey());
    setShowAddInsumoModal(false);
    alert(existing ? '✅ Reposição somada ao item existente no Depósito!' : '✅ Compra registrada no Depósito!');
  };

  // SUBMIT NOVA RECEITA
  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeSweetName.trim()) {
      alert('Por favor, informe o nome do doce!');
      return;
    }
    if (recipeIngredients.length === 0) {
      alert('Adicione pelo menos um ingrediente do Depósito na receita!');
      return;
    }

    const compiledIngredients: RecipeIngredient[] = recipeIngredients.map((row) => {
      const inv = state.inventory.find((i) => i.id === row.inventoryItemId);
      const unitCost = inv?.unitCost || 0;
      const qty = parseFormattedNumber(row.quantityUsedStr);
      return {
        inventoryItemId: row.inventoryItemId,
        inventoryItemName: inv ? inv.name : 'Insumo',
        quantityUsed: qty,
        unit: inv?.unit || 'unidade',
        estimatedCost: qty * unitCost,
      };
    });

    const newSweetId = `sw-${Date.now()}`;
    const existingSweet = state.sweets.find(
      (s) => s.name.toLowerCase() === recipeSweetName.trim().toLowerCase()
    );
    const targetSweetId = existingSweet ? existingSweet.id : newSweetId;
    const nowIso = new Date().toISOString();

    const newRecipe: Recipe = {
      id: `rec-${Date.now()}`,
      sweetId: targetSweetId,
      sweetName: recipeSweetName.trim(),
      yieldsCount: yieldsCount,
      ingredients: compiledIngredients,
      packagingCostPerUnit: 0,
      stoveGasMinutes: stoveGasMinutes,
      electricOvenMinutes: electricOvenMinutes,
      waterCleaningCost: waterCleaningCost,
      indirectCost: indirectCost,
      calculatedUnitCost: calculatedUnitCost,
      updatedAt: nowIso,
    };

    const updatedSweets = existingSweet
      ? state.sweets.map((s) =>
          s.id === existingSweet.id
            ? { ...s, price: manualFinalPrice, recipeId: newRecipe.id, updatedAt: nowIso }
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
            updatedAt: nowIso,
          },
        ];

    const newState: AppState = {
      ...state,
      recipes: [newRecipe, ...state.recipes],
      sweets: updatedSweets,
    };

    onStateChange(newState);

    setRecipeSweetName('');
    setShowNewRecipeModal(false);
    alert(`🎉 Receita de "${recipeSweetName}" salva no Livro de Receitas. O estoque só será baixado quando você confirmar uma produção.`);
  };

  const buildScaledIngredients = (recipe: Recipe, quantity: number): RepeatIngredientRow[] => {
    const factor = quantity / Math.max(1, recipe.yieldsCount);
    return recipe.ingredients.map((ingredient) => ({
      inventoryItemId: ingredient.inventoryItemId,
      inventoryItemName: ingredient.inventoryItemName,
      unit: ingredient.unit,
      quantityUsedStr: (ingredient.quantityUsed * factor).toFixed(3).replace(/\.?0+$/, '').replace('.', ','),
    }));
  };

  const handleOpenRepeatRecipe = (recipe: Recipe) => {
    const quantity = recipe.yieldsCount || 1;
    setRepeatRecipe(recipe);
    setRepeatQuantityStr(String(quantity));
    setRepeatIngredients(buildScaledIngredients(recipe, quantity));
  };

  const handleRepeatQuantityChange = (value: string) => {
    // Alterar a quantidade de potes NÃO altera automaticamente a receita.
    // O usuário decide se mantém exatamente os ingredientes originais ou se
    // deseja recalcular proporcionalmente pelo botão específico abaixo.
    setRepeatQuantityStr(value);
  };

  const handleScaleRepeatIngredients = () => {
    if (!repeatRecipe) return;
    const quantity = Math.max(1, Math.floor(parseFormattedNumber(repeatQuantityStr)));
    setRepeatIngredients(buildScaledIngredients(repeatRecipe, quantity));
  };

  const handleRestoreOriginalRecipe = () => {
    if (!repeatRecipe) return;
    setRepeatIngredients(buildScaledIngredients(repeatRecipe, repeatRecipe.yieldsCount || 1));
  };

  const handleUpdateRepeatIngredient = (inventoryItemId: string, value: string) => {
    setRepeatIngredients((rows) => rows.map((row) =>
      row.inventoryItemId === inventoryItemId ? { ...row, quantityUsedStr: value } : row
    ));
  };

  const handleRegisterTodayProduction = () => {
    if (!repeatRecipe) return;
    const recipe = repeatRecipe;
    const qty = Math.floor(parseFormattedNumber(repeatQuantityStr));
    if (!Number.isFinite(qty) || qty <= 0) {
      alert('Por favor, informe uma quantidade válida de potes.');
      return;
    }

    const scaledIndirectCost = (recipe.indirectCost || 0) * (qty / Math.max(1, recipe.yieldsCount));
    const actualIngredients: RecipeIngredient[] = repeatIngredients.map((row) => {
      const inventoryItem = state.inventory.find((item) => item.id === row.inventoryItemId);
      const quantityUsed = Math.max(0, parseFormattedNumber(row.quantityUsedStr));
      const currentUnitCost = inventoryItem?.unitCost || 0;
      return {
        inventoryItemId: row.inventoryItemId,
        inventoryItemName: row.inventoryItemName,
        quantityUsed,
        unit: row.unit,
        estimatedCost: quantityUsed * currentUnitCost,
      };
    });
    const productionCost = actualIngredients.reduce((total, ingredient) => total + ingredient.estimatedCost, 0)
      + scaledIndirectCost;
    const productionUnitCost = productionCost / qty;

    const nowIso = new Date().toISOString();
    const updatedInventory = consumeInventoryForRecipe(recipe, qty, nowIso, actualIngredients);
    if (!updatedInventory) return;

    const registeredSweet = state.sweets.find(
      (s) => s.name.toLowerCase() === recipe.sweetName.toLowerCase() || s.recipeId === recipe.id
    );

    const newBatch: ProductionBatch = {
      id: `batch-${Date.now()}`,
      sweetId: registeredSweet ? registeredSweet.id : recipe.sweetId || `sw-${Date.now()}`,
      sweetName: recipe.sweetName,
      totalProduced: qty,
      totalSold: 0,
      unitPrice: registeredSweet ? registeredSweet.price : 13.0,
      recipeId: recipe.id,
      productionCost,
      unitCost: productionUnitCost,
      ingredientsUsed: actualIngredients,
      startDate: getSaoPauloDateKey(),
      endDate: getSaoPauloDateKey(),
      createdAt: nowIso,
      updatedAt: nowIso,
      weekLabel: `Semana ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      status: 'active',
    };

    const updatedRecipes = state.recipes.map((r) =>
      r.id === recipe.id ? { ...r, updatedAt: nowIso } : r
    );

    const newState: AppState = {
      ...state,
      recipes: updatedRecipes,
      batches: [newBatch, ...state.batches],
      inventory: updatedInventory,
      utilitySettings: applyReadyStockDelta(state.utilitySettings, qty, nowIso),
    };

    onStateChange(newState);
    setRepeatRecipe(null);
    alert(`Produção de ${qty} potes de "${recipe.sweetName}" registrada. Custo total: ${formatCurrency(productionCost)}. Os ingredientes foram baixados do Depósito.`);
  };

  // Low stock alert items
  const lowStockItems = state.inventory.filter(
    (item) => item.remainingQuantity <= (item.minAlertQuantity || 3)
  );

  // Filtered stock list
  const filteredInventory = state.inventory.filter((item) =>
    item.name.toLowerCase().includes(stockSearchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-24 text-slate-800">
      {/* HEADER PRINCIPAL DE PRODUÇÃO */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-2">
        <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          <Package className="w-3.5 h-3.5 text-amber-700" />
          <span>Módulo de Produção</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Depósito & Livro de Receitas
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Acesse os cadastros flutuantes sem poluição na tela. Lançamentos via cards práticos!
        </p>
      </div>

      {/* 2 MAIN OPERATIONAL CARDS FOR PRODUÇÃO: ESTOQUE vs LIVRO DE RECEITAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SEÇÃO 1: ESTOQUE */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5 flex flex-col justify-between hover:border-amber-400 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-2xl">
                📦
              </div>
              {lowStockItems.length > 0 ? (
                <span className="bg-rose-100 text-rose-800 text-xs px-3 py-1 rounded-full font-bold border border-rose-200">
                  ⚠️ {lowStockItems.length} p/ reposição
                </span>
              ) : (
                <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold border border-emerald-200">
                  ✓ Depósito em ordem
                </span>
              )}
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">Depósito</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Registre cada compra, a quantidade e o valor pago. O custo médio fica disponível no Livro de Receitas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* BOTÃO CADASTRAR COMPRA */}
            <button
              type="button"
              onClick={() => setShowAddInsumoModal(true)}
              className="px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-2xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Compra</span>
            </button>

            {/* BOTÃO VER LISTA DE PRODUTOS */}
            <button
              type="button"
              onClick={() => setShowStockListModal(true)}
              className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Package className="w-4 h-4 text-amber-400" />
              <span>Ver Produtos no Depósito ({state.inventory.length})</span>
            </button>
          </div>
        </div>

        {/* SEÇÃO 2: LIVRO DE RECEITAS */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-5 flex flex-col justify-between hover:border-purple-400 transition-colors">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center text-2xl">
                📖
              </div>
              <span className="bg-purple-100 text-purple-900 text-xs px-3 py-1 rounded-full font-bold border border-purple-200">
                {state.recipes.length} receitas cadastradas
              </span>
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">Livro de Receitas</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Crie e consulte suas receitas com cálculo exato de custos de insumos, gás e energia por pote.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* BOTÃO NOVA RECEITA */}
            <button
              type="button"
              onClick={() => setShowNewRecipeModal(true)}
              className="px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4 text-amber-300" />
              <span>Nova Receita</span>
            </button>

            {/* BOTÃO LIVRO DE RECEITAS */}
            <button
              type="button"
              onClick={() => setShowRecipeBookModal(true)}
              className="px-4 py-3 bg-purple-950 hover:bg-purple-900 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <BookOpen className="w-4 h-4 text-amber-300" />
              <span>Livro de Receitas ({state.recipes.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. CARD FLUTUANTE / MODAL: CADASTRAR COMPRA (ESTOQUE) */}
      {/* ========================================================================= */}
      {showAddInsumoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-600" />
                <h3 className="text-xl font-black text-slate-900">Cadastrar Compra de Insumo</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddInsumoModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* CALCULADORA IMPLÍCITA DE BOLACHA DENTRO DA COMPRA */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-amber-600" />
                  <span>Calculadora de Bolacha Implicita no Lançamento</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowBiscuitCalc(!showBiscuitCalc)}
                  className="text-xs font-bold text-amber-800 underline cursor-pointer"
                >
                  {showBiscuitCalc ? 'Fechar Calculadora' : '🍪 Calcular por Pacotes de Bolacha'}
                </button>
              </div>

              {showBiscuitCalc && (
                <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 text-[10px] mb-1">Nome:</label>
                      <input
                        type="text"
                        value={biscuitNameInput}
                        onChange={(e) => setBiscuitNameInput(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 text-[10px] mb-1">Qtd Pacotes:</label>
                      <input
                        type="text"
                        value={biscuitPkgCountStr}
                        onChange={(e) => setBiscuitPkgCountStr(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 text-[10px] mb-1">Peso Pacote (g):</label>
                      <input
                        type="text"
                        value={biscuitPkgWeightStr}
                        onChange={(e) => setBiscuitPkgWeightStr(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 text-[10px] mb-1">Preço/Pacote (R$):</label>
                      <input
                        type="text"
                        value={biscuitPkgPriceStr}
                        onChange={(e) => setBiscuitPkgPriceStr(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold font-mono text-emerald-700"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyImplicitBiscuitCalc}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl cursor-pointer text-xs transition-colors shadow-2xs"
                  >
                    ✅ Preencher {((parseFormattedNumber(biscuitPkgCountStr) || 1) * (parseFormattedNumber(biscuitPkgWeightStr) || 360))}g de Bolacha (Total: R$ {((parseFormattedNumber(biscuitPkgCountStr) || 1) * (parseFormattedNumber(biscuitPkgPriceStr) || 7.98)).toFixed(2)}) no Formulário!
                  </button>
                </div>
              )}
            </div>

            {/* FORMULARIO DE COMPRA */}
            <form onSubmit={handleAddInsumo} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">O que você está fazendo?</label>
                <select
                  value={existingItemId}
                  onChange={(e) => {
                    const id = e.target.value; setExistingItemId(id);
                    const item = state.inventory.find((i) => i.id === id);
                    if (item) { setItemName(item.name); setItemCategory(item.category); setItemUnit(item.unit); setMinAlertQtyStr(String(item.minAlertQuantity ?? 3)); }
                  }}
                  className="w-full p-3 bg-amber-50 border border-amber-200 rounded-2xl font-bold text-slate-900"
                >
                  <option value="new">➕ Cadastrar produto novo</option>
                  {state.inventory.map((item) => <option key={item.id} value={item.id}>♻️ Repor {item.name} — atual: {item.remainingQuantity} {item.unit}</option>)}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Reposição soma quantidade e valor ao cadastro existente; nenhuma compra antiga é apagada.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome do Insumo:</label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Ex: Leite Condensado Moça, Bolacha Maizena"
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Data da compra:</label>
                  <input
                    type="date"
                    value={itemPurchaseDate}
                    onChange={(e) => setItemPurchaseDate(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Validade:</label>
                  <input
                    type="date"
                    value={itemExpiry}
                    onChange={(e) => setItemExpiry(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Qtd Comprada:</label>
                  <input
                    type="text"
                    value={itemQtyStr}
                    onChange={(e) => setItemQtyStr(e.target.value)}
                    placeholder="Ex: 1080 ou 3"
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unidade:</label>
                  <select
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 cursor-pointer"
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
                  <label className="block font-bold text-slate-700 mb-1">Valor Total Pago (R$):</label>
                  <input
                    type="text"
                    value={itemCostStr}
                    onChange={(e) => setItemCostStr(e.target.value)}
                    placeholder="Ex: 23,94"
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alerta Mínimo:</label>
                  <input
                    type="text"
                    value={minAlertQtyStr}
                    onChange={(e) => setMinAlertQtyStr(e.target.value)}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-rose-700"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  + REGISTRAR COMPRA
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddInsumoModal(false)}
                  className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CARD FLUTUANTE / MODAL: LISTA DE PRODUTOS EM ESTOQUE */}
      {/* ========================================================================= */}
      {showStockListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-600" />
                <h3 className="text-xl font-black text-slate-900">
                  Produtos no Depósito ({state.inventory.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStockListModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={stockSearchTerm}
                onChange={(e) => setStockSearchTerm(e.target.value)}
                placeholder="Buscar produto no depósito..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-amber-600"
              />
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider bg-slate-50">
                    <th className="py-3 px-4">Insumo</th>
                    <th className="py-3 px-4">Validade</th>
                    <th className="py-3 px-4 text-center">Ajuste de Quantidade</th>
                    <th className="py-3 px-4">Custo Unitário</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInventory.map((item) => {
                    const calculatedUnitCost = item.unitCost;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-black text-slate-900">📦 {item.name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {item.expirationDate ? new Date(item.expirationDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => handleAdjustQuantity(item.id, -1)}
                              className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 text-slate-800 font-black flex items-center justify-center text-sm active:scale-90 transition-all cursor-pointer shadow-2xs"
                              title="Diminuir 1"
                            >
                              -
                            </button>
                            <span className="min-w-[48px] text-center font-black text-slate-900 font-mono text-sm">
                              {item.remainingQuantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAdjustQuantity(item.id, 1)}
                              className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black flex items-center justify-center text-sm active:scale-90 transition-all cursor-pointer shadow-2xs"
                              title="Aumentar +1"
                            >
                              +
                            </button>
                            <span className="text-[10px] text-slate-400 font-mono ml-1">
                              / {item.totalQuantityBought} {item.unit}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold font-mono text-emerald-700">
                          {formatCurrency(calculatedUnitCost)} / {item.unit}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {confirmDeleteId === item.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteInsumo(item.id)}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-md cursor-pointer"
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-slate-400 hover:text-slate-600 text-[10px] px-1 py-1 cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Excluir insumo"
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

      {/* ========================================================================= */}
      {/* 3. CARD FLUTUANTE / MODAL: NOVA RECEITA */}
      {/* ========================================================================= */}
      {showNewRecipeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 w-full max-w-3xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-purple-600" />
                <h3 className="text-xl font-black text-slate-900">Cadastrar Nova Receita</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewRecipeModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Nome do Doce:
                  </label>
                  <input
                    type="text"
                    value={recipeSweetName}
                    onChange={(e) => setRecipeSweetName(e.target.value)}
                    placeholder="Ex: Bolo de Pote Ninho com Nutella"
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Rendimento (Quantidade de Potes):
                  </label>
                  <input
                    type="text"
                    value={recipeYieldsCountStr}
                    onChange={(e) => setRecipeYieldsCountStr(e.target.value)}
                    placeholder="Ex: 20"
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-purple-900"
                  />
                </div>
              </div>

              {/* INGREDIENTES DO ESTOQUE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <label className="font-bold text-slate-900 uppercase text-[11px] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-600" />
                    Ingredientes puxados do Depósito:
                  </label>

                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 hover:bg-purple-600 hover:text-white font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Insumo</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {recipeIngredients.map((row, index) => {
                    const selectedInvItem = state.inventory.find((i) => i.id === row.inventoryItemId);
                    const unitCost = selectedInvItem
                      ? selectedInvItem.unitCost
                      : 0;
                    const qtyVal = parseFormattedNumber(row.quantityUsedStr);
                    const lineTotalCost = qtyVal * unitCost;

                    return (
                      <div key={row.id} className="bg-slate-50 p-2.5 border border-slate-200 rounded-xl space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <span className="font-bold text-slate-400 sm:col-span-1 text-center">{index + 1}.</span>

                          <div className="sm:col-span-5">
                            <select
                              value={row.inventoryItemId}
                              onChange={(e) => handleUpdateIngredientRow(row.id, 'inventoryItemId', e.target.value)}
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 cursor-pointer"
                            >
                              {state.inventory.map((inv) => {
                                const invUnitCost = inv.unitCost;
                                return (
                                  <option key={inv.id} value={inv.id}>
                                    📦 {inv.name} ({formatCurrency(invUnitCost)} / {inv.unit})
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div className="sm:col-span-3">
                            <div className="flex items-center justify-between">
                              <label className="block text-[10px] font-bold text-slate-500">Qtd ({selectedInvItem?.unit || 'un'}):</label>
                              <button
                                type="button"
                                onClick={() => setActiveConverterRowId(activeConverterRowId === row.id ? null : row.id)}
                                className="text-[10px] font-bold text-amber-700 hover:underline cursor-pointer"
                              >
                                Converter Biscoito
                              </button>
                            </div>
                            <input
                              type="text"
                              value={row.quantityUsedStr}
                              onChange={(e) => handleUpdateIngredientRow(row.id, 'quantityUsedStr', e.target.value)}
                              placeholder="Ex: 50 ou 1,5"
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                            />
                          </div>

                          <div className="sm:col-span-3 flex items-center justify-between sm:justify-end gap-2">
                            <div className="text-right">
                              <span className="font-mono font-bold text-slate-800">{formatCurrency(lineTotalCost)}</span>
                              {yieldsCount > 0 && (
                                <span className="block font-mono text-[10px] font-bold text-purple-700">
                                  ({formatCurrency(lineTotalCost / yieldsCount)} / pote)
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveIngredientRow(row.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* CONVERSOR INLINE */}
                        {activeConverterRowId === row.id && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-2 text-xs text-amber-950">
                            <div className="flex items-center justify-between font-bold text-[11px]">
                              <span>Conversor Biscoitos Inteiros ↔ Gramas:</span>
                              <button
                                type="button"
                                onClick={() => setActiveConverterRowId(null)}
                                className="text-[10px] text-slate-500 hover:underline"
                              >
                                Fechar
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] block font-bold">Qtd de Biscoitos Inteiros:</label>
                                <input
                                  type="text"
                                  value={converterUnitsCountStr}
                                  onChange={(e) => setConverterUnitsCountStr(e.target.value)}
                                  className="w-full p-1.5 bg-white border border-amber-200 rounded font-mono text-xs font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] block font-bold">Peso de 1 Biscoito (g):</label>
                                <input
                                  type="text"
                                  value={converterUnitWeightGramsStr}
                                  onChange={(e) => setConverterUnitWeightGramsStr(e.target.value)}
                                  className="w-full p-1.5 bg-white border border-amber-200 rounded font-mono text-xs font-bold"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* UTILIDADES */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-600" />
                    <Zap className="w-4 h-4 text-amber-500" />
                    <Droplets className="w-4 h-4 text-blue-500" />
                    <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Gás, Luz e Água (Tempo de Preparo)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowUtilityRates((value) => !value)}
                    className="text-[10px] font-bold text-purple-700 bg-white border border-purple-200 hover:bg-purple-50 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    {showUtilityRates ? 'Fechar contas' : 'Calibrar contas do mês anterior'}
                  </button>
                </div>

                {showUtilityRates && (
                  <div className="bg-white border border-purple-200 rounded-xl p-3 space-y-3">
                    <div className="text-[11px] text-slate-600 leading-relaxed">
                      Use as contas de <strong>{formatMonthShort(utilityReferenceMonth)}</strong>. O sistema calcula o preço do kWh e divide a água pela quantidade de produções do mês.
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <label className="text-[10px] font-bold text-slate-600">Botijão de gás (R$)
                        <input value={gasCylinderPriceStr} onChange={(event) => setGasCylinderPriceStr(event.target.value)} className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900" />
                      </label>
                      <label className="text-[10px] font-bold text-slate-600">Conta de luz (R$)
                        <input value={electricityBillStr} onChange={(event) => setElectricityBillStr(event.target.value)} className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900" />
                      </label>
                      <label className="text-[10px] font-bold text-slate-600">Consumo da luz (kWh)
                        <input value={electricityKwhStr} onChange={(event) => setElectricityKwhStr(event.target.value)} className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900" />
                      </label>
                      <label className="text-[10px] font-bold text-slate-600">Conta de água (R$)
                        <input value={waterBillStr} onChange={(event) => setWaterBillStr(event.target.value)} className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900" />
                      </label>
                      <label className="text-[10px] font-bold text-slate-600">Produções no mês
                        <input value={productionCyclesStr} onChange={(event) => setProductionCyclesStr(event.target.value)} className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900" />
                      </label>
                    </div>
                    <button type="button" onClick={handleSaveUtilityRates} className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black cursor-pointer">
                      Salvar contas e aplicar à receita
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Tempo no Fogão (min):
                    </label>
                    <input
                      type="text"
                      value={stoveGasMinutesStr}
                      onChange={(e) => setStoveGasMinutesStr(e.target.value)}
                      placeholder="Ex: 25 min"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Tempo Forno Elétrico (min):
                    </label>
                    <input
                      type="text"
                      value={electricOvenMinutesStr}
                      onChange={(e) => setElectricOvenMinutesStr(e.target.value)}
                      placeholder="Ex: 40 min"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Água / Limpeza (R$):
                    </label>
                    <input
                      type="text"
                      value={waterCleaningCostStr}
                      onChange={(e) => setWaterCleaningCostStr(e.target.value)}
                      placeholder="Ex: 1,00"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* RESUMO DE PREÇOS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-purple-50 border border-purple-200 rounded-xl p-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-purple-800">Custo Total Receita:</span>
                  <div className="text-lg font-bold text-slate-900 font-mono">{formatCurrency(totalRecipeCost)}</div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-purple-900">Custo Produção por Doce:</span>
                  <div className="text-xl font-black text-purple-950 font-mono">{formatCurrency(calculatedUnitCost)}</div>
                </div>

                <div>
                  <label className="block font-bold text-slate-900 uppercase text-[10px] mb-1">Preço de Venda (R$):</label>
                  <input
                    type="text"
                    value={manualFinalPriceStr}
                    onChange={(e) => setManualFinalPriceStr(e.target.value)}
                    required
                    className="w-full p-2 bg-white border-2 border-purple-400 rounded-lg font-mono font-bold text-purple-950 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-colors"
              >
                SALVAR RECEITA
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CARD FLUTUANTE / MODAL: LIVRO DE RECEITAS */}
      {/* ========================================================================= */}
      {showRecipeBookModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                <h3 className="text-xl font-black text-slate-900">
                  Livro de Receitas ({state.recipes.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRecipeBookModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {state.recipes.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl text-slate-400 text-xs font-semibold">
                Nenhuma receita cadastrada ainda. Clique em "Nova Receita" para adicionar!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {state.recipes.map((recipe) => {
                  const registeredSweet = state.sweets.find(
                    (s) => s.name === recipe.sweetName || s.recipeId === recipe.id
                  );
                  const salePrice = registeredSweet ? registeredSweet.price : 13;
                  const estimatedProfit = salePrice - recipe.calculatedUnitCost;
                  const recipeTotalCost = recipe.ingredients.reduce(
                    (total, ingredient) => total + (ingredient.estimatedCost || 0),
                    0
                  ) + (recipe.indirectCost || 0);

                  return (
                    <div key={recipe.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs shadow-xs">
                      <div className="flex items-center justify-between font-black text-slate-900 border-b border-slate-200 pb-2">
                        <span className="text-sm">🧁 {recipe.sweetName}</span>
                        <span className="text-purple-950 font-mono bg-purple-100 px-2.5 py-1 rounded-lg text-xs font-black">
                          {formatCurrency(recipe.calculatedUnitCost)} / pote
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 text-center font-mono">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Rendimento:</span>
                          <span className="font-bold text-slate-800 text-xs">{recipe.yieldsCount} potes</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Custo total:</span>
                          <span className="font-extrabold text-rose-700 text-xs">{formatCurrency(recipeTotalCost)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Preço Venda:</span>
                          <span className="font-extrabold text-emerald-700 text-xs">{formatCurrency(salePrice)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Lucro / Pote:</span>
                          <span className="font-extrabold text-purple-700 text-xs">{formatCurrency(estimatedProfit)}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Ingredientes Lançados:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {recipe.ingredients.map((ing, idx) => (
                            <span key={idx} className="bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[10px] text-slate-700 font-semibold">
                              {ing.inventoryItemName}: {ing.quantityUsed} {ing.unit} ({formatCurrency(ing.estimatedCost)})
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenRepeatRecipe(recipe)}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 border border-amber-600/30"
                      >
                        <ChefHat className="w-4 h-4" />
                        <span>Produzir novamente</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REPETIR RECEITA: fluxo propositalmente simples */}
      {repeatRecipe && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white border-2 border-amber-300 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-800"><ChefHat className="w-4 h-4" /> Repetir receita</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{repeatRecipe.sweetName}</h3>
                <p className="text-xs text-slate-500 mt-1">A mesma receita será usada novamente. Informe apenas quantos potes você produziu.</p>
              </div>
              <button type="button" onClick={() => setRepeatRecipe(null)} className="p-2 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <label className="block bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <span className="block text-[10px] font-black uppercase text-amber-800 mb-2">Quantidade produzida</span>
              <input type="number" min="1" step="1" value={repeatQuantityStr} onChange={(event) => handleRepeatQuantityChange(event.target.value)} className="w-full p-3 bg-white border-2 border-amber-400 rounded-xl text-3xl font-black font-mono text-slate-900 text-center" />
              <small className="block mt-2 text-center text-amber-800">Receita original: {repeatRecipe.yieldsCount} potes</small>
            </label>
            <button type="button" onClick={handleRegisterTodayProduction} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm rounded-xl shadow-md">Confirmar produção</button>
            <button type="button" onClick={() => { setRepeatRecipe(null); setShowNewRecipeModal(true); }} className="w-full text-xs font-bold text-slate-500 hover:text-slate-800">Preciso alterar a receita</button>
          </div>
        </div>
      )}
    </div>
  );
};
