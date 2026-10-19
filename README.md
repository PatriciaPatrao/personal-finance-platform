# Personal Finance Platform

A household financial health application. It shows the current position of recorded accounts, explains historical cash flow from transactions, and projects future balances from scheduled income and recurring expenses.

The product is a modular monolith: an Angular client talks to a FastAPI API, and domain modules persist data in PostgreSQL. It is not a general expense tracker with a dashboard bolted on. Dashboard, Analysis, Forecast, Transactions, and Goals are separate concerns.

## Problem

Household money is usually split across what is in accounts now, what already happened, and what is already scheduled. Mixing those questions in one ledger makes it hard to tell a recorded balance from a historical total, or a projection from a guess based on past spending.

## Product concept

The application is a financial orientation tool:

- **Current position** is stored account balances, summed only within one currency.
- **Analysis** explains the past using transactions only.
- **Forecast** looks ahead using current balances plus active income schedules and recurring expenses. It does not infer the future from historical spending.
- **Goals** name future financial objectives and derived progress toward them. They do not own money.

The Dashboard is a presentation layer. It loads those results, derives a small set of signals when every account uses the same currency, shows goal progress, and links to Accounts, Schedules, Transactions, Goals, Analysis, and Forecast.

## Current capabilities

**Accounts.** Create and read accounts. Types are bank, cash, credit card, and investment. Each account stores a currency (EUR by default) and a signed `current_balance`. Negative balances are allowed. ADR 005 **system-maintained** balances: every effective transaction updates `current_balance` in the same database transaction. Account create may set an opening balance. The Angular screen at `/personal_finance/accounts` lists stored accounts and creates new ones. The create form offers EUR, USD, and GBP only. That list is a UI constraint: the API accepts any 3-character currency code. `/personal_finance/accounts/:id` shows a read-only account detail. There is no update or delete path, no FX conversion, and no combined total across different currencies.

**Transactions.** Create, read, update, and delete income and expense transactions. Each transaction belongs to an account and may have a category and description. The Angular screen at `/personal_finance/transactions` performs that CRUD. Filters (date range, type, category) run in the client. Category is an optional string. Writes update `current_balance` atomically. Transactions linked to schedule execution cannot be edited or deleted (409).

**Income.** Create, read, and update expected salary schedules. Each schedule belongs to an account. Frequency is weekly, monthly, or yearly, with a start date, a next occurrence, an optional end date, and an active flag. The income model is salary only. The start date is stored and checked against the next occurrence and end date. Forecast does not use it to generate dates. The Angular screen at `/personal_finance/schedules` lists, creates, edits, deactivates, and reactivates salary schedules, and can **execute** today’s eligible occurrence as a transaction. Schedule CRUD does not create transactions or change balances.

**Recurring expenses.** Create, read, and update fixed scheduled commitments on an account, with the same frequency, start date, occurrence, and active-flag shape, plus a description and optional category. Each schedule has one fixed amount. The same Schedules screen maintains these records and supports execution for active rows.

**Analysis.** Read-only historical queries over every account’s transactions for a date range that cannot end in the future. Amounts are not converted between currencies. The Analysis screen labels them EUR. The API response has no currency field.

- income, expenses, and net cash flow
- expenses grouped by category, including each category’s share of the total. A missing category is reported as Uncategorized
- cash flow grouped by day or month. The Analysis screen defaults to month

**Forecast.** Read-only projection for a date range, grouped by day or month. The Forecast screen defaults to month and offers “All accounts” or a single account. `GET /forecast` returns `projections[]`: each item has `currency`, `starting_balance`, and `periods`. Household scope returns one projection per account currency (sorted by currency code), never combining unlike currencies. Account scope (`account_id`) returns one projection for that account. Dates are generated from `next_occurrence` through an optional inclusive end date. Dates before today are omitted. There is no FX conversion. Forecast does not write balances.

**Financial Goals.** The Angular screen at `/personal_finance/goals` lists, creates, and edits future financial objectives, and designates existing Account money through GoalAllocations. Each Goal has a name, a positive target amount, a currency (EUR by default; the form offers EUR, USD, and GBP), and an optional target date. A Goal does not store money. Progress comes from funded allocations: `current_amount` is the sum of funded designation amounts, `progress` is bounded to `[0, 1]`, and `completed` is derived. A Goal with no allocations has those three values null and the screen says progress is unavailable. Allocation writes do not change `Account.current_balance`. An Account may fund many Goals and a Goal may receive allocations from many Accounts of the same currency, as long as designated amounts stay within available capacity. There is no Goal DELETE route; allocations can be reduced or deleted.

**Financial summary.** `GET /financial-summary` returns the same transaction totals as analysis summary, for a date range that may extend into the future. The Analysis page uses the analysis routes.

**Dashboard signals.** From the loaded summary and forecast, the client can report positive or negative cash flow, missing scheduled income, and whether the projected balance rises or falls over the forecast window. Those signals are hidden when accounts use more than one currency, and the Dashboard skips household forecast in that case. Per-account forecast is available on the Forecast page. The Dashboard also lists each goal’s target and funded amount in that goal’s currency. Null progress is shown as unavailable.

