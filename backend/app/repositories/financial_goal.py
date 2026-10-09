"""Persistence for financial goal records."""

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.db.session import Session
from app.models.financial_goal import FinancialGoal
from app.models.goal_allocation import GoalAllocation


class FinancialGoalRepository:
    """Store financial goal rows."""

    def __init__(self, session: Session) -> None:
        """Bind the repository to one database session."""
        self._session = session

    def create(
        self,
        name: str,
        target_amount: Decimal,
        currency: str = "EUR",
        target_date: date | None = None,
    ) -> FinancialGoal:
        """Insert a financial goal and return it."""
        goal = FinancialGoal(
            name=name,
            target_amount=target_amount,
            currency=currency,
            target_date=target_date,
        )
        self._session.add(goal)
        self._session.commit()
        self._session.refresh(goal)
        return goal

    def list_all(self) -> list[FinancialGoal]:
        """Return every goal, newest first, with allocations loaded."""
        statement = (
            select(FinancialGoal)
            .options(
                joinedload(FinancialGoal.allocations).joinedload(
                    GoalAllocation.account,
                ),
            )
            .execution_options(populate_existing=True)
            .order_by(
                FinancialGoal.created_at.desc(),
                FinancialGoal.id.desc(),
            )
        )
        return list(self._session.scalars(statement).unique().all())

    def get_by_id(self, goal_id: int) -> FinancialGoal | None:
        """Return one goal by primary key, with allocations loaded."""
        statement = (
            select(FinancialGoal)
            .options(
                joinedload(FinancialGoal.allocations).joinedload(
                    GoalAllocation.account,
                ),
            )
            .execution_options(populate_existing=True)
            .where(FinancialGoal.id == goal_id)
        )
        return self._session.scalars(statement).unique().one_or_none()

    def update(
        self,
        goal_id: int,
        name: str,
        target_amount: Decimal,
        currency: str,
        target_date: date | None,
    ) -> FinancialGoal | None:
        """Update editable fields and return the row."""
        goal = self.get_by_id(goal_id)
        if goal is None:
            return None
        goal.name = name
        goal.target_amount = target_amount
        goal.currency = currency
        goal.target_date = target_date
        self._session.commit()
        self._session.refresh(goal)
        return goal
