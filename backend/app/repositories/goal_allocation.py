"""Persistence for goal allocation records."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.db.session import Session
from app.models.goal_allocation import GoalAllocation


class GoalAllocationRepository:
    """Store goal allocation rows."""

    def __init__(self, session: Session) -> None:
        """Bind the repository to one database session."""
        self._session = session

    def create(
        self,
        goal_id: int,
        account_id: int,
        amount: Decimal,
    ) -> GoalAllocation:
        """Insert a goal allocation and return it."""
        allocation = GoalAllocation(
            goal_id=goal_id,
            account_id=account_id,
            amount=amount,
        )
        self._session.add(allocation)
        self._session.commit()
        self._session.refresh(allocation)
        return allocation

    def get_by_id(
        self,
        allocation_id: int,
    ) -> GoalAllocation | None:
        """Return one allocation by primary key."""
        statement = (
            select(GoalAllocation)
            .options(
                joinedload(GoalAllocation.account),
                joinedload(GoalAllocation.goal),
            )
            .where(GoalAllocation.id == allocation_id)
        )
        return self._session.scalars(statement).unique().one_or_none()

    def get_by_goal_and_account(
        self,
        goal_id: int,
        account_id: int,
    ) -> GoalAllocation | None:
        """Return the allocation for a goal and account pair."""
        statement = select(GoalAllocation).where(
            GoalAllocation.goal_id == goal_id,
            GoalAllocation.account_id == account_id,
        )
        return self._session.scalars(statement).one_or_none()

    def list_by_account_id(
        self,
        account_id: int,
    ) -> list[GoalAllocation]:
        """Return every allocation for an account, funding order."""
        statement = (
            select(GoalAllocation)
            .where(GoalAllocation.account_id == account_id)
            .order_by(
                GoalAllocation.created_at.asc(),
                GoalAllocation.id.asc(),
            )
        )
        return list(self._session.scalars(statement).all())

    def list_by_goal_id(
        self,
        goal_id: int,
    ) -> list[GoalAllocation]:
        """Return every allocation for a goal."""
        statement = (
            select(GoalAllocation)
            .options(joinedload(GoalAllocation.account))
            .where(GoalAllocation.goal_id == goal_id)
            .order_by(
                GoalAllocation.created_at.asc(),
                GoalAllocation.id.asc(),
            )
        )
        return list(self._session.scalars(statement).unique().all())

    def update_amount(
        self,
        allocation_id: int,
        amount: Decimal,
    ) -> GoalAllocation | None:
        """Update the designated amount and return the row."""
        allocation = self.get_by_id(allocation_id)
        if allocation is None:
            return None
        allocation.amount = amount
        self._session.commit()
        self._session.refresh(allocation)
        return allocation

    def delete(self, allocation_id: int) -> bool:
        """Delete one allocation. Return True when a row was removed."""
        allocation = self.get_by_id(allocation_id)
        if allocation is None:
            return False
        self._session.delete(allocation)
        self._session.commit()
        return True
