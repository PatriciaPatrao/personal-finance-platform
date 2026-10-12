# Milestone: Recurring schedules and forecast integration

This document closes the recurring income and recurring expense milestone. It records domain behaviour, validation, automated test coverage, remaining manual checks, and the proposed next milestone (executing scheduled occurrences).

The codebase remains the source of truth. If this document and the code disagree, treat the discrepancy as a documentation bug unless the product intentionally changed.

## Scope delivered

- **Backend:** `incomes` and `recurring_expenses` tables, CRUD-style API (`POST`, `GET`, `PUT`; no DELETE), Pydantic validation, services that do not touch `transactions` or `Account.current_balance`.
- **Forecast:** `GET /forecast` expands **active** schedules into in-memory occurrences via `generate_occurrences`, and returns `projections[]` (per currency) without persisting results. Omit `account_id` for household scope; pass `account_id` for one account. See ADR [002](decisions/002-analysis-vs-forecast.md).
- **Frontend:** `/personal_finance/schedules` lists salary and recurring expenses (active and inactive), create and edit forms, one-click **Deactivate** / **Activate**, and copy-to-clipboard on data tables elsewhere in the app.

## Schedules versus transactions versus forecast

| Concept | Stored? | Changes `Account.current_balance`? | Creates `Transaction` rows? |
| --- | --- | --- | --- |
| Salary schedule (`Income`) | Yes | No | No |
| Recurring expense | Yes | No | No |
| Transaction | Yes | No (MVP) | Yes (it is the event) |
| Forecast period / occurrence | No (computed per request) | No | No |

**Deactivated schedules** remain in the database and in list responses with `active: false`. Forecast skips them. Historical transactions are unchanged.

**Projected balance** is `sum(current_balance)` plus cumulative scheduled net cash flow over the requested range. **Actual balance** is only the stored column on each account.

## Validation rules

### Amount

- Must be **greater than zero**.
- At most **two decimal places** (frontend regex; backend Pydantic `decimal_places=2` on income and recurring-expense write schemas).
- Frontend message on the Schedules form: `Enter a positive amount with at most two decimal places.` (Transactions use the same wording.)

### Dates

- `start_date` ≤ `next_occurrence`.
- When set, `end_date` must be on or after both `start_date` and `next_occurrence`.
- UI dates are DD-MM-YYYY; API uses ISO `YYYY-MM-DD`.

### Other fields

- Recurring expense **description** required (1–255 characters).
- **Account** must exist (`404` with `Account not found` when missing).
- Income has no description field (salary-only model).

### API errors

- **422** — Pydantic validation (zero/negative amount, too many decimals, missing required fields, invalid dates in query params).
- **404** — Unknown schedule id or missing account on update.
- **405** — DELETE on schedules is not implemented (by design).

Rejected writes do not create partial rows and do not alter balances or transactions (covered by automated tests).

## Forecast calculation (review notes)

Implementation: `backend/app/services/forecast.py` and `backend/app/services/occurrence.py`.

1. **Starting balance:** Sum of every account’s `current_balance` (not derived from transactions).
2. **Occurrences:** For each **active** income and recurring expense, `generate_occurrences(next_occurrence, frequency, end_date, from, to, as_of=today)`:
   - Starts stepping from `next_occurrence`.
   - Skips dates before `from`, before `to`, and before `as_of` (today).
   - Stops after inclusive `end_date` when set.
   - Does **not** use `start_date` to generate dates (only validated on write).
3. **Per period:** Income and expenses are summed into buckets (day or month). Net cash flow = income − expenses. **Projected balance** carries forward period by period.

### Observed UI behaviour (€1,500 → €500 salary)

If the ending projected balance fell by **exactly €1,000** (for example €94,150 → €93,150), that matches the implementation when **one** scheduled income occurrence falls in the selected forecast range: reducing the salary amount by €1,000 reduces that period’s income by €1,000 and therefore the ending projected balance by €1,000. If multiple occurrences fall in the range (for example three monthly paydays), the ending balance would drop by €1,000 × (number of occurrences).

To verify in the UI:

1. Note forecast **from**, **to**, and **grouping**.
2. Call `GET /forecast` with the same parameters before and after the edit.
3. Compare `periods[].income` and the last period’s `projected_balance`.

Automated test: `test_forecast_reflects_updated_income_amount` in `backend/tests/test_forecast.py`.

## Automated test coverage (this milestone)

### Backend (pytest)

| Area | Examples |
| --- | --- |
| Income API | CRUD, ordering, date rules, zero/negative/decimal validation, no DELETE |
| Recurring expense API | Same pattern |
| Side effects | Creating/updating income does not add or mutate transactions |
| Deactivation | `active: false` persisted; transactions unchanged |
| Forecast | Active vs inactive, end dates, grouping, starting balance, no DB writes |
| Occurrence helpers | Monthly stepping, `as_of`, inclusive `end_date` |
| **Data integrity** | `test_schedule_data_integrity.py` — balances and transaction ids unchanged across create/update/deactivate/activate; rejected create leaves DB unchanged |

### Frontend (Vitest / `ng test`)

| Area | Examples |
| --- | --- |
| Schedules component | Load, filters, create/edit/deactivate/activate, validation, currency display |
| Forecast / Analysis | HTTP mocked component tests |
| Amount validation | Zero, negative, over-precision on schedule forms |

Run commands (must be executed on each release candidate):

```powershell
cd backend
pytest

cd ..\frontend
npm test -- --watch=false
```

## Manual test 9 — No side effects on transactions or balances

**Goal:** Prove schedule create, edit, deactivate, and activate do not change recorded transactions or stored account balances.

### If you have no baseline from earlier testing

You cannot prove historical equality for past exploratory edits. Run a **new controlled test** on a dedicated account (or after noting current state explicitly).

