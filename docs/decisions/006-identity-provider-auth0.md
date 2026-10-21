# 006 — Identity provider: Auth0

## Decision

Use **Auth0** for authentication in Phase 14.

## Comparison (Clerk vs Auth0)

| Factor | Auth0 | Clerk |
| --- | --- | --- |
| Angular 21 SDK | Official `@auth0/auth0-angular` (SPA, v14+); `ng add` quickstart | No official Angular SDK; community **ngx-clerk** (Angular 20+, Clerk Core 3) |
| FastAPI JWT / JWKS | Official `auth0-fastapi-api` and documented RS256 + JWKS (`/.well-known/jwks.json`), `iss` + `aud` validation | Documented manual JWT / `authenticateRequest()`; Python SDK is Backend API wrapper, not a FastAPI JWT plugin |
| Password recovery | Built-in Universal Login + Database Connection password reset | Built-in sign-in UI and password flows |
| MFA | Configurable in Auth0 Dashboard (Guardian / policies); effort is mostly tenant configuration | Available in Clerk Dashboard; similar configuration effort |
| Production / pricing | Free tier (limited MAU); separate Auth0 apps for SPA + API audience | Free tier with MAU limits; Clerk Billing org features not required for this app |
| Implementation risk | **Lower**: official Angular + documented FastAPI path, stable `sub` claim | **Higher**: third-party Angular adapter, pending-session edge cases in ngx-clerk, more custom FastAPI verification |

## Rationale

The delivery target requires a **small, complete, tested** auth stack. Auth0 provides **official** Angular and FastAPI integration paths with standard OAuth2/OIDC access tokens, JWKS verification, and issuer/audience checks. Clerk’s Angular story depends on a community package, which adds integration and upgrade risk for tomorrow’s deadline.

MFA is **not enabled in code**; it must be turned on in the Auth0 tenant (see `docs/auth-production-config.md`). Until that is verified in staging/production, MFA must be treated as **NOT VERIFIED**.

## Consequences

- Frontend exposes only Auth0 **public** config (`domain`, `clientId`, `audience`).
- Backend validates access tokens via Auth0 JWKS; identity is always the token `sub`, never client-supplied IDs.
- Household membership is resolved server-side after JWT validation.
