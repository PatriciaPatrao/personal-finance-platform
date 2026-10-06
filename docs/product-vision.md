# Product vision

This product is a **financial health / household financial resilience** platform.

Many households can record income and expenses. Fewer can see their **current position**, understand **what already happened**, and judge **future capacity** when scheduled bills and salary land. The product exists to make that picture inspectable, not to replace a ledger with a score.

It is not a simple expense tracker.

## Core problem

Households struggle to connect three different questions:

1. How much money is available now?
2. What did cash flow look like in a past period?
3. What may the balance look like if known salary and recurring commitments occur as scheduled?

Without that split, people under-estimate vulnerability to unexpected expenses and over-trust a list of past purchases as a plan.

## Current capabilities

These are implemented in the application today.

### Current financial position

The dashboard reports **stored account balances**. When every account uses the same currency, it shows a single total across accounts. When currencies differ, it does not invent a combined figure.

That total is **current position, not a forecast**. Account `current_balance` is stored on the account. Recording a transaction does not recalculate it.

### Historical financial analysis

**Analysis** answers what happened in a chosen date range. It reads **persisted transactions** only, across every account:

- period income, expenses, and net cash flow
- expenses grouped by category, with a missing category shown as Uncategorized
- cash flow over time, grouped by day or month

Those totals are not converted between currencies. The Analysis screen labels them EUR. Scheduled salary and recurring expenses are out of this view. Past spending is not used to predict the future.

### Future scheduled cash-flow projection

**Forecast** answers what may happen based on what is scheduled. It is a **read-only projection** from:

- the sum of current account balances
- active scheduled salary
- active recurring expenses with a fixed expected amount

Occurrences are generated when a forecast is requested, starting at each schedule’s next occurrence. A stored start date is not the generation start. Dates before today are omitted, including when the requested range begins earlier. Each schedule belongs to an account; the projection still uses one combined balance and does not post an occurrence to that account. The projection is **not** a model of historical spending and **does not** write transactions.

### Accounts

Accounts are places money is held: bank, cash, credit card, or investment. Each has a name, currency (default EUR), and current balance.

### Transactions

Transactions are recorded movements of money: income or expense, amount, date, optional description and category. They are the source of truth for historical analysis. The Angular Transactions screen records, edits, and deletes those events. Category remains an optional string. Account balances are not derived from the transaction list.

### Scheduled income

Scheduled income in this MVP is **salary only**. Each record belongs to an account and has a frequency (weekly, monthly, yearly), start date, next occurrence, optional end date, and active flag. Forecast generates dates from the next occurrence. Other income categories are not modeled.

### Recurring expenses

Recurring expenses are expected future commitments on an account, with a **fixed** amount, optional category, the same frequency and date fields as salary, and an active flag. Amounts that vary by occurrence (for example utilities) are not modeled.

### Dashboard-oriented financial overview

The Angular app’s primary surfaces are **Dashboard**, **Analysis**, **Forecast**, and **Transactions**.

The dashboard is an orientation home: current position, a small set of **explainable financial signals**, and links into analysis and forecast. Signals are rule-based text (for example positive vs negative cash flow this month, no scheduled income in the forecast window, projected balance rising or falling). There is no numeric financial-health score.

Accounts, scheduled salary, and recurring expenses are maintained through the API. The current UI does not include screens to edit those records.

## Product boundaries

| Surface | Question it answers |
| --- | --- |
| Dashboard | What should I know or pay attention to? |
| Analysis | What happened? |
| Forecast | What may happen based on what is scheduled? |
| Transactions | Where do my recorded financial events live? |

Forecast and historical analysis stay separate on purpose. Mixing them would hide whether a number is observed or assumed.

## Product principles

- Financial signals are **transparent and explainable**. Users should be able to see why a message appeared.
- Do not introduce an **arbitrary financial-health score** without a defensible model.
- Do not introduce **machine learning** merely for demonstration.
- Automation should **account for uncertainty** and leave **control with the user** (schedules are explicit, forecasts are projections of those schedules, inactive records are excluded).
- The product should evolve toward helping users **understand, plan, and improve financial resilience**.

## Deliberate non-implementation (current MVP)

These are omitted on purpose, not missing by accident:

- **No arbitrary financial-health score.**
- **No ML** in the current application.
- **No automatic generation of transactions** from recurring records or salary schedules. Forecast calculates occurrences in memory and does not persist them as transactions.
- **No unnecessary multi-currency complexity.** Currency defaults to EUR. The dashboard will not invent a single balance across mixed currencies. Forecast reports EUR. Full FX conversion is out of scope.
- **No premature background-job infrastructure.** Occurrence dates are computed on forecast request.
- **Salary-only scheduled income.** Other recurring income types are a later concern.
- **Fixed recurring-expense amounts.** Variable amounts per occurrence are a later concern.

## Future product direction

The following are **possible later capabilities**. They are **not** implemented and are **not** current requirements:

- goals
- scenarios
- financial resilience analysis
- richer visual analytics
- CSV / import workflows
- insights
- anomaly detection
- ML / predictive capabilities

Any later ML or scoring work would still need an explainable model and a clearer resilience question than “give the user a number.”