### Procedure

1. Start API and database. Open `http://127.0.0.1:8000/docs` or use curl.
2. Pick an account id (for example from `GET /accounts`). Record:
   - `GET /accounts/{id}` → `current_balance`
   - `GET /transactions` → count and sorted list of `id` values (or save full JSON).
3. Perform **one** schedule operation (example: `PUT /incomes/{id}` with `active: false`, or edit amount).
4. Repeat step 2.

**Pass criteria:**

- `current_balance` is **identical** (string/decimals equal).
- Transaction **count** and **ids** are **identical**.
- Schedule row reflects the intended change (`active`, `amount`, etc.) via `GET /incomes` or `GET /recurring-expenses`.

Repeat for: create salary, create recurring expense, edit amount, deactivate, activate.

**Automated equivalent:** `backend/tests/test_schedule_data_integrity.py` and existing income/recurring-expense transaction tests.

## Manual test 10 — Invalid form values

| Case | Frontend (Schedules UI) | Backend (bypass UI) |
| --- | --- | --- |
| Zero amount | Save blocked; field error | `POST`/`PUT` → **422**; no new row |
| Negative amount | Save blocked | **422** |
| More than 2 decimal places | Save blocked | **422** |
| Missing account / dates / description | Field errors | **422** or service date errors |

**Bypass frontend:** Send invalid JSON directly to `POST /incomes` or `POST /recurring-expenses`, then confirm `GET /accounts/{id}` and `GET /transactions` unchanged.

**Note:** The Transactions screen already uses the message *Enter a positive amount with at most two decimal places.* Schedules now use the same wording for amount errors.

## Known limitations (unchanged)

- No automatic materialization of occurrences into transactions.
- Forecast sums all accounts and labels currency EUR without FX conversion.
- `account_id` on a schedule filters account-scoped forecast; household forecast includes every active schedule when currencies match.
- `start_date` is not used when generating forecast dates.
- Pagination and indexing deferred.

## Next milestone proposal: Executing recurring occurrences

**Do not implement until this plan is reviewed.** Goal: turn a due schedule occurrence into a **recorded transaction** without duplicating money movement or silently changing balances.

### Product decision required

Choose one primary trigger (or combine explicitly):

1. **Explicit user action** — “Record this occurrence” on Schedules or Transactions (simplest audit trail).
2. **Scheduled job** — daily worker finds due occurrences (needs idempotency and ops).
3. **Hybrid** — job proposes, user confirms (not in initial execution slice unless required).

Recommendation for MVP **after** this milestone: start with **explicit user action** or a **manual “Run due schedules for date D”** admin endpoint, because there is no job infrastructure today (`docs/architecture.md` §11). Add a background worker only when unattended execution is a firm requirement.

### Domain concepts to add

| Concept | Purpose |
| --- | --- |
| **Schedule occurrence identity** | Stable key: `(source_type, source_id, occurrence_date)` where `source_type` ∈ `income` \| `recurring_expense`. |
| **Execution record** | Row proving an occurrence was materialized (links to `transaction_id`, timestamp, status). |
| **Materialized transaction** | Normal `Transaction` row (`occurred_on` = occurrence date, amount from schedule, type income/expense, description/category from schedule). |

### Idempotency and concurrency

- **Unique constraint** on `(source_type, source_id, occurrence_date)` in an `schedule_executions` (name TBD) table.
- **Transaction creation** inside a DB transaction: insert execution row → insert transaction; rollback on conflict.
- **Retries:** Second attempt for the same occurrence returns existing transaction (409 or 200 with same body), never a second transaction.
- **Concurrent requests:** Row-level lock on execution insert or `ON CONFLICT DO NOTHING` + fetch existing.

### Balance consistency (MVP tension)

Today, **transactions do not update `current_balance`**. Execution must follow the same rule until a deliberate “balance follows transactions” milestone exists. Otherwise:

- Option A: Execution only creates transactions (consistent with current MVP).
- Option B: Execution creates transactions **and** updates `current_balance` (requires a single documented rule and migration of user expectations).

The plan should pick one and test it; mixing rules would break audit clarity.

### Handling edge cases

| Case | Behaviour |
| --- | --- |
| **Missed occurrence** | User or job passes `as_of`; generate occurrences ≤ `as_of` not yet executed; optionally cap backlog. |
| **End date passed** | No new executions after inclusive end. |
| **Deactivated schedule** | No execution; existing execution rows remain historical. |
| **Edit amount after execution** | Past executions immutable; future occurrences use new amount. |
| **Failure mid-flight** | DB transaction rolls back; no partial execution row. |

### Forecast transition

After execution, the occurrence is **historical** (transaction) and should **not** double-count in forecast. Options:

- Forecast excludes dates on or before `as_of` that already have an execution record for that schedule; or
- Forecast always projects from schedules, and Analysis shows actuals — product must define whether forecast is “pure schedule” or “schedule minus executed”. Prefer **subtract executed occurrences** for the same `(source, date)` to avoid double counting.

### Likely implementation steps (future)

1. Alembic migration: `schedule_executions` (+ optional `execution_status`).
2. Service: `execute_occurrence(source, date)` with idempotency.
3. API: `POST /incomes/{id}/executions` or batch `POST /schedule-executions/run?date=`.
4. Frontend: action on schedule card or post-execution indicator.
5. Tests: idempotency, concurrency simulation, no balance change (or defined balance change), forecast adjustment rules.
6. Documentation update in README and this file.

### Out of scope for execution milestone v1

- Multi-currency execution rules.
- Goal allocation side effects.
- Automatic balance reconciliation from all historical transactions.

---

**Milestone status:** Implementation complete pending your manual test 9 run on your environment. Automated suites must pass on each candidate build before merge.
