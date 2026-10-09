# Financial Goals

## Status

Accepted

**Revision note.** This decision supersedes the earlier MVP rule that a Goal optionally linked to one Account through `FinancialGoal.account_id` and derived progress from the full `Account.current_balance`. The accepted and implemented domain is `Account → GoalAllocation → Goal`. The application persists GoalAllocation, exposes allocation routes, derives progress from funded amounts, locks the Account row on allocation create and increase, and lets the Goals UI designate Account money.

## Problem

A Financial Goal answers: “What financial objective am I saving for or trying to achieve?”

The household may intend only part of an Account’s money for that objective. The rest may fund other Goals or ordinary spending. Progress toward a Goal must reflect money the household has designated for that objective. It must not treat every euro in a linked Account as belonging to that Goal.

## Superseded limitation

The first Goals MVP associated a Goal with at most one Account (`Goal.account_id`) and derived:

`current_amount = Account.current_balance`

Example: an Account held €20,000 and was linked to Emergency Fund. The product treated the entire €20,000 as Emergency Fund progress. That was incorrect when the same balance was meant for several objectives.

The temporary one-Goal-per-Account unique index only stopped a second Goal from reading the same full balance. It did not express how much of the balance belonged to any one Goal. Migration `f6a7b8c9d0e1` removed that link. It did not copy those links into allocation rows.

## Decision

### Domain purpose

A Financial Goal is a future financial objective with:

- a name
- a positive target amount
- a currency (default EUR)
- an optional target date

A Goal does not own money. It does not store an independent monetary balance. It is not an Account, Transaction, schedule, or Forecast.

Progress and completion are derived readings. They are not persisted on the Goal. There is no persisted `active` or `completed` flag in the MVP.

### Domain model

Funding is `GoalAllocation`:

`Account → GoalAllocation → Goal`

`GoalAllocation` is the source of designated amounts. It designates an amount of existing Account money toward a Goal. It does not create money, does not replace `Account.current_balance`, does not give the Goal its own balance, and does not move or reserve physical money in the Account. It is an application-level designation of money that already exists on the Account.

`FinancialGoal` has no `account_id`. Persisted Goal fields are `name`, `target_amount`, `currency`, optional `target_date`, and `created_at`.

Cardinality:

- An Account may fund zero, one, or many Goals through allocations.
- A Goal may receive allocations from zero, one, or many Accounts.
- An allocation always references exactly one existing Account and exactly one existing Goal.
- At most one allocation row exists for a given `(goal_id, account_id)` pair.

A Goal may exist with no allocations. That Goal remains a valid objective. Progress is unavailable until at least one allocation exists.

Example:

- Account balance = €20,000
- Emergency Fund allocation = €10,000
- House Deposit allocation = €10,000

`Account.current_balance` remains €20,000. Each Goal’s progress is read from its funded allocation amounts, not from the full account balance.

### Invariants

1. `Account.current_balance` remains the single source of truth for actual account money.
2. A Goal never stores an independent monetary balance. Derived fields such as `current_amount`, `progress`, and `completed` are not persisted on FinancialGoal.
3. Goal progress comes from allocations from Accounts, never from treating a whole Account balance as one Goal’s money.
4. Every GoalAllocation references an existing Account and an existing Goal.
5. Money counted toward a Goal comes only from Accounts explicitly selected through that Goal’s allocations.
6. The same money must not be counted twice toward more than one Goal.
7. For every Account, the sum of designated allocation amounts must not exceed available capacity when an allocation is created or increased:

   `SUM(GoalAllocation.amount for that Account) <= max(0, Account.current_balance)`

