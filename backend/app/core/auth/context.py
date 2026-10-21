"""Authenticated request context."""

from dataclasses import dataclass

from app.models.household_membership import HouseholdRole


@dataclass(frozen=True)
class AuthenticatedMember:
    """Resolved household access for one authenticated user."""

    user_sub: str
    household_id: int
    membership_id: int
    role: HouseholdRole
