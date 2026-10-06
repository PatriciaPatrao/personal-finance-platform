# Architecture

This document describes the architecture that exists in this repository. The codebase is the source of truth.

The application is a household financial health product: it shows **current position**, explains **historical cash flow**, and **projects scheduled future cash flow**. It is a modular monolith, not a set of independently deployed services.

## 1. Architecture overview

```text
Angular
   ↓
FastAPI API
   ↓
Domain/application services
   ↓
Repositories / SQLAlchemy
   ↓
PostgreSQL
```

The Angular client is a standalone Angular 21 application. It talks to one FastAPI process over HTTP. The browser is configured for **GET** calls only (CORS on the API allows origin `http://localhost:4200` and method `GET`). Write endpoints exist on the API for accounts, transactions, scheduled income, and recurring expenses; the current UI does not call them.

FastAPI request handlers live under `backend/app/api/`. They construct a service for the current SQLAlchemy session, call application logic, and return Pydantic schemas. Services live under `backend/app/services/`. Repositories under `backend/app/repositories/` issue queries. Models under `backend/app/models/` map tables. PostgreSQL is reached through `DATABASE_URL` and the psycopg2 driver.

There is no authentication and no per-user tenancy. List and aggregate endpoints operate over the whole database.

## 2. Modular monolith rationale

The backend is one FastAPI application, one process, and one PostgreSQL database. Domain areas are **modules inside that process** (`accounts`, `transactions`, `incomes`, `recurring_expenses`, `analysis`, `forecast`), not separately deployed services.

That shape matches the current coupling:

- Accounts, transactions, incomes, and recurring expenses share foreign keys to `accounts`.
- Analysis and Forecast are read models over those tables, not separate stores.
- A request uses one database session (`get_db`).
- The product is still an MVP. Splitting the API into microservices would add network boundaries without a corresponding ownership split.

The modules already isolate **calculation**: Analysis does not call Forecast, and Forecast does not call Analysis. Persistence stays in one schema.

## 3. Frontend structure

The shell is `PersonalFinanceLayout` at `/personal_finance`. Navigation is Dashboard, Analysis, and Forecast. `/` redirects to `/personal_finance`.

| Route | Responsibility |
| --- | --- |
| `/personal_finance` | Dashboard: current position, signals, links |
| `/personal_finance/analysis` | Historical analysis of transactions |
| `/personal_finance/forecast` | Projection from balances and schedules |

Routes are lazy-loaded standalone components (`frontend/src/app/app.routes.ts`).

### Dashboard

Implemented by `PersonalFinance`. It loads:

- `GET /accounts` for stored balances
- `GET /analysis/summary` for the current calendar month through today
- `GET /forecast` grouped by month, from today through the last day of the calendar month two months ahead

