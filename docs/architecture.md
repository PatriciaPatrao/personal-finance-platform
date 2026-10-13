# Architecture

This document describes the architecture that exists in this repository. The codebase is the source of truth.

The application is a household financial health product: it shows **current position**, explains **historical cash flow**, **projects scheduled future cash flow**, and records **financial objectives** (Goals) separately from money held in Accounts. It is a modular monolith, not a set of independently deployed services.

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

The Angular client is a standalone Angular 21 application. It talks to one FastAPI process over HTTP. CORS on the API allows origin `http://localhost:4200` and methods `GET`, `POST`, `PUT`, `DELETE`, and `OPTIONS`.

FastAPI request handlers live under `backend/app/api/`. They construct a service for the current SQLAlchemy session, call application logic, and return Pydantic schemas. Services live under `backend/app/services/`. Repositories under `backend/app/repositories/` issue queries. Models under `backend/app/models/` map tables. PostgreSQL is reached through `DATABASE_URL` and the psycopg2 driver.

There is no authentication and no per-user tenancy. List and aggregate endpoints operate over the whole database.

## 2. Modular monolith rationale

The backend is one FastAPI application, one process, and one PostgreSQL database. Domain areas are **modules inside that process** (`accounts`, `transactions`, `incomes`, `recurring_expenses`, `financial_goals`, `analysis`, `forecast`), not separately deployed services.

That shape matches the current coupling:

- Accounts, transactions, incomes, recurring expenses, and financial goals share foreign keys to `accounts` where an association exists.
- Analysis and Forecast are read models over those tables, not separate stores.
- Financial Goals are a separate objective domain. They designate existing Account money through GoalAllocation and never write `Account.current_balance`.
- A request uses one database session (`get_db`).
- The product is still an MVP. Splitting the API into microservices would add network boundaries without a corresponding ownership split.

The modules already isolate **calculation**: Analysis does not call Forecast, and Forecast does not call Analysis. Goals do not feed Analysis or Forecast. Persistence stays in one schema.

## 3. Frontend structure

The shell is `PersonalFinanceLayout` at `/personal_finance`. Navigation is Dashboard, Accounts, Schedules, Goals, Analysis, Forecast, and Transactions. `/` redirects to `/personal_finance`.

| Route | Responsibility |
| --- | --- |
| `/personal_finance` | Dashboard: position by currency, signals, goals, links |
| `/personal_finance/accounts` | Stored accounts list and create form |
| `/personal_finance/accounts/:id` | Read-only stored account detail |
| `/personal_finance/schedules` | Salary and fixed recurring expenses: list, create, edit, deactivate, activate |
| `/personal_finance/goals` | Financial objectives: list, create, and edit |
| `/personal_finance/analysis` | Historical analysis of transactions |
| `/personal_finance/forecast` | Projection from balances and schedules |
| `/personal_finance/transactions` | Recorded income and expense events |

Routes are lazy-loaded standalone components (`frontend/src/app/app.routes.ts`).

### Dashboard

Implemented by `PersonalFinance`. It loads:

- `GET /accounts` for stored balances
- `GET /analysis/summary` for the current calendar month through today
- `GET /forecast` grouped by month, from today through the last day of the calendar month two months ahead
- `GET /financial-goals` for derived goal progress

