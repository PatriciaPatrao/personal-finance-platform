# Schedule occurrence execution

## Status

Accepted

**Revision note (contract finalisation).** This revision adds two confirmed product decisions: (1) **system-maintained `Account.current_balance` for every effective financial transaction** (manual and schedule-generated), with atomic create/update/delete; (2) **execution eligibility** requires `occurrence_date` to equal the application **current domain date** (no early or late execution in MVP). It supersedes earlier ADR 005 wording that left manual transaction CRUD without balance updates and that allowed an open forward execution window.

## Context

Recurring salary (`incomes`) and recurring expenses (`recurring_expenses`) are **schedule definitions**. They belong to an `accounts` row through `account_id`. Forecast expands active schedules into in-memory occurrence dates via `generate_occurrences` in `app.services.occurrence` and never writes to the database (`ForecastService`, ADR [002](002-analysis-vs-forecast.md)).

Recorded history lives in `transactions` (`occurred_on`, `transaction_type`, `amount`, optional `description` and `category`).

**Implementation status:** Manual transaction CRUD and schedule execution update `Account.current_balance` atomically via `TransactionService` (`persist_new_with_balance` / update / delete). Execution is exposed as `POST /incomes/{id}/executions` and `POST /recurring-expenses/{id}/executions`. Idempotent replay returns **200**; first success returns **201**. Current domain date is `app.services.domain_date.current_domain_date()` (`date.today()`), shared by Forecast `as_of` and execution eligibility.

The architecture audit concluded that materializing a schedule occurrence requires persisted idempotency, one database transaction wrapping execution + transaction + balance, and Forecast read-path exclusion of executed occurrences.

## Problem

Users need to turn one projected schedule occurrence into a real financial event: a stored `Transaction`, an updated stored balance, and a durable record that the occurrence was executed—without batch jobs, without silent balance changes on schedule CRUD, and without breaking read-only Forecast. Stored balances must stay consistent with **all** effective transactions, not only those from schedules.

## Approved product decisions

1. **System-maintained account balance.** `Account.current_balance` is maintained **exclusively by the system**. Every **effective** financial transaction (manual income, manual expense, and schedule-generated transaction) must update the corresponding account balance **exactly once**, in the **same database transaction** as the transaction row write. Failure rolls back both. Schedule execution must **reuse** shared transaction and balance logic; it must **not** apply a separate balance path that could double-count.

2. **Execution mode.** **Explicit user action** only. **One occurrence per HTTP request.** No background worker and no batch execution in this MVP.

3. **Occurrence eligibility (date).** An occurrence may be executed **only when** `occurrence_date` **equals** the application **current domain date**. Future dates cannot be executed early. Past dates cannot be recovered in this MVP. No configurable overdue-recovery window.

4. **Deletion (schedule-generated).** **Direct deletion** of transactions linked from `schedule_executions` is **prohibited**. Corrections use a future explicit **cancellation/reversal** process.

5. **Scope.** Each request executes **at most one** occurrence. Requests succeed or fail **independently**.

6. **Editing (schedule-generated).** **Direct editing** of execution-linked transactions is **prohibited**. Corrections use cancellation/reversal and, where appropriate, a **new** execution after schedule correction.

7. **Preserved from prior acceptance:** `schedule_executions` idempotency; atomic execution unit of work; Forecast exclusion of executed occurrences; read-only Forecast; cancellation/reversal as a **separate milestone** (not part of execution MVP).

## Decision

### 1. Execution records and idempotency

Introduce a persisted **`schedule_executions`** table (name as implemented in Alembic) recording that a **specific schedule occurrence** was materialized exactly once.

**Occurrence identity** (logical key):

`(source_type, source_id, occurrence_date)`

- **`source_type`** distinguishes recurring **income** (`incomes`) versus **recurring expense** (`recurring_expenses`).
- **`source_id`** is the integer primary key of the schedule row (`incomes.id` or `recurring_expenses.id`).
- **`occurrence_date`** is the calendar date of the occurrence being executed (same notion as dates from `generate_occurrences`).

**Required database guarantees:**

- **`UNIQUE (source_type, source_id, occurrence_date)`** — at most one execution row; concurrent inserts fail or resolve to the existing row.
- **`transaction_id`** — `NOT NULL`, references `transactions.id`, with **at most one execution per transaction** (e.g. `UNIQUE (transaction_id)`).
- Schedule existence and `account_id` consistency enforced in application logic (separate `incomes` / `recurring_expenses` models; no polymorphic FK in current schema).

**Idempotent API behaviour:** Retries and concurrent requests for the same identity must **not** create a second transaction or second balance movement; return the existing execution and transaction (exact HTTP status chosen at implementation).

### 2. System-maintained balance and atomic financial updates

#### Balance invariant (all effective transactions)

For every persisted transaction that represents an effective movement on an account:

