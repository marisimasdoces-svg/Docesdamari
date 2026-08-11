export type UserRole = 'admin' | 'manager';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  avatar: string;
  badge: string;
}

export type DepartmentName = string;

export interface Buyer {
  id: string;
  name: string;
  department: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface SweetItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  recipeId?: string;
  active: boolean;
  category?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface ProductionBatch {
  id: string;
  weekLabel: string; // e.g. "Semana 04/08 a 10/08"
  startDate: string;
  endDate: string;
  sweetId: string;
  sweetName: string;
  totalProduced: number;
  totalSold: number;
  unitPrice: number;
  notes?: string;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface Sale {
  id: string;
  buyerId: string;
  buyerName: string;
  department: string;
  sweetId: string;
  sweetName: string;
  batchId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  saleDate: string; // ISO date
  monthKey: string; // e.g. "2026-08"
  weekLabel: string;
  isPaidImmediately: boolean;
  paymentStatus: 'paid' | 'pending';
  paymentDate?: string;
  paymentMethod?: 'pix' | 'dinheiro' | 'fiado';
  registeredBy: string;
  notes?: string;
  isRetroactive?: boolean;
  estimatedUnitCost?: number;
  updatedAt?: string;
  deletedAt?: string;
}

export interface PaymentRecord {
  id: string;
  buyerId: string;
  buyerName: string;
  monthKey: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: 'pix' | 'dinheiro';
  notes?: string;
  registeredBy: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'ingrediente' | 'embalagem' | 'utensilio' | 'outro';
  unit: 'g' | 'kg' | 'ml' | 'L' | 'unidade' | 'caixa' | 'pct';
  totalQuantityBought: number;
  remainingQuantity: number;
  totalCostPaid: number; // R$ total
  unitCost: number; // R$ per unit/g/ml
  expirationDate?: string; // ISO date string
  purchaseDate: string;
  minAlertQuantity?: number;
  supplier?: string;
  brand?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface RecipeIngredient {
  inventoryItemId: string;
  inventoryItemName: string;
  quantityUsed: number;
  unit: string;
  estimatedCost: number;
}

export interface Recipe {
  id: string;
  sweetId: string;
  sweetName: string;
  yieldsCount: number; // how many jars made
  ingredients: RecipeIngredient[];
  packagingCostPerUnit: number; // cost of pot + spoon + sticker
  indirectCost?: number; // Gás, Energia e Água (R$ total da receita)
  stoveGasMinutes?: number;
  electricOvenMinutes?: number;
  waterCleaningCost?: number;
  calculatedUnitCost: number; // total recipe cost / yieldsCount
  updatedAt: string;
  deletedAt?: string;
}

export interface BatchExpense {
  id: string;
  batchId?: string;
  date: string;
  description: string;
  category: 'ingredientes' | 'embalagens' | 'transporte' | 'equipamento' | 'outro';
  totalCost: number;
  monthKey: string;
  notes?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface UtilitySettings {
  id: string;
  referenceMonth: string;
  gasCylinderPrice: number;
  electricityBill: number;
  electricityKwh: number;
  waterBill: number;
  productionCycles: number;
  updatedAt: string;
  deletedAt?: string;
}

export interface AppState {
  users: User[];
  currentUser: User | null;
  buyers: Buyer[];
  sweets: SweetItem[];
  batches: ProductionBatch[];
  sales: Sale[];
  payments: PaymentRecord[];
  inventory: InventoryItem[];
  recipes: Recipe[];
  expenses: BatchExpense[];
  utilitySettings: UtilitySettings[];
  departments: string[];
  tombstones?: Record<string, string>; // { [entityId]: ISO_Timestamp_When_Deleted }
  lastUpdated?: string;
}