It presents one stored total per currency. A household with one currency still sees a single total. It shows text signals only when every loaded account uses that same currency. Mixed currencies suppress Analysis and Forecast signals, because those APIs are not currency-safe. Goals show each objective’s target and funded amount in that goal’s currency. Null progress stays unavailable. It links to Accounts, Schedules, Transactions, Goals, Analysis, and Forecast. It does not write financial data. It is a presentation/orchestration surface (see [Dashboard responsibility](#6-dashboard-responsibility)).

### Analysis

Implemented by `Analysis`. It queries `/analysis/summary`, `/analysis/expenses`, and `/analysis/cash-flow` for an explicit date range (UI dates are DD-MM-YYYY). Default range is the current month through today.

### Forecast

Implemented by `Forecast`. It queries `GET /forecast` with `from`, `to`, optional `account_id`, and `group_by` (`day` or `month`). Default range starts today and ends on the last day of the month two months ahead. The UI offers “All accounts” (household) or a single account.

### Accounts

Implemented by `Accounts` and `AccountDetail`. The list page loads `GET /accounts` through `AccountService.listAccounts()`, lists every stored account in API order, and shows each account’s name, type, currency, and stored `current_balance`. It creates accounts through `AccountService.createAccount()` with name, type, currency, and optional opening balance. The create form offers EUR, USD, and GBP. That list is a UI constraint, not a domain rule: the API accepts any 3-character currency code and does not convert between them. The detail page at `/personal_finance/accounts/:id` loads one account through `AccountService.getAccount(id)` and shows the stored fields read-only, each balance in that account’s own currency. The Accounts screens do not sum balances across accounts and do not derive them from transactions. There is no update or delete path. `AccountService` is also used by the Dashboard, by the Transactions account picker, by the Goals account picker, and by the Schedules account picker.

`current_balance` is a stored signed amount maintained **by the system** (ADR [005](decisions/005-schedule-execution.md)). Negative values are allowed for every account type. Every effective transaction create, update, and delete must apply the corresponding balance delta in the **same database transaction** as the `transactions` row. Account create may set an initial balance without a transaction. Schedule CRUD and Goal allocations do not modify it. **Today’s code** does not yet update balance on manual transaction CRUD; implementation must align with ADR 005 before or with schedule execution. Type-specific meaning is future product work. Forecast starts from stored balances per currency.

### Schedules

Implemented by `Schedules` at `/personal_finance/schedules`. It loads `GET /incomes`, `GET /recurring-expenses`, and `GET /accounts`, lists salary and fixed recurring-expense records (including inactive ones), and creates and updates them through `POST` and `PUT`. There is no DELETE; deactivation and activation set `active` on a full PUT body that always includes every required field, including `end_date`. One-click Deactivate and Activate buttons call those updates without opening the edit form. Separate sections cover salary and recurring expenses, each with an Active / Inactive / All filter. Dates are entered as DD-MM-YYYY and sent as ISO `YYYY-MM-DD`. Amount validation requires a positive value with at most two decimal places. The page explains that schedules inform Forecast, are not recorded transactions, do not change `Account.current_balance`, and do not imply a separate projected balance per account. It does not call Transactions, Analysis, or Forecast. See [milestone-recurring-schedules.md](milestone-recurring-schedules.md) for validation and manual test checklists.

### Goals

Implemented by `Goals` at `/personal_finance/goals`. It loads `GET /financial-goals` and `GET /accounts`, lists objectives, and creates and updates them through `POST` and `PUT`. There is no Goal delete. Inline edit covers name, target, currency, and target date (DD-MM-YYYY). The create form offers EUR, USD, and GBP. Allocations are managed on the Goal card: add, reduce, or remove designations of existing Account money. Compatible Accounts show balance, already allocated, and available capacity. The screen displays backend `current_amount` under the label Funded, `progress` (capped at 100%), `completed`, and allocation rows. Each row shows the designated amount and, when that amount is not fully funded, the funded amount. A Goal with no allocations shows that progress is unavailable. The page does not recompute those values, does not write `Account.current_balance`, and does not call Analysis, Forecast, or Transactions.

### Transactions

Implemented by `Transactions`. It loads `GET /transactions` and `GET /accounts`, lists historical income and expense events, and creates, updates, and deletes them through the write routes. Execution-linked rows will reject PUT/DELETE (ADR 005). Filters run in the client. Per ADR 005, each write must update `current_balance` atomically (not yet implemented in the backend). Schedule execution is initiated from Schedules (planned). The page does not call Analysis or Forecast and does not paginate.

## 4. Backend domain boundaries

| Domain | Role | Persistence |
| --- | --- | --- |
| Accounts | Places money is held (bank, cash, credit card, investment). Own `current_balance` and currency (default EUR). | `accounts` |
| Transactions | Recorded income or expense events on an account. Source of historical analysis. | `transactions` |
| Income | Expected **salary** schedules on an account (weekly / monthly / yearly), with start date, next occurrence, optional end, and active flag. | `incomes` |
| Recurring expenses | Expected future commitments on an account with **one fixed amount**, optional category, and the same date and frequency shape as income. | `recurring_expenses` |
| Financial Goals | Future financial objectives with a target amount and optional target date. Funding is GoalAllocation. Do not store money. | `financial_goals`, `goal_allocations` |
| Analysis | Read-only aggregates over transactions in a historical range. | None of its own |
| Forecast | Read-only projection from balances and active schedules. | None of its own |

Income and recurring-expense models document salary-only income and fixed recurring amounts as current limits.

### Financial Goals

Financial Goals answer “what financial objective am I saving for or trying to achieve?” Domain rules are recorded in [004-financial-goals.md](decisions/004-financial-goals.md).

Persisted Goal fields: `name`, `target_amount` (must be greater than zero), `currency` (default EUR), optional `target_date`, and `created_at`. The Goal model does **not** persist `current_amount`, `progress`, `completed`, `active`, or `account_id`.

`GoalAllocation` designates an amount of existing Account money toward a Goal: `goal_id`, `account_id`, positive `amount`, `created_at`, unique `(goal_id, account_id)`.

When a Goal has allocations:

- `current_amount` is the sum of **funded** allocation amounts (Account capacity walked by `created_at`, then `id`, up to `max(0, current_balance)`)
- `progress = max(0, min(1, current_amount / target_amount))`
- `completed` is `current_amount >= target_amount`
- each Account’s currency must equal `Goal.currency`
- designated amounts on an Account must not exceed available capacity on create/increase
- those capacity checks lock the Account row (`SELECT … FOR UPDATE`) until the allocation transaction commits
- Goal and allocation writes never modify `Account.current_balance`

When a Goal has no allocations, `current_amount`, `progress`, and `completed` are null. Unavailable progress is not represented as 0%.

**Cardinality:** `Account → 0..N Goals` and `Goal → 0..N Accounts` through GoalAllocation. Forecast-based projected Goal completion is not implemented.

API: `POST /financial-goals`, `GET /financial-goals`, `GET /financial-goals/{goal_id}`, `PUT /financial-goals/{goal_id}`, plus `POST/PUT/DELETE` allocation routes under `/financial-goals/{goal_id}/allocations`. There is no Goal DELETE. List order is newest first (`created_at` desc, `id` desc), matching Accounts.

`GET /financial-summary` is a separate route that returns the same transaction totals as analysis summary. Analysis summary reuses `FinancialSummaryService`. The Analysis page and Dashboard use `/analysis/summary`, not `/financial-summary`. `/financial-summary` does not reject a `to` date in the future (see [API design principles](#8-api-design-principles)).

Transaction writes validate that the account exists. ADR [005](decisions/005-schedule-execution.md) requires that **all** effective transaction creates, updates, and deletes update `Account.current_balance` in the same database transaction. **Schedule occurrence execution** additionally creates a `schedule_executions` row, reuses the shared transaction+balance path, and allows execution only when `occurrence_date` equals the current domain date (same notion as Forecast `as_of`).

## 5. Analysis vs Forecast

**Analysis is historical and uses Transactions.**

It reads persisted `transactions` in `[from, to]`, across every account. It reports period income, expenses, net cash flow, expenses by category, and cash flow grouped by day or month. A null expense category is returned as `Uncategorized`, with that category’s share of total expenses. The Analysis screen defaults cash-flow grouping to month and labels amounts EUR. The analysis API does not return a currency and does not convert mixed account currencies. Scheduled income and recurring expenses are out of this path.

**Forecast is future-oriented and uses:**

- `Account.current_balance` (sum of every account)
- active scheduled Income
- active Recurring Expenses

Occurrences are generated in memory (`generate_occurrences`) when a forecast is requested. Generation starts at `next_occurrence`, stops after an optional inclusive `end_date`, and omits dates before today (`as_of`, defaulting to `date.today()`). `start_date` is stored and validated on the schedule (`start_date` on or before `next_occurrence`, and on or before `end_date` when that is set). It is not an input to occurrence generation. Occurrence dates that already have a `schedule_executions` row for that schedule are excluded from schedule totals (see ADR 005). Without `account_id`, household forecast returns one projection per account currency (`projections[]` with `starting_balance` and `periods`). With `account_id`, a single projection for that account is returned. The Forecast screen defaults grouping to month. Forecast does not write transactions, balances, or period rows.

**Forecast must not depend on historical analysis logic.** Forecast services and repositories do not import Analysis. Analysis does not import Forecast. Similar period-label helpers exist in both services; they are duplicated, not shared as a financial calculation.

Household forecast returns one projection per account currency (ADR 002). There is no FX conversion and no cross-currency totals. Revisit starting-balance semantics if account types later represent overdraft, cash, credit-card debt, or investment value differently.

## 6. Dashboard responsibility

Dashboard is an **orchestration and presentation layer**, not a financial domain.

It may consume existing data contracts (accounts, analysis summary, forecast, financial goals) and display them. It should not become a second place where balances, cash-flow totals, projections, or goal progress are defined.

Today it:

- sums `current_balance` in the client within each currency, and keeps a separate total for every currency
- derives explainable text signals in `frontend/src/app/personal-finance/financial-signals.ts` (this-month cash-flow sign from analysis summary; missing scheduled income and projected balance direction from forecast periods). A zero net cash flow, or a projected ending balance equal to the starting balance, produces no directional signal. The quiet state names the period that was checked. Those signals are hidden when loaded accounts use more than one currency, and the Dashboard does not request household forecast in that case.
- lists goals from `GET /financial-goals`, including unavailable progress and allocations whose funded amount is below the designated amount

Those signal rules live in the dashboard feature, not in a backend domain service. They interpret API responses; they do not replace Analysis, Forecast, or Goals. Account, analysis, forecast, and goal requests load and fail independently.

## 7. Data ownership

| Fact | Source of truth |
| --- | --- |
| Actual current account balance | `Account.current_balance` (stored signed column). System-maintained: every effective transaction write updates it atomically with the row (ADR 005). Opening balance on account create is the initial exception. Not type-specific yet. |
| Historical financial events | `Transaction` rows (`occurred_on`, type, amount, optional category). |
| Executed schedule occurrences | `schedule_executions` (planned): links schedule identity, `occurrence_date`, and `transaction_id`. |
| Scheduled future inflows (pending) | Active `Income` rows minus executed occurrences in Forecast aggregation. |
| Scheduled future outflows (pending) | Active `RecurringExpense` rows minus executed occurrences in Forecast aggregation. |
| Financial objective and target | `FinancialGoal` rows (`target_amount`, optional `target_date`). Designated funding is `GoalAllocation`. |
| Goal current amount, progress, completion | Not persisted. Derived on each Goal API response from the linked Account when present. |
| Calculated forecast periods | Not persisted. Produced on each `GET /forecast`. |
| Historical analysis totals | Not persisted. Produced on each `/analysis/*` request. |

Demo seed data today sets `current_balance` independently of seeded transaction totals. Reconcile seed when ADR 005 balance rules are implemented.

## 8. API design principles

Relevant decisions that the current API implements:

- **Read-only Analysis and Forecast.** `GET /analysis/summary`, `/analysis/expenses`, `/analysis/cash-flow`, and `GET /forecast` do not mutate data.
- **Explicit date ranges.** Query parameters are named `from` and `to`. `from` must be on or before `to`.
- **Historical Analysis cannot use a future end date.** Analysis query schemas reject `to` after today. `to` equal to today is allowed.
- **Forecast includes empty periods.** For `group_by=day` or `month`, the response includes every period in the range, with zeros when nothing is scheduled. Analysis cash-flow does the same for historical buckets. `group_by` is required on both cash-flow and forecast requests.
- **No persistence for calculated Forecast data.** Periods, projected balances, and generated occurrence dates are response-only.
- **CORS from the Angular origin.** The API allows `GET`, `POST`, `PUT`, `DELETE`, and `OPTIONS` from `http://localhost:4200`. Other origins are rejected.

`GET /financial-summary` shares the transaction-total calculation with analysis summary but only validates `from <= to`. It does **not** apply the historical `to` constraint.

## 9. Testing approach

### Backend

pytest plus FastAPI `TestClient` (`httpx`). Tests use the same `DATABASE_URL` as the app, with connection `search_path` set to a PostgreSQL schema named `test` (`backend/tests/conftest.py`). That schema must already exist and contain migrated tables. The suite does not create the schema. Each test deletes rows in `goal_allocations`, `financial_goals`, `accounts`, `transactions`, `recurring_expenses`, and `incomes`.

Coverage is HTTP-level and domain-level: health, CORS preflight, accounts, transactions, account–transaction relationship, incomes, recurring expenses, schedule data integrity (no balance or transaction side effects), financial goals, financial summary, analysis, forecast, occurrence helpers, and database session wiring.

### Frontend

Angular CLI `ng test` runs Vitest. Specs cover routes, the dashboard component, financial signals, analysis component and service, date field, forecast component and service, account service, accounts list/create component, account detail component, the schedules component, the goals component and service, the transactions component and service, and table copy helpers. Tests are unit/component tests with HTTP mocked where services call the API. There is no end-to-end browser suite in this repository.

## 10. Seed data

`backend/scripts/seed_demo_data.py` loads a **deterministic local dataset** so Dashboard, Analysis, Forecast, and Transactions have something to show. It is optional and is safe to run more than once: existing historical transactions for the demo account are left in place; missing forecast seed rows are inserted without duplicates.

It creates or reuses one bank account named **Demo Main Account** (EUR). A new account, or an existing demo account with balance zero, is given `current_balance` 5000.00. Historical transactions cover 2026-01-01 through 2026-09-30. Forecast seed is one active monthly salary of 2000.00 and three active monthly expenses (Rent, Utilities, Household / Groceries).

**Seed data is not a migration.** Alembic revisions under `backend/alembic/versions/` change schema (tables, enums, columns such as `current_balance`). The seed script inserts application rows into an already-migrated database. Schema changes belong in Alembic; sample household data belongs in the seed script.

## 11. Infrastructure decisions

Infrastructure that exists:

- PostgreSQL, accessed with SQLAlchemy 2 and psycopg2
- Alembic (`backend/alembic`), with `ALEMBIC_SCHEMA` (default `public`) for the version table and `search_path`
- Pydantic settings: `DATABASE_URL` from `backend/.env`
- Uvicorn as the process that serves FastAPI
- CORS for `http://localhost:4200` with `GET`, `POST`, `PUT`, `DELETE`, and `OPTIONS`
- Process liveness: `GET /` and `GET /health`
- Angular development API base `http://127.0.0.1:8000`; production environment file still holds a placeholder URL

The following are **not** implemented: Redis, message queues, background workers, Kubernetes (or other cluster orchestration), metrics/tracing platforms, and authentication infrastructure.

Occurrence dates for Forecast are computed on request. There is no job that materializes upcoming transactions.

## 12. Future evolution

These are **future considerations**. They are not current architecture.

- **Account selection.** Analysis aggregates remain household-wide. Forecast supports optional `account_id` on the API and an account filter on the Forecast page. The Dashboard keeps a household-only forecast when every account shares one currency.
- **Multi-currency.** The Accounts create form offers EUR, USD, and GBP. That is a UI constraint. The API accepts any 3-character code. There is no FX conversion. The Dashboard shows one stored total per currency and does not show Analysis or Forecast signals when those currencies differ. Forecast still sums balances and labels the result EUR. That Forecast limitation is unchanged. Revisit it if broader multi-currency support becomes a product requirement.
- **Account-type balance rules.** `current_balance` is one signed stored value for every type. Negative amounts are allowed. Bank overdrafts, cash, credit-card debt, and investment valuation are not modeled separately. Forecast’s starting sum assumes they are comparable.
- **Background jobs.** Not present. Recurring occurrences are expanded when Forecast is requested.
- **Observability.** Health JSON only. No tracing, metrics, or log platform is wired in.
- **Richer financial insights.** Signals are a small, rule-based set on the Dashboard. Deeper resilience analysis is product direction, not an implemented module.
- **Forecast → Goal projected completion.** Forecast does not read Goals. Projecting when a Goal may be met from schedules, including any confidence or uncertainty around that projection, is future work.
- **ML.** Not used. Predictive models are explicitly out of the current product.

Related product limits already noted in models: scheduled income is salary-only; recurring expenses use one fixed amount per schedule.
