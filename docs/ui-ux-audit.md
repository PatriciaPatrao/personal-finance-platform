# UI/UX audit and Dashboard redesign proposal

**Phase:** Diagnostic and planning only (no application code changes).  
**Date:** 19 October 2026  
**Branch inspected:** `dev` at commit `addc461` (working tree clean at audit start).  
**Product framing:** Financial Health — Household Financial Resilience Platform ([product-vision.md](product-vision.md)).

---

## 1. Executive summary and overall assessment

The application delivers the intended **separation of concerns** (Dashboard as orientation, Analysis as history, Forecast as scheduled projection, Goals as objectives). Recent Dashboard work (`91a7fc2` — trustworthy baseline dashboard) improved currency-safe totals, explainable signals, attention items, and contextual primary actions. The interface is **honest about data limits** (multi-currency suppression, schedule-linked transaction immutability, null goal progress).

Overall UX maturity is **early MVP**: a coherent **visual language** is emerging (monochrome, card panels, tabular numerals) but it lives as **duplicated SCSS per route**, not as shared tokens or components. There is **no charting layer**; Analysis and Forecast rely on tables, which suits accessibility but limits scan speed for trends.

**Primary gaps relative to the product vision:**

1. The Dashboard answers “what is my position?” reasonably well but **under-serves “what is coming next?”** — schedule data is partially loaded for primary-action logic yet not surfaced as upcoming commitments.
2. **Multi-currency households** see position split correctly but lose **all** Dashboard signals because analysis/forecast requests are skipped entirely, even though the APIs return **per-currency** structures that could be shown without cross-currency aggregation.
3. **Navigation and page chrome** (generic document title, flat nav on mobile, Transactions last in nav order) weaken orientation and discoverability.
4. **Information density** on data-heavy routes (Transactions, Schedules) will strain mobile without horizontal scroll patterns or column prioritisation (verified loading states; full populated table layout partially verified).

**Recommendation:** Proceed with a **phased UI refactor** starting with design tokens and Dashboard information architecture, then align core routes. Do not add new dependencies; extend the existing SCSS + standalone component approach.

---

## 2. Repository and environment inspected

| Item | Finding |
| --- | --- |
| Git branch | `dev`, up to date with `origin/dev`, clean working tree at audit start |
| Latest commits | `addc461` (analysis tests), `40e688c` (multi-currency analysis), `351d7f7` (dashboard/goals), `b51c403` (transactions form), `91a7fc2` (baseline dashboard) |
| Backend | FastAPI on `http://127.0.0.1:8000` — reachable during audit (`GET /health` → 200) |
| Frontend | Angular 21 on `http://localhost:4200` — reachable during audit |
| Browser automation | Cursor IDE browser MCP — used for live inspection |
| E2E suite | None in repository ([architecture.md](architecture.md) §9) |
| Test baselines (run during audit) | Backend: **228** tests collected (`pytest --collect-only`). Frontend: **266** tests passed (`CI=true npm test`) |
| Local data | Development database with 19 accounts (EUR + USD), demo transactions, goals, schedules — **not** pristine seed-only data |

**Screenshot evidence (session captures, not committed to repo):**

- `audit-dashboard-desktop-1440.png` — Dashboard, multi-currency position + suppressed signals
- `audit-dashboard-tablet-768.png` — Dashboard, tablet width
- `audit-dashboard-mobile-390.png` — Dashboard goals section, mobile
- `audit-analysis-mobile-390.png` — Analysis filters, mobile
- Live navigation also visited: `/personal_finance/schedules`, `/personal_finance/transactions`

---

## 3. Routes and components audited

| Route | Component | Key supporting modules |
| --- | --- | --- |
| `/personal_finance` | `PersonalFinance` | `financial-signals.ts`, `dashboard-attention.ts`, `dashboard-primary-action.ts` |
| `/personal_finance/accounts` | `Accounts` | `AccountService`, `CopyTable` |
| `/personal_finance/accounts/:id` | `AccountDetail` | Read-only detail |
| `/personal_finance/transactions` | `Transactions` | `DateField`, schedule-linked flag handling |
| `/personal_finance/schedules` | `Schedules` | Income/recurring services, execution panel |
| `/personal_finance/goals` | `Goals` | Allocations, progress display |
| `/personal_finance/analysis` | `Analysis` | `by_currency`, `currencies[]` API shapes |
| `/personal_finance/forecast` | `Forecast` | `projections[]`, account scope filter |
| Shell | `PersonalFinanceLayout` | Global nav in `personal-finance-layout.html` |