There is no authentication. The Angular UI writes transactions, creates accounts, creates and edits Financial Goals, and creates and edits salary and recurring-expense schedules through the API. Schedule writes do not create transactions or change account balances.

## Architecture

```text
Angular (Dashboard, Accounts, Schedules, Goals, Analysis, Forecast, Transactions)
        │  HTTP
        ▼
FastAPI
        │
        ├── api          HTTP routes
        ├── services     domain rules
        ├── repositories data access
        ├── models       SQLAlchemy tables
        └── PostgreSQL
```

Analysis and Forecast do not share a calculation. Analysis reads transactions. Forecast reads account balances, incomes, and recurring expenses, and expands schedules into occurrences.

## Backend

- Python
- FastAPI 0.142
- SQLAlchemy 2
- PostgreSQL via psycopg2
- Alembic
- Pydantic settings (`DATABASE_URL` in `backend/.env`)
- pytest and HTTPX for API tests

Layout under `backend/app/`: `api`, `services`, `repositories`, `schemas`, `models`, `db`, and `core`. Migrations live in `backend/alembic`.

### API

| Method | Path | Role |
| --- | --- | --- |
| GET | `/`, `/health` | Process status |
| POST, GET | `/accounts`, `/accounts/{id}` | Accounts |
| POST, GET, PUT, DELETE | `/transactions`, `/transactions/{id}` | Transactions |
| POST, GET, PUT | `/incomes`, `/incomes/{id}` | Salary schedules |
| POST, GET, PUT | `/recurring-expenses`, `/recurring-expenses/{id}` | Fixed recurring expenses |
| POST, GET, PUT | `/financial-goals`, `/financial-goals/{id}` | Financial objectives; no Goal DELETE |
| POST, PUT, DELETE | `/financial-goals/{id}/allocations`, `.../{allocation_id}` | Designate existing Account money toward a Goal |
| GET | `/financial-summary` | Transaction totals for `from` and `to` |
| GET | `/analysis/summary` | Historical totals; `to` cannot be in the future |
| GET | `/analysis/expenses` | Historical expenses by category |
| GET | `/analysis/cash-flow` | Historical cash flow; `group_by` is `day` or `month` |
| GET | `/forecast` | Projection; `group_by` is `day` or `month`; optional `account_id`; response includes `scope`, `account_id`, and `projections[]` |

Date query parameters use the names `from` and `to`.

## Frontend

- Angular 21
- TypeScript
- SCSS
- Standalone components and lazy-loaded routes
- Vitest, through the Angular CLI

The development client calls `http://127.0.0.1:8000` (`frontend/src/environments/environment.development.ts`). Production builds require `NG_APP_API_BASE_URL` (see **Production deployment** below).

## Application routes

The shell is `PersonalFinanceLayout` at `/personal_finance`, with navigation for Dashboard, Accounts, Schedules, Goals, Analysis, Forecast, and Transactions.

| Route | Screen |
| --- | --- |
| `/` | Redirects to `/personal_finance` |
| `/personal_finance` | Dashboard: one stored total per currency, financial signals when currencies match, goal progress, links to Accounts, Schedules, Transactions, Goals, Analysis, and Forecast |
| `/personal_finance/accounts` | Stored accounts list and create form: name, type, currency, and opening/current balance |
| `/personal_finance/accounts/:id` | Read-only account detail: stored balance, type, currency, and created date. No update or delete. |
| `/personal_finance/schedules` | Salary and fixed recurring expenses: list, create, edit, deactivate, activate, and execute today’s occurrence (ADR 005). Dates are DD-MM-YYYY. Schedule CRUD informs Forecast only; execution creates transactions and updates balance. |
| `/personal_finance/goals` | Financial objectives: list, create, and edit; allocate, reduce, or remove designated Account money. Derived progress, no Goal delete. Dates are entered as DD-MM-YYYY. |
| `/personal_finance/analysis` | Historical summary, expenses by category, and cash flow. Default range is the current month through today. Dates are entered as DD-MM-YYYY. |
| `/personal_finance/forecast` | Projected income, expenses, net cash flow, and running balance. Default range starts today and ends on the last day of the calendar month two months ahead. Grouping is monthly or daily. |
| `/personal_finance/transactions` | Recorded income and expense events: list, client-side filters, create, edit, and delete. Dates are entered as DD-MM-YYYY. |

If accounts use more than one currency, the Dashboard shows a separate total for each currency and does not show Analysis or Forecast signals. Household Forecast returns one projection per account currency (no cross-currency sum or FX).

## Run the backend

PostgreSQL must already be running. From `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and set at least:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
APP_ENV=development
```

Optional in development: `CORS_ORIGINS` (comma-separated). When unset, the API allows `http://localhost:4200` for the Angular dev server.

Apply migrations (default schema is `public`). Alembic loads `DATABASE_URL` through the same settings as the API: `backend/.env`, overridden by the process environment when that variable is set:

```powershell
alembic upgrade head
uvicorn app.main:app --reload
```

The API listens on `http://127.0.0.1:8000`. Interactive OpenAPI is at `http://127.0.0.1:8000/docs`.

