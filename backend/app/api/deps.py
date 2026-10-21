"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.security import HTTPBearer

from app.core.auth.context import AuthenticatedMember
from app.core.auth.jwt_verifier import TokenValidationError
from app.core.auth.jwt_verifier import JwtVerifier
from app.core.config import settings
from app.db.session import Session
from app.db.session import get_db
from app.services.household import HouseholdService


_bearer = HTTPBearer(auto_error=False)
_verifier: JwtVerifier | None = None


def _get_verifier() -> JwtVerifier:
    """Return a process-wide JWT verifier."""
    global _verifier
    if _verifier is None:
        if not settings.auth0_domain or not settings.auth0_audience:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication is not configured",
            )
        _verifier = JwtVerifier(
            domain=settings.auth0_domain,
            audience=settings.auth0_audience,
            jwks_json=settings.auth0_jwks_json,
        )
    return _verifier


def get_current_member(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(_bearer),
    ],
    session: Session = Depends(get_db),
) -> AuthenticatedMember:
    """Validate the bearer token and resolve household membership."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        claims = _get_verifier().verify(token)
    except TokenValidationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_sub = claims.get("sub")
    if not isinstance(user_sub, str) or not user_sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    membership = HouseholdService(session).ensure_membership(
        user_sub,
    )
    return AuthenticatedMember(
        user_sub=user_sub,
        household_id=membership.household_id,
        membership_id=membership.id,
        role=membership.role,
    )


def require_owner(
    member: AuthenticatedMember = Depends(get_current_member),
) -> AuthenticatedMember:
    """Allow only household owners."""
    from app.models.household_membership import HouseholdRole

    if member.role != HouseholdRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner role required",
        )
    return member