**UI libraries:** No Angular Material, PrimeNG, or Tailwind in dependencies. Styling is **component-scoped SCSS** plus minimal global `styles.scss`. Shared widgets: `DateField`, `CopyTable`.

**Accepted ADRs reviewed:** [001 modular monolith](decisions/001-modular-monolith.md), [002 Analysis vs Forecast](decisions/002-analysis-vs-forecast.md), [003 Dashboard responsibility](decisions/003-dashboard-responsibility.md), [004 Financial Goals](decisions/004-financial-goals.md), [005 Schedule execution](decisions/005-schedule-execution.md).

---

## 4. Findings (ranked by severity)

Severity reflects user impact on financial comprehension, trust, and task completion. Effort is implementation effort for a later phase.

### Critical

| ID | Area | Evidence | Current behaviour | Problem | Recommendation | Expected benefit | Effort | Dependencies | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UX-001 | Accessibility | `frontend/src/index.html` (`<title>Frontend</title>`); browser tab on all routes | Document title is generic “Frontend” | Users with many tabs, screen reader session overview, and bookmarks cannot identify the app or current screen | Set route-aware titles (e.g. “Dashboard — Personal Finance Platform”) via Angular `Title` service in layout or per route | Faster orientation and WCAG 2.4.2 (Page Titled) improvement | Small | None | Each main route exposes a unique, descriptive `<title>`; manual check in browser |
| UX-002 | Dashboard | `personal-finance.ts` `loadDashboard()` when `signalsSuppressed` | If accounts use more than one currency, Dashboard **does not call** `/analysis/summary` or `/forecast` | Households with legitimate multi-currency setups get **no** cash-flow or projection signals on the home screen, despite APIs returning **separate currency blocks** (`by_currency[]`, `projections[]`) | Load analysis/forecast when multi-currency; render **one signal group per currency** using existing helpers extended to pick matching blocks (no cross-currency maths) | Multi-currency users regain explainable insights without unsafe totals | Medium | Product sign-off on per-currency signal copy; extend `financial-signals.ts` | With EUR+USD accounts, Dashboard shows separate EUR and USD signal sections; no combined totals; unit tests for multi-block summary |
| UX-003 | Dashboard | Live Dashboard (multi-currency DB); `projectionForFinancialSignals` requires `projections.length === 1` | User sees only aggregate balances; no forward-looking cue on home | Fails product question **“What commitments are coming next?”** | Add **Upcoming commitments** section: list active schedules with `next_occurrence` within forecast window (data already fetched in `loadSupportingContext()` — extend to expose next N occurrences with amount, account, currency) | Users see imminent salary/expenses without opening Schedules/Forecast | Medium | None (read-only schedule fields) | Section lists only active schedules; dates and amounts match Schedules page; empty state when none |

### High