8. Creating or increasing an allocation designates existing money. It does not increase `Account.current_balance`.
9. Decreasing or deleting an allocation removes a designation. It does not decrease `Account.current_balance`. Allocation writes never modify `Account.current_balance`.
10. The system rejects an allocation create or amount increase that would make the sum of designated amounts for that Account exceed available capacity. The backend check is authoritative. The Goals UI repeats it only as guidance.
11. A Goal may have allocations from multiple Accounts (same currency as the Goal).
12. An Account may have allocations to multiple Goals (within capacity).
13. No GoalAllocation may reference an Account whose currency differs from the Goal’s currency.
14. No FX conversion in the MVP.
15. A Goal with no allocations has unavailable (`null`) current amount, progress, and completion. That is not the same as 0% progress from Accounts.
16. Completion is derived: funded current amount versus target amount.
17. Progress is capped at 100% (`progress` in `[0, 1]`).
18. Negative `Account.current_balance` does not create positive Goal progress. Available capacity is `max(0, current_balance)`. A negative balance funds nothing and cannot back a new positive allocation.
19. GoalAllocation does not move or reserve physical money in the Account.
20. Allocation create, and an allocation amount increase, lock the Account row with PostgreSQL `SELECT … FOR UPDATE` before summing designated amounts. The lock, the capacity check, and the allocation write commit in the same transaction. Reductions and deletes do not take this lock.

### Allocation semantics

Each GoalAllocation stores:

- a surrogate identity (`id`)
- `goal_id`
- `account_id`
- `amount` (positive designated amount)
- `created_at`

`amount` is the user’s designation. It is not a second Account balance, and it is not the funded amount.

**Available capacity** for an Account is `max(0, Account.current_balance)`.

**Designated amount** is the stored `GoalAllocation.amount`. The capacity invariant applies to the sum of designated amounts on an Account.

**Funded amount** of an allocation is computed on read. It is not stored. For one Account, walk allocations in `created_at` ascending, then `id` ascending. Remaining capacity starts at available capacity. Each allocation contributes:

`funded = min(amount, remaining_capacity)`

Then reduce remaining capacity by that funded amount. Any excess of `amount` over funded is unfunded designation. Stored amounts are not rewritten when the Account later has less money than the sum of designations.

**Goal `current_amount`** is the sum of funded amounts across that Goal’s allocations. It is derived at read time. It is not the sum of designated amounts when any allocation is only partly funded.

A Goal whose allocations all exist but are fully unfunded has `current_amount = 0` and `progress = 0`. That is different from a Goal with no allocations (`null` progress).

Amount must be greater than zero. Clearing a designation is a delete of the allocation row, not an amount of zero.

The user may type an allocation amount. The backend enforces currency match, existence of Account and Goal, positivity, uniqueness of `(goal_id, account_id)`, and the capacity invariant on create and increase.

**Concurrency.** Create and increase load the Account with `SELECT … FOR UPDATE`, then sum that Account’s designated amounts, then insert or update the allocation, then commit. A second writer for the same Account waits until that transaction ends, so it cannot pass the check against a stale sum. A missing Account raises the same not-found result as before the lock. Decreasing an amount, or deleting an allocation, does not need the lock: those writes cannot raise the designated sum.

### Currency rules

A Goal has its own currency, defaulting to EUR.

Every Account referenced by an allocation for that Goal must use the same currency as the Goal. No FX conversion.

A Goal with no allocations may keep any currency. Changing a Goal’s currency is rejected while any allocation exists.

The frontend may continue to offer a limited currency list (for example EUR, USD, GBP). That remains a UI constraint, not a domain restriction on Goal or Account currency codes.

### Balance-decrease behaviour

The capacity invariant is enforced when designations are written (create or increase). It is not a physical lock on `Account.current_balance`. The row lock above serializes allocation writes. It does not reserve Account money, and it does not block later balance changes.

If `Account.current_balance` later falls below the sum of designated allocation amounts for that Account, the stored designations remain as entered. They are not auto-reduced. Balance changes are not blocked solely because designations exist. On subsequent reads, funding is applied by the ordered capacity walk above. Earlier allocations keep priority for the remaining capacity.

Example:

- Goal A allocation designated €6,000
- Goal B allocation designated €4,000
- Account later becomes €7,000

Stored amounts stay €6,000 and €4,000. Funded amounts become €6,000 and €1,000 (assuming A was created before B). Goal progress uses the funded amounts. The Goals screen labels the Goal total as Funded and, on an underfunded row, shows Designated and Funded separately.

