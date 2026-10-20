# Staging UAT checklist

Manual checks for client delivery. **Automated tests (`CI=true npm test`, backend pytest) do not replace this list** unless a row explicitly says otherwise.

**Legend**

| Column | Meaning |
| --- | --- |
| **Staging/API** | Yes — needs a running API and browser (or HTTP client). No — UI-only or code review. |
| **Status** | Leave blank until executed on staging; do not mark pass without running the steps. |

## 1. Account create and balance display

| Step | Expected result | Staging/API | Status |
| --- | --- | --- | --- |
| Open `/personal_finance/accounts`, create an account with opening balance `100.00`. | Account appears in the list with balance `100.00` in the chosen currency. | Yes | |
| Open `/personal_finance/accounts/:id`. | Detail shows the same stored balance (read-only). | Yes | |
| Open Dashboard. | Current position includes the new account total for that currency only (no cross-currency sum). | Yes | |

## 2. Transactions and balance consistency

| Step | Expected result | Staging/API | Status |
| --- | --- | --- | --- |
| Record an expense on the account; note balance on Accounts. | Balance decreases by the expense amount. | Yes | |
| Edit the transaction amount (non schedule-linked). | Balance updates to reflect the change atomically. | Yes | |
| Delete a manual transaction. | Balance reverses the transaction effect. | Yes | |
| Attempt edit/delete on a schedule-linked transaction. | UI hides actions; API returns 409 if forced. | Yes | |

## 3. Schedule create and execute once

| Step | Expected result | Staging/API | Status |
| --- | --- | --- | --- |
| Create active monthly schedule with `next_occurrence` equal to API **current domain date** (`GET /health` → `current_domain_date`). | Schedule lists; execute control enabled when date matches server date. | Yes | |
| Confirm and execute the occurrence once. | 201 (or 200 on idempotent replay); transaction created; balance updated. | Yes | |
| Execute the same occurrence again. | 200 idempotent replay; no duplicate balance movement. | Yes | |

## 4. Forecast exclusion and linked-transaction rules

| Step | Expected result | Staging/API | Status |
| --- | --- | --- | --- |
| After execution, open Forecast for a range including the executed date. | Executed occurrence not double-counted; `next_occurrence` advanced on schedule. | Yes | |
| On Transactions, locate the linked row. | Edit/delete unavailable. | Yes | |

## 5. Forecast scope and multi-currency

| Step | Expected result | Staging/API | Status |
| --- | --- | --- | --- |
| Household forecast with one currency. | One projection; amounts in that currency. | Yes | |
| Household forecast with EUR and USD accounts. | Separate projections per currency; no combined total or FX. | Yes | |
| Select a single account on Forecast. | One projection for that account’s currency only. | Yes | |

## 6. Analysis date presets

| Step | Expected result | Staging/API | Status |
| --- | --- | --- | --- |
| Open Analysis; apply **This month**. | From = first day of current month, to = domain today; data loads. | Yes | |
| Apply **Last month**. | Full previous calendar month (first through last day); data matches range. | Yes | |
| Enter a future **To** date and apply. | Validation error; no request with future `to`. | Yes | |

## 7. Goals and allocations

| Step | Expected result | Staging/API | Status |
| --- | --- | --- | --- |
| Create a goal with target amount and currency. | Goal listed; progress unavailable until allocation. | Yes | |
| Add allocation within available account capacity. | Funded/progress update from API; account balance unchanged. | Yes | |
| Attempt allocation above available capacity. | Client validation or API 422; no partial persist. | Yes | |

## 8. Loading, empty, validation, and API errors

| Step | Expected result | Staging/API | Status |
| --- | --- | --- | --- |
| Dashboard with no accounts. | Empty position copy; signals unavailable message. | Yes | |
| Stop API; reload Dashboard. | Error messages per failed section; no fabricated balances or signals. | Yes | |
| Submit invalid form (empty amount, bad date). | Field-level errors; no silent success. | Yes | |

## 9. Mobile layout and keyboard

| Step | Expected result | Staging/API | Status |
| --- | --- | --- | --- |
| Narrow viewport: open mobile nav, follow a link, close drawer. | Focus returns to menu trigger; routes work. | Yes | |
| Tab through a form and confirmation dialog. | Visible focus; Escape closes confirmations where implemented. | Yes | |
| Transactions list on narrow width. | Card layout usable; filters reachable. | Yes | |

## Automated baseline (not UAT)

Run before each release candidate:

- `CI=true npm test` (frontend)
- `NG_APP_API_BASE_URL=<staging-api> npm run build` (frontend production build)
- Backend pytest (including `test_health`, schedule execution, goals)
- `git diff --check`

These verify regressions covered in code; they **do not** certify staging behaviour until the tables above are executed against a live environment.
