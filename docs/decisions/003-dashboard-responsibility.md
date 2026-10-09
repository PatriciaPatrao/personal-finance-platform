# Dashboard responsibility

## Status

Accepted

**Revision note.** The Dashboard shows one stored total per currency, reads Financial Goals, withholds Analysis and Forecast signals when account currencies differ, and links to Accounts, Transactions, Goals, Analysis, and Forecast. Forecast’s mixed-currency sum is unchanged.

## Context

The Angular shell at `/personal_finance` has routes for Dashboard, Accounts, Goals, Analysis, Forecast, and Transactions. Analysis and Forecast already own their calculations on the API (`/analysis/*` and `GET /forecast`). Transactions is its own screen for recorded events; it is not a dashboard calculation. Accounts already expose stored balances on `GET /accounts`. `/personal_finance/accounts` lists and creates them, and `/personal_finance/accounts/:id` shows a read-only detail. Account update and delete are not in the UI. Goals expose derived funded progress on `GET /financial-goals`.

There is no dashboard route on the API. There is no numeric financial-health score in the client or the API.

## Decision

Treat Dashboard as an orchestration and presentation layer, not a financial domain.

`PersonalFinance` loads existing contracts and displays them:

- `GET /accounts` for current position. The client sums `current_balance` inside each currency. One shared currency stays a single total. Different currencies stay separate totals. There is no conversion.
- `GET /analysis/summary` for the current calendar month through today
- `GET /forecast` grouped by month, from today through the last day of the calendar month two months ahead
- `GET /financial-goals` for each goal’s name, target, funded amount, and backend-derived progress

It surfaces a small set of transparent text signals when every loaded account uses the same currency. When currencies differ, it does not show Analysis or Forecast signals, because those APIs add amounts without conversion and Forecast still labels its result EUR. That Forecast calculation is unchanged.

Account, analysis, forecast, and goal requests load and fail independently. A failure does not hide data from a request that succeeded, and it does not turn missing data into zero. When a successful check produces no directional signal, the screen says what was checked and over which period.

Dashboard does not duplicate Analysis, Forecast, or Goal calculations, does not own financial-domain rules for balances, historical totals, projections, or funded progress, and does not introduce an arbitrary financial-health score. It does not need a dedicated dashboard endpoint.

## Consequences

- Domain boundaries stay in Accounts, Analysis, Forecast, and Goals. The home screen cannot become a second definition of cash flow, projection, or goal progress.
- Signals in `financial-signals.ts` only interpret responses already returned by Analysis and Forecast: the sign of this month’s net cash flow, whether any forecast period has scheduled income, and whether projected balance rises or falls. A zero net cash flow, or an ending projected balance equal to the starting balance, produces no directional signal. The quiet state names the checked period. It does not say that nothing requires attention. Each signal is explainable text. They are not a score and they do not recompute those domains. Mixed account currencies suppress these signals.
- Current position is presentation of stored signed balances, grouped by currency. The screen labels it as current position, not a forecast. It does not convert currencies. The Accounts create form’s EUR/USD/GBP list is a UI constraint, not a dashboard or domain rule; the API still accepts any 3-character code.
- Forecast still sums every stored balance and returns currency `EUR` when accounts differ. The Dashboard does not repeat that figure. Changing the Forecast sum is separate work.
- Goal progress, funded amount, and completion come from the goal response. Null progress is shown as unavailable. A goal with allocations and a funded amount of zero can show 0%. An allocation whose `funded_amount` is below its designated `amount` is flagged. The Dashboard does not add goal amounts across currencies, and it does not flag a passed target date.
- Dashboard does not define what a negative `current_balance` means for a bank, cash, credit card, or investment account. That stored value is the same signed amount for every type. Type-specific rules, and any later change to Forecast’s starting sum of those balances, belong to future account-domain work, not to this screen.
- Discovery links to Accounts, Schedules, Transactions, Goals, Analysis, and Forecast. The Dashboard does not create or change financial records. Salary and recurring expenses are maintained on the Schedules screen; the Dashboard only links there. Named recurring commitments are not listed on the Dashboard.
- A later dashboard endpoint would be justified only if these contracts cannot express a real screen need. That need is not present today.

## Alternatives considered

**A dashboard domain or `GET /dashboard` aggregate.** Rejected for the current UI. The screen is a composition of accounts, analysis summary, and forecast. A dedicated endpoint would duplicate those contracts without a gap they fail to cover.

**A financial-health score on the Dashboard.** Rejected. The product shows inspectable position, history, and scheduled projection. No defensible scoring model exists in the codebase, and the Dashboard does not invent one.