- **Create:** apply signed delta to `accounts.current_balance` for `transaction.account_id` — income **adds** `amount`, expense **subtracts** `amount` (consistent with `TransactionType` and Analysis aggregation).
- **Update:** reverse the **old** row’s balance effect, then apply the **new** row’s effect (same session, one commit).
- **Delete:** reverse the row’s balance effect (same session, one commit).

Manual CRUD and schedule execution **share** this logic. Schedule execution **must not** call a balance updater in addition to a transaction creator that already applies the delta.

**Exceptions (unchanged domain conventions):**

- **Account create** may set an initial `current_balance` without a transaction (opening position on `POST /accounts`).
- **Schedule CRUD** (income/recurring expense create/update/activate/deactivate) still does **not** create transactions or change balances.
- **Goal allocation** writes still do **not** modify `current_balance` (ADR [004](004-financial-goals.md)).

#### Schedule execution unit of work

Within **one SQLAlchemy session and one commit**, execution must:

1. Validate eligibility (§4).
2. Insert `schedule_executions` (or handle unique violation for idempotent completion).
3. Create the `transactions` row through the **same shared path** that applies the balance delta once, with:
   - `account_id` = schedule’s `account_id`;
   - `amount` = schedule’s `amount` at execution time;
   - `transaction_type` = income or expense matching schedule kind;
   - `occurred_on` = `occurrence_date`;
   - recurring expense: `description` and `category` from schedule.
4. Link `schedule_executions.transaction_id` to the new transaction.

**Failure at any step rolls back everything.**

#### Double-update prevention

- Execution must **not** use today’s `TransactionRepository.create` as-is if it commits independently and skips balance.
- Execution must **not** apply balance delta both inside shared transaction create **and** again in execution-specific code.

#### Future cancellation/reversal (separate milestone)

- Preserve original execution and transaction rows.
- Apply inverse balance delta **exactly once** per cancellation; idempotent cancellation.
- Forecast consistency rules defined in that milestone.
- Execution MVP blocks DELETE/PUT on execution-linked transactions via API.

### 3. Forecast consistency

Forecast stays **read-only**.

When aggregating schedule amounts (`ForecastService._accumulate_schedule_amounts` / `generate_occurrences`), **skip** occurrence dates that have a `schedule_executions` row for the same `(source_type, source_id, occurrence_date)`.

- **Analysis:** persisted `transactions`.
- **Forecast pending schedule flow:** active schedules minus executed keys, starting from stored `current_balance` (which reflects executed and manual transactions after implementation).

Preserve per-currency `projections[]` and account scope (ADR 002). No FX.

### 4. Eligibility and dates (MVP)

**Current domain date:** The calendar date used as **`as_of`** in Forecast (`ForecastService.get_forecast`, default `date.today()` when not injected). Execution eligibility must use the **same definition** so occurrence generation and execution stay aligned. Tests may inject a fixed “today” the same way forecast tests use known dates.

**Execution is allowed only when all hold:**

| Rule | Detail |
| --- | --- |
| User-initiated | Explicit API/UI action; one occurrence per request |
| **Date equality** | `occurrence_date == current_domain_date` |
| Active schedule | `active` is true on the schedule row |
| On recurrence grid | Date is reachable from the schedule’s `next_occurrence`, `frequency`, and inclusive `end_date` under the same stepping rules as `generate_occurrences` / `next_after` |
| End date | If `end_date` is set, `occurrence_date` must not be after inclusive `end_date` |

**Rejected for MVP:** `occurrence_date` before current domain date (no overdue recovery). **`occurrence_date` after** current domain date (no early execution). Arbitrary forward windows or configurable recovery periods.

**Semantics:** For materialized occurrences, **`occurrence_date` equals `Transaction.occurred_on`**, and both equal **current domain date** at execution time.

**Compatibility with Forecast:** Forecast includes generated occurrences where `occurrence_date >= as_of`. On the current domain date only, an occurrence may appear in Forecast **and** be eligible for execution until executed; after execution, Forecast excludes it via `schedule_executions`.

### 5. Cancellation, deletion, and editing

**Execution MVP:** Reject DELETE and PUT on transactions referenced by `schedule_executions`. Manual DELETE/PUT remain available for **non-linked** transactions and must use the shared balance rules in §2.

**Cancellation/reversal:** Separate milestone; not required to ship execution.

### 6. Error handling and consistency

| Situation | Expected behaviour |
| --- | --- |
| Duplicate request (same execution identity) | Unique constraint; idempotent response; **no** second balance delta |
| Concurrent duplicate | Same |
| `occurrence_date` ≠ current domain date | No persistence; 4xx |
| Inactive, off-grid, or after `end_date` | No persistence; 4xx |
| Already executed | Same as duplicate |
| DB failure mid-unit-of-work | Full rollback |
| Client timeout after commit | Retry safe via unique identity |

**Database-enforced:** unique execution identity. **Application-enforced:** date equality, active, grid membership.

## Domain invariants