| ID | Area | Evidence | Current behaviour | Problem | Recommendation | Expected benefit | Effort | Dependencies | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UX-004 | Navigation | `personal-finance-layout.html` — 7 links, no mobile pattern | Nav wraps to multiple rows on narrow viewports (verified ~390px) | Core routes compete for space; **Transactions** (high-frequency) is last; no skip link | Introduce compact nav: priority order **Dashboard → Transactions → Accounts → Schedules → Forecast → Analysis → Goals**; add skip-to-main link; optional collapsible menu ≤768px | Faster access to recording and review tasks | Medium | Design tokens for nav | At 390px width, all routes reachable without horizontal overflow; logical focus order |
| UX-005 | Dashboard | `personal-finance.html` quick links — no Analysis | Quick access omits **Analysis** though signals link there | Historical context is de-emphasised vs Forecast | Add Analysis to quick access; order by decision workflow (position → attention → upcoming → signals → goals → links) | Parity with README/architecture link list | Small | None | Analysis link present and routes correctly |
| UX-006 | Dashboard | `dashboard-attention.ts` — goals below target always flagged | Any goal with `progress < 1` generates attention, including 0% with funding | Noise when many goals are intentionally in progress | Differentiate **“not started”** (null progress) vs **“in progress”** vs **“at risk”** (optional: underfunded allocation only) | Attention list stays actionable | Small | Product copy | Attention items use distinct titles for null vs partial progress |
| UX-007 | Accounts | API + Accounts table — many rows named “Savings” | List distinguishes only by balance/type | Users cannot tell accounts apart when names duplicate | Show **id**, **created date**, or last-four naming hint in list and Dashboard account labels | Safer account selection in forms | Medium | Product decision on displaying internal id | Account list unique per row in UI when names collide |
| UX-008 | Transactions | `transactions.html` — 7-column table | Wide table on desktop; mobile not fully verified populated | Horizontal scan difficulty; touch targets for row actions unverified at scale | Responsive pattern: card list on narrow viewports OR sticky first column + hide description | Mobile review of history | Medium | None | At 390px, no required horizontal pan for primary columns |
| UX-009 | Schedules | `schedules.html` execution panel — direct `Execute occurrence` button | No confirmation step before POST | Accidental execution risk (mitigated by `executingKey` disable, not by confirm) | Add confirm dialog summarising amount, account, date; keep idempotent API | Fewer mistaken ledger entries | Small | Reuse dialog pattern from transaction delete | Confirm required before POST; disabled while executing |
| UX-010 | Design System | Duplicated `.page-header`, `.filters`, `.status-*` across `*.scss` | Same rules copied in ≥6 files | Drift risk; inconsistent spacing on change | Extract shared partials or CSS variables in `styles.scss` (tokens §9) | Consistent UI with one change point | Medium | Phase 1 foundation | Visual regression unchanged; single token source |
| UX-011 | Analysis | `analysis.html` — cash flow as tables only | No visual trend encoding | Harder to spot period spikes | Optional simple bar/sparkline **per currency** using CSS (no new chart library) or emphasise latest period row | Quicker historical reading | Large | Product approval for minimal chart | Chart/table numerically identical to API |
| UX-012 | Forecast | Colour classes `net-income-positive/negative` | Semantic net income uses colour | Partial reliance on colour for sign (supplemented by numbers) | Add explicit “+/−” or “Surplus/Deficit” text label adjacent to coloured metric | Colour-blind safe comprehension | Small | None | Text label present when colour class applied |

### Medium

| ID | Area | Evidence | Current behaviour | Problem | Recommendation | Expected benefit | Effort | Dependencies | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UX-013 | Dashboard | Hero shows currency totals only | No account breakdown or link “View N accounts” | User cannot drill into composition without leaving | Add secondary line: account count + link to Accounts filtered/sorted | Faster validation of totals | Small | None | Link navigates to Accounts; count matches API |
| UX-014 | Dashboard | Primary action defaults to “Record transaction” when schedules not due | Contextual schedule action only when `next_occurrence === today` | Misses **upcoming** (not just today) schedule review | Tie primary action to nearest `next_occurrence` within 7 days → Review schedules | Aligns CTA with commitments | Small | UX-003 | Primary action label updates when occurrence within window |
| UX-015 | Dashboard | Long `page-intro` on every visit | Explanatory paragraph always expanded | Pushes actionable content down on mobile | Collapse to “About this page” disclosure after first visit (localStorage) or shorten default copy | More above-the-fold space | Small | Copy review | Intro collapsible; full text still available |
| UX-016 | Goals | Dashboard + Goals — duplicate underfunded messages | Same allocation warning on Dashboard card and attention list | Redundant noise | Show underfunded detail **once** (prefer Needs attention) on Dashboard | Cleaner goals panel | Small | None | No duplicate allocation warning in both places |
| UX-017 | Goals | Product docs vs API cardinality | Multiple goals and allocations per account supported | MVP wording implied simpler model | Document only in audit — **product decision** (see §12) | Avoid wrong future UI constraints | — | Product | N/A (decision) |
| UX-018 | Transactions | Delete uses `role="alertdialog"` without focus trap | Focus may remain behind dialog | WCAG focus management gap | Trap focus, return on close, `aria-modal="true"` | Keyboard-safe destructive action | Medium | Shared dialog component | Tab cycles within dialog only |
| UX-019 | Schedules | Long `page-intro` on Schedules | Dense policy text before actions | Cognitive load before task | Move execution rules to collapsible “How execution works” | Faster path to Execute | Small | Copy from ADR 005 | Rules accessible in one disclosure |
| UX-020 | Forecast | Period tables only | Similar to Analysis | Long horizon hard to scan | Highlight current month row; sticky period header on scroll | Easier projection reading | Medium | None | Current period visually distinct |
| UX-021 | Accounts | No edit/delete | Read-only except create | Correct functionally but easy to miss | Persistent info callout: “Accounts cannot be edited yet” near create | Prevents false affordances | Small | None | Callout visible on list page |
| UX-022 | Navigation | `routerLinkActive` underline only | Active state subtle | Weak location cue | Add background pill or left border for active route | Clearer wayfinding | Small | Tokens | Active route distinct in contrast check |
| UX-023 | Design System | `lang="en"` in index | UK English in docs, en in HTML | Minor locale inconsistency | Set `lang="en-GB"` if UI copy standardised to UK English | Screen reader pronunciation | Small | Copy audit | lang attribute matches copy standard |

