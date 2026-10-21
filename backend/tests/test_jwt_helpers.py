"""Mint JWT access tokens for API tests."""

from datetime import datetime
from datetime import timedelta
from datetime import timezone
from pathlib import Path

import jwt

from app.core.config import settings

_PRIVATE_KEY_PATH = Path(__file__).parent / "_test_auth_private.pem"
_TEST_KID = "test-key-1"


def mint_test_access_token(
    user_sub: str,
    *,
    expired: bool = False,
    audience: str | None = None,
    issuer: str | None = None,
) -> str:
    """Return a signed bearer token for the test Auth0 tenant."""
    if not _PRIVATE_KEY_PATH.is_file():
        raise RuntimeError(
            "Missing tests/_test_auth_private.pem; run test setup.",
        )
    private_key = _PRIVATE_KEY_PATH.read_text()
    domain = settings.auth0_domain.strip().rstrip("/")
    if domain.startswith("https://"):
        default_issuer = f"{domain}/"
    else:
        default_issuer = f"https://{domain}/"
    now = datetime.now(timezone.utc)
    exp = now + timedelta(hours=1)
    if expired:
        exp = now - timedelta(minutes=5)
    payload = {
        "sub": user_sub,
        "iss": issuer or default_issuer,
        "aud": audience or settings.auth0_audience,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(
        payload,
        private_key,
        algorithm="RS256",
        headers={"kid": _TEST_KID},
    )


def auth_header(user_sub: str, **kwargs: object) -> dict[str, str]:
    """Return Authorization headers for one test user."""
    token = mint_test_access_token(user_sub, **kwargs)
    return {"Authorization": f"Bearer {token}"}
