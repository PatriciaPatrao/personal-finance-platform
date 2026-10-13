# Schedule occurrence execution

## Status

Accepted

## Context

Recurring salary (`incomes`) and recurring expenses (`recurring_expenses`) are **schedule definitions**. They belong to an `accounts` row through `account_id`. Forecast expands active schedules into in-memory occurrence dates via `generate_occurrences` in `app.services.occurrence` and never writes to the database (`ForecastService`, ADR [002](002-analysis-vs-forecast.md)).

Recorded history lives in `transactions` (`occurred_on`, `transaction_type`, `amount`, optional `description` and `category`). Today, `TransactionService.create` persists a row and does **not** update `Account.current_balance` (`TransactionRepository.create` commits without touching `accounts`).

The architecture audit for occurrence execution concluded that materializing a schedule occurrence requires:

- a persisted **idempotency** record so retries and concurrent requests cannot create duplicate transactions;
- **one database transaction** wrapping execution registration, transaction creation, and balance update;
- **Forecast read-path exclusion** of executed occurrences so schedules and transactions are not double-counted in projections.

This ADR records **approved product decisions** and the architectural rules implementation must follow. It does not repeat the full audit.

## Problem

Users need to turn one projected schedule occurrence into a real financial event: a stored `Transaction`, an updated stored balance, and a durable record that the occurrence was executed—without batch jobs, without silent balance changes on schedule CRUD, and without breaking read-only Forecast.

## Approved product decisions

1. **Account balance.** On successful execution, update `Account.current_balance` **atomically** in the same database transaction as the execution record and the new `Transaction`. Balance effects follow schedule type: income increases balance, expense decreases balance (same sign convention as Analysis aggregates over `TransactionType`).

2. **Execution mode.** **Explicit user action** only. **One occurrence per HTTP request.** No background worker and no batch “run all due” in this MVP.

3. **Past occurrences.** **Overdue-occurrence recovery is deferred.** This MVP does not implement catch-up execution for dates before today.

4. **Deletion.** **Direct deletion** of transactions created through schedule execution is **prohibited**. Corrections use a future explicit **cancellation/reversal** process (see below).

5. **Scope.** Each request executes **at most one** occurrence. Requests succeed or fail **independently**.

6. **Editing.** **Direct editing** of executed transactions is **prohibited**. Corrections use cancellation/reversal and, where appropriate, a **new** execution.

## Decision

### 1. Execution records and idempotency

Introduce a persisted **`schedule_executions`** table (name as implemented in Alembic) whose purpose is to record that a **specific schedule occurrence** was materialized exactly once.

**Occurrence identity** (logical key):

`(source_type, source_id, occurrence_date)`

- **`source_type`** distinguishes which schedule table the row refers to: recurring **income** (`incomes`) versus **recurring expense** (`recurring_expenses`). Income and expense primary keys are independent sequences; the type disambiguates `source_id`.
- **`source_id`** is the integer primary key of the schedule row (`incomes.id` or `recurring_expenses.id`).
- **`occurrence_date`** is the calendar date of the schedule occurrence being executed (ISO date, same domain notion as dates emitted by `generate_occurrences`).

This identity is **independent of HTTP retries**: the same tuple must map to at most one execution row and one linked transaction.

**Required database guarantees:**

- **`UNIQUE (source_type, source_id, occurrence_date)`** — prevents duplicate execution rows; concurrent inserts must fail or resolve to the existing row.
- **`transaction_id`** — `NOT NULL`, references `transactions.id`. Enforce **at most one execution per transaction** (e.g. `UNIQUE (transaction_id)`).
- Referential integrity to schedules is enforced in application logic: validate that `source_id` exists in the table implied by `source_type`, and that the schedule’s `account_id` matches the account used for the transaction and balance update. PostgreSQL cannot express a single polymorphic FK to both `incomes` and `recurring_expenses` without two nullable FK columns or a shared supertype; the MVP may use `(source_type, source_id)` plus service validation, consistent with existing separate schedule models.

**Idempotent API behaviour:**

- First successful request: insert execution, insert transaction, update balance, commit.
- Retry or concurrent request for the same identity: must **not** create a second transaction or second balance movement; return the **existing** execution and transaction (HTTP semantics chosen at implementation time, e.g. 200 with same body).

Application-level checks (schedule active, date eligible) complement but **do not replace** the unique constraint.

### 2. Atomic financial updates

`Account.current_balance` remains the **stored position** for Dashboard, Forecast starting balance, and Goal allocation capacity (`FinancialGoalService._available_capacity` uses `max(0, account.current_balance)`).

For this milestone, **system-initiated balance changes** on execution are approved. Schedule create/update/deactivate must still **not** create transactions or change balances (existing invariant in `IncomeService` / `RecurringExpenseService` and schedule data-integrity tests).

