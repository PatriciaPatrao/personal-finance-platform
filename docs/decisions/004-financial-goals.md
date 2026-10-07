# Financial Goals

## Status

Accepted

## Context

The product today answers three questions: current position (`Account.current_balance`), what already happened (Analysis over transactions), and what may happen from scheduled salary and recurring expenses (Forecast). [Product vision](../product-vision.md) lists goals as a possible later capability. They are not implemented. This decision records the domain rules for that capability before any model, API, or screen exists.

Accounts already own money. `Account.current_balance` is a stored signed amount. It is not derived from transactions, and nothing else in the product writes it when recording history or projecting the future. Currency defaults to EUR. The API accepts any 3-character currency code. The Accounts create form’s EUR, USD, and GBP list is a UI constraint, not a domain restriction. There is no FX conversion.

A Financial Goal is a different question from position, history, or forecast. It names an objective and, when a source of money is known, how far that objective has come.

## Decision

### 1. Domain purpose

A Financial Goal represents a future financial objective with:

- a target amount
- an optional target date
- an optional association with an Account

The central question a Goal answers is: “What financial objective am I saving for or trying to achieve?”

Goals are about objectives and progress towards those objectives. They are not accounts, transactions, schedules, or projections. A target date describes the objective. It does not, by itself, complete the Goal or change Account money.

### 2. Account remains the source of truth

A Goal must not store its own current monetary balance.

The Account remains the source of truth for money. When a Goal is associated with an Account:

- current amount is derived from `Account.current_balance`
- progress is derived from the relationship between that current amount and the target amount
- the Goal does not subtract, reserve, transfer, or otherwise modify `Account.current_balance`

Do not introduce a duplicated balance field such as `current_amount` on the Goal. Reading progress must not write the Account.

### 3. Account association is optional

A Goal may exist without an Account. It may later be associated with one.

When no Account is associated, progress is unavailable. That absence must not be represented as 0%. Domain and UI semantics distinguish “no financial source associated” from “0 progress”.

### 4. Progress and completion

When a Goal has an associated Account:

`progress = current_amount / target_amount`

`current_amount` is the associated Account’s `current_balance` at the time of the reading. It is not stored on the Goal.

Visual progress is capped at 100%. If the current amount reaches or exceeds the target amount, the Goal is considered completed, the UI shows it as completed, and progress stays visually capped at 100%.

Completion is derived, not persisted. If the target amount changes later, completion and progress are recalculated from the current Account balance and the new target. There is no stored completion that would survive that change.

### 5. Goal lifecycle

For the MVP, lifecycle is derived from financial state.

There is no separate `active` flag. There is no persisted `completed` flag. Do not introduce `completed` or `active` as persisted Goal fields.

A future lifecycle such as archived or paused may be introduced if the product later requires it. That lifecycle is outside the current MVP.

### 6. Currency

A Goal has its own currency, defaulting to EUR.

If a Goal is associated with an Account, `Goal.currency` must match `Account.currency`. No FX conversion is performed.

If a Goal has no Account, its currency is independent of any Account.

The MVP does not introduce multi-currency conversion. The existing product convention that the frontend may initially expose a limited currency selection stays a UI concern. It is not a domain restriction on Goal currency.

### 7. Multiple Goals per Account

The intended long-term domain is:

- an Account can have zero, one, or many Goals
- a Goal can be associated with an Account

Implementing multiple Goals directly against the same Account would make each Goal derive progress from the full `Account.current_balance`, and the same money would count toward every Goal.

The MVP therefore uses a temporary limit:

> MVP limitation: an Account can be associated with at most one Goal. Goal Allocation will later allow multiple Goals to share the same Account without duplicating account balance.

This is an MVP implementation limitation, not a definitive domain rule. The long-term cardinality remains many Goals for one Account, once allocation exists. A Goal still has at most one Account.

### 8. Future GoalAllocation

The intended future model is:

`Account → GoalAllocation → Goal`

A future `GoalAllocation` designates an amount of existing Account money to a Goal. It does not create money, does not replace `Account.current_balance`, and does not give the Goal its own balance.

Example of that future relationship: an Account whose current balance is €20,000 can designate part of that existing balance to a Goal, such as an Emergency Fund allocation. Progress for that Goal would be read from the allocated amount, not from the full account balance, so another Goal could be associated with the same Account through a different allocation without counting the same euros twice.

GoalAllocation is not part of the MVP. Until it exists, section 7’s one-Goal-per-Account limit is what prevents that double count.

## Consequences

- Goal progress is a reading of Account state, in the same way Analysis totals and Forecast periods are readings rather than stored balances. Changing `Account.current_balance` changes derived progress and completion without a write to the Goal.
- A Goal with no Account remains a valid objective. Callers must be able to show that progress does not apply. They must not coerce that case to zero.
- Completion cannot drift from the numbers. Raising the target above the current amount clears completion; lowering it to or below the current amount establishes completion. Both follow from the same formula.
- The MVP can ship Goals without an allocation table, at the cost of refusing a second Goal on an Account that already has one. That refusal is an implementation limit and should be described as such wherever it is enforced later.
- Associating a Goal with an Account is valid only when the currencies are the same. Mixed-currency progress is out of scope, consistent with the rest of the product.
- Goals do not become an input to Analysis or Forecast, and they do not take ownership of `current_balance` from Accounts.
- Dashboard remains a presentation layer ([003](003-dashboard-responsibility.md)). Any later Goal summary on that screen would display these derived facts, not define them.

## Alternatives considered

**Store `current_amount` on the Goal.** Rejected. It would copy `Account.current_balance` and create a second source of truth for the same money. The Account already owns that figure.

**Persist `completed` and `active`.** Rejected for the MVP. Completion is the comparison of derived current amount and target amount. An active flag would add a lifecycle the product has not asked for. Both flags would go stale when the target or the Account balance changes.

**Treat a Goal with no Account as 0% progress.** Rejected. Zero progress means an associated balance of zero against a target. No associated source means progress cannot be calculated. Those states answer different questions.

**Allow many Goals on one Account in the MVP, each reading the full balance.** Rejected for now. Each Goal would treat the entire balance as its own, so one euro would satisfy several objectives at once. The long-term domain still allows many Goals per Account, through GoalAllocation rather than through a shared full balance.

**Convert currencies when a Goal and an Account differ.** Rejected. The product does not convert FX anywhere else. A Goal linked to an Account uses that Account’s currency. An unlinked Goal keeps its own currency until it is linked, at which point the currencies must already match.