### Low

| ID | Area | Evidence | Current behaviour | Problem | Recommendation | Expected benefit | Effort | Dependencies | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UX-024 | Dashboard | `Financial signals` panel always rendered when single currency | Large panel for quiet state | Vertical scroll on mobile | Collapse quiet signals to single line with expand | Reduced scroll | Small | None | Quiet state ≤2 lines default |
| UX-025 | CopyTable | Icon-only copy button with aria-label | Good label | No visible text | Optional “Copy table” text on wide screens | Discoverability | Small | None | Visible text or tooltip on focus |
| UX-026 | Brand | Layout title “Personal Finance Platform” plain text | Not aligned with resilience positioning | Weak product identity | Subtitle tagline under brand (one line from product vision) | Reinforces purpose | Small | Product copy | Tagline visible in header |
| UX-027 | Analysis | Default range current month | Good | — | Add preset chips: “This month”, “Last month” | Fewer date entry errors | Medium | None | Presets apply valid ranges |
| UX-028 | Transactions | Income/expense colour classes | Green/red not verified for contrast | Possible contrast failure | Verify `#` pairs against WCAG AA; adjust tokens | Accessible differentiation | Small | Token phase | Contrast ratio ≥4.5:1 for text |
| UX-029 | Dashboard | Goals list shows all goals equally | No sort by nearness to target | Long list on dashboard | Sort by incomplete first, then highest progress | Prioritised objectives | Small | None | Sort order documented in component |
| UX-030 | Accessibility | No automated a11y scan run | Manual snapshot only | Unknown violations | Add axe-core in CI for static templates (implementation phase) | Regression detection | Medium | CI | axe job reports zero critical |

---

## 5. Dashboard redesign proposal

### 5.A Recommended information architecture

**Purpose order (decision-first):**

1. **Page header** — H1 “Dashboard”, one-line orientation, **primary action** (contextual CTA).
2. **Current financial position** — Dominant numeric hierarchy; per-currency cards when needed; explicit “stored balances, not forecast”.
3. **Needs attention** — Only when items exist; negative balances, underfunded allocations, material goal gaps (refined rules UX-006).
4. **Upcoming commitments** *(new)* — Next scheduled inflows/outflows by date (from schedules already loaded); link to Schedules and Forecast.
5. **Financial signals** — Per-currency groups when multi-currency (UX-002); quiet state compact (UX-024).
6. **Goals** — Compact cards (top 3–5) + “Manage goals”.
7. **Quick access** — Full nav subset including **Analysis** (UX-005).

**Above the fold (desktop ~1440×900, populated household):** Header + primary action + position hero + at least one of {attention, upcoming} without scrolling.

**Mobile (~390×844):** Single column; primary action full width (already in `personal-finance.scss`); upcoming commitments before signals; quick access as wrapped chips (keep).

### 5.B Component-level changes

| Component / section | Action | Problem | Proposed content & states |
| --- | --- | --- | --- |
| `PersonalFinance` shell | Modify | Missing forward view | Orchestrate new upcoming section; per-currency signal loading |
| Current position (`hero`) | Modify | Totals only | Currency cards with account count + CTA to Accounts |
| Needs attention | Keep / refine | Over-broad goal flags | Tighter rules; dedupe with goal cards (UX-016) |
| Upcoming commitments | **Add** | Not on Dashboard | List `{date, type, description, amount, currency, account}` sorted by date; empty: “No active schedules in the next …” |
| Financial signals | Modify | Suppressed multi-currency | Render `#currency` subsections; loading/error independent per currency where feasible |
| Goals panel | Modify | Duplication / length | Top N goals; link for rest |
| Quick access | Modify | Missing Analysis | Seven links ordered by workflow |
| `dashboard-primary-action.ts` | Modify | Today-only schedule CTA | Widen eligibility window (UX-014) without bypassing execution rules |
| `financial-signals.ts` | Modify | Single-block only | `deriveFinancialSignalsForCurrency(block, projection)` — no new metrics |

