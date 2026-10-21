# Staging deployment (Vercel + Render + Neon)

This guide prepares a **disposable staging** environment for the Personal Finance Platform. Staging is for demo and UAT only. **Do not enter real client financial data** — use synthetic demo data only. The API requires Auth0 access tokens on all financial routes (see [auth-production-config.md](auth-production-config.md)).

Nothing in this document assumes cloud accounts, services, or URLs already exist. Replace every `YOUR-*` placeholder with values from your own dashboards after provisioning.

**Local development:** For PostgreSQL and the API on your machine without Neon or Render, use Docker Compose at the repository root ([`compose.yaml`](../compose.yaml)). That stack is **development-only** (disposable credentials and data). It does not deploy the frontend; continue to use `npm start` locally or Vercel for hosted builds. Cloud staging below is independent of Compose.

## Architecture

```text
Browser
   │
   ▼
Vercel (static Angular)          Render (FastAPI web service)
   │  NG_APP_API_BASE_URL ─────────►  │  DATABASE_URL
   │  (build-time, public)            ▼
   │                             Neon PostgreSQL (staging DB)
   └── CORS: staging frontend origin only (APP_ENV=production)
```

| Component | Provider | Role |
| --- | --- | --- |
| Frontend | Vercel | Hosts the production Angular build (static files). |
| Backend | Render | Runs `uvicorn` for FastAPI; health check `GET /health`. |
| Database | Neon | Dedicated **staging** PostgreSQL (not local dev, not production). |

## Security and data handling

- **Secrets:** `DATABASE_URL` lives only on Render (and locally in ignored `.env` files). Never commit connection strings or passwords.
- **Frontend env:** Treat every Vercel environment variable as **public** (embedded in the client bundle). Only set `NG_APP_API_BASE_URL` — never database credentials or API keys on the frontend.
- **CORS:** With `APP_ENV=production`, the API **refuses to start** unless `CORS_ORIGINS` lists the exact staging frontend origin(s). Do not use `*` or disable CORS.
- **`APP_ENV` for staging:** Use `production` on Render so CORS is enforced. Values like `staging` are **not** supported and would fall back to development CORS (`http://localhost:4200` only).
- **Demo seed:** Run `backend/scripts/seed_demo_data.py` only after you have confirmed `DATABASE_URL` points at the **intended staging** Neon database — not your laptop database and not production.

## 1. Neon — staging PostgreSQL

1. Create a Neon account and a **new project** (or separate branch) used **only** for staging.
2. Create a database (for example `personal_finance_staging`).
3. Copy a connection string from the Neon dashboard:
   - Prefer the **direct** (non-pooler) connection for **Alembic migrations** if Neon offers both direct and pooled endpoints.
   - The application can use the same direct URL on Render’s free tier; pooled URLs are optional for higher concurrency later.
4. Ensure the string includes TLS, typically `?sslmode=require` (Neon’s default strings usually include this).
5. Neon may emit `postgres://` or `postgresql://`. The API normalizes both to `postgresql+psycopg2://` for SQLAlchemy.

**Verify connectivity (local, optional):**

```powershell
cd backend
$env:DATABASE_URL = "YOUR-NEON-CONNECTION-STRING"
alembic current
alembic upgrade head
```

- `alembic current` shows the revision after migrations apply.
- Use a **new** staging database; do not point at local PostgreSQL or production.

**Migration status on Render:** Each deploy runs `alembic upgrade head` via `preDeployCommand` in [`render.yaml`](../render.yaml) before traffic is served. Migrations are **not** run on application startup.

## 2. Render — FastAPI backend

### Option A — Blueprint ([`render.yaml`](../render.yaml))

1. Push this repository to a Git remote Render can access.
2. In Render: **New → Blueprint**, connect the repo, and apply the blueprint.
3. When prompted, set secret environment variables (see table below).

### Option B — Manual web service

| Setting | Value |
| --- | --- |
| **Root directory** | `backend` |
| **Runtime** | Python 3 |
| **Python version** | `3.12` (see [`backend/.python-version`](../backend/.python-version)) |
| **Build command** | `pip install -r requirements.txt` |
| **Pre-deploy command** | `alembic upgrade head` |
| **Start command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Health check path** | `/health` |

Render injects `PORT`; binding to `0.0.0.0` is required.

### Backend environment variables (Render)

| Variable | Required | Example / notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon staging connection string (secret). |
| `APP_ENV` | Yes | `production` (required for strict CORS on staging). |
| `CORS_ORIGINS` | Yes when `APP_ENV=production` | Exact Vercel staging origin, no trailing slash, e.g. `https://YOUR-PROJECT.vercel.app` |
| `AUTH0_DOMAIN` | Yes | Same tenant domain as the SPA, e.g. `your-tenant.us.auth0.com` |
| `AUTH0_AUDIENCE` | Yes | Auth0 API identifier, e.g. `https://api.personal-finance` |
| `PYTHON_VERSION` | Recommended | `3.12` |

Do **not** set `ALEMBIC_SCHEMA` on Render unless you intentionally use a non-`public` schema (default is `public`).

After the first successful deploy, note the Render service URL (e.g. `https://YOUR-SERVICE.onrender.com`). This becomes the API origin for the frontend build.

**Smoke test (API only):**

