/**
 * Centralized storage repository.
 * Currently backed by window.localStorage.
 * Designed with clean repository functions so LocalStorage calls
 * can be swapped with REST API fetch() calls during backend integration.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'clearledger_transactions_v1',
  BUDGET: 'clearledger_budget_v1',
  INITIALIZED: 'clearledger_initialized_v1',
};

const DEFAULT_SEED_TRANSACTIONS = [
  {
    id: 'tx_seed_01',
    title: 'Monthly Salary',
    amount: 5400,
    category: 'Salary',
    type: 'income',
    date: '2026-11-01',
    description: 'Primary employer direct deposit',
  },
  {
    id: 'tx_seed_02',
    title: 'Apartment Rent',
    amount: 1650,
    category: 'Housing',
    type: 'expense',
    date: '2026-11-02',
    description: 'November lease payment',
  },
  {
    id: 'tx_seed_03',
    title: 'UI Consulting Retainer',
    amount: 950,
    category: 'Freelance',
    type: 'income',
    date: '2026-11-05',
    description: 'Design system review for client',
  },
  {
    id: 'tx_seed_04',
    title: 'Grocery Shopping',
    amount: 285.4,
    category: 'Food',
    type: 'expense',
    date: '2026-11-07',
    description: 'Weekly groceries and fresh produce',
  },
  {
    id: 'tx_seed_05',
    title: 'Electric & Fiber Internet',
    amount: 142.8,
    category: 'Utilities',
    type: 'expense',
    date: '2026-11-08',
    description: 'Monthly power and internet bill',
  },
  {
    id: 'tx_seed_06',
    title: 'Commuter Transit Pass',
    amount: 118,
    category: 'Transport',
    type: 'expense',
    date: '2026-11-10',
    description: 'Monthly metro & rail pass',
  },
  {
    id: 'tx_seed_07',
    title: 'Dental Checkup',
    amount: 165,
    category: 'Healthcare',
    type: 'expense',
    date: '2026-11-11',
    description: 'Routine cleaning co-pay',
  },
  {
    id: 'tx_seed_08',
    title: 'Farmers Market & Dinner',
    amount: 148.5,
    category: 'Food',
    type: 'expense',
    date: '2026-11-13',
    description: 'Weekend market and dinner out',
  },
  {
    id: 'tx_seed_09',
    title: 'Monthly Salary',
    amount: 5400,
    category: 'Salary',
    type: 'income',
    date: '2026-10-01',
    description: 'October direct deposit',
  },
  {
    id: 'tx_seed_10',
    title: 'Apartment Rent',
    amount: 1650,
    category: 'Housing',
    type: 'expense',
    date: '2026-10-02',
    description: 'October lease payment',
  },
  {
    id: 'tx_seed_11',
    title: 'Grocery & Household',
    amount: 520,
    category: 'Food',
    type: 'expense',
    date: '2026-10-12',
    description: 'Monthly pantry restock and supplies',
  },
  {
    id: 'tx_seed_12',
    title: 'Autumn Jacket & Shoes',
    amount: 240,
    category: 'Shopping',
    type: 'expense',
    date: '2026-10-18',
    description: 'Seasonal wardrobe essentials',
  },
  {
    id: 'tx_seed_13',
    title: 'Monthly Salary',
    amount: 5200,
    category: 'Salary',
    type: 'income',
    date: '2026-09-01',
    description: 'September direct deposit',
  },
  {
    id: 'tx_seed_14',
    title: 'Apartment Rent',
    amount: 1650,
    category: 'Housing',
    type: 'expense',
    date: '2026-09-02',
    description: 'September lease payment',
  },
  {
    id: 'tx_seed_15',
    title: 'Online Course Subscription',
    amount: 199,
    category: 'Education',
    type: 'expense',
    date: '2026-09-14',
    description: 'Annual technical workshop access',
  },
];

const DEFAULT_BUDGET_CONFIG = {
  defaultLimit: 3500,
  monthlyLimits: {
    '2026-11': 3500,
    '2026-10': 3500,
    '2026-09': 3500,
  },
};

function getStorageBackend() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function initializeStorage() {
  const storage = getStorageBackend();
  if (!storage) return;

  const isInitialized = storage.getItem(STORAGE_KEYS.INITIALIZED);
  if (!isInitialized) {
    if (storage.getItem(STORAGE_KEYS.TRANSACTIONS) === null) {
      storage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(DEFAULT_SEED_TRANSACTIONS));
    }
    if (storage.getItem(STORAGE_KEYS.BUDGET) === null) {
      storage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(DEFAULT_BUDGET_CONFIG));
    }
    storage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }
}

export function getTransactions() {
  const storage = getStorageBackend();
  if (!storage) return [];

  try {
    const raw = storage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read transactions from storage:', error);
    return [];
  }
}

export function saveTransactions(transactions) {
  const storage = getStorageBackend();
  if (!storage) return false;

  try {
    storage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    return true;
  } catch (error) {
    console.error('Failed to save transactions to storage:', error);
    return false;
  }
}

export function addTransaction(transaction) {
  const list = getTransactions();
  const nextList = [transaction, ...list];
  saveTransactions(nextList);
  return transaction;
}

export function updateTransaction(id, updates) {
  const list = getTransactions();
  let updatedItem = null;
  const nextList = list.map((item) => {
    if (item.id === id) {
      updatedItem = { ...item, ...updates, id };
      return updatedItem;
    }
    return item;
  });
  if (updatedItem) {
    saveTransactions(nextList);
  }
  return updatedItem;
}

export function deleteTransaction(id) {
  const list = getTransactions();
  const nextList = list.filter((item) => item.id !== id);
  if (nextList.length === list.length) {
    return false;
  }
  saveTransactions(nextList);
  return true;
}

export function getBudgetConfig() {
  const storage = getStorageBackend();
  if (!storage) return { ...DEFAULT_BUDGET_CONFIG };

  try {
    const raw = storage.getItem(STORAGE_KEYS.BUDGET);
    if (!raw) return { ...DEFAULT_BUDGET_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      defaultLimit: Number(parsed?.defaultLimit) || DEFAULT_BUDGET_CONFIG.defaultLimit,
      monthlyLimits: { ...(parsed?.monthlyLimits || {}) },
    };
  } catch (error) {
    console.error('Failed to read budget config from storage:', error);
    return { ...DEFAULT_BUDGET_CONFIG };
  }
}

export function getMonthlyBudget(month) {
  const config = getBudgetConfig();
  if (month && Object.prototype.hasOwnProperty.call(config.monthlyLimits, month)) {
    return Number(config.monthlyLimits[month]) || 0;
  }
  return Number(config.defaultLimit) || 0;
}

export function saveBudget(month, limit) {
  const storage = getStorageBackend();
  const config = getBudgetConfig();
  const numericLimit = Number(limit);

  if (month) {
    config.monthlyLimits[month] = numericLimit;
  }
  config.defaultLimit = numericLimit;

  if (storage) {
    try {
      storage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save budget config to storage:', error);
    }
  }
  return config;
}