**Loading / error / empty:** Retain independent request failure messages (ADR 003). Never show `0` for failed loads. Multi-currency: never imply one household total.

**Accessibility:** Landmarks: `main`, `nav` with `aria-label="Primary"`, sections with `aria-labelledby` (already partially present). Progress bars keep `role="progressbar"`. Upcoming list uses `<ul>`/`<li>` with headings.

### 5.C Visual direction

| Token | Proposed value | Usage |
| --- | --- | --- |
| `--color-text` | `#222` | Body (existing) |
| `--color-text-muted` | `#555` | Intro, captions |
| `--color-border` | `#d8d8d8` | Cards, tables |
| `--color-surface` | `#fafafa` | Hero, filters |
| `--color-danger` | `#7a1f1f` on `#f8ecec` | Errors (existing) |
| `--color-success` | TBD (contrast-checked) | Success banners |
| `--font-family` | `system-ui, sans-serif` | Keep |
| `--space-section` | `1.5rem` | Section gap (existing) |
| `--radius-none` | `0` | Keep sharp financial aesthetic |

**Typography hierarchy:** H1 1.75rem / 650; section H2 1.15rem; financial hero 2rem tabular nums; labels 0.8rem uppercase tracking.

**Components:** Standardise **primary** (filled `#222`), **secondary** (outline), **destructive** (red outline), **status banners** (loading/error/success/unavailable).

**Charts:** Prefer CSS-based micro-visualisation before adding libraries. Tables remain source of truth for accessibility.

### 5.D Before-and-after specification

| Area | Current issue | Proposed replacement |
| --- | --- | --- |
| Multi-currency home | User sees €86,917.40 + $5,000.00 and a grey box: signals unavailable (verified live) | Two currency columns under position; below, **EUR signals** and **USD signals** from respective API blocks; banner: “Totals are never combined across currencies.” |
| Forward visibility | User must open Schedules or Forecast for next salary/rent | **Upcoming commitments** table: next 5 active schedule occurrences with DD-MM-YYYY, amount in account currency, link “Review on Schedules” |
| Quick access | Five links, no Analysis | Seven links including Analysis, ordered Dashboard → Transactions → … |
| Page title | Browser tab “Frontend” | “Dashboard — Personal Finance Platform” (and analogues) |

Developer anchors: `frontend/src/app/personal-finance/personal-finance.html`, `.ts`, `financial-signals.ts`, `dashboard-attention.ts`, `dashboard-primary-action.ts`, `personal-finance-layout.html`, `index.html`.

---

## 6. Responsive audit results

| Viewport | Routes inspected | Observations |
| --- | --- | --- |
| 1440×900 (desktop) | Dashboard | Content max-width 56rem centred; comfortable spacing; primary action right-aligned in header row |
| 768×1024 (tablet) | Dashboard | Nav wraps to two rows; no horizontal overflow detected |
| 390×844 (mobile) | Dashboard, Analysis | `scrollWidth === clientWidth` (390) — **no horizontal overflow** on Analysis filters; Dashboard primary action full width; nav links wrap — **long nav consumes vertical space** (UX-004) |

**Tables / forms:** Populated Transactions and Schedules tables at mobile width were **not fully verified** in browser (loading/scroll timing); code review indicates wide tables without responsive breakpoints (UX-008 risk).

**Charts:** N/A — no canvas/SVG charts in app (only icons in `DateField`, `CopyTable`).

---

## 7. Accessibility findings and limitations

### Verified (manual / snapshot)

- Section headings use logical H1 → H2 → H3 in Dashboard template.
- Several regions use `aria-labelledby`; loading states use `aria-live="polite"`.
- Errors use `role="alert"`.
- Goal progress exposes `role="progressbar"` with `aria-valuenow`.
- Date field calendar button has `aria-label` (“Open calendar for …”).
- Copy table button has `aria-label`.
- `:focus-visible` outlines on primary links and nav (Dashboard SCSS, layout SCSS).
- `prefers-reduced-motion: reduce` on progress fill transition.

### Not verified / limitations

