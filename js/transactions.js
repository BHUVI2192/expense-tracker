export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Education',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Bonus',
  'Gift',
  'Other',
];

export const ALL_CATEGORIES = Array.from(
  new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])
);

export function generateTransactionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tx_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function validateTransactionInput(input) {
  const errors = {};
  const type = input?.type === 'income' ? 'income' : 'expense';
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  const rawAmount = Number(input?.amount);
  const category = typeof input?.category === 'string' ? input.category.trim() : '';
  const date = typeof input?.date === 'string' ? input.date.trim() : '';
  const description = typeof input?.description === 'string' ? input.description.trim() : '';

  if (title.length < 2) {
    errors.title = 'Enter a title with at least 2 characters.';
  } else if (title.length > 80) {
    errors.title = 'Title must be 80 characters or fewer.';
  }

  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    errors.amount = 'Enter a valid amount greater than 0.';
  }

  const allowedCategories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (!category || !allowedCategories.includes(category)) {
    errors.category = 'Select a valid category.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Select a valid date.';
  } else {
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      errors.date = 'Select a valid calendar date.';
    }
  }

  if (description.length > 240) {
    errors.description = 'Description must be 240 characters or fewer.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      title,
      amount: Math.round(rawAmount * 100) / 100,
      category,
      type,
      date,
      description,
    },
  };
}

