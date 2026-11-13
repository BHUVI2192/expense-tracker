# ClearLedger — Expense Tracker

A minimalist personal finance and expense tracking web application built strictly with **HTML5**, **CSS3**, and **Vanilla JavaScript** (with Chart.js and Lucide Icons via CDN), using `localStorage` for client-side persistence.

## Folder Structure

```text
expense-tracker/
├── index.html          # Semantic HTML5 shell, views, and accessible dialogs
├── css/
│   └── style.css       # Minimalist CSS3 design system and responsive layout
├── js/
│   ├── app.js          # Application state, routing, and event coordination
│   ├── storage.js      # Centralized LocalStorage repository (REST API ready)
│   ├── transactions.js # Validation, filtering, sorting, and history table
│   ├── dashboard.js    # Dynamic KPI calculations and overview charts
│   ├── analytics.js    # Savings, top category, and comparative charts
│   └── budget.js       # Monthly budget tracking, 80% warning, and >100% alert
├── assets/
│   └── logo.svg        # Geometric brand mark
└── tests/
    └── finance.test.mjs # Unit tests for pure calculation and validation logic
```

## Running Locally

Because the application uses native ES Modules (`<script type="module">`), serve the directory over a local HTTP server (rather than opening `index.html` via `file://`):

```bash
# Using Python 3
python3 -m http.server 3000

# Or using Node
npx serve -l 3000
```

Then open `http://localhost:3000` in your browser.

## Module Overview

- **`js/storage.js`**: Centralizes all `localStorage` read/write operations (`getTransactions`, `addTransaction`, `updateTransaction`, `deleteTransaction`, `getMonthlyBudget`, `saveBudget`) and seeds initial demo entries on first launch. To migrate to a Node.js + Express + SQL backend later, only this module needs to be updated to call `fetch('/api/...')`.
- **`js/transactions.js`**: Handles transaction form validation (`validateTransactionInput`), multi-criteria search/filter (`filterTransactions`), sorting (`sortTransactions`), and rendering the Transaction History table.
- **`js/dashboard.js`**: Computes dynamic totals (`Total Balance = Total Income - Total Expenses`), recent activity, monthly cash flow series, and category breakdown Chart.js visualizations.
- **`js/analytics.js`**: Computes cumulative savings, savings rate, highest spending category, monthly income vs. expenses comparison, and spending distribution.
- **`js/budget.js`**: Validates monthly budget targets and tracks spending utilization with automatic 80% warning and >100% exceeded alerts across both the Budget view and global banner.
- **`js/app.js`**: Coordinates view navigation, active month selection, modal dialogs, toast feedback, and cross-module re-rendering.