On Unix, activate the virtual environment with `source .venv/bin/activate`.

## Run the frontend

From `frontend`, with the API already running:

```powershell
npm install
npm start
```

Open `http://localhost:4200/`. The browser is allowed to call the API from that origin.

## Production deployment

Configure the API and the built frontend separately. Replace placeholder values with your real deployment URLs and origins.

### Backend

Set environment variables (or `backend/.env` on the server):

| Variable | Development | Production |
| --- | --- | --- |
| `DATABASE_URL` | Required | Required |
| `APP_ENV` | `development` (default) | `production` |
| `CORS_ORIGINS` | Optional; defaults to `http://localhost:4200` | **Required.** Comma-separated list of frontend origins, e.g. `https://app.example.com` |

When `APP_ENV=production`, the process **refuses to start** unless `CORS_ORIGINS` lists every browser origin that may call the API. Wildcard `*` is not permitted.

Start the API with `uvicorn app.main:app` (or your process manager) after migrations.

### Frontend

Production builds inject the public API base URL at compile time. **`npm run build` fails** if `NG_APP_API_BASE_URL` is missing or still a documentation placeholder.

PowerShell:

```powershell
cd frontend
$env:NG_APP_API_BASE_URL = "https://YOUR-API-ORIGIN.example"
npm run build
```

Unix:

```bash
cd frontend
NG_APP_API_BASE_URL=https://YOUR-API-ORIGIN.example npm run build
```

Use the API origin **without** a trailing slash (for example `https://api.example.com`). Static files are emitted under `frontend/dist/frontend`.

Development (`npm start`) is unchanged and does not use `NG_APP_API_BASE_URL`.

## Tests

Backend tests use pytest against the same `DATABASE_URL`, with the connection `search_path` set to a PostgreSQL schema named `test`. That schema must already exist and contain the migrated tables. The suite deletes rows in `test` before each test. It does not create the schema.

```powershell
cd backend
$env:ALEMBIC_SCHEMA = "test"
alembic upgrade head
pytest
```

On Unix, set the schema with `ALEMBIC_SCHEMA=test alembic upgrade head`.

Frontend unit tests:

```powershell
cd frontend
npm test
```

## Demo data

`backend/scripts/seed_demo_data.py` loads a deterministic dataset. It is safe to run more than once: existing historical transactions are left in place, and missing forecast rows are inserted without duplicates.

```powershell
cd backend
python scripts/seed_demo_data.py
```

It creates or reuses one bank account, **Demo Main Account**, in EUR. On a **first run** (new account or existing demo account with no historical transactions), it inserts the transaction rows below and sets `current_balance` from those rows using the same balance rules as the API (net **4040.00** for this dataset). **Re-runs** leave existing transactions and balances unchanged; only missing forecast schedule rows are added. An **empty** demo account (no transactions, balance zero) is given **5000.00** as a forecast-only placeholder. **Legacy** databases seeded before this behaviour may still show **5000.00** alongside historical transactions; re-seeding does not rewrite them.

Historical transactions cover 2026-01-01 through 2026-09-30 (125 rows). Each month has 2000.00 of income. Expense totals are:

| Month | Expenses |
| --- | ---: |
| 2026-01 | 1420.00 |
| 2026-02 | 1510.00 |
| 2026-03 | 1380.00 |
| 2026-04 | 1760.00 |
| 2026-05 | 1450.00 |
| 2026-06 | 1620.00 |
| 2026-07 | 1900.00 |
| 2026-08 | 1570.00 |
| 2026-09 | 1350.00 |

Forecast rows are one active monthly salary of 2000.00 and three active monthly expenses: Rent 800.00 (Housing), Utilities 150.00 (Utilities), and Household / Groceries 300.00 (Food). The next occurrence is 31 October 2026, or the next monthly date on or after today if that date has passed.

The script stops if more than one account is already named Demo Main Account.

## Documentation

- [docs/product-vision.md](docs/product-vision.md) — product boundaries and what is intentionally omitted
- [docs/architecture.md](docs/architecture.md) — structure of the current application
- [docs/milestone-recurring-schedules.md](docs/milestone-recurring-schedules.md) — recurring schedules and schedule execution milestone (validation, tests, status)
- [docs/decisions/](docs/decisions/) — modular monolith, Analysis versus Forecast, Dashboard responsibility, Financial Goals, and schedule occurrence execution (ADR 005)
- [frontend/README.md](frontend/README.md) — Angular CLI serve, build, and unit-test commands
- `http://127.0.0.1:8000/docs` — generated OpenAPI for the running API

There is no separate visual design file in this repository.

## Planned direction

The intended product is household financial resilience: where money stands, what history shows, what scheduled commitments imply next, and what objectives the household is working toward. Dashboard, Analysis, Forecast, Transactions, and Goals are the current expression of that split. Resilience as a combined health concept remains future work.

Limits already marked and not built:

- Income records expected salary. Other income types are a separate future concern.
- Recurring expenses store one fixed amount per schedule. Amounts that vary by occurrence are a later change.
- Forecast does not project Goal completion. Projection confidence and uncertainty around Goal timelines remain future work.
