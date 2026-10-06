# Analysis versus Forecast

## Status

Accepted

## Context

The product answers two different questions with two different sources of truth.

Historical events live in `transactions` (`occurred_on`, type, amount, optional category). Recording a transaction does not update `Account.current_balance`. Scheduled future inflows live in active `incomes` (salary). Scheduled future outflows live in active `recurring_expenses` (one fixed amount). Current position is the stored `Account.current_balance`, not a sum of transactions.

Demo seed data follows the same split: `current_balance` is set independently of seeded transaction totals.

## Decision

Keep Analysis and Forecast as separate read models.

**Analysis** is historical and transaction-based. It answers “what happened?” `AnalysisService` and `AnalysisRepository` aggregate persisted transactions in `[from, to]`, across every account: period income, expenses, net cash flow, expenses by category, and cash flow by day or month. A null category is returned as `Uncategorized`. Analysis query schemas reject a `to` date after today. Amounts are not converted between currencies. Scheduled income and recurring expenses are not inputs. Analysis does not import Forecast.

**Forecast** is future-oriented. It answers “what may happen based on what is scheduled?” `ForecastService` starts from the sum of every `Account.current_balance`, then applies occurrences of active Income and active Recurring Expenses. Occurrences are generated in memory when `GET /forecast` is requested, from `next_occurrence` through an optional inclusive `end_date`. Dates before today are omitted. `start_date` is validated on write and is not used to generate dates. `account_id` on a schedule does not assign the occurrence to that account. Forecast does not read transactions, does not write transactions or balances, and does not import Analysis.

Historical transactions are not extrapolated into future Forecast values. Past spending is not a forecast input.

## Consequences

- A number is either observed (transactions) or assumed from an explicit schedule. The two are not blended.
- Changing how categories or historical totals are computed does not change a projection, and changing a salary or recurring expense does not change Analysis.
- Empty forecast periods stay zero when nothing is scheduled, even if similar months in history had spending. A requested `from` before today still does not include occurrences before today.
- Forecast currency is the string `EUR`. The service sums every account balance and does not convert or skip mixed currencies.
- Period-label helpers are duplicated in the two services. Both use `add_months` from `app.services.occurrence` as a calendar helper. That shared helper is not a shared financial calculation.
- `GET /financial-summary` returns the same transaction totals as analysis summary but does not reject a future `to` date. The Analysis page and Dashboard call `/analysis/summary`, which does enforce the historical bound.

## Alternatives considered

**One cash-flow model for past and future.** Rejected. Mixing transaction history with scheduled salary and recurring expenses would couple “what happened” to “what is assumed,” and would make a projected balance look like an observed one.

**Extrapolating historical transactions into Forecast.** Rejected. Forecast is a projection of stored balances and active schedules only. There is no job that materializes schedules as transactions, and Forecast does not infer future spending from past transactions.