export function filterTransactions(transactions, filters = {}) {
  const { search = '', category = 'all', type = 'all', month = 'all' } = filters;
  const query = search.trim().toLowerCase();

  return transactions.filter((tx) => {
    if (month && month !== 'all' && (!tx.date || !tx.date.startsWith(month))) {
      return false;
    }
    if (type && type !== 'all' && tx.type !== type) {
      return false;
    }
    if (category && category !== 'all' && tx.category !== category) {
      return false;
    }
    if (query) {
      const haystack = `${tx.title || ''} ${tx.category || ''} ${tx.description || ''}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

export function sortTransactions(transactions, sortBy = 'date-desc') {
  const indexed = transactions.map((tx, index) => ({ tx, index }));
  indexed.sort((a, b) => {
    if (sortBy === 'date-asc') {
      const diff = String(a.tx.date).localeCompare(String(b.tx.date));
      return diff !== 0 ? diff : b.index - a.index;
    }
    if (sortBy === 'amount-desc') {
      return Number(b.tx.amount) - Number(a.tx.amount);
    }
    if (sortBy === 'amount-asc') {
      return Number(a.tx.amount) - Number(b.tx.amount);
    }
    const dateDiff = String(b.tx.date).localeCompare(String(a.tx.date));
    if (dateDiff !== 0) return dateDiff;
    const timeA = Number(a.tx.createdAt) || 0;
    const timeB = Number(b.tx.createdAt) || 0;
    if (timeB !== timeA) return timeB - timeA;
    return a.index - b.index;
  });
  return indexed.map((item) => item.tx);
}

export function formatCurrency(amount) {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDisplayDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || '')) return dateString || '';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTransactionsView(state, handlers) {
  const tbody = document.getElementById('all-transactions-tbody');
  const tableWrap = document.querySelector('#view-transactions .table-wrap');
  const emptyState = document.getElementById('all-transactions-empty');
  const emptyTitle = document.getElementById('tx-empty-title');
  const emptyDesc = document.getElementById('tx-empty-desc');
  const emptyClearBtn = document.getElementById('tx-empty-clear-btn');
  const countEl = document.getElementById('tx-result-count');
  const resetBtn = document.getElementById('tx-reset-filters-btn');
  const categorySelect = document.getElementById('tx-category-filter');

  if (!tbody || !emptyState) return;

  // Sync category options while keeping current selection
  if (categorySelect && categorySelect.options.length <= 1) {
    ALL_CATEGORIES.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
  }
  if (categorySelect) {
    categorySelect.value = state.filters.category;
  }

  const hasActiveFilters =
    state.filters.search.trim() !== '' ||
    state.filters.category !== 'all' ||
    state.filters.type !== 'all';

  if (resetBtn) {
    resetBtn.hidden = !hasActiveFilters;
  }

  const filtered = filterTransactions(state.transactions, {
    ...state.filters,
    month: state.selectedMonth,
  });
  const sorted = sortTransactions(filtered, state.filters.sortBy);

  if (countEl) {
    const label = sorted.length === 1 ? 'transaction' : 'transactions';
    countEl.textContent = `${sorted.length} ${label}`;
  }

  if (sorted.length === 0) {
    tbody.innerHTML = '';
    if (tableWrap) tableWrap.hidden = true;
    emptyState.hidden = false;

    if (state.transactions.length === 0) {
      if (emptyTitle) emptyTitle.textContent = 'No transactions recorded yet';
      if (emptyDesc) emptyDesc.textContent = 'Add your first income or expense entry to start tracking.';
      if (emptyClearBtn) emptyClearBtn.hidden = true;
    } else {
      if (emptyTitle) emptyTitle.textContent = 'No matching transactions';
      if (emptyDesc) emptyDesc.textContent = 'Try adjusting your search query, month, or filters.';
      if (emptyClearBtn) emptyClearBtn.hidden = !hasActiveFilters;
    }
    return;
  }

  if (tableWrap) tableWrap.hidden = false;
  emptyState.hidden = true;

  tbody.innerHTML = sorted
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'tx-amount-income' : 'tx-amount-expense';
      const typeClass = isIncome ? 'tx-type-income' : 'tx-type-expense';
      const typeLabel = isIncome ? 'Income' : 'Expense';
      const safeTitle = escapeHtml(tx.title);
      const safeDesc = escapeHtml(tx.description);
      const safeCategory = escapeHtml(tx.category);
      const formattedDate = formatDisplayDate(tx.date);

      return `
        <tr data-tx-id="${escapeHtml(tx.id)}">
          <td>
            <div class="tx-primary">${safeTitle}</div>
            ${safeDesc ? `<div class="tx-desc" title="${safeDesc}">${safeDesc}</div>` : ''}
          </td>
          <td><span class="tx-meta-text">${safeCategory}</span></td>
          <td><span class="tx-type-label ${typeClass}">${typeLabel}</span></td>
          <td class="tx-date-cell tabular-nums">${escapeHtml(formattedDate)}</td>
          <td class="text-right tx-amount tabular-nums ${amountClass}">${sign}${formatCurrency(tx.amount)}</td>
          <td class="text-right">
            <div class="row-actions">
              <button
                type="button"
                class="icon-btn"
                data-action="edit"
                data-id="${escapeHtml(tx.id)}"
                aria-label="Edit ${safeTitle}"
                title="Edit transaction"
              >
                <i data-lucide="pencil" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                class="icon-btn icon-btn-danger"
                data-action="delete"
                data-id="${escapeHtml(tx.id)}"
                aria-label="Delete ${safeTitle}"
                title="Delete transaction"
              >
                <i data-lucide="trash-2" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tx = state.transactions.find((item) => item.id === btn.dataset.id);
      if (tx && handlers.onEdit) handlers.onEdit(tx);
    });
  });

  tbody.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tx = state.transactions.find((item) => item.id === btn.dataset.id);
      if (tx && handlers.onDelete) handlers.onDelete(tx);
    });
  });
}

export function populateCategorySelect(selectEl, type, selectedValue = '') {
  if (!selectEl) return;
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  selectEl.innerHTML = list
    .map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
    .join('');

  if (selectedValue && list.includes(selectedValue)) {
    selectEl.value = selectedValue;
  } else {
    selectEl.value = list[0];
  }
}

export function clearTransactionFormErrors() {
  const fields = ['title', 'amount', 'category', 'date', 'description'];
  fields.forEach((field) => {
    const input = document.getElementById(`tx-${field}-input`);
    const errorEl = document.getElementById(`tx-${field}-error`);
    if (input) input.classList.remove('input-error');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
  });
}

export function showTransactionFormErrors(errors) {
  clearTransactionFormErrors();
  Object.entries(errors).forEach(([field, message]) => {
    const input = document.getElementById(`tx-${field}-input`);
    const errorEl = document.getElementById(`tx-${field}-error`);
    if (input) input.classList.add('input-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
  });
}