Within **one SQLAlchemy session and one commit**, execution must:

1. Insert `schedule_executions` (or detect unique violation for idempotent completion path).
2. Insert `transactions` with:
   - `account_id` = schedule’s `account_id`;
   - `amount` = schedule’s `amount` at execution time;
   - `transaction_type` = `income` or `expense` matching the schedule kind;
   - `occurred_on` = **`occurrence_date`** (occurrence date and transaction date are the same for materialized occurrences);
   - for recurring expenses: `description` and `category` from the schedule; income has no description field on the schedule model.
3. Update the **`accounts`** row for that `account_id`: apply the signed delta once (income adds, expense subtracts), using the same money precision rules as elsewhere (`Numeric(12, 2)`).

**Failure at any step rolls back everything** — no orphan execution, transaction, or balance change.

**Double-update prevention (implementation constraints):**

- Execution must **not** call `TransactionRepository.create` as it exists today if that method commits independently; balance update and transaction insert must share the execution unit of work (single commit), as the audit noted for repositories that commit per method.
- Execution must apply the balance delta **exactly once** per successful identity.
- Manual `POST /transactions` (non-execution) remains unchanged in this milestone unless a separate decision harmonizes all transaction writes with balance—**out of scope here**. Product copy and tests must reflect that only **execution** (and account opening balance on create) moves stored balance today.

**Future cancellation/reversal** (not implemented in execution MVP):

- Must **preserve** original execution and transaction rows (no hard delete of history).
- Must apply the **inverse balance delta exactly once** per cancellation.
- Must be **idempotent** (cannot cancel twice).
- Must restore Forecast consistency (executed occurrence treated as not pending again only if product rules say so—typically cancellation marks execution as reversed and Forecast exclusion rules follow the reversal table; detail belongs in the cancellation ADR/milestone).

Cancellation/reversal is a **separate implementation milestone after execution MVP**. It is **not** a prerequisite to ship execution, but execution must **not** allow DELETE/PUT on linked transactions that would bypass those future rules.

### 3. Forecast consistency

Forecast stays **read-only** (no writes, no materialization during `GET /forecast`).

When aggregating schedule amounts (`ForecastService._accumulate_schedule_amounts` / `generate_occurrences`), **skip** any occurrence date for which a `schedule_executions` row exists for the same `(source_type, source_id, occurrence_date)`.

- **Authoritative for actual movements:** persisted `transactions` (Analysis).
- **Authoritative for not-yet-executed schedule cash flow:** active schedules minus executed keys above, plus stored `current_balance` as today.

Do not sum across currencies; preserve household `projections[]` and account scope behaviour (ADR 002).

### 4. Eligibility and dates (MVP)

- Execution is **user-initiated** only (API + UI action per occurrence).
- **`occurrence_date`** must denote an occurrence that the schedule **could** produce under the same recurrence rules as Forecast (`next_occurrence`, `frequency`, inclusive `end_date`, stepping via `next_after` / `add_months`). Validation should reuse shared occurrence logic, not ad hoc dates.
- Schedule must be **`active: true`** at execution time.
- **`occurrence_date` must not be before today** (`date.today()` in the API’s timezone policy—today the codebase uses `date.today()` for Forecast `as_of`). This implements “no overdue recovery” in MVP.
- **`occurrence_date` after inclusive `end_date`** is ineligible when `end_date` is set.

**Open question (blocks exact validation spec):** The codebase does not define an upper bound on how far in the future a user may execute (Forecast `to_date` is a query parameter, not a schedule limit). Implementation must either reuse “occurrence appears in `generate_occurrences` for `[today, occurrence_date]`” or document an explicit maximum forward window in a follow-up decision.

**Semantics:** For executed materializations, **`occurrence_date` equals `Transaction.occurred_on`**. That aligns Analysis historical buckets with the schedule date the user executed.

### 5. Cancellation, deletion, and editing

**Execution MVP:**

- Prohibit **DELETE** and **PUT** on transactions linked from `schedule_executions` (API enforcement when implemented).
- The Transactions UI must not offer edit/delete for those rows, or must route corrections to the future reversal flow.

**Future cancellation/reversal milestone** (principles only):

- Append-only history: original transaction and execution remain queryable.
- One reversal record per execution (unique constraint parallel to execution idempotency).
- Single inverse balance adjustment.
- Forecast treats reversed executions according to rules defined in that milestone (typically: occurrence becomes pending again in Forecast if reversal voids materialization).
- A **corrected** amount requires reversal plus either a new manual transaction policy or a new execution after schedule edit—product detail deferred.

### 6. Error handling and consistency

