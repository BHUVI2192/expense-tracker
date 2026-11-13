import {
  CATEGORY_COLORS,
  getExpenseCategoryBreakdown,
  getMonthlyOverviewSeries,
  formatMonthShort,
} from './dashboard.js';
import { formatCurrency } from './transactions.js';

let comparisonChartInstance = null;
let distributionChartInstance = null;

export function calculateAnalyticsMetrics(transactions, targetMonth = 'all') {
  let periodIncome = 0;
  let periodExpense = 0;
  let totalIncomeAllTime = 0;
  let totalExpenseAllTime = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    const isMatch = !targetMonth || targetMonth === 'all' || (tx.date && tx.date.startsWith(targetMonth));

    if (tx.type === 'income') {
      totalIncomeAllTime += amount;
      if (isMatch) periodIncome += amount;
    } else if (tx.type === 'expense') {
      totalExpenseAllTime += amount;
      if (isMatch) periodExpense += amount;
    }
  }

  const totalSavings = Math.round((totalIncomeAllTime - totalExpenseAllTime) * 100) / 100;
  const savingsRate =
    totalIncomeAllTime > 0
      ? Math.round(((totalIncomeAllTime - totalExpenseAllTime) / totalIncomeAllTime) * 1000) / 10
      : 0;

  const periodNetFlow = Math.round((periodIncome - periodExpense) * 100) / 100;
  const categoryBreakdown = getExpenseCategoryBreakdown(transactions, targetMonth);
  const highestCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;

  return {
    totalSavings,
    savingsRate,
    periodIncome: Math.round(periodIncome * 100) / 100,
    periodExpense: Math.round(periodExpense * 100) / 100,
    periodNetFlow,
    highestCategory,
    categoryBreakdown,
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

export function renderAnalyticsView(state, activeBudgetMonth) {
  const analytics = calculateAnalyticsMetrics(state.transactions, state.selectedMonth);
  const referenceMonth = state.selectedMonth === 'all' ? activeBudgetMonth : state.selectedMonth;
  const monthlySeries = getMonthlyOverviewSeries(state.transactions, referenceMonth, 6);

  const savingsEl = document.getElementById('analytics-savings');
  const savingsRateEl = document.getElementById('analytics-savings-rate');
  const topCatEl = document.getElementById('analytics-top-category');
  const topCatAmountEl = document.getElementById('analytics-top-category-amount');
  const netFlowEl = document.getElementById('analytics-net-flow');
  const netSubEl = document.getElementById('analytics-net-sub');
  const distSubEl = document.getElementById('analytics-dist-subtitle');

  if (savingsEl) {
    savingsEl.textContent = formatCurrency(analytics.totalSavings);
    savingsEl.classList.toggle('kpi-income', analytics.totalSavings > 0);
    savingsEl.classList.toggle('kpi-expense', analytics.totalSavings < 0);
  }
  if (savingsRateEl) {
    savingsRateEl.textContent = `${analytics.savingsRate}% cumulative savings rate`;
  }

  if (topCatEl) {
    topCatEl.textContent = analytics.highestCategory ? analytics.highestCategory.category : 'None';
  }
  if (topCatAmountEl) {
    const scopeLabel =
      state.selectedMonth === 'all' ? 'across all months' : `in ${formatMonthShort(state.selectedMonth)}`;
    topCatAmountEl.textContent = analytics.highestCategory
      ? `${formatCurrency(analytics.highestCategory.amount)} (${analytics.highestCategory.percentage}%) ${scopeLabel}`
      : `No expenses ${scopeLabel}`;
  }

  if (netFlowEl) {
    netFlowEl.textContent = formatCurrency(analytics.periodNetFlow);
    netFlowEl.classList.toggle('kpi-income', analytics.periodNetFlow > 0);
    netFlowEl.classList.toggle('kpi-expense', analytics.periodNetFlow < 0);
  }
  if (netSubEl) {
    netSubEl.textContent = `${formatCurrency(analytics.periodIncome)} in · ${formatCurrency(analytics.periodExpense)} out`;
  }
  if (distSubEl) {
    distSubEl.textContent =
      state.selectedMonth === 'all'
        ? 'Spending distribution across all months'
        : `Spending distribution for ${formatMonthShort(state.selectedMonth)}`;
  }

  renderAnalyticsCharts(monthlySeries, analytics.categoryBreakdown);
  renderAnalyticsCategoryTable(analytics.categoryBreakdown);
}

function renderAnalyticsCharts(monthlySeries, breakdown) {
  const comparisonCanvas = document.getElementById('analytics-comparison-chart');
  const distCanvas = document.getElementById('analytics-distribution-chart');
  const distEmpty = document.getElementById('analytics-dist-empty');

  if (typeof window === 'undefined' || typeof window.Chart === 'undefined') {
    return;
  }

  if (comparisonCanvas) {
    if (comparisonChartInstance) {
      comparisonChartInstance.destroy();
    }
    comparisonChartInstance = new window.Chart(comparisonCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: monthlySeries.labels,
        datasets: [
          {
            label: 'Income',
            data: monthlySeries.incomeSeries,
            backgroundColor: 'rgba(21, 128, 61, 0.85)',
            borderRadius: 4,
          },
          {
            label: 'Expenses',
            data: monthlySeries.expenseSeries,
            backgroundColor: 'rgba(185, 28, 28, 0.82)',
            borderRadius: 4,
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

  if (distCanvas) {
    if (distributionChartInstance) {
      distributionChartInstance.destroy();
      distributionChartInstance = null;
    }

    if (breakdown.length === 0) {
      distCanvas.hidden = true;
      if (distEmpty) distEmpty.hidden = false;
    } else {
      distCanvas.hidden = false;
      if (distEmpty) distEmpty.hidden = true;

      distributionChartInstance = new window.Chart(distCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: breakdown.map((item) => item.category),
          datasets: [
            {
              label: 'Spent',
              data: breakdown.map((item) => item.amount),
              backgroundColor: breakdown.map(
                (_, idx) => CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
              ),
              borderRadius: 4,
              barThickness: 18,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(ctx) {
                  const row = breakdown[ctx.dataIndex];
                  return `${formatCurrency(row.amount)} (${row.percentage}%)`;
                },
              },
            },
          },
          scales: {
            x: {
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
            y: {
              grid: { display: false },
              ticks: {
                font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
                color: '#0f172a',
              },
            },
          },
        },
      });
    }
  }
}

function renderAnalyticsCategoryTable(breakdown) {
  const tbody = document.getElementById('analytics-category-tbody');
  const tableWrap = document.querySelector('#view-analytics .table-wrap');
  const emptyState = document.getElementById('analytics-table-empty');
  if (!tbody || !emptyState) return;

  if (breakdown.length === 0) {
    tbody.innerHTML = '';
    if (tableWrap) tableWrap.hidden = true;
    emptyState.hidden = false;
    return;
  }

  if (tableWrap) tableWrap.hidden = false;
  emptyState.hidden = true;

  tbody.innerHTML = breakdown
    .map((row, idx) => {
      const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
      const txWord = row.count === 1 ? 'entry' : 'entries';
      return `
        <tr>
          <td>
            <div class="legend-name-wrap">
              <span class="legend-swatch" style="background-color: ${color}"></span>
              <span class="tx-primary">${escapeHtml(row.category)}</span>
            </div>
          </td>
          <td class="tx-meta-text tabular-nums">${row.count} ${txWord}</td>
          <td>
            <div class="share-bar-cell">
              <div class="share-track" aria-hidden="true">
                <div class="share-fill" style="width: ${Math.min(row.percentage, 100)}%; background-color: ${color}"></div>
              </div>
              <span class="share-pct tabular-nums">${row.percentage}%</span>
            </div>
          </td>
          <td class="text-right tx-amount tabular-nums">${formatCurrency(row.amount)}</td>
        </tr>
      `;
    })
    .join('');
}
