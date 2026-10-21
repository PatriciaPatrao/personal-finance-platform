"""Validate Auth0-issued JWT access tokens."""

from typing import Any

import jwt
from jwt import PyJWKClient
from jwt import PyJWKSet


class TokenValidationError(Exception):
    """Raised when a bearer token fails verification."""


class JwtVerifier:
    """Verify RS256 JWTs using Auth0 issuer, audience, and JWKS."""

    def __init__(
        self,
        *,
        domain: str,
        audience: str,
        jwks_json: str | None = None,
    ) -> None:
        """Configure issuer, audience, and JWKS source."""
        domain = domain.strip().rstrip("/")
        if domain.startswith("https://"):
            self._issuer = f"{domain}/"
            jwks_host = domain
        else:
            self._issuer = f"https://{domain}/"
            jwks_host = f"https://{domain}"
        self._audience = audience.strip()
        self._static_jwks: PyJWKSet | None = None
        self._jwks_client: PyJWKClient | None = None
        if jwks_json:
            self._static_jwks = PyJWKSet.from_json(jwks_json)
        else:
            self._jwks_client = PyJWKClient(
                f"{jwks_host}/.well-known/jwks.json",
            )

    def verify(self, token: str) -> dict[str, Any]:
        """Return decoded claims when the token is valid."""
        try:
            if self._static_jwks is not None:
                header = jwt.get_unverified_header(token)
                kid = header.get("kid")
                signing_key = self._static_jwks[kid]
            else:
                assert self._jwks_client is not None
                signing_key = (
                    self._jwks_client.get_signing_key_from_jwt(
                        token,
                    )
                )
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self._audience,
                issuer=self._issuer,
                options={
                    "require": ["exp", "sub", "iss", "aud"],
                },
            )
        except jwt.PyJWTError as error:
            raise TokenValidationError(
                "Invalid access token",
            ) from error
        return claims
