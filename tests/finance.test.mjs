import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTransactionInput,
  filterTransactions,
  sortTransactions,
} from '../js/transactions.js';
import {
  calculateSummaryMetrics,
  getRecentTransactions,
  getMonthlyOverviewSeries,
  getExpenseCategoryBreakdown,
} from '../js/dashboard.js';
import { calculateAnalyticsMetrics } from '../js/analytics.js';
import { validateBudgetAmount, calculateBudgetStatus } from '../js/budget.js';

const SAMPLE_TRANSACTIONS = [
  {
    id: 't1',
    title: 'Salary',
    amount: 5000,
    category: 'Salary',
    type: 'income',
    date: '2026-11-01',
    description: 'Monthly salary',
  },
  {
    id: 't2',
    title: 'Rent',
    amount: 1500,
    category: 'Housing',
    type: 'expense',
    date: '2026-11-02',
    description: 'Apartment',
  },
  {
    id: 't3',
    title: 'Groceries',
    amount: 300,
    category: 'Food',
    type: 'expense',
    date: '2026-11-10',
    description: 'Supermarket',
  },
  {
    id: 't4',
    title: 'October Salary',
    amount: 4800,
    category: 'Salary',
    type: 'income',
    date: '2026-10-01',
    description: 'Oct pay',
  },
  {
    id: 't5',
    title: 'Flight Ticket',
    amount: 600,
    category: 'Transport',
    type: 'expense',
    date: '2026-10-15',
    description: 'Conference travel',
  },
];

test('validateTransactionInput rejects invalid inputs and accepts valid transaction', () => {
  const invalid = validateTransactionInput({
    type: 'expense',
    title: 'A',
    amount: -10,
    category: 'NonExistent',
    date: 'invalid',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.title);
  assert.ok(invalid.errors.amount);
  assert.ok(invalid.errors.category);
  assert.ok(invalid.errors.date);

  const valid = validateTransactionInput({
    type: 'expense',
    title: '  Grocery Shopping  ',
    amount: '125.456',
    category: 'Food',
    date: '2026-11-13',
    description: '  Weekly groceries  ',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.sanitized.title, 'Grocery Shopping');
  assert.equal(valid.sanitized.amount, 125.46);
  assert.equal(valid.sanitized.description, 'Weekly groceries');
});

test('filterTransactions and sortTransactions handle search, category, type, month, and sorting', () => {
  const novExpenses = filterTransactions(SAMPLE_TRANSACTIONS, {
    month: '2026-11',
    type: 'expense',
  });
  assert.equal(novExpenses.length, 2);

  const searchFood = filterTransactions(SAMPLE_TRANSACTIONS, {
    search: 'supermarket',
    month: 'all',
  });
  assert.equal(searchFood.length, 1);
  assert.equal(searchFood[0].id, 't3');

  const sortedByAmountDesc = sortTransactions(SAMPLE_TRANSACTIONS, 'amount-desc');
  assert.equal(sortedByAmountDesc[0].id, 't1');
  assert.equal(sortedByAmountDesc[sortedByAmountDesc.length - 1].id, 't3');

  const sortedByDateAsc = sortTransactions(SAMPLE_TRANSACTIONS, 'date-asc');
  assert.equal(sortedByDateAsc[0].id, 't4');

  const sameDateList = [
    { id: 'new_entry', title: 'New', amount: 10, category: 'Food', type: 'expense', date: '2026-11-13' },
    { id: 'old_entry', title: 'Old', amount: 20, category: 'Food', type: 'expense', date: '2026-11-13' },
  ];
  const sortedSameDate = sortTransactions(sameDateList, 'date-desc');
  assert.equal(sortedSameDate[0].id, 'new_entry');
});

test('calculateSummaryMetrics dynamically computes Total Balance = Total Income - Total Expenses', () => {
  const metrics = calculateSummaryMetrics(SAMPLE_TRANSACTIONS, '2026-11');
  assert.equal(metrics.totalIncome, 9800);
  assert.equal(metrics.totalExpenses, 2400);
  assert.equal(metrics.totalBalance, 7400);
  assert.equal(metrics.monthlyIncome, 5000);
  assert.equal(metrics.monthlySpending, 1800);
});

test('getRecentTransactions, getMonthlyOverviewSeries, and getExpenseCategoryBreakdown return accurate series', () => {
  const recent = getRecentTransactions(SAMPLE_TRANSACTIONS, 2);
  assert.equal(recent.length, 2);
  assert.equal(recent[0].id, 't3');

  const series = getMonthlyOverviewSeries(SAMPLE_TRANSACTIONS, '2026-11', 3);
  assert.deepEqual(series.monthKeys, ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(series.incomeSeries, [0, 4800, 5000]);
  assert.deepEqual(series.expenseSeries, [0, 600, 1800]);

  const breakdown = getExpenseCategoryBreakdown(SAMPLE_TRANSACTIONS, '2026-11');
  assert.equal(breakdown.length, 2);
  assert.equal(breakdown[0].category, 'Housing');
  assert.equal(breakdown[0].amount, 1500);
});

test('calculateAnalyticsMetrics calculates total savings, savings rate, and highest spending category', () => {
  const analytics = calculateAnalyticsMetrics(SAMPLE_TRANSACTIONS, '2026-11');
  assert.equal(analytics.totalSavings, 7400);
  assert.equal(analytics.highestCategory.category, 'Housing');
  assert.equal(analytics.periodNetFlow, 3200);
});

test('budget validation and threshold status (healthy < 80%, warning >= 80%, exceeded > 100%)', () => {
  assert.equal(validateBudgetAmount('0').valid, false);
  assert.equal(validateBudgetAmount('2500').valid, true);

  const healthy = calculateBudgetStatus(SAMPLE_TRANSACTIONS, '2026-11', 3000);
  assert.equal(healthy.spent, 1800);
  assert.equal(healthy.remaining, 1200);
  assert.equal(healthy.utilizationPercent, 60);
  assert.equal(healthy.status, 'healthy');

  const warning = calculateBudgetStatus(SAMPLE_TRANSACTIONS, '2026-11', 2000);
  assert.equal(warning.utilizationPercent, 90);
  assert.equal(warning.status, 'warning');

  const exceeded = calculateBudgetStatus(SAMPLE_TRANSACTIONS, '2026-11', 1500);
  assert.equal(exceeded.remaining, -300);
  assert.equal(exceeded.utilizationPercent, 120);
  assert.equal(exceeded.status, 'exceeded');
});
