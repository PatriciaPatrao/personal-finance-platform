"""Application logic for recurring expenses."""

from datetime import date

from app.db.session import Session
from app.models.recurring_expense import RecurringExpense
from app.repositories.account import AccountRepository
from app.repositories.recurring_expense import (
    RecurringExpenseRepository,
)
from app.schemas.recurring_expense import RecurringExpenseCreate
from app.schemas.recurring_expense import RecurringExpenseUpdate


class AccountNotFoundError(Exception):
    """Raised when a recurring expense references a missing account."""


class InvalidRecurringExpenseDatesError(Exception):
    """Raised when recurring expense dates are inconsistent."""


class RecurringExpenseService:
    """Coordinate recurring expense operations."""

    def __init__(self, session: Session) -> None:
        """Bind the service to one database session."""
        self._repository = RecurringExpenseRepository(session)
        self._account_repository = AccountRepository(session)

    def _validate_dates(
        self,
        start_date: date,
        next_occurrence: date,
        end_date: date | None,
    ) -> None:
        """Reject inconsistent date relationships."""
        if start_date > next_occurrence:
            raise InvalidRecurringExpenseDatesError(
                "start_date must be on or before "
                "next_occurrence",
            )
        if end_date is not None:
            if start_date > end_date:
                raise InvalidRecurringExpenseDatesError(
                    "start_date must be on or before end_date",
                )
            if next_occurrence > end_date:
                raise InvalidRecurringExpenseDatesError(
                    "next_occurrence must be on or before "
                    "end_date",
                )

    def _require_account(self, account_id: int) -> None:
        """Raise when the referenced account does not exist."""
        account = self._account_repository.get_by_id(
            account_id,
        )
        if account is None:
            raise AccountNotFoundError(
                f"Account {account_id} not found",
            )

    def create(
        self,
        data: RecurringExpenseCreate,
    ) -> RecurringExpense:
        """Persist a new recurring expense from incoming data."""
        self._require_account(data.account_id)
        self._validate_dates(
            data.start_date,
            data.next_occurrence,
            data.end_date,
        )
        return self._repository.create(
            account_id=data.account_id,
            description=data.description,
            amount=data.amount,
            frequency=data.frequency,
            start_date=data.start_date,
            next_occurrence=data.next_occurrence,
            category=data.category,
            end_date=data.end_date,
            active=data.active,
        )

    def list_all(self) -> list[RecurringExpense]:
        """Return every stored recurring expense."""
        return self._repository.list_all()

    def get_by_id(
        self,
        recurring_expense_id: int,
    ) -> RecurringExpense | None:
        """Return one stored recurring expense, if it exists."""
        return self._repository.get_by_id(
            recurring_expense_id,
        )

    def update(
        self,
        recurring_expense_id: int,
        data: RecurringExpenseUpdate,
    ) -> RecurringExpense | None:
        """Fully update a stored recurring expense, if it exists."""
        recurring_expense = self._repository.get_by_id(
            recurring_expense_id,
        )
        if recurring_expense is None:
            return None
        self._require_account(data.account_id)
        self._validate_dates(
            data.start_date,
            data.next_occurrence,
            data.end_date,
        )
        return self._repository.update(
            recurring_expense_id=recurring_expense_id,
            account_id=data.account_id,
            description=data.description,
            amount=data.amount,
            frequency=data.frequency,
            start_date=data.start_date,
            next_occurrence=data.next_occurrence,
            category=data.category,
            end_date=data.end_date,
            active=data.active,
        )
