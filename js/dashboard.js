import { formatCurrency, formatDisplayDate, sortTransactions } from './transactions.js';

export const CATEGORY_COLORS = [
  '#1d4ed8',
  '#0f766e',
  '#d97706',
  '#4f46e5',
  '#b91c1c',
  '#0369a1',
  '#475569',
  '#15803d',
  '#7c3aed',
];

let overviewChartInstance = null;
let categoryChartInstance = null;

export function calculateSummaryMetrics(transactions, targetMonth) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let monthlyIncome = 0;
  let monthlySpending = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    const isMonthMatch = !targetMonth || targetMonth === 'all' || (tx.date && tx.date.startsWith(targetMonth));

    if (tx.type === 'income') {
      totalIncome += amount;
      if (isMonthMatch) monthlyIncome += amount;
    } else if (tx.type === 'expense') {
      totalExpenses += amount;
      if (isMonthMatch) monthlySpending += amount;
    }
  }

  return {
    totalBalance: Math.round((totalIncome - totalExpenses) * 100) / 100,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    monthlyIncome: Math.round(monthlyIncome * 100) / 100,
    monthlySpending: Math.round(monthlySpending * 100) / 100,
    transactionCount: transactions.length,
  };
}

export function getRecentTransactions(transactions, limit = 6) {
  return sortTransactions(transactions, 'date-desc').slice(0, limit);
}

export function getRecentMonthKeys(referenceMonth, count = 6) {
  const base = /^\d{4}-\d{2}$/.test(referenceMonth || '')
    ? referenceMonth
    : new Date().toISOString().slice(0, 7);
  const [year, month] = base.split('-').map(Number);
  const keys = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    keys.push(`${y}-${m}`);
  }
  return keys;
}

export function formatMonthShort(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(monthKey || '')) return monthKey;
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

export function getMonthlyOverviewSeries(transactions, referenceMonth, count = 6) {
  const monthKeys = getRecentMonthKeys(referenceMonth, count);
  const incomeMap = Object.fromEntries(monthKeys.map((k) => [k, 0]));
  const expenseMap = Object.fromEntries(monthKeys.map((k) => [k, 0]));

  for (const tx of transactions) {
    const key = typeof tx.date === 'string' ? tx.date.slice(0, 7) : '';
    if (!Object.prototype.hasOwnProperty.call(incomeMap, key)) continue;
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      incomeMap[key] += amount;
    } else if (tx.type === 'expense') {
      expenseMap[key] += amount;
    }
  }

  return {
    monthKeys,
    labels: monthKeys.map(formatMonthShort),
    incomeSeries: monthKeys.map((k) => Math.round(incomeMap[k] * 100) / 100),
    expenseSeries: monthKeys.map((k) => Math.round(expenseMap[k] * 100) / 100),
  };
}

export function getExpenseCategoryBreakdown(transactions, targetMonth = 'all') {
  const totals = {};
  const counts = {};
  let grandTotal = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (targetMonth && targetMonth !== 'all' && (!tx.date || !tx.date.startsWith(targetMonth))) {
      continue;
    }
    const cat = tx.category || 'Other';
    const amount = Number(tx.amount) || 0;
    totals[cat] = (totals[cat] || 0) + amount;
    counts[cat] = (counts[cat] || 0) + 1;
    grandTotal += amount;
  }

  return Object.entries(totals)
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      count: counts[category] || 0,
      percentage: grandTotal > 0 ? Math.round((amount / grandTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderDashboardView(state, activeBudgetMonth) {
  const effectiveMonth = state.selectedMonth === 'all' ? activeBudgetMonth : state.selectedMonth;
  const metrics = calculateSummaryMetrics(state.transactions, effectiveMonth);

  const balanceEl = document.getElementById('kpi-balance');
  const incomeEl = document.getElementById('kpi-income');
  const expensesEl = document.getElementById('kpi-expenses');
  const monthlySpendingEl = document.getElementById('kpi-monthly-spending');
  const monthlySubEl = document.getElementById('kpi-monthly-sub');
  const categorySubEl = document.getElementById('dashboard-category-subtitle');

  if (balanceEl) {
    balanceEl.textContent = formatCurrency(metrics.totalBalance);
    balanceEl.classList.toggle('kpi-expense', metrics.totalBalance < 0);
  }
  if (incomeEl) incomeEl.textContent = formatCurrency(metrics.totalIncome);
  if (expensesEl) expensesEl.textContent = formatCurrency(metrics.totalExpenses);
  if (monthlySpendingEl) monthlySpendingEl.textContent = formatCurrency(metrics.monthlySpending);

  const monthLabel = state.selectedMonth === 'all' ? formatMonthShort(activeBudgetMonth) : formatMonthShort(state.selectedMonth);
  if (monthlySubEl) {
    monthlySubEl.textContent = `Outflows in ${monthLabel}`;
  }
  if (categorySubEl) {
    categorySubEl.textContent =
      state.selectedMonth === 'all'
        ? 'Distribution across all months'
        : `Distribution for ${monthLabel}`;
  }

  renderRecentTransactions(state.transactions);
  renderDashboardCharts(state.transactions, state.selectedMonth, activeBudgetMonth);
}

function renderRecentTransactions(transactions) {
  const tbody = document.getElementById('recent-transactions-tbody');
  const tableWrap = document.querySelector('#view-dashboard .table-wrap');
  const emptyState = document.getElementById('recent-transactions-empty');
  if (!tbody || !emptyState) return;

  const recent = getRecentTransactions(transactions, 6);
  if (recent.length === 0) {
    tbody.innerHTML = '';
    if (tableWrap) tableWrap.hidden = true;
    emptyState.hidden = false;
    return;
  }

  if (tableWrap) tableWrap.hidden = false;
  emptyState.hidden = true;

  tbody.innerHTML = recent
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'tx-amount-income' : 'tx-amount-expense';
      return `
        <tr>
          <td>
            <div class="tx-primary">${escapeHtml(tx.title)}</div>
            ${tx.description ? `<div class="tx-desc">${escapeHtml(tx.description)}</div>` : ''}
          </td>
          <td><span class="tx-meta-text">${escapeHtml(tx.category)}</span></td>
          <td class="tx-date-cell tabular-nums">${escapeHtml(formatDisplayDate(tx.date))}</td>
          <td class="text-right tx-amount tabular-nums ${amountClass}">${sign}${formatCurrency(tx.amount)}</td>
        </tr>
      `;
    })
    .join('');
}

