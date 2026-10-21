"""Persistence for households and memberships."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.session import Session
from app.models.household import Household
from app.models.household_membership import HouseholdMembership
from app.models.household_membership import HouseholdRole


class HouseholdRepository:
    """Store household and membership rows."""

    def __init__(self, session: Session) -> None:
        """Bind the repository to one database session."""
        self._session = session

    def create_household(self) -> Household:
        """Insert a household and return it."""
        household = Household()
        self._session.add(household)
        self._session.flush()
        return household

    def get_membership_by_user_sub(
        self,
        user_sub: str,
    ) -> HouseholdMembership | None:
        """Return the membership for an identity subject, if any."""
        statement = select(HouseholdMembership).where(
            HouseholdMembership.user_sub == user_sub,
        )
        return self._session.scalars(statement).one_or_none()

    def create_membership(
        self,
        *,
        household_id: int,
        user_sub: str,
        role: HouseholdRole,
    ) -> HouseholdMembership:
        """Insert a membership row."""
        membership = HouseholdMembership(
            household_id=household_id,
            user_sub=user_sub,
            role=role,
        )
        self._session.add(membership)
        self._session.flush()
        return membership

    def commit(self) -> None:
        """Commit the current session."""
        self._session.commit()

    def rollback(self) -> None:
        """Roll back the current session."""
        self._session.rollback()

    def refresh(self, entity: Household | HouseholdMembership) -> None:
        """Refresh an entity from the database."""
        self._session.refresh(entity)

    def add_member_idempotent(
        self,
        *,
        household_id: int,
        user_sub: str,
        role: HouseholdRole,
    ) -> HouseholdMembership:
        """Add a member or return the existing membership on conflict."""
        existing = self.get_membership_by_user_sub(user_sub)
        if existing is not None:
            return existing
        try:
            membership = self.create_membership(
                household_id=household_id,
                user_sub=user_sub,
                role=role,
            )
            self.commit()
            self.refresh(membership)
            return membership
        except IntegrityError:
            self.rollback()
            existing = self.get_membership_by_user_sub(user_sub)
            if existing is None:
                raise
            return existing
