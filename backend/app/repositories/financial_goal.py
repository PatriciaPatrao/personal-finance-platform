"""Persistence for financial goal records."""

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.db.session import Session
from app.models.financial_goal import FinancialGoal


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
        account_id: int | None = None,
    ) -> FinancialGoal:
        """Insert a financial goal and return it."""
        goal = FinancialGoal(
            name=name,
            target_amount=target_amount,
            currency=currency,
            target_date=target_date,
            account_id=account_id,
        )
        self._session.add(goal)
        self._session.commit()
        self._session.refresh(goal)
        return goal

    def list_all(self) -> list[FinancialGoal]:
        """Return every goal, newest first, with account loaded."""
        statement = (
            select(FinancialGoal)
            .options(joinedload(FinancialGoal.account))
            .order_by(
                FinancialGoal.created_at.desc(),
                FinancialGoal.id.desc(),
            )
        )
        return list(self._session.scalars(statement).unique().all())

    def get_by_id(self, goal_id: int) -> FinancialGoal | None:
        """Return one goal by primary key, with account loaded."""
        statement = (
            select(FinancialGoal)
            .options(joinedload(FinancialGoal.account))
            .where(FinancialGoal.id == goal_id)
        )
        return self._session.scalars(statement).unique().one_or_none()

    def get_by_account_id(
        self,
        account_id: int,
    ) -> FinancialGoal | None:
        """Return the goal linked to an account, if any."""
        statement = select(FinancialGoal).where(
            FinancialGoal.account_id == account_id,
        )
        return self._session.scalars(statement).one_or_none()

    def update(
        self,
        goal_id: int,
        name: str,
        target_amount: Decimal,
        currency: str,
        target_date: date | None,
        account_id: int | None,
    ) -> FinancialGoal | None:
        """Update editable fields and return the row."""
        goal = self.get_by_id(goal_id)
        if goal is None:
            return None
        goal.name = name
        goal.target_amount = target_amount
        goal.currency = currency
        goal.target_date = target_date
        goal.account_id = account_id
        self._session.commit()
        self._session.refresh(goal)
        return goal
