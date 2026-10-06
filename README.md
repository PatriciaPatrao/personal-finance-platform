# Personal Finance Platform

A household financial health application. It shows the current position of recorded accounts, explains historical cash flow from transactions, and projects future balances from scheduled income and recurring expenses.

The product is a modular monolith: an Angular client talks to a FastAPI API, and domain modules persist data in PostgreSQL. It is not a general expense tracker with a dashboard bolted on. Dashboard, Analysis, Forecast, and Transactions are separate concerns.

## Problem

Household money is usually split across what is in accounts now, what already happened, and what is already scheduled. Mixing those questions in one ledger makes it hard to tell a recorded balance from a historical total, or a projection from a guess based on past spending.

## Product concept

The application is a financial orientation tool:

- **Current position** is the sum of stored account balances.
- **Analysis** explains the past using transactions only.
- **Forecast** looks ahead using current balances plus active income schedules and recurring expenses. It does not infer the future from historical spending.

The Dashboard is a presentation layer. It loads those results, derives a small set of signals, and links to Analysis and Forecast.

## Current capabilities

**Accounts.** Create and read accounts. Types are bank, cash, credit card, and investment. Each account stores a currency (EUR by default) and a `current_balance`. Recording a transaction does not change that balance. The Angular screen at `/personal_finance/accounts` lists stored accounts and creates new ones. Account detail views are not in the UI yet.

**Transactions.** Create, read, update, and delete income and expense transactions. Each transaction belongs to an account and may have a category and description. The Angular screen at `/personal_finance/transactions` performs that CRUD. Filters (date range, type, category) run in the client. Category is an optional string. Recording or changing a transaction does not update `Account.current_balance`.

**Income.** Create, read, and update expected salary schedules. Each schedule belongs to an account. Frequency is weekly, monthly, or yearly, with a start date, a next occurrence, an optional end date, and an active flag. The income model is salary only. The start date is stored and checked against the next occurrence and end date. Forecast does not use it to generate dates.

**Recurring expenses.** Create, read, and update fixed scheduled commitments on an account, with the same frequency, start date, occurrence, and active-flag shape, plus a description and optional category. Each schedule has one fixed amount.

**Analysis.** Read-only historical queries over every account’s transactions for a date range that cannot end in the future. Amounts are not converted between currencies. The Analysis screen labels them EUR. The API response has no currency field.

- income, expenses, and net cash flow
- expenses grouped by category, including each category’s share of the total. A missing category is reported as Uncategorized
- cash flow grouped by day or month. The Analysis screen defaults to month

**Forecast.** Read-only projection for a date range, grouped by day or month. The Forecast screen defaults to month. It sums every account’s stored balance, then applies active income and recurring-expense occurrences. Each schedule belongs to an account, and the projection does not assign an occurrence to that account. Dates are generated from `next_occurrence` through an optional inclusive end date. Dates before today are omitted, including when `from` is earlier than today. The response currency is EUR, with no conversion when account currencies differ. Forecast does not write balances.

**Financial summary.** `GET /financial-summary` returns the same transaction totals as analysis summary, for a date range that may extend into the future. The Analysis page uses the analysis routes.

**Dashboard signals.** From the loaded summary and forecast, the client can report positive or negative cash flow, missing scheduled income, and whether the projected balance rises or falls over the forecast window.

There is no authentication. The Angular UI writes transactions and creates accounts through the API. Income and recurring-expense writes remain API-only.

## Architecture

```text
Angular (Dashboard, Accounts, Analysis, Forecast, Transactions)
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
| GET | `/financial-summary` | Transaction totals for `from` and `to` |
| GET | `/analysis/summary` | Historical totals; `to` cannot be in the future |
| GET | `/analysis/expenses` | Historical expenses by category |
| GET | `/analysis/cash-flow` | Historical cash flow; `group_by` is `day` or `month` |
| GET | `/forecast` | Projection; `group_by` is `day` or `month` |

Date query parameters use the names `from` and `to`.

## Frontend

- Angular 21
- TypeScript
- SCSS
- Standalone components and lazy-loaded routes
- Vitest, through the Angular CLI

The development client calls `http://127.0.0.1:8000` (`frontend/src/environments/environment.development.ts`). The production environment file still has a placeholder API base URL.

## Application routes

The shell is `PersonalFinanceLayout` at `/personal_finance`, with navigation for Dashboard, Accounts, Analysis, Forecast, and Transactions.

| Route | Screen |
| --- | --- |
| `/` | Redirects to `/personal_finance` |
| `/personal_finance` | Dashboard: combined balance when every account uses the same currency, financial signals, links to Analysis and Forecast |
| `/personal_finance/accounts` | Stored accounts list and create form: name, type, currency, and opening/current balance. Detail is not in the UI yet. |
| `/personal_finance/analysis` | Historical summary, expenses by category, and cash flow. Default range is the current month through today. Dates are entered as DD-MM-YYYY. |
| `/personal_finance/forecast` | Projected income, expenses, net cash flow, and running balance. Default range starts today and ends on the last day of the calendar month two months ahead. Grouping is monthly or daily. |
| `/personal_finance/transactions` | Recorded income and expense events: list, client-side filters, create, edit, and delete. Dates are entered as DD-MM-YYYY. |

If accounts use more than one currency, the Dashboard does not show a single combined balance.

## Run the backend

PostgreSQL must already be running. From `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `backend/.env`:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

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

It creates or reuses one bank account, **Demo Main Account**, in EUR. A new account, or an existing demo account whose balance is zero, is given a current balance of 5000.00. That balance is stored directly. It is not the sum of the seeded transactions.

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
- [docs/decisions/](docs/decisions/) — modular monolith, Analysis versus Forecast, and Dashboard responsibility
- [frontend/README.md](frontend/README.md) — Angular CLI serve, build, and unit-test commands
- `http://127.0.0.1:8000/docs` — generated OpenAPI for the running API

There is no separate visual design file in this repository.

## Planned direction

The intended product is household financial resilience: where money stands, what history shows, and what scheduled commitments imply next. Dashboard, Analysis, Forecast, and Transactions are the current expression of that split.

Two limits are already marked in the domain models and are not built:

- Income records expected salary. Other income types are a separate future concern.
- Recurring expenses store one fixed amount per schedule. Amounts that vary by occurrence are a later change.

No other roadmap is specified in the repository.
