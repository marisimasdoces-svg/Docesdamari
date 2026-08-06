import { AppState } from '../types';

export const INITIAL_STATE: AppState = {
  users: [
    {
      id: 'usr-damer',
      name: 'Damer Simas',
      username: 'DAMERSIMAS',
      role: 'admin',
      avatar: '👨‍🍳',
      badge: 'Mestre Doceiro / Gestor',
    },
    {
      id: 'usr-mari',
      name: 'Mari Simas',
      username: 'MARISIMAS',
      role: 'manager',
      avatar: '👩‍🍳',
      badge: 'Chef Confeiteira / Mari',
    },
  ],
  currentUser: null,
  departments: [
    '1º esqd',
    '2º esqd',
    '3º esqd',
    'Esqd Cap',
    'fanfarra',
    'pmgu',
    'outros',
  ],
  buyers: [],
  sweets: [],
  batches: [],
  sales: [],
  payments: [],
  inventory: [],
  recipes: [],
  expenses: [],
};

