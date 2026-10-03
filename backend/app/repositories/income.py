"""Persistence for income records."""

from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.db.session import Session
from app.models.income import Income
from app.models.income import IncomeFrequency


class IncomeRepository:
    """Store income rows."""

    def __init__(self, session: Session) -> None:
        """Bind the repository to one database session."""
        self._session = session

    def create(
        self,
        account_id: int,
        amount: Decimal,
        frequency: IncomeFrequency,
        start_date: date,
        next_occurrence: date,
        end_date: date | None = None,
        active: bool = True,
    ) -> Income:
        """Insert an income and return it."""
        income = Income(
            account_id=account_id,
            amount=amount,
            frequency=frequency,
            start_date=start_date,
            next_occurrence=next_occurrence,
            end_date=end_date,
            active=active,
        )
        self._session.add(income)
        self._session.commit()
        self._session.refresh(income)
        return income

    def list_all(self) -> list[Income]:
        """Return every income, next due first."""
        statement = select(Income).order_by(
            Income.next_occurrence.asc(),
            Income.id.asc(),
        )
        return list(self._session.scalars(statement).all())

    def get_by_id(self, income_id: int) -> Income | None:
        """Return one income by primary key."""
        statement = select(Income).where(
            Income.id == income_id,
        )
        return self._session.scalars(statement).one_or_none()

    def update(
        self,
        income_id: int,
        account_id: int,
        amount: Decimal,
        frequency: IncomeFrequency,
        start_date: date,
        next_occurrence: date,
        end_date: date | None = None,
        active: bool = True,
    ) -> Income | None:
        """Update editable fields and return the row."""
        income = self.get_by_id(income_id)
        if income is None:
            return None
        income.account_id = account_id
        income.amount = amount
        income.frequency = frequency
        income.start_date = start_date
        income.next_occurrence = next_occurrence
        income.end_date = end_date
        income.active = active
        self._session.commit()
        self._session.refresh(income)
        return income
