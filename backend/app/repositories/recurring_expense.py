"""Persistence for recurring expense records."""

from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.db.session import Session
from app.models.account import Account
from app.models.recurring_expense import RecurringExpense
from app.models.recurring_expense import RecurringFrequency


class RecurringExpenseRepository:
    """Store recurring expense rows scoped to one household."""

    def __init__(
        self,
        session: Session,
        household_id: int,
    ) -> None:
        """Bind the repository to one database session."""
        self._session = session
        self._household_id = household_id

    def create(
        self,
        account_id: int,
        description: str,
        amount: Decimal,
        frequency: RecurringFrequency,
        start_date: date,
        next_occurrence: date,
        category: str | None = None,
        end_date: date | None = None,
        active: bool = True,
    ) -> RecurringExpense:
        """Insert a recurring expense and return it."""
        recurring_expense = RecurringExpense(
            account_id=account_id,
            description=description,
            amount=amount,
            category=category,
            frequency=frequency,
            start_date=start_date,
            next_occurrence=next_occurrence,
            end_date=end_date,
            active=active,
        )
        self._session.add(recurring_expense)
        self._session.commit()
        self._session.refresh(recurring_expense)
        return recurring_expense

    def list_all(self) -> list[RecurringExpense]:
        """Return every recurring expense in the household."""
        statement = (
            select(RecurringExpense)
            .join(Account, RecurringExpense.account_id == Account.id)
            .where(Account.household_id == self._household_id)
            .order_by(
                RecurringExpense.next_occurrence.asc(),
                RecurringExpense.id.asc(),
            )
        )
        return list(self._session.scalars(statement).all())

    def get_by_id(
        self,
        recurring_expense_id: int,
    ) -> RecurringExpense | None:
        """Return one recurring expense in this household."""
        statement = (
            select(RecurringExpense)
            .join(Account, RecurringExpense.account_id == Account.id)
            .where(
                RecurringExpense.id == recurring_expense_id,
                Account.household_id == self._household_id,
            )
        )
        return self._session.scalars(statement).one_or_none()

    def update(
        self,
        recurring_expense_id: int,
        account_id: int,
        description: str,
        amount: Decimal,
        frequency: RecurringFrequency,
        start_date: date,
        next_occurrence: date,
        category: str | None = None,
        end_date: date | None = None,
        active: bool = True,
    ) -> RecurringExpense | None:
        """Update editable fields and return the row."""
        recurring_expense = self.get_by_id(
            recurring_expense_id,
        )
        if recurring_expense is None:
            return None
        recurring_expense.account_id = account_id
        recurring_expense.description = description
        recurring_expense.amount = amount
        recurring_expense.category = category
        recurring_expense.frequency = frequency
        recurring_expense.start_date = start_date
        recurring_expense.next_occurrence = next_occurrence
        recurring_expense.end_date = end_date
        recurring_expense.active = active
        self._session.commit()
        self._session.refresh(recurring_expense)
        return recurring_expense