| Situation | Expected behaviour |
| --- | --- |
| Duplicate request (same identity) | DB unique constraint + idempotent read of existing row; no second balance delta |
| Concurrent duplicate | Same; one winner, others resolve to existing |
| Validation failure (inactive, ineligible date, off-grid) | No DB changes; 4xx |
| Already executed | Same as duplicate (idempotent success or 409 with existing resource—pick one convention and test it) |
| DB failure mid-unit-of-work | Full rollback |
| Client timeout after commit | Retry safe via unique identity |

Distinguish **database-enforced** idempotency (unique index) from **application** eligibility checks (active, date window, grid membership).

## Domain invariants

1. Schedule CRUD (create, update, activate, deactivate) never creates transactions or changes `current_balance`.
2. At most one execution and one materialization transaction per `(source_type, source_id, occurrence_date)`.
3. Successful execution updates `current_balance` exactly once by the schedule amount with correct sign.
4. Forecast never double-counts an executed occurrence in schedule aggregation.
5. Execution never mixes currencies: schedule, transaction, and balance update stay on the schedule’s `account_id` / `Account.currency`.
6. `generate_occurrences` recurrence rules (`next_occurrence`, frequency, inclusive `end_date`, `as_of` for Forecast) remain unchanged except for read-path exclusion of executed keys.
7. Linked transactions are immutable via normal transaction DELETE/PUT until cancellation exists.

## Alternatives considered

(From the pre-implementation audit; not re-evaluated in this task.)

- **Execution without balance update** — rejected by approved product decision (balance updates on execute).
- **Batch/worker execution** — rejected for MVP (no job infrastructure; explicit user action only).
- **Idempotency only in application code** — rejected; unique constraint required.
- **Storing execution metadata only on `transactions`** — rejected for MVP; dedicated execution row clarifies immutability and Forecast exclusion without overloading user-editable transaction rows.
- **Advancing `next_occurrence` on execute** — not approved; Forecast and eligibility continue to use stored schedule fields plus execution registry.

## Consequences and trade-offs

- Stored balance **aligns with executed schedule events** but may still **diverge** from the sum of all transactions while manual transaction CRUD does not adjust balance.
- Goal allocation capacity will reflect execution-driven balance changes; designation limits must remain correct under concurrent execution (consider row lock on `accounts` during execution, as allocations use `FOR UPDATE`).
- Demo seed and docs that state “transactions never change balance” require updates wherever execution is enabled.
- Repositories that commit per method must be bypassed or extended for the execution unit of work.
- Multi-currency rules unchanged: execute within one account currency; Forecast projections stay per currency.

## Explicitly deferred

- Overdue / backdated occurrence recovery (`occurrence_date` before today).
- Batch or scheduled automatic execution.
- Cancellation/reversal implementation (separate milestone).
- Harmonizing manual transaction CRUD with balance updates.
- FX or cross-account execution.

## Unresolved questions and impact

| Question | Impact |
| --- | --- |
| Maximum forward execution date | Without a rule, validators must define testable eligibility (e.g. must appear in generated occurrences from `today` through `occurrence_date`). |
| HTTP status for idempotent replay (200 vs 201 vs 409) | Affects client and tests only if chosen consistently. |
| Polymorphic FK shape for `schedule_executions` | Migration design; service validation is mandatory either way. |
| Whether reversal re-opens Forecast occurrence | Deferred to cancellation milestone. |
| Manual transactions vs “system-maintained balance” long term | UX and reconciliation; not blocking schema + execution path if MVP documents the split. |

## Implementation acceptance criteria

1. Alembic migration adds `schedule_executions` with **`UNIQUE (source_type, source_id, occurrence_date)`** and **`UNIQUE (transaction_id)`**, FK to `transactions.id`.
2. One service method performs execution with **single commit**; failure rolls back execution, transaction, and balance.
3. Idempotent retry and concurrent duplicate produce **one** transaction and **one** balance change.
4. `GET /forecast` excludes executed `(source_type, source_id, occurrence_date)` from schedule totals; no Forecast writes.
5. Ineligible requests (inactive, before today, off-grid, after `end_date`) produce no persistence.
6. Linked transactions reject DELETE/PUT via API (execution MVP).
7. Schedule writes still pass existing data-integrity tests (no side effects).
8. Tests cover income and expense execution, idempotency, concurrency (where feasible), forecast before/after, balance delta, multi-currency isolation at account/forecast scope, and inactive schedule rejection.

## Related documents

- [002-analysis-vs-forecast.md](002-analysis-vs-forecast.md) — Forecast read model; updated for execution exclusion.
- [004-financial-goals.md](004-financial-goals.md) — `current_balance` as capacity input; execution changes balance without changing allocation rows.
- [../architecture.md](../architecture.md) — module boundaries and data ownership.
- [../milestone-recurring-schedules.md](../milestone-recurring-schedules.md) — schedule milestone and execution roadmap.