- **No** axe/Lighthouse automated run in this phase.
- **No** full keyboard-only walkthrough of all routes.
- **No** screen reader (NVDA/VoiceOver) session.
- Dialog focus trap **not** verified for transaction delete or date calendar (`role="dialog"` on calendar without full modal pattern).
- Colour contrast for income/expense row colours **not** instrumentally measured (UX-028).
- WCAG **compliance not claimed** — items above are candidate fixes.

---

## 8. Empty, loading, error and multi-currency states

| State | Verification method | Result |
| --- | --- | --- |
| Normal populated | Live Dashboard | Position + goals + suppressed signals (multi-currency) |
| Multi-currency | Live + code | Separate totals; signals skipped in code (`signalsSuppressed`) |
| Goals, no allocations | Live | “Unavailable — no designated funding yet.” |
| Loading | Live | Sequential “Loading …” banners per section |
| No accounts | Unit tests (`personal-finance.spec.ts`) | Empty position copy; primary action Create account — **not live verified** |
| Single-currency signals | Unit tests (`financial-signals.spec.ts`, dashboard spec) | **Not live verified** (local DB always multi-currency) |
| Analysis API failure | Component logic | Error banner; does not fabricate zeros — **not live verified** |
| Partial dashboard failure | ADR 003 + component code | Independent sections — **not live verified** |
| Schedule execution eligible today | Code + schedules template | Execute disabled unless date === domain today — **not live verified** (no occurrence due on audit date) |
| Negative balance attention | Code | Would list in attention — **not live verified** (no negative balance in spot-check accounts) |
| Completed goals | Goals template | Badge on Goals page — **not live verified** on Dashboard |
| Empty analysis range | Analysis template empty states | **Code review only** |
| Transaction schedule-linked | `transactions.html` | “From schedule execution” — **live table not awaited** |

---

## 9. Design-system recommendations

**Current state:** Emergent **informal system** — repeated patterns across `analysis.scss`, `transactions.scss`, `accounts.scss`, `forecast.scss`, `goals.scss`, `schedules.scss`, and `personal-finance.scss`. Global `styles.scss` only resets body margin/font.

**Recommendation:** Introduce a small **token layer** in `styles.scss` (CSS custom properties) and optional `_ui-patterns.scss` imported by components — **without** new npm dependencies. Reuse existing class names where possible (`.status-error`, `.data-table`, `.field-label`).

**Do not** adopt Angular Material solely for buttons/forms — the app is lightweight and consistent enough to extend SCSS.

**Shared components to consider (implementation phase):**

- `PageHeader` (title + intro)
- `StatusBanner` (loading/error/success)
- `FilterBar` (date fields + apply)
- `CurrencyMetricGrid` (Analysis/Forecast/Dashboard)

---

## 10. Phased implementation roadmap

### Phase 1 — Foundation

- **Scope:** CSS tokens, shared status/button/table patterns, `Title` service, skip link, nav `aria-label`, contrast fix for amount colours.
- **Components:** `styles.scss`, `personal-finance-layout.*`, global index title strategy.
- **Dependencies:** None.
- **Effort:** Medium (1–2 dev days).
- **Acceptance:** Visual parity on Dashboard; tokens documented; UX-001 closed.
- **Tests:** Existing 266 frontend tests pass; add title service tests.
- **Invariants:** No API or financial logic changes.

### Phase 2 — Dashboard structure

- **Scope:** IA reorder, quick access fix, compact intro, position hero tweaks.
- **Components:** `personal-finance.html/scss`, `dashboard-primary-action.ts`.
- **Dependencies:** Phase 1 tokens.
- **Effort:** Medium.
- **Acceptance:** Order matches §5.A; Analysis in quick access; mobile above-the-fold review.
- **Tests:** Update `personal-finance.spec.ts` for new order/links.

### Phase 3 — Dashboard data components

- **Scope:** Upcoming commitments; per-currency signals (UX-002); attention refinements.
- **Components:** New `dashboard-upcoming.ts` (pure functions), extend `financial-signals.ts`, `personal-finance.ts` load logic.
- **Dependencies:** Phase 2 layout slots.
- **Effort:** Medium–Large.
- **Acceptance:** Multi-currency signals without combined totals; upcoming list matches schedule API; no execution bypass.
- **Tests:** New unit tests for upcoming sort/filter; multi-currency signal cases.

### Phase 4 — Core route consistency

