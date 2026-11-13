import {
  initializeStorage,
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getMonthlyBudget,
  saveBudget,
} from './storage.js';
import {
  generateTransactionId,
  validateTransactionInput,
  renderTransactionsView,
  populateCategorySelect,
  clearTransactionFormErrors,
  showTransactionFormErrors,
} from './transactions.js';
import { renderDashboardView, formatMonthShort } from './dashboard.js';
import { renderAnalyticsView } from './analytics.js';
import {
  validateBudgetAmount,
  calculateBudgetStatus,
  renderBudgetSummaryWidgets,
  renderBudgetView,
} from './budget.js';

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  transactions: 'Transaction History',
  analytics: 'Expense Analytics',
  budget: 'Budget Management',
};

function getCurrentMonthKey() {
  return '2026-11';
}

function getTodayDateString() {
  return '2026-11-13';
}

const appState = {
  activeView: 'dashboard',
  selectedMonth: getCurrentMonthKey(),
  transactions: [],
  filters: {
    search: '',
    type: 'all',
    category: 'all',
    sortBy: 'date-desc',
  },
  pendingDeleteId: null,
};

function getAvailableMonthKeys(transactions) {
  const set = new Set([getCurrentMonthKey()]);
  for (const tx of transactions) {
    if (typeof tx.date === 'string' && /^\d{4}-\d{2}/.test(tx.date)) {
      set.add(tx.date.slice(0, 7));
    }
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

function syncMonthSelector() {
  const select = document.getElementById('global-month-select');
  if (!select) return;

  const months = getAvailableMonthKeys(appState.transactions);
  if (appState.selectedMonth !== 'all' && !months.includes(appState.selectedMonth)) {
    months.unshift(appState.selectedMonth);
  }

  const optionsHtml = [
    ...months.map((m) => `<option value="${m}">${formatMonthShort(m)}</option>`),
    '<option value="all">All Months</option>',
  ].join('');

  select.innerHTML = optionsHtml;
  select.value = appState.selectedMonth;
}

function getActiveBudgetMonth() {
  return appState.selectedMonth === 'all' ? getCurrentMonthKey() : appState.selectedMonth;
}

function refreshIcons() {
  if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 3000);
}

function renderAll() {
  appState.transactions = getTransactions();
  syncMonthSelector();

  const budgetMonth = getActiveBudgetMonth();
  const budgetLimit = getMonthlyBudget(budgetMonth);
  const budgetStatus = calculateBudgetStatus(appState.transactions, budgetMonth, budgetLimit);

  renderBudgetSummaryWidgets(budgetStatus, appState.activeView === 'budget');

  // Toggle visible view section
  document.querySelectorAll('.view-section').forEach((section) => {
    const isTarget = section.id === `view-${appState.activeView}`;
    section.hidden = !isTarget;
  });

  // Update navigation state
  document.querySelectorAll('.nav-link[data-view]').forEach((btn) => {
    const isActive = btn.dataset.view === appState.activeView;
    btn.classList.toggle('is-active', isActive);
    if (isActive) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  const titleEl = document.getElementById('page-title');
  if (titleEl) {
    titleEl.textContent = VIEW_TITLES[appState.activeView] || 'Dashboard';
  }

  if (appState.activeView === 'dashboard') {
    renderDashboardView(appState, budgetMonth);
  } else if (appState.activeView === 'transactions') {
    renderTransactionsView(appState, {
      onEdit: (tx) => openTransactionModal('edit', tx),
      onDelete: (tx) => openDeleteModal(tx),
    });
  } else if (appState.activeView === 'analytics') {
    renderAnalyticsView(appState, budgetMonth);
  } else if (appState.activeView === 'budget') {
    renderBudgetView(appState, budgetMonth, budgetLimit);
  }

  refreshIcons();
}

function switchView(viewName) {
  if (!VIEW_TITLES[viewName]) return;
  appState.activeView = viewName;
  closeMobileSidebar();
  renderAll();
}

function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const openBtn = document.getElementById('open-sidebar-btn');
  if (sidebar) sidebar.classList.add('is-open');
  if (backdrop) backdrop.hidden = false;
  if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const openBtn = document.getElementById('open-sidebar-btn');
  if (sidebar) sidebar.classList.remove('is-open');
  if (backdrop) backdrop.hidden = true;
  if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
}

function setFormType(type) {
  const normalized = type === 'income' ? 'income' : 'expense';
  const typeInput = document.getElementById('tx-type-input');
  const categorySelect = document.getElementById('tx-category-input');

  if (typeInput) typeInput.value = normalized;
  document.querySelectorAll('[data-form-type]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.formType === normalized);
  });

  if (categorySelect) {
    const currentCategory = categorySelect.value;
    populateCategorySelect(categorySelect, normalized, currentCategory);
  }
}

function openTransactionModal(mode = 'add', transaction = null) {
  const modal = document.getElementById('transaction-modal');
  const modalTitle = document.getElementById('tx-modal-title');
  const submitBtn = document.getElementById('submit-tx-btn');
  const editIdInput = document.getElementById('tx-edit-id');
  const titleInput = document.getElementById('tx-title-input');
  const amountInput = document.getElementById('tx-amount-input');
  const categorySelect = document.getElementById('tx-category-input');
  const dateInput = document.getElementById('tx-date-input');
  const descInput = document.getElementById('tx-description-input');

  if (!modal) return;
  clearTransactionFormErrors();

  if (mode === 'edit' && transaction) {
    if (modalTitle) modalTitle.textContent = 'Edit Transaction';
    if (submitBtn) submitBtn.textContent = 'Update Transaction';
    if (editIdInput) editIdInput.value = transaction.id;

    setFormType(transaction.type);
    if (categorySelect) populateCategorySelect(categorySelect, transaction.type, transaction.category);
    if (titleInput) titleInput.value = transaction.title || '';
    if (amountInput) amountInput.value = String(transaction.amount ?? '');
    if (dateInput) dateInput.value = transaction.date || getTodayDateString();
    if (descInput) descInput.value = transaction.description || '';
  } else {
    if (modalTitle) modalTitle.textContent = 'Add Transaction';
    if (submitBtn) submitBtn.textContent = 'Save Transaction';
    if (editIdInput) editIdInput.value = '';

    setFormType('expense');
    if (categorySelect) populateCategorySelect(categorySelect, 'expense');
    if (titleInput) titleInput.value = '';
    if (amountInput) amountInput.value = '';
    if (dateInput) {
      dateInput.value =
        appState.selectedMonth !== 'all'
          ? `${appState.selectedMonth}-13`
          : getTodayDateString();
    }
    if (descInput) descInput.value = '';
  }

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', 'true');
  }
  refreshIcons();
  if (titleInput) titleInput.focus();
}

