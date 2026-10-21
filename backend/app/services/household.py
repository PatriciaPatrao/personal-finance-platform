"""Household bootstrap and membership management."""

from sqlalchemy.exc import IntegrityError

from app.db.session import Session
from app.models.household_membership import HouseholdMembership
from app.models.household_membership import HouseholdRole
from app.repositories.household import HouseholdRepository


class MembershipConflictError(Exception):
    """Raised when a user already belongs to another household."""


class HouseholdService:
    """Create households and manage memberships."""

    def __init__(self, session: Session) -> None:
        """Bind the service to one database session."""
        self._session = session
        self._repository = HouseholdRepository(session)

    def ensure_membership(self, user_sub: str) -> HouseholdMembership:
        """Return membership, creating a household on first login."""
        existing = self._repository.get_membership_by_user_sub(
            user_sub,
        )
        if existing is not None:
            return existing
        try:
            household = self._repository.create_household()
            membership = self._repository.create_membership(
                household_id=household.id,
                user_sub=user_sub,
                role=HouseholdRole.OWNER,
            )
            self._repository.commit()
            self._repository.refresh(membership)
            return membership
        except IntegrityError:
            self._repository.rollback()
            existing = self._repository.get_membership_by_user_sub(
                user_sub,
            )
            if existing is not None:
                return existing
            raise

    def add_member(
        self,
        *,
        owner_household_id: int,
        user_sub: str,
    ) -> HouseholdMembership:
        """Add a user to the owner's household (owner-only)."""
        existing = self._repository.get_membership_by_user_sub(
            user_sub,
        )
        if existing is not None:
            if existing.household_id != owner_household_id:
                raise MembershipConflictError(
                    "User already belongs to another household",
                )
            return existing
        return self._repository.add_member_idempotent(
            household_id=owner_household_id,
            user_sub=user_sub,
            role=HouseholdRole.MEMBER,
        )