function renderDashboardCharts(transactions, selectedMonth, activeBudgetMonth) {
  const overviewCanvas = document.getElementById('dashboard-overview-chart');
  const categoryCanvas = document.getElementById('dashboard-category-chart');
  const categoryEmpty = document.getElementById('dashboard-category-empty');
  const legendEl = document.getElementById('dashboard-category-legend');

  const referenceMonth = selectedMonth === 'all' ? activeBudgetMonth : selectedMonth;
  const series = getMonthlyOverviewSeries(transactions, referenceMonth, 6);
  const breakdown = getExpenseCategoryBreakdown(transactions, selectedMonth);

  if (typeof window !== 'undefined' && typeof window.Chart !== 'undefined') {
    if (overviewCanvas) {
      if (overviewChartInstance) {
        overviewChartInstance.destroy();
      }
      overviewChartInstance = new window.Chart(overviewCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: series.labels,
          datasets: [
            {
              label: 'Income',
              data: series.incomeSeries,
              backgroundColor: 'rgba(21, 128, 61, 0.85)',
              borderRadius: 4,
              barPercentage: 0.72,
              categoryPercentage: 0.68,
            },
            {
              label: 'Expenses',
              data: series.expenseSeries,
              backgroundColor: 'rgba(185, 28, 28, 0.82)',
              borderRadius: 4,
              barPercentage: 0.72,
              categoryPercentage: 0.68,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: {
                boxWidth: 10,
                boxHeight: 10,
                usePointStyle: true,
                pointStyle: 'rectRounded',
                font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
              },
            },
            tooltip: {
              callbacks: {
                label(ctx) {
                  return `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 11.5 }, color: '#64748b' },
            },
            y: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              ticks: {
                font: { family: "'JetBrains Mono', monospace", size: 11 },
                color: '#64748b',
                callback(value) {
                  return `$${Number(value).toLocaleString()}`;
                },
              },
            },
          },
        },
      });
    }

    if (categoryCanvas) {
      if (categoryChartInstance) {
        categoryChartInstance.destroy();
        categoryChartInstance = null;
      }

      if (breakdown.length === 0) {
        categoryCanvas.hidden = true;
        if (categoryEmpty) categoryEmpty.hidden = false;
      } else {
        categoryCanvas.hidden = false;
        if (categoryEmpty) categoryEmpty.hidden = true;

        categoryChartInstance = new window.Chart(categoryCanvas.getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: breakdown.map((item) => item.category),
            datasets: [
              {
                data: breakdown.map((item) => item.amount),
                backgroundColor: breakdown.map((_, idx) => CATEGORY_COLORS[idx % CATEGORY_COLORS.length]),
                borderWidth: 2,
                borderColor: '#ffffff',
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '66%',
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label(ctx) {
                    const row = breakdown[ctx.dataIndex];
                    return `${row.category}: ${formatCurrency(row.amount)} (${row.percentage}%)`;
                  },
                },
              },
            },
          },
        });
      }
    }
  }

  if (legendEl) {
    if (breakdown.length === 0) {
      legendEl.innerHTML = '';
      legendEl.hidden = true;
    } else {
      legendEl.hidden = false;
      legendEl.innerHTML = breakdown
        .slice(0, 6)
        .map((item, idx) => {
          const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
          return `
            <li class="legend-item">
              <span class="legend-name-wrap">
                <span class="legend-swatch" style="background-color: ${color}"></span>
                <span class="legend-name">${escapeHtml(item.category)} (${item.percentage}%)</span>
              </span>
              <span class="legend-amount tabular-nums">${formatCurrency(item.amount)}</span>
            </li>
          `;
        })
        .join('');
    }
  }
}