function closeTransactionModal() {
  const modal = document.getElementById('transaction-modal');
  if (!modal) return;
  if (typeof modal.close === 'function' && modal.open) {
    modal.close();
  } else {
    modal.removeAttribute('open');
  }
}

function openDeleteModal(transaction) {
  const modal = document.getElementById('confirm-delete-modal');
  const messageEl = document.getElementById('delete-modal-message');
  if (!modal || !transaction) return;

  appState.pendingDeleteId = transaction.id;
  if (messageEl) {
    messageEl.textContent = `Are you sure you want to delete "${transaction.title}"? This action cannot be undone.`;
  }

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', 'true');
  }
  refreshIcons();
}

function closeDeleteModal() {
  const modal = document.getElementById('confirm-delete-modal');
  appState.pendingDeleteId = null;
  if (!modal) return;
  if (typeof modal.close === 'function' && modal.open) {
    modal.close();
  } else {
    modal.removeAttribute('open');
  }
}

function handleTransactionSubmit(event) {
  event.preventDefault();

  const editId = document.getElementById('tx-edit-id')?.value || '';
  const payload = {
    type: document.getElementById('tx-type-input')?.value,
    title: document.getElementById('tx-title-input')?.value,
    amount: document.getElementById('tx-amount-input')?.value,
    category: document.getElementById('tx-category-input')?.value,
    date: document.getElementById('tx-date-input')?.value,
    description: document.getElementById('tx-description-input')?.value,
  };

  const result = validateTransactionInput(payload);
  if (!result.valid) {
    showTransactionFormErrors(result.errors);
    return;
  }

  clearTransactionFormErrors();

  if (editId) {
    updateTransaction(editId, result.sanitized);
    showToast('Transaction updated');
  } else {
    const newTx = {
      id: generateTransactionId(),
      ...result.sanitized,
    };
    addTransaction(newTx);
    if (appState.selectedMonth !== 'all') {
      appState.selectedMonth = newTx.date.slice(0, 7);
    }
    showToast(`${newTx.type === 'income' ? 'Income' : 'Expense'} added`);
  }

  closeTransactionModal();
  renderAll();
}

function handleBudgetSubmit(event) {
  event.preventDefault();
  const limitInput = document.getElementById('budget-limit-input');
  const errorEl = document.getElementById('budget-limit-error');
  const validation = validateBudgetAmount(limitInput?.value);

  if (!validation.valid) {
    if (limitInput) limitInput.classList.add('input-error');
    if (errorEl) {
      errorEl.textContent = validation.error;
      errorEl.hidden = false;
    }
    return;
  }

  if (limitInput) limitInput.classList.remove('input-error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.hidden = true;
  }

  const targetMonth = getActiveBudgetMonth();
  saveBudget(targetMonth, validation.value);
  showToast(`Monthly budget saved for ${formatMonthShort(targetMonth)}`);
  renderAll();
}

