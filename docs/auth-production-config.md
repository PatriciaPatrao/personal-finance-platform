# Authentication — production and staging configuration

Auth0 is the identity provider (see [006-identity-provider-auth0.md](decisions/006-identity-provider-auth0.md)).

## Auth0 tenant setup

1. Create an **API** with identifier `AUTH0_AUDIENCE` (e.g. `https://api.personal-finance`).
2. Create a **Single Page Application** for the Angular app.
3. Enable **Database** connection (username/password) for sign-up and sign-in.
4. Configure **password reset** via Universal Login (default for database connections).
5. **MFA**: enable in Auth0 Dashboard (Guardian) and apply an MFA policy for production users. This has **not** been verified in a live tenant as part of Phase 14 automation; treat MFA as required manual configuration before client release.

### SPA application settings

| Setting | Value |
| --- | --- |
| Allowed Callback URLs | `https://<vercel-domain>/callback`, `http://localhost:4200/callback` |
| Allowed Logout URLs | `https://<vercel-domain>`, `http://localhost:4200` |
| Allowed Web Origins | Same as frontend origins |
| Grant types | Authorization Code with PKCE (default for SPA) |

## Backend (Render)

Set in Render for each environment (staging vs production use **separate** Auth0 apps or tenants if desired):

| Variable | Description |
| --- | --- |
| `AUTH0_DOMAIN` | Tenant domain, e.g. `your-tenant.us.auth0.com` |
| `AUTH0_AUDIENCE` | API identifier matching the Auth0 API |
| `APP_ENV` | `production` disables `/docs` and OpenAPI |
| `CORS_ORIGINS` | Comma-separated Vercel (and local) origins |
| `DATABASE_URL` | **Separate** empty Neon DB per environment |

Do **not** set `AUTH0_JWKS_JSON` in production; the API loads JWKS from Auth0.

## Frontend (Vercel)

Public build-time variables only:

| Variable | Description |
| --- | --- |
| `NG_APP_API_BASE_URL` | Render API URL |
| `NG_APP_AUTH0_DOMAIN` | Same as `AUTH0_DOMAIN` |
| `NG_APP_AUTH0_CLIENT_ID` | SPA client ID |
| `NG_APP_AUTH0_AUDIENCE` | Same as `AUTH0_AUDIENCE` |

Never commit client secrets to the frontend; the SPA uses PKCE without a client secret.

The SPA requests an **API access token** via `authorizationParams.audience` (same value as `AUTH0_AUDIENCE`). The FastAPI backend validates `iss`, `aud`, `exp`, and signature via Auth0 JWKS. ID tokens are not accepted for API calls.

## Multi-user households

1. The **owner** signs in (first login creates a household automatically).
2. The owner opens **Household** in the app and creates an invitation link (`POST /households/invitations`).
3. The second user opens the link (`/join?token=…`), signs in with Auth0, and the app calls `POST /households/invitations/accept` using their JWT `sub` (not a browser-supplied user id).
4. Optional advanced path: `POST /households/members` with a known Auth0 `sub` (owner only).

Invitation links expire after 72 hours and are single-use.

## Local development

Copy `backend/.env.example` and set `AUTH0_*` variables. For backend tests, JWKS is loaded from `tests/_test_auth_jwks.json` via `AUTH0_JWKS_JSON`.

Angular dev uses placeholder Auth0 values in `environment.development.ts` until a real dev tenant is configured.

## Database migration

Migration `h8i9j0k1l2m3` **fails** if financial rows exist without households. Production must use a **new empty** database. Staging seed data must not be migrated blindly into production.