- **Scope:** Accounts disambiguation, Transactions responsive layout, Schedules confirm execute, Goals dedupe on Dashboard.
- **Effort:** Large.
- **Acceptance:** UX-007–009, UX-016, UX-018 addressed.
- **Invariants:** Schedule execution still domain-date only; linked transactions still read-only.

### Phase 5 — Forecast & Analysis visualisation

- **Scope:** Table emphasis, optional CSS sparkline, Forecast period highlight.
- **Effort:** Medium.
- **Acceptance:** Numeric parity with API; `by_currency` / `currencies[]` unchanged.

### Phase 6 — Responsive & accessibility refinement

- **Scope:** Mobile nav, keyboard/dialog audits, optional axe in CI.
- **Effort:** Medium.
- **Acceptance:** Manual keyboard pass on all routes; no horizontal overflow on Transactions at 390px.

**Prioritisation:** Phases 1–3 deliver the most product vision uplift. Phases 4–6 can parallelise after Phase 1.

---

## 11. Acceptance criteria and regression-testing strategy (implementation phase)

- Run **backend** `pytest` (228 tests) and **frontend** `CI=true npm test` (266 tests) before merge.
- Add/update component tests for Dashboard IA, multi-currency signals, upcoming commitments.
- Manual browser checks at **1440, 768, 390** on Dashboard, Transactions, Schedules.
- Keyboard: Tab through nav → main → primary action → section links.
- Multi-currency visual check: never one total line mixing € and $.
- Loading/error: disconnect API — sections show errors, not zero balances.
- Schedule execution: confirm dialog → still only today eligible (422 otherwise).
- Production build: `npm run build` with valid `NG_APP_API_BASE_URL`.
- `git diff --check` before commit.

Backend regression tests only if implementation accidentally touches Python (this UI plan should not).

---

## 12. Items requiring product decisions

1. **Goal cardinality messaging** — API allows many goals and cross-account allocations ([004](decisions/004-financial-goals.md)); simplify UI copy or enforce display limits?
2. **Dashboard goal attention rules** — Should every below-target goal appear, or only those with target dates / underfunded allocations?
3. **Upcoming commitments window** — How many days ahead (7, 14, through forecast default range)?
4. **Per-currency Dashboard signals** — Confirm copy when EUR and USD show separate signal lists side-by-side.
5. **Account disambiguation** — Show internal id, created date, or prompt rename policy (no rename API yet)?
6. **Schedule execution confirmation** — Mandatory confirm vs optional “don’t ask again”.
7. **UK English** — Formalise `en-GB` vs `en` for UI strings.

---

## 13. Areas that could not be verified

- Single-currency Dashboard with directional signals (live data always mixed EUR/USD).
- Empty account and zero-transaction households (live DB populated).
- API failure and partial-failure UI (no fault injection run).
- Negative balance and completed-goal Dashboard attention (no matching live records spotted).
- Schedule **Execute occurrence** success/failure flow on audit date (no eligible occurrence today).
- Full populated Transactions/Schedules/Forecast table layout at mobile width.
- WCAG contrast and automated accessibility tooling.
- Income/expense colour semantics contrast ratios.
- Analysis populated multi-currency summary blocks (page reached loading/apply; full table screenshot not captured after load in this session).

---

## Appendix A — Functional invariants (preserved in all UI work)

1. `Account.current_balance` is system-maintained.  
2. Effective transaction operations update balances consistently.  
3. Schedule CRUD does not alter balances.  
4. Schedule execution is manual, domain-date eligible, idempotent.  
5. Executed occurrences excluded from Forecast.  
6. Schedule-linked transactions immutable via normal PUT/DELETE.  
7. No cross-currency monetary totals in UI.  
8. Transaction currency from account.  
9. Dashboard signals suppressed only where consolidation would be unsafe — **future UI should use per-currency API blocks instead of hiding all signals**.  
10. API failures must not display as zero or success.

---

## Appendix B — Navigation vs product purpose

| Product question | Best surface today | Dashboard gap |
| --- | --- | --- |
| Current position? | Dashboard hero | Adequate |
| What needs attention? | Dashboard attention | Refine rules |
| What is coming next? | Schedules, Forecast | **Missing on Dashboard** |
| What happened? | Analysis | Weak discoverability (quick link) |
| What if schedules run? | Forecast | Not summarised on home |
| Objectives? | Goals | Adequate list; noisy attention |

This audit recommends closing the **upcoming commitments** and **multi-currency signal** gaps without merging Analysis and Forecast domains.
