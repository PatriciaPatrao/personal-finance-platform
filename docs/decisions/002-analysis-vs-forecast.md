# Analysis versus Forecast

## Status

Accepted

## Context

The product answers two different questions with two different sources of truth.

Historical events live in `transactions` (`occurred_on`, type, amount, optional category). Scheduled future inflows live in active `incomes` (salary). Scheduled future outflows live in active `recurring_expenses` (one fixed amount). Current position is the stored `Account.current_balance`. ADR [005](005-schedule-execution.md) requires that **every effective transaction** (manual and schedule-generated) update `current_balance` atomically with the transaction row; manual CRUD and schedule execution implement this via `TransactionService`.

Demo seed data on a first run sets `current_balance` from seeded transaction deltas; see `backend/scripts/seed_demo_data.py`.

## Decision

Keep Analysis and Forecast as separate read models.

**Analysis** is historical and transaction-based. It answers “what happened?” `AnalysisService` and `AnalysisRepository` aggregate persisted transactions in `[from, to]`, across every account: period income, expenses, net cash flow, expenses by category, and cash flow by day or month. A null category is returned as `Uncategorized`. Analysis query schemas reject a `to` date after today. Amounts are not converted between currencies. Scheduled income and recurring expenses are not inputs. Analysis does not import Forecast.

**Forecast** is future-oriented. It answers “what may happen based on what is scheduled?” `GET /forecast` accepts optional `account_id`.

- **Household scope** (default, `account_id` omitted): return one **projection** per distinct account currency, sorted alphabetically by currency code. Each projection sums `current_balance` only for accounts in that currency and includes only active schedules linked to those accounts. There is no FX conversion and no cross-currency totals.
- **Account scope** (`account_id` set): return a single projection for that account’s currency, using its `current_balance` and matching active schedules. **404** when the account is missing.
- **Response shape:** `projections[]` with `currency`, `starting_balance`, and `periods` (no top-level combined `currency` or `periods`).

Occurrences are generated in memory when `GET /forecast` is requested, from `next_occurrence` through an optional inclusive `end_date`. Dates before today are omitted. `start_date` is validated on write and is not used to generate dates. Gaps between `start_date` and `next_occurrence` are not projected. Forecast does not read transactions, does not write transactions or balances, and does not import Analysis.

Historical transactions are not extrapolated into future Forecast values. Past spending is not a forecast input.

**Schedule execution (ADR [005](005-schedule-execution.md)).** When a schedule occurrence is executed on the **current domain date**, a `Transaction` is created and recorded in `schedule_executions`. Forecast remains read-only and **excludes** executed keys from schedule aggregation. Analysis continues to use transactions only. Transaction writes and balance updates share one atomic unit of work for manual and schedule-generated transactions.

## Consequences

- A number is either observed (transactions) or assumed from an explicit schedule. The two are not blended.
- Changing how categories or historical totals are computed does not change a projection, and changing a salary or recurring expense does not change Analysis.
- Empty forecast periods stay zero when nothing is scheduled, even if similar months in history had spending. A requested `from` before today still does not include occurrences before today.
- Multi-currency households receive multiple independent projections in one response. Dashboard financial signals stay suppressed when accounts use more than one currency (no per-currency signals yet).
- The response includes `scope` (`household` or `account`), `account_id` (null for household), and `projections`.
- Period-label helpers are duplicated in the two services. Both use `add_months` from `app.services.occurrence` as a calendar helper. That shared helper is not a shared financial calculation.
- `GET /financial-summary` returns the same transaction totals as analysis summary but does not reject a future `to` date. The Analysis page and Dashboard call `/analysis/summary`, which does enforce the historical bound.
- After execution, projected schedule totals omit occurrences that already have an execution record; stored starting balance reflects execution-driven balance updates.

## Alternatives considered

**One cash-flow model for past and future.** Rejected. Mixing transaction history with scheduled salary and recurring expenses would couple “what happened” to “what is assumed,” and would make a projected balance look like an observed one.

**Extrapolating historical transactions into Forecast.** Rejected. Forecast is a projection of stored balances and active schedules only. There is no job that materializes schedules as transactions, and Forecast does not infer future spending from past transactions.