```bash
curl -sS "https://YOUR-SERVICE.onrender.com/health"
```

Expect HTTP **200** and JSON including `status` and `current_domain_date`.

## 3. Vercel — Angular frontend

### Project settings

| Setting | Value |
| --- | --- |
| **Root directory** | `frontend` |
| **Framework preset** | Other (or Angular if detected) |
| **Build command** | `npm run build` |
| **Output directory** | `dist/frontend/browser` |
| **Install command** | `npm install` (default) |

Angular’s application builder emits static files under `dist/frontend/browser`, not `dist/frontend` alone.

### Frontend environment variables (Vercel)

| Variable | When | Value |
| --- | --- | --- |
| `NG_APP_API_BASE_URL` | **Build** time | Render API origin **without** trailing slash, e.g. `https://YOUR-SERVICE.onrender.com` |
| `NG_APP_AUTH0_DOMAIN` | **Build** time | Same as Render `AUTH0_DOMAIN` |
| `NG_APP_AUTH0_CLIENT_ID` | **Build** time | Auth0 SPA client ID |
| `NG_APP_AUTH0_AUDIENCE` | **Build** time | Same as Render `AUTH0_AUDIENCE` |

Set this in Vercel **before** the first production build. The build script [`frontend/scripts/build-production.mjs`](../frontend/scripts/build-production.mjs) validates the URL and injects it at compile time; do not hardcode the API URL in source.

[`frontend/vercel.json`](../frontend/vercel.json) rewrites unknown paths to `index.html` so client routes (e.g. `/personal_finance/analysis`) work on refresh and deep links.

### Local production build check (placeholder API)

```powershell
cd frontend
$env:NG_APP_API_BASE_URL = "https://api-placeholder.example"
$env:NG_APP_AUTH0_DOMAIN = "your-tenant.auth0.com"
$env:NG_APP_AUTH0_CLIENT_ID = "YOUR_SPA_CLIENT_ID"
$env:NG_APP_AUTH0_AUDIENCE = "https://api.personal-finance"
npm run build
```

Artifacts appear under `frontend/dist/frontend/browser`.

## 4. Configuration order

Configure and deploy in this order to avoid CORS mismatches and failed builds:

1. **Neon** — Create staging database; save `DATABASE_URL` securely.
2. **Auth0** — Create API + SPA; note domain, client ID, and audience (see [auth-production-config.md](auth-production-config.md)).
3. **Render** — Create service; set `DATABASE_URL`, `APP_ENV=production`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, and a **temporary** or final `CORS_ORIGINS`. Deploy; confirm `GET /health`.
4. **Vercel** — Create project; set all `NG_APP_*` variables; deploy.
5. **Render (again)** — Set `CORS_ORIGINS` to the **exact** Vercel deployment origin (preview URLs differ from production domain — list each origin you use, comma-separated).
6. **Optional demo data** — From a machine with staging `DATABASE_URL`, run `python scripts/seed_demo_data.py` only after double-checking the target database.
7. **UAT** — Run [staging-uat-checklist.md](staging-uat-checklist.md) and the smoke tests below.

## 5. Post-deployment smoke test

Replace placeholders with your deployed URLs.

1. `GET https://YOUR-SERVICE.onrender.com/health` → **200**, body includes `current_domain_date`.
2. Sign in via Auth0 on `https://YOUR-VERCEL-ORIGIN/personal_finance` → dashboard loads; API calls return **200** (not **401**).
3. Create an account → **201**; sign out and confirm financial routes are unreachable without a token.
4. Owner: **Household** → create invitation; second user opens `/join?token=…`, signs in, lands on shared household data.
5. Open **Analysis** and **Forecast** with a valid range → data or empty state (not persistent **401**/**403**).
6. If any step fails, treat deployment as **not verified**.

## 6. Free-tier limitations (manual expectations)

| Provider | Typical free-tier behaviour |
| --- | --- |
| **Render** | Service may **spin down** after idle time; first request after sleep can take tens of seconds. Pre-deploy runs on each deploy. |
| **Neon** | Storage and compute caps; inactive projects may suspend until resumed in the dashboard. |
| **Vercel** | Bandwidth and build minute limits on Hobby; preview deployments get unique URLs (each needs CORS if used against the API). |

## 7. Local validation (repository prep)

Before provisioning cloud services, from the repo root:

```powershell
cd backend
pytest tests/test_health.py tests/test_cors_settings.py tests/test_database_url.py

cd ..\frontend
npm test
$env:NG_APP_API_BASE_URL = "https://api-placeholder.example"
$env:NG_APP_AUTH0_DOMAIN = "your-tenant.auth0.com"
$env:NG_APP_AUTH0_CLIENT_ID = "YOUR_SPA_CLIENT_ID"
$env:NG_APP_AUTH0_AUDIENCE = "https://api.personal-finance"
npm run build
```

Backend tests that need PostgreSQL still require local `DATABASE_URL` and the `test` schema as described in the [README](../README.md).

## Related files

- [`render.yaml`](../render.yaml) — Render web service, migrations, health check.
- [`frontend/vercel.json`](../frontend/vercel.json) — SPA routing for Angular.
- [`backend/.env.example`](../backend/.env.example) — Local env template (not used on Render).
- [README — Production deployment](../README.md#production-deployment) — General production env vars and build commands.
