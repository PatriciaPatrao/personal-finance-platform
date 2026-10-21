"""Persistence for household invitations."""

from datetime import datetime

from sqlalchemy import select

from app.db.session import Session
from app.models.household_invitation import HouseholdInvitation


class HouseholdInvitationRepository:
    """Store invitation rows."""

    def __init__(self, session: Session) -> None:
        """Bind the repository to one database session."""
        self._session = session

    def create(
        self,
        *,
        household_id: int,
        token_hash: str,
        expires_at: datetime,
    ) -> HouseholdInvitation:
        """Insert an invitation and return it."""
        invitation = HouseholdInvitation(
            household_id=household_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self._session.add(invitation)
        self._session.flush()
        return invitation

    def get_by_token_hash(
        self,
        token_hash: str,
    ) -> HouseholdInvitation | None:
        """Return an invitation by its stored hash."""
        statement = select(HouseholdInvitation).where(
            HouseholdInvitation.token_hash == token_hash,
        )
        return self._session.scalars(statement).one_or_none()

    def commit(self) -> None:
        """Commit the current session."""
        self._session.commit()

    def refresh(self, invitation: HouseholdInvitation) -> None:
        """Refresh an invitation from the database."""
        self._session.refresh(invitation)
