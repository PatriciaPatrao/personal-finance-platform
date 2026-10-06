# Dashboard responsibility

## Status

Accepted

## Context

The Angular shell at `/personal_finance` has routes for Dashboard, Accounts, Analysis, Forecast, and Transactions. Analysis and Forecast already own their calculations on the API (`/analysis/*` and `GET /forecast`). Transactions is its own screen for recorded events; it is not a dashboard calculation. Accounts already expose stored balances on `GET /accounts`. `/personal_finance/accounts` lists and creates them, and `/personal_finance/accounts/:id` shows a read-only detail. Account update and delete are not in the UI.

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
- Signals in `financial-signals.ts` only interpret responses already returned by Analysis and Forecast: the sign of this month’s net cash flow, whether any forecast period has scheduled income, and whether projected balance rises or falls. A zero net cash flow, or an ending projected balance equal to the starting balance, produces no directional signal. With an empty list, the screen says that nothing currently requires attention. Each signal is explainable text. They are not a score and they do not recompute those domains.
- Combined current position is presentation of stored signed balances, and only when every account uses the same currency. The screen labels it as current position, not a forecast. It does not convert currencies. The Accounts create form’s EUR/USD/GBP list is a UI constraint, not a dashboard or domain rule; the API still accepts any 3-character code. Mixed-currency aggregation stays unsupported.
- Dashboard does not define what a negative `current_balance` means for a bank, cash, credit card, or investment account. That stored value is the same signed amount for every type. Type-specific rules, and any later change to Forecast’s starting sum of those balances, belong to future account-domain work, not to this screen.
- Discovery on the Dashboard is limited to Analysis and Forecast. Transactions and Accounts have their own routes. The Accounts screen lists, creates, and shows a read-only detail of stored balances; it does not own a combined multi-currency total. Salary and recurring expenses still have no UI routes; those writes remain API-only.
- A later dashboard endpoint would be justified only if these contracts cannot express a real screen need. That need is not present today.

## Alternatives considered

**A dashboard domain or `GET /dashboard` aggregate.** Rejected for the current UI. The screen is a composition of accounts, analysis summary, and forecast. A dedicated endpoint would duplicate those contracts without a gap they fail to cover.

**A financial-health score on the Dashboard.** Rejected. The product shows inspectable position, history, and scheduled projection. No defensible scoring model exists in the codebase, and the Dashboard does not invent one.