**Why this option.** Blocking a balance decrease, or auto-shrinking allocations, would make GoalAllocation behave like a reservation of Account money and would invent a write path from Goals into Account state or into other Goals’ designations. The Account remains the source of truth. Transactions and Account balance updates stay free of Goal-owned reservation logic. Soft over-designation with ordered funding preserves the user’s stated intent while still preventing double-counting of the money that still exists.

Decreases and deletes of allocations remain allowed when the Account is already over-designated relative to capacity. Only creates and increases are rejected when they would raise the designated sum above capacity.

Account create stores `current_balance`. Later product paths may change that balance. Transaction writes do not change it, and allocation writes do not change it. The balance-decrease rule is how Goal reads behave when the stored balance is lower than the designated sum.

### Goal progress and completion

When a Goal has one or more allocations:

`current_amount = sum of funded allocation amounts`

`progress = max(0, min(1, current_amount / target_amount))`

`completed = current_amount >= target_amount`

When a Goal has no allocations:

`current_amount`, `progress`, and `completed` are `null` (progress unavailable).

Changing the Goal’s target amount only recalculates progress and completion from funded allocations and the new target. No duplicated balance is stored. Raising the target above the funded amount clears completion; lowering it to or below the funded amount establishes completion.

### Unlinking and moving

There is no `Goal.account_id`. Removing a Goal’s relationship to an Account means deleting that Goal’s allocation for that Account.

Moving a designation from one Account to another is not a single domain operation in the MVP. It is delete of the old allocation plus create of a new allocation on the other Account. Each step is validated for existence, currency, and capacity. There is no move endpoint that bypasses those checks.

### API

Goal identity and allocation identity stay separate.

Goal create and update accept objective fields only: name, target amount, currency, target date. They do not accept `account_id` or nested allocations.

Allocation routes:

- `POST /financial-goals/{goal_id}/allocations` — create a designation
- `PUT /financial-goals/{goal_id}/allocations/{allocation_id}` — change the designated amount
- `DELETE /financial-goals/{goal_id}/allocations/{allocation_id}` — remove the designation

Each of those routes returns the Goal, including allocations and derived progress.

Goal routes are `POST /financial-goals`, `GET /financial-goals`, `GET /financial-goals/{goal_id}`, and `PUT /financial-goals/{goal_id}`. There is no Goal `DELETE`. List order is newest first (`created_at` desc, `id` desc).

Goal `GET` (list and detail) returns the Goal’s objective fields, its allocations (each with stored `amount` and derived `funded_amount`), and the derived `current_amount`, `progress`, and `completed`.

**Why dedicated allocation endpoints.** Embedding allocations only inside Goal `PUT` would force every amount change through a full Goal rewrite, blur objective edits with funding edits, and make partial failures harder to reason about. Allocations are their own resource with their own identity, validation, and lifecycle. Goal `DELETE` remains out of scope; allocation `DELETE` is in scope because removing a designation is a normal funding action, not deletion of the objective.

A surrogate `id` on GoalAllocation supports update, delete, and future auditability. The unique `(goal_id, account_id)` constraint still prevents two designations of the same Account to the same Goal.

Create rejects an unknown Goal or Account, a currency mismatch, a duplicate `(goal_id, account_id)`, a non-positive amount, and a designated sum above capacity. Increase rejects the same capacity failure. Reduce and delete do not re-check capacity. Unknown allocation returns not found.

### Ownership compatibility

The MVP has no User or Household ownership columns. Future ownership must require that a GoalAllocation only connects a Goal and an Account that belong to the same household (or equivalent ownership boundary). Do not put a separate ownership owner on the allocation that can disagree with Goal and Account.

### Implemented scope

- `GoalAllocation` persistence, services, and API.
- `FinancialGoal.account_id` and the one-Goal-per-Account unique index removed.
- Goal progress derived from funded allocations.
- Goal objective create, read, and update (no Goal delete), plus allocation create, update, and delete.
- Currency match and capacity enforced on allocation writes, with an Account row lock on create and increase.
- Many Goals per Account and many Accounts per Goal through allocations.
- Goals stay out of Analysis, Forecast, and Transactions.