It presents a combined current position when every account uses the same currency, a small set of text signals, and links into Analysis and Forecast. It is a presentation/orchestration surface (see [Dashboard responsibility](#6-dashboard-responsibility)).

### Analysis

Implemented by `Analysis`. It queries `/analysis/summary`, `/analysis/expenses`, and `/analysis/cash-flow` for an explicit date range (UI dates are DD-MM-YYYY). Default range is the current month through today.

### Forecast

Implemented by `Forecast`. It queries `GET /forecast` with `from`, `to`, and `group_by` (`day` or `month`). Default range starts today and ends on the last day of the month two months ahead.

### Future Transactions and Accounts screens

There is **no** Transactions route and **no** Accounts management route. `AccountService` only lists accounts for the Dashboard. Creating or editing accounts, transactions, salary, and recurring expenses is API-only today.

## 4. Backend domain boundaries

| Domain | Role | Persistence |
| --- | --- | --- |
| Accounts | Places money is held (bank, cash, credit card, investment). Own `current_balance` and currency (default EUR). | `accounts` |
| Transactions | Recorded income or expense events on an account. Source of historical analysis. | `transactions` |
| Income | Expected **salary** schedules (weekly / monthly / yearly), with next occurrence, optional end, active flag. | `incomes` |
| Recurring expenses | Expected future commitments with **one fixed amount**, optional category, same frequency shape as income. | `recurring_expenses` |
| Analysis | Read-only aggregates over transactions in a historical range. | None of its own |
| Forecast | Read-only projection from balances and active schedules. | None of its own |

Income and recurring-expense models document salary-only income and fixed recurring amounts as current limits.

`GET /financial-summary` is a separate route that returns the same transaction totals as analysis summary. Analysis summary reuses `FinancialSummaryService`. The Analysis page and Dashboard use `/analysis/summary`, not `/financial-summary`. `/financial-summary` does not reject a `to` date in the future (see [API design principles](#8-api-design-principles)).

Transaction writes validate that the account exists. They do **not** update `Account.current_balance`.

## 5. Analysis vs Forecast

**Analysis is historical and uses Transactions.**

It reads persisted `transactions` in `[from, to]`. It reports period income, expenses, net cash flow, expenses by category, and cash flow grouped by day or month. Scheduled income and recurring expenses are out of this path.

**Forecast is future-oriented and uses:**

- `Account.current_balance` (sum of every account)
- active scheduled Income
- active Recurring Expenses

Occurrences are generated in memory (`occurrence` helpers) when a forecast is requested. Forecast does not write transactions, balances, or period rows.

**Forecast must not depend on historical analysis logic.** Forecast services and repositories do not import Analysis. Analysis does not import Forecast. Similar period-label helpers exist in both services; they are duplicated, not shared as a financial calculation.

Forecast response currency is the string `EUR`. The service does not convert currencies or skip mixed-currency accounts.

## 6. Dashboard responsibility

Dashboard is an **orchestration and presentation layer**, not a financial domain.

It may consume existing data contracts (accounts, analysis summary, forecast) and display them. It should not become a second place where balances, cash-flow totals, or projections are defined.

Today it:

- sums `current_balance` in the client when currencies match, and withholds a combined figure when they differ
- derives explainable text signals in `frontend/src/app/personal-finance/financial-signals.ts` (this-month cash-flow sign from analysis summary; missing scheduled income and projected balance direction from forecast periods)

Those signal rules live in the dashboard feature, not in a backend domain service. They interpret API responses; they do not replace Analysis or Forecast.

## 7. Data ownership

| Fact | Source of truth |
| --- | --- |
| Actual current account balance | `Account.current_balance` (stored column). Not derived from transactions. |
| Historical financial events | `Transaction` rows (`occurred_on`, type, amount, optional category). |
| Scheduled future inflows | Active `Income` rows (salary). |
| Scheduled future outflows | Active `RecurringExpense` rows (fixed amount). |
| Calculated forecast periods | Not persisted. Produced on each `GET /forecast`. |
| Historical analysis totals | Not persisted. Produced on each `/analysis/*` request. |

Demo seed data sets `current_balance` independently of the seeded transaction totals. That matches this ownership split.

## 8. API design principles

Relevant decisions that the current API implements:

- **Read-only Analysis and Forecast.** `GET /analysis/summary`, `/analysis/expenses`, `/analysis/cash-flow`, and `GET /forecast` do not mutate data.
- **Explicit date ranges.** Query parameters are named `from` and `to`. `from` must be on or before `to`.
- **Historical Analysis cannot use a future end date.** Analysis query schemas reject `to` after today. `to` equal to today is allowed.
- **Forecast includes empty periods.** For `group_by=day` or `month`, the response includes every period in the range, with zeros when nothing is scheduled. Analysis cash-flow does the same for historical buckets.
- **No persistence for calculated Forecast data.** Periods, projected balances, and generated occurrence dates are response-only.
- **CORS GET from the Angular origin.** The running UI cannot call POST/PUT/DELETE even though those routes exist.

`GET /financial-summary` shares the transaction-total calculation with analysis summary but only validates `from <= to`. It does **not** apply the historical `to` constraint.

## 9. Testing approach

### Backend

pytest plus FastAPI `TestClient` (`httpx`). Tests use the same `DATABASE_URL` as the app, with connection `search_path` set to a PostgreSQL schema named `test` (`backend/tests/conftest.py`). That schema must already exist and contain migrated tables. The suite does not create the schema. Each test deletes rows in `accounts`, `transactions`, `recurring_expenses`, and `incomes`.

Coverage is HTTP-level and domain-level: health, accounts, transactions, account–transaction relationship, incomes, recurring expenses, financial summary, analysis, forecast, occurrence helpers, and database session wiring.

### Frontend

Angular CLI `ng test` runs Vitest. Specs cover routes, the dashboard component, financial signals, analysis component and service, date field, forecast component and service, and account service. Tests are unit/component tests with HTTP mocked where services call the API. There is no end-to-end browser suite in this repository.

## 10. Seed data

`backend/scripts/seed_demo_data.py` loads a **deterministic local dataset** so Dashboard, Analysis, and Forecast have something to show. It is optional and is safe to run more than once: existing historical transactions for the demo account are left in place; missing forecast seed rows are inserted without duplicates.

It creates or reuses one bank account named **Demo Main Account** (EUR). A new account, or an existing demo account with balance zero, is given `current_balance` 5000.00. Historical transactions cover 2026-01-01 through 2026-09-30. Forecast seed is one active monthly salary of 2000.00 and three active monthly expenses (Rent, Utilities, Household / Groceries).

**Seed data is not a migration.** Alembic revisions under `backend/alembic/versions/` change schema (tables, enums, columns such as `current_balance`). The seed script inserts application rows into an already-migrated database. Schema changes belong in Alembic; sample household data belongs in the seed script.

## 11. Infrastructure decisions

Infrastructure that exists:

- PostgreSQL, accessed with SQLAlchemy 2 and psycopg2
- Alembic (`backend/alembic`), with `ALEMBIC_SCHEMA` (default `public`) for the version table and `search_path`
- Pydantic settings: `DATABASE_URL` from `backend/.env`
- Uvicorn as the process that serves FastAPI
- CORS for `http://localhost:4200`, GET only
- Process liveness: `GET /` and `GET /health`
- Angular development API base `http://127.0.0.1:8000`; production environment file still holds a placeholder URL

The following are **not** implemented: Redis, message queues, background workers, Kubernetes (or other cluster orchestration), metrics/tracing platforms, and authentication infrastructure.

Occurrence dates for Forecast are computed on request. There is no job that materializes upcoming transactions.

## 12. Future evolution

These are **future considerations**. They are not current architecture.

- **Account selection.** Aggregates and forecasts currently include every account (or every active schedule). Filtering by account is not an API concern yet.
- **Multi-currency.** Accounts store a currency code. Dashboard withholds a combined balance when currencies differ. Forecast still sums balances and labels the result EUR. Full FX conversion is out of scope.
- **Background jobs.** Not present. Recurring occurrences are expanded when Forecast is requested.
- **Observability.** Health JSON only. No tracing, metrics, or log platform is wired in.
- **Richer financial insights.** Signals are a small, rule-based set on the Dashboard. Deeper resilience analysis is product direction, not an implemented module.
- **ML.** Not used. Predictive models are explicitly out of the current product.

Related product limits already noted in models: scheduled income is salary-only; recurring expenses use one fixed amount per schedule.
