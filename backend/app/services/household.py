"""Household bootstrap, invitations and membership management."""

import hashlib
import secrets
from datetime import datetime
from datetime import timedelta
from datetime import timezone

from sqlalchemy.exc import IntegrityError

from app.db.session import Session
from app.models.household import Household
from app.models.household_membership import HouseholdMembership
from app.models.household_membership import HouseholdRole
from app.repositories.household import HouseholdRepository
from app.repositories.household_invitation import (
    HouseholdInvitationRepository,
)

INVITATION_TTL = timedelta(hours=72)


class MembershipConflictError(Exception):
    """Raised when a user already belongs to another household."""


class InvalidInvitationError(Exception):
    """Raised when an invitation token is unknown or already used."""


class InvitationExpiredError(Exception):
    """Raised when an invitation token has expired."""


class HouseholdService:
    """Create households and manage memberships."""

    def __init__(self, session: Session) -> None:
        """Bind the service to one database session."""
        self._session = session
        self._repository = HouseholdRepository(session)
        self._invitations = HouseholdInvitationRepository(session)

    @staticmethod
    def _hash_token(token: str) -> str:
        """Return a stable hash for storing invitation tokens."""
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

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

    def create_invitation(
        self,
        *,
        owner_household_id: int,
    ) -> tuple[str, datetime]:
        """Create a single-use invitation and return the plain token."""
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + INVITATION_TTL
        invitation = self._invitations.create(
            household_id=owner_household_id,
            token_hash=self._hash_token(token),
            expires_at=expires_at,
        )
        self._invitations.commit()
        self._invitations.refresh(invitation)
        return token, expires_at

    def accept_invitation(
        self,
        *,
        token: str,
        user_sub: str,
    ) -> HouseholdMembership:
        """Join a household using a verified invitation and JWT identity."""
        token_hash = self._hash_token(token.strip())
        invitation = self._invitations.get_by_token_hash(token_hash)
        if invitation is None:
            raise InvalidInvitationError("Invalid invitation")

        existing = self._repository.get_membership_by_user_sub(
            user_sub,
        )
        if (
            existing is not None
            and existing.household_id == invitation.household_id
        ):
            return existing

        if invitation.used_at is not None:
            raise InvalidInvitationError("Invalid invitation")
        now = datetime.now(timezone.utc)
        expires_at = invitation.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < now:
            raise InvitationExpiredError("Invitation has expired")

        if existing is not None:
            if not self._can_leave_current_household(existing):
                raise MembershipConflictError(
                    "User already belongs to another household",
                )
            self._repository.delete_membership(existing)
            old_household = self._session.get(
                Household,
                existing.household_id,
            )
            if old_household is not None:
                self._repository.delete_household(old_household)
            self._session.flush()

        try:
            membership = self._repository.create_membership(
                household_id=invitation.household_id,
                user_sub=user_sub,
                role=HouseholdRole.MEMBER,
            )
            invitation.used_at = now
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

    def _can_leave_current_household(
        self,
        membership: HouseholdMembership,
    ) -> bool:
        """Allow abandoning a solo, empty household created on first login."""
        if membership.role != HouseholdRole.OWNER:
            return False
        if self._repository.household_has_accounts(
            membership.household_id,
        ):
            return False
        return (
            self._repository.count_memberships(
                membership.household_id,
            )
            == 1
        )

    def add_member(
        self,
        *,
        owner_household_id: int,
        owner_user_sub: str,
        user_sub: str,
    ) -> HouseholdMembership:
        """Add a member by Auth0 subject (owner-only, advanced)."""
        if user_sub == owner_user_sub:
            existing = self._repository.get_membership_by_user_sub(
                user_sub,
            )
            if existing is not None:
                return existing
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