1. Schedule CRUD never creates transactions or changes `current_balance`.
2. Every effective transaction create/update/delete changes `current_balance` exactly once per committed operation (shared rules).
3. At most one execution and one materialization transaction per `(source_type, source_id, occurrence_date)`.
4. Schedule execution does not apply balance effects outside the shared transaction path.
5. Forecast never double-counts executed occurrences in schedule aggregation.
6. Execution stays on the schedule’s `account_id` / currency; no cross-currency effects.
7. Execution-linked transactions are not editable or deletable via normal transaction API until cancellation exists.
8. `generate_occurrences` recurrence rules unchanged except Forecast read-path exclusion of executed keys.

## Minimum implementation changes (code — not part of this task)

Documentation-only list of what the codebase must change to meet this ADR:

| Area | Change |
| --- | --- |
| `TransactionService` / repository | Single unit of work: insert/update/delete transaction **and** apply balance delta; **one commit** per API operation |
| Shared balance helper | Centralise signed delta from `TransactionType` + `amount`; reverse on update/delete |
| Repository commits | Refactor or add flush-only methods so execution and manual paths do not commit mid-flight |
| `ScheduleExecutionService` (new) | Orchestrate execution row + call shared transaction create; **no** extra balance call |
| Forecast service | Read `schedule_executions` (or equivalent query) when aggregating schedules |
| Transaction API | Reject PUT/DELETE when row linked from `schedule_executions` |
| Alembic | Add `schedule_executions` with uniqueness as in §1 |
| Tests | Extend transaction tests for balance on create/update/delete; keep schedule data-integrity tests; add execution, idempotency, date equality, forecast exclusion |
| Docs / seed / UI copy | Align README and screens with system-maintained balance; revisit demo seed where balance and transactions were independent |

**Current gap:** `backend/app/services/transaction.py` and `backend/app/repositories/transaction.py` do not implement §2 today. Implementation must close that gap **before or together with** schedule execution so execution never doubles balance updates.

## Alternatives considered

(From pre-implementation audit; not re-evaluated here.)

- Execution without balance update — rejected.
- Balance update on execution only, manual CRUD unchanged — **rejected** by system-maintained balance decision.
- Batch/worker execution — rejected for MVP.
- Idempotency without unique constraint — rejected.
- Execution metadata only on `transactions` — rejected for MVP.
- Advancing `next_occurrence` on execute — not approved.
- Forward execution window or overdue recovery — **rejected**; only `occurrence_date == current_domain_date`.

## Consequences and trade-offs

- Stored balance tracks cumulative transaction effects; Analysis totals and balance moves align when implementation is complete.
- Goal allocation capacity (`max(0, current_balance)`) reflects transaction and execution activity; concurrent execution and allocation may need account row locking (allocations already use `FOR UPDATE`).
- Demo seed and historical docs that treated balance and transactions as independent require reconciliation when implementing.
- Transaction update/delete semantics become financially significant; tests and UI must reflect balance changes.
- Multi-currency rules unchanged.

## Explicitly deferred

- Overdue / backdated execution (`occurrence_date` before current domain date).
- Early execution (`occurrence_date` after current domain date).
- Batch or automatic execution.
- Cancellation/reversal implementation.
- FX or cross-account execution.

## Unresolved implementation details

| Detail | Impact |
| --- | --- |
| HTTP status for idempotent execution replay | **Resolved:** 201 created, 200 idempotent replay |
| Exact `schedule_executions` column and enum names | Migration; must match §1 constraints |
| Polymorphic schedule reference in DB | Service validation required either way |
| Forecast after future reversal | Cancellation milestone |
| Timezone for `current_domain_date` | Today code uses `date.today()` server local; document or centralise if product requires UTC |

These do **not** reopen approved product decisions.

## Implementation acceptance criteria

1. Manual `POST` / `PUT` / `DELETE` `/transactions` update `current_balance` atomically with the transaction row (create/update/delete rules in §2).
2. Alembic adds `schedule_executions` with **`UNIQUE (source_type, source_id, occurrence_date)`** and **`UNIQUE (transaction_id)`**, FK to `transactions.id`.
3. Schedule execution: single commit; shared transaction+balance create; idempotent retry and concurrency safe.
4. Execution rejected unless `occurrence_date == current_domain_date` and other §4 rules pass.
5. `GET /forecast` excludes executed keys; no Forecast writes.
6. PUT/DELETE rejected for execution-linked transactions.
7. Schedule writes still produce no transaction or balance side effects.
8. Tests cover manual balance effects, execution, idempotency, date equality, forecast exclusion, inactive schedule, multi-currency account isolation.

## Related documents

- [002-analysis-vs-forecast.md](002-analysis-vs-forecast.md)
- [004-financial-goals.md](004-financial-goals.md)
- [../architecture.md](../architecture.md)
- [../milestone-recurring-schedules.md](../milestone-recurring-schedules.md)
