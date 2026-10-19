# Milestone: Recurring schedules and forecast integration

This document closes the recurring income and recurring expense milestone and records schedule **occurrence execution** as delivered under ADR [005](decisions/005-schedule-execution.md). It covers domain behaviour, validation, automated test coverage, and remaining manual checks.

The codebase remains the source of truth. If this document and the code disagree, treat the discrepancy as a documentation bug unless the product intentionally changed.

## Scope delivered

- **Backend:** `incomes` and `recurring_expenses` tables, CRUD-style API (`POST`, `GET`, `PUT`; no DELETE), Pydantic validation, services that do not touch `transactions` or `Account.current_balance`.
- **Forecast:** `GET /forecast` expands **active** schedules into in-memory occurrences via `generate_occurrences`, and returns `projections[]` (per currency) without persisting results. Omit `account_id` for household scope; pass `account_id` for one account. See ADR [002](decisions/002-analysis-vs-forecast.md).
- **Frontend:** `/personal_finance/schedules` lists salary and recurring expenses (active and inactive), create and edit forms, one-click **Deactivate** / **Activate**, **Execute occurrence** for active schedules (today’s date only), and copy-to-clipboard on data tables elsewhere in the app.

## Schedules versus transactions versus forecast

| Concept | Stored? | Changes `Account.current_balance`? | Creates `Transaction` rows? |
| --- | --- | --- | --- |
| Salary schedule (`Income`) | Yes | No | No |
| Recurring expense | Yes | No | No |
| Transaction | Yes | Yes (ADR 005 — system-maintained) | Yes (it is the event) |
| Schedule execution | Yes | Yes (via linked transaction) | Yes (creates transaction + execution row) |
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
| **Schedule execution** | `test_schedule_execution.py` — eligibility, idempotency, balance updates, forecast exclusion, guards on execution-linked transactions |

### Frontend (Vitest / `ng test`)

| Area | Examples |
| --- | --- |
| Schedules component | Load, filters, create/edit/deactivate/activate, execute occurrence (success, idempotent replay, errors, duplicate-submit guard), validation, currency display |
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

## Known limitations

- Occurrences materialize only through explicit user action (Schedules UI or execution API); no worker or batch execution (ADR 005).
- Household forecast returns one projection per currency; no FX conversion (ADR 002).
- `account_id` on a schedule filters account-scoped forecast.
- `start_date` is not used when generating forecast dates.
- Pagination and indexing deferred.

## Schedule occurrence execution (delivered)

**Status:** **Implemented** per [005-schedule-execution.md](decisions/005-schedule-execution.md): backend API, `schedule_executions` migration, system-maintained balance on execution, Forecast exclusion, Angular execute UI on Schedules. Cancellation/reversal and batch/background execution remain deferred.

Summary of accepted behaviour:

| Topic | Decision |
| --- | --- |
| Trigger | Explicit user action; **one occurrence per request**; no worker or batch |
| Balance | **System-maintained** `current_balance` for **all** effective transactions (manual + execution), one atomic DB transaction per write; execution reuses shared transaction logic |
| Eligibility | `occurrence_date` **must equal** current domain date (same as Forecast `as_of`); no early or late execution |
| Idempotency | `schedule_executions` with **`UNIQUE (source_type, source_id, occurrence_date)`** |
| Forecast | Read-only; **exclude** executed occurrences from schedule aggregation |
| Corrections | No DELETE/PUT on execution-linked transactions; **cancellation/reversal** is a **later milestone** |

Implementation order and acceptance criteria are listed in ADR 005.

---

**Milestone status:** **Closed** for recurring schedules and schedule occurrence execution (ADR 005). Recurring-schedule manual test 9 remains a useful environment check but is not a merge blocker. **Deferred:** cancellation/reversal, batch/background execution.
