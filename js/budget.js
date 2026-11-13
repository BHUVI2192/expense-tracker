import { getExpenseCategoryBreakdown, formatMonthShort } from './dashboard.js';
import { formatCurrency } from './transactions.js';

export function validateBudgetAmount(rawValue) {
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return {
      valid: false,
      error: 'Enter a monthly budget limit greater than $0.',
      value: 0,
    };
  }
  return {
    valid: true,
    error: '',
    value: Math.round(numeric * 100) / 100,
  };
}

export function calculateBudgetStatus(transactions, month, budgetLimit) {
  const limit = Number(budgetLimit) || 0;
  let spent = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (month && tx.date && tx.date.startsWith(month)) {
      spent += Number(tx.amount) || 0;
    }
  }

  spent = Math.round(spent * 100) / 100;
  const remaining = Math.round((limit - spent) * 100) / 100;
  const utilizationPercent = limit > 0 ? Math.round((spent / limit) * 1000) / 10 : 0;

  let status = 'healthy';
  if (limit <= 0) {
    status = 'unset';
  } else if (utilizationPercent > 100) {
    status = 'exceeded';
  } else if (utilizationPercent >= 80) {
    status = 'warning';
  }

  return {
    month,
    limit,
    spent,
    remaining,
    utilizationPercent,
    status,
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderBudgetSummaryWidgets(budgetStatus, hideGlobalAlert = false) {
  // Sidebar budget glance
  const sidebarPct = document.getElementById('sidebar-budget-pct');
  const sidebarBar = document.getElementById('sidebar-budget-bar');
  const sidebarMeta = document.getElementById('sidebar-budget-meta');

  if (sidebarPct) sidebarPct.textContent = `${budgetStatus.utilizationPercent}%`;
  if (sidebarBar) {
    sidebarBar.style.width = `${Math.min(budgetStatus.utilizationPercent, 100)}%`;
    sidebarBar.className = `progress-fill is-${budgetStatus.status}`;
  }
  if (sidebarMeta) {
    sidebarMeta.textContent = `${formatCurrency(budgetStatus.spent)} of ${formatCurrency(budgetStatus.limit)}`;
  }

  // Global alert banner (shown at >= 80% warning or > 100% exceeded on non-budget views)
  const globalAlert = document.getElementById('global-budget-alert');
  if (globalAlert) {
    if (hideGlobalAlert) {
      globalAlert.hidden = true;
      globalAlert.innerHTML = '';
      return;
    }
    if (budgetStatus.status === 'exceeded') {
      const overAmount = Math.abs(budgetStatus.remaining);
      globalAlert.hidden = false;
      globalAlert.className = 'alert-banner alert-danger';
      globalAlert.innerHTML = `
        <div class="alert-banner-content">
          <i data-lucide="alert-octagon" aria-hidden="true"></i>
          <span>
            <strong>Budget Exceeded (${budgetStatus.utilizationPercent}%):</strong>
            You have exceeded your ${escapeHtml(formatMonthShort(budgetStatus.month))} budget of
            ${formatCurrency(budgetStatus.limit)} by ${formatCurrency(overAmount)}.
          </span>
        </div>
      `;
    } else if (budgetStatus.status === 'warning') {
      globalAlert.hidden = false;
      globalAlert.className = 'alert-banner alert-warning';
      globalAlert.innerHTML = `
        <div class="alert-banner-content">
          <i data-lucide="alert-triangle" aria-hidden="true"></i>
          <span>
            <strong>Budget Warning (${budgetStatus.utilizationPercent}%):</strong>
            You have used over 80% of your ${escapeHtml(formatMonthShort(budgetStatus.month))} budget.
            ${formatCurrency(budgetStatus.remaining)} remaining.
          </span>
        </div>
      `;
    } else {
      globalAlert.hidden = true;
      globalAlert.innerHTML = '';
    }
  }
}

export function renderBudgetView(state, activeBudgetMonth, budgetLimit) {
  const budgetStatus = calculateBudgetStatus(state.transactions, activeBudgetMonth, budgetLimit);
  const monthText = formatMonthShort(activeBudgetMonth);

  const monthLabelEl = document.getElementById('budget-month-label');
  const limitInput = document.getElementById('budget-limit-input');
  const limitDisplay = document.getElementById('budget-limit-display');
  const spentDisplay = document.getElementById('budget-spent-display');
  const remainingDisplay = document.getElementById('budget-remaining-display');
  const utilDisplay = document.getElementById('budget-utilization-display');
  const statusLabel = document.getElementById('budget-status-label');
  const statusSub = document.getElementById('budget-status-subtitle');
  const panelAlert = document.getElementById('budget-panel-alert');
  const progressBar = document.getElementById('budget-progressbar');
  const progressFill = document.getElementById('budget-progress-fill');

  if (monthLabelEl) {
    monthLabelEl.textContent = `Configure spending limit for ${monthText}`;
  }
  if (limitInput && document.activeElement !== limitInput) {
    limitInput.value = budgetStatus.limit > 0 ? String(budgetStatus.limit) : '';
  }

  if (limitDisplay) limitDisplay.textContent = formatCurrency(budgetStatus.limit);
  if (spentDisplay) spentDisplay.textContent = formatCurrency(budgetStatus.spent);

  if (remainingDisplay) {
    remainingDisplay.textContent =
      budgetStatus.remaining < 0
        ? `-${formatCurrency(Math.abs(budgetStatus.remaining))}`
        : formatCurrency(budgetStatus.remaining);
    remainingDisplay.classList.toggle('kpi-expense', budgetStatus.remaining < 0);
    remainingDisplay.classList.toggle('kpi-income', budgetStatus.remaining >= 0);
  }

  if (utilDisplay) {
    utilDisplay.textContent = `${budgetStatus.utilizationPercent}%`;
  }

  if (statusSub) {
    statusSub.textContent = `Tracking ${monthText} expenses against monthly limit`;
  }

  if (statusLabel) {
    if (budgetStatus.status === 'exceeded') {
      statusLabel.textContent = 'Budget Exceeded';
      statusLabel.className = 'status-text status-exceeded';
    } else if (budgetStatus.status === 'warning') {
      statusLabel.textContent = 'Approaching Limit (80%+)';
      statusLabel.className = 'status-text status-warning';
    } else if (budgetStatus.status === 'unset') {
      statusLabel.textContent = 'No Limit Set';
      statusLabel.className = 'status-text';
    } else {
      statusLabel.textContent = 'Within Budget';
      statusLabel.className = 'status-text status-healthy';
    }
  }

  if (panelAlert) {
    if (budgetStatus.status === 'exceeded') {
      panelAlert.hidden = false;
      panelAlert.className = 'alert-banner alert-danger alert-inline';
      panelAlert.innerHTML = `
        <div class="alert-banner-content">
          <i data-lucide="alert-octagon" aria-hidden="true"></i>
          <span>Monthly budget exceeded by ${formatCurrency(Math.abs(budgetStatus.remaining))}. Review discretionary expenses.</span>
        </div>
      `;
    } else if (budgetStatus.status === 'warning') {
      panelAlert.hidden = false;
      panelAlert.className = 'alert-banner alert-warning alert-inline';
      panelAlert.innerHTML = `
        <div class="alert-banner-content">
          <i data-lucide="alert-triangle" aria-hidden="true"></i>
          <span>80% budget threshold reached. Only ${formatCurrency(budgetStatus.remaining)} left for ${escapeHtml(monthText)}.</span>
        </div>
      `;
    } else if (budgetStatus.status === 'healthy') {
      panelAlert.hidden = false;
      panelAlert.className = 'alert-banner alert-healthy alert-inline';
      panelAlert.innerHTML = `
        <div class="alert-banner-content">
          <i data-lucide="check-circle-2" aria-hidden="true"></i>
          <span>Spending is on track at ${budgetStatus.utilizationPercent}% of your ${escapeHtml(monthText)} budget.</span>
        </div>
      `;
    } else {
      panelAlert.hidden = true;
    }
  }

  if (progressBar) {
    progressBar.setAttribute('aria-valuenow', String(Math.min(Math.round(budgetStatus.utilizationPercent), 100)));
  }
  if (progressFill) {
    progressFill.style.width = `${Math.min(budgetStatus.utilizationPercent, 100)}%`;
    progressFill.className = `progress-fill is-${budgetStatus.status}`;
  }

  renderBudgetCategoryTable(state.transactions, activeBudgetMonth, budgetStatus.limit);
}

function renderBudgetCategoryTable(transactions, month, limit) {
  const tbody = document.getElementById('budget-category-tbody');
  const tableWrap = document.querySelector('#view-budget .table-wrap');
  const emptyState = document.getElementById('budget-table-empty');
  if (!tbody || !emptyState) return;

  const breakdown = getExpenseCategoryBreakdown(transactions, month);
  if (breakdown.length === 0) {
    tbody.innerHTML = '';
    if (tableWrap) tableWrap.hidden = true;
    emptyState.hidden = false;
    return;
  }

  if (tableWrap) tableWrap.hidden = false;
  emptyState.hidden = true;

  tbody.innerHTML = breakdown
    .map((row) => {
      const budgetShare = limit > 0 ? Math.round((row.amount / limit) * 1000) / 10 : 0;
      const barColor = budgetShare >= 50 ? '#b91c1c' : budgetShare >= 25 ? '#d97706' : '#1d4ed8';
      return `
        <tr>
          <td class="tx-primary">${escapeHtml(row.category)}</td>
          <td>
            <div class="share-bar-cell">
              <div class="share-track" aria-hidden="true">
                <div class="share-fill" style="width: ${Math.min(budgetShare, 100)}%; background-color: ${barColor}"></div>
              </div>
              <span class="share-pct tabular-nums">${budgetShare}%</span>
            </div>
          </td>
          <td class="text-right tx-amount tabular-nums">${formatCurrency(row.amount)}</td>
        </tr>
      `;
    })
    .join('');
}