function bindEvents() {
  // Navigation
  document.querySelectorAll('.nav-link[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
    });
  });

  document.getElementById('view-all-transactions-btn')?.addEventListener('click', () => {
    switchView('transactions');
  });

  // Mobile sidebar
  document.getElementById('open-sidebar-btn')?.addEventListener('click', openMobileSidebar);
  document.getElementById('close-sidebar-btn')?.addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

  // Global month filter
  document.getElementById('global-month-select')?.addEventListener('change', (e) => {
    appState.selectedMonth = e.target.value;
    renderAll();
  });

  // Open Add Transaction modal
  document.getElementById('add-transaction-btn')?.addEventListener('click', () => {
    openTransactionModal('add');
  });
  document.querySelectorAll('.empty-add-btn').forEach((btn) => {
    btn.addEventListener('click', () => openTransactionModal('add'));
  });

  // Modal controls
  document.getElementById('close-tx-modal-btn')?.addEventListener('click', closeTransactionModal);
  document.getElementById('cancel-tx-modal-btn')?.addEventListener('click', closeTransactionModal);
  document.getElementById('transaction-form')?.addEventListener('submit', handleTransactionSubmit);

  document.querySelectorAll('[data-form-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setFormType(btn.dataset.formType);
    });
  });

  // Delete modal controls
  document.getElementById('close-delete-modal-btn')?.addEventListener('click', closeDeleteModal);
  document.getElementById('cancel-delete-btn')?.addEventListener('click', closeDeleteModal);
  document.getElementById('confirm-delete-btn')?.addEventListener('click', () => {
    if (appState.pendingDeleteId) {
      deleteTransaction(appState.pendingDeleteId);
      showToast('Transaction deleted');
    }
    closeDeleteModal();
    renderAll();
  });

  // Transaction History filters
  document.getElementById('tx-search-input')?.addEventListener('input', (e) => {
    appState.filters.search = e.target.value;
    renderTransactionsView(appState, {
      onEdit: (tx) => openTransactionModal('edit', tx),
      onDelete: (tx) => openDeleteModal(tx),
    });
    refreshIcons();
  });

  document.querySelectorAll('[data-tx-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.filters.type = btn.dataset.txType;
      document.querySelectorAll('[data-tx-type]').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.txType === appState.filters.type);
      });
      renderTransactionsView(appState, {
        onEdit: (tx) => openTransactionModal('edit', tx),
        onDelete: (tx) => openDeleteModal(tx),
      });
      refreshIcons();
    });
  });

  document.getElementById('tx-category-filter')?.addEventListener('change', (e) => {
    appState.filters.category = e.target.value;
    renderTransactionsView(appState, {
      onEdit: (tx) => openTransactionModal('edit', tx),
      onDelete: (tx) => openDeleteModal(tx),
    });
    refreshIcons();
  });

  document.getElementById('tx-sort-select')?.addEventListener('change', (e) => {
    appState.filters.sortBy = e.target.value;
    renderTransactionsView(appState, {
      onEdit: (tx) => openTransactionModal('edit', tx),
      onDelete: (tx) => openDeleteModal(tx),
    });
    refreshIcons();
  });

  const resetFilters = () => {
    appState.filters = {
      search: '',
      type: 'all',
      category: 'all',
      sortBy: 'date-desc',
    };
    const searchInput = document.getElementById('tx-search-input');
    const categorySelect = document.getElementById('tx-category-filter');
    const sortSelect = document.getElementById('tx-sort-select');
    if (searchInput) searchInput.value = '';
    if (categorySelect) categorySelect.value = 'all';
    if (sortSelect) sortSelect.value = 'date-desc';
    document.querySelectorAll('[data-tx-type]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.txType === 'all');
    });
    renderTransactionsView(appState, {
      onEdit: (tx) => openTransactionModal('edit', tx),
      onDelete: (tx) => openDeleteModal(tx),
    });
    refreshIcons();
  };

  document.getElementById('tx-reset-filters-btn')?.addEventListener('click', resetFilters);
  document.getElementById('tx-empty-clear-btn')?.addEventListener('click', resetFilters);

  // Budget form
  document.getElementById('budget-form')?.addEventListener('submit', handleBudgetSubmit);
}

function bootstrap() {
  initializeStorage();
  bindEvents();
  renderAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