### Explicit non-goals

- Do not couple Forecast to GoalAllocation. Future Forecast → Goal work may estimate when a funded Goal could be reached, including confidence or uncertainty. That is separate work.
- Do not introduce `Transaction.goal_id`. Goals are funded by designation of existing Account money, not by tagging transactions.
- Do not store `current_amount`, `progress`, or `completed` on FinancialGoal.
- Do not let allocation writes modify `Account.current_balance`.
- Do not add FX conversion.
- Do not add Goal soft-delete or archive.

### Future evolution

- Forecast projected Goal completion from schedules and funded progress.
- Household or user ownership on Accounts and Goals, with allocation constrained to the same owner.
- Richer funding UX (for example guided split of unallocated balance) without changing these invariants.
- Optional audit history of designation changes.

### Migration

Migration `f6a7b8c9d0e1` (revises `e5f6a7b8c9d0`):

1. Creates `goal_allocations` (surrogate id, `goal_id`, `account_id`, positive `amount`, `created_at`, unique `(goal_id, account_id)`, foreign keys).
2. Drops `financial_goals.account_id` and index `uq_financial_goals_account_id`.
3. Does **not** backfill allocation rows from the old `account_id` link. Copying the whole balance, or `min(balance, target)`, would invent a designation the user never entered. Goals that had a link become objectives with no allocations until the user creates allocations explicitly.
4. Downgrade restores nullable `financial_goals.account_id` and the partial unique index, and drops `goal_allocations`. It does not recreate the old links.

Goal API schemas omit `account_id` on create and update. Responses expose allocations and funded-derived progress. The service does not enforce one Goal per Account and does not set `current_amount` from the full Account balance.

## Consequences

- Progress is a reading of funded Account money. The Account still owns the money. Designated amounts record intent and can exceed a later, lower balance.
- Multiple Goals may share one Account without double-counting the same euros.
- A Goal without allocations remains valid; callers must show that progress is unavailable.
- Over-designation relative to a later lower balance is possible as stored intent; funded progress always respects remaining capacity and ordered funding.
- Allocation delete is allowed; Goal delete remains out of scope.
- Concurrent creates or increases for one Account serialize on that Account row, so the designated-sum invariant holds at commit.
- Dashboard remains a presentation layer ([003](003-dashboard-responsibility.md)). Any later Goal summary there would display these derived facts, not define them.

## Alternatives considered

**Keep `Goal.account_id` and derive progress from the full balance.** Rejected. One Account cannot honestly fund several objectives when each Goal claims the entire balance.

**Store `current_amount` on the Goal.** Rejected. It would duplicate money already owned by Accounts and by designations.

**Persist `completed` and `active`.** Rejected for the MVP. Completion follows funded amount versus target. An active flag adds a lifecycle the product has not required.

**Treat a Goal with no allocations as 0% progress.** Rejected. Zero progress means funded amount is zero against a target. No designations means progress cannot be calculated.

**Block Account balance decreases that would violate designated sums, or auto-reduce allocations.** Rejected. That turns designations into reservations and couples Account money writes to Goal state. Soft over-designation with ordered funding keeps Account as source of truth.

**Check capacity without locking the Account row.** Rejected. Two creates or increases can both read the old designated sum and both commit, so the stored sum exceeds available capacity. `SELECT … FOR UPDATE` on the Account closes that window without changing Account balance or funded-versus-designated rules.

**Embed allocation create/update only inside Goal PUT.** Rejected as the primary boundary. Allocations have their own identity, validation, and delete lifecycle. Dedicated routes keep objective edits separate from funding edits.

**Backfill allocations from old `account_id` using full balance or min(balance, target).** Rejected. The user never chose those amounts as designations.

**Convert currencies when Goal and Account differ.** Rejected. The product does not convert FX elsewhere.

**Tag Transactions with `goal_id` to fund Goals.** Rejected. Goals designate existing Account money; they are not a ledger of tagged events.
