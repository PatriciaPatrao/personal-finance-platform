# Dashboard responsibility

## Status

Accepted

## Context

The Angular shell at `/personal_finance` has three routes: Dashboard, Analysis, and Forecast. Analysis and Forecast already own their calculations on the API (`/analysis/*` and `GET /forecast`). Accounts already expose stored balances on `GET /accounts`.

There is no dashboard route on the API. There is no numeric financial-health score in the client or the API.

## Decision

Treat Dashboard as an orchestration and presentation layer, not a financial domain.

`PersonalFinance` loads existing contracts and displays them:

- `GET /accounts` for current position (client sum of `current_balance` when every account uses the same currency; no combined figure when currencies differ)
- `GET /analysis/summary` for the current calendar month through today
- `GET /forecast` grouped by month, from today through the last day of the calendar month two months ahead

It surfaces a small set of transparent text signals and links to Analysis and Forecast so users can open those specialised screens.

Dashboard does not duplicate Analysis or Forecast calculations, does not own financial-domain rules for balances, historical totals, or projections, and does not introduce an arbitrary financial-health score. It does not need a dedicated dashboard endpoint: the existing account, analysis, and forecast contracts are sufficient for what the screen shows.

## Consequences

- Domain boundaries stay in Accounts, Analysis, and Forecast. The home screen cannot become a second definition of cash flow or projection.
- Signals in `financial-signals.ts` only interpret responses already returned by Analysis and Forecast: the sign of this month’s net cash flow, whether any forecast period has scheduled income, and whether projected balance rises or falls. Each signal is explainable text. They are not a score and they do not recompute those domains.
- Combined current position is presentation of stored balances. The screen labels it as current position, not a forecast.
- Discovery on the Dashboard is limited to Analysis and Forecast. Accounts, transactions, salary, and recurring expenses have no UI routes; writes remain API-only.
- A later dashboard endpoint would be justified only if these contracts cannot express a real screen need. That need is not present today.

## Alternatives considered

**A dashboard domain or `GET /dashboard` aggregate.** Rejected for the current UI. The screen is a composition of accounts, analysis summary, and forecast. A dedicated endpoint would duplicate those contracts without a gap they fail to cover.

**A financial-health score on the Dashboard.** Rejected. The product shows inspectable position, history, and scheduled projection. No defensible scoring model exists in the codebase, and the Dashboard does not invent one.
