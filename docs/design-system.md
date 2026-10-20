# Personal Finance Platform — design system

This document describes the shared visual tokens, PrimeNG usage, and UI migration status for user-facing routes.

## Design tokens

Tokens live in `frontend/src/styles.scss` under `:root`:

| Token | Purpose |
| --- | --- |
| `--pfp-brand-teal` | Primary accent, focus, positive actions |
| `--pfp-brand-navy` | Headings, primary text emphasis |
| `--pfp-accent-amber` | Highlight accent |
| `--pfp-page-bg` | Application background |
| `--pfp-surface` / `--pfp-surface-muted` | Cards and panels |
| `--pfp-border` | Borders and dividers |
| `--pfp-text` / `--pfp-text-muted` / `--pfp-text-subtle` | Text hierarchy |
| `--pfp-success` / `--pfp-danger` / `--pfp-warning` / `--pfp-info` | Semantic colours |
| `--pfp-money-positive` / `--pfp-money-negative` | Amount emphasis |
| `--pfp-radius-md` / `--pfp-radius-lg` | Corner radius |
| `--pfp-shadow-sm` / `--pfp-shadow-md` | Elevation |
| `--pfp-space-page` | Vertical rhythm between page sections |
| `--pfp-max-content` | Max width for route content |

The PrimeNG theme preset is `frontend/src/app/design-system/pfp-preset.ts`, registered in `app.config.ts` via `providePrimeNG`.

## PrimeNG components

| Component | Typical use |
| --- | --- |
| `p-button` | Actions; preserve test hooks with `styleClass` (`apply-button`, `save-button`, `cancel-button`, etc.) |
| `p-message` | Loading, success, validation, and error feedback (`severity` + `styleClass` such as `status-error`) |
| `p-card` | Major sections; use `styleClass="pfp-panel-card"` |
| `pInputText` | Text and numeric inputs |
| `p-select` | Filters and form dropdowns (with `FormsModule` / `ngModel`) |
| `p-dialog` | Reserved for future modal flows; delete/execution confirms remain inline panels with focus trap |

Layout chrome (menubar, drawer) uses PrimeNG in `personal-finance-layout`.

## Shared CSS

Global rules in `styles.scss` cover page shells (`.pfp-page`, `.accounts-page`, …), filters (`.pfp-filter-panel`, `.filters`), tables (`.data-table`), metrics (`.metric-grid`), form fields (`.field`, `.form-actions`), and analysis/forecast visuals (sparklines, flow bars). Route SCSS files should only hold page-specific layout.

## Route migration status

| Route | Status | Notes |
| --- | --- | --- |
| `/personal_finance` (Dashboard) | Migrated | `p-card` panels, `p-message` status |
| `/personal_finance/accounts` | Migrated | Create form in `p-card`, `p-select` for type/currency |
| `/personal_finance/accounts/:id` | Migrated | Detail in `p-card` |
| `/personal_finance/transactions` | Migrated | Mobile cards retained; delete confirm + focus trap |
| `/personal_finance/schedules` | Migrated | Execution confirm panel retained |
| `/personal_finance/goals` | Migrated | Goal cards as `p-card` |
| `/personal_finance/analysis` | Migrated | Period presets as `p-button`; SCSS trimmed |
| `/personal_finance/forecast` | Migrated | Account/grouping `p-select`; SCSS trimmed |
| `app-date-field` | Migrated | `pInputText` + calendar `p-button` |

Copy-table uses `p-button` with `styleClass="copy-button"`.

## Accessibility

- Keep `role="alert"` / `role="status"` on messages where the previous `<p class="status">` had them.
- Delete and schedule execution confirmations keep `role="alertdialog"`, `aria-modal`, and focus trapping.
- Test selectors rely on `styleClass` on `p-button` (inner native `<button>` carries the class).
