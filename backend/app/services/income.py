"""Application logic for incomes."""

from datetime import date

from app.db.session import Session
from app.models.income import Income
from app.repositories.account import AccountRepository
from app.repositories.income import IncomeRepository
from app.schemas.income import IncomeCreate
from app.schemas.income import IncomeUpdate


class AccountNotFoundError(Exception):
    """Raised when an income references a missing account."""


class InvalidIncomeDatesError(Exception):
    """Raised when income dates are inconsistent."""


class IncomeService:
    """Coordinate income operations."""

    def __init__(self, session: Session) -> None:
        """Bind the service to one database session."""
        self._repository = IncomeRepository(session)
        self._account_repository = AccountRepository(session)

    def _validate_dates(
        self,
        start_date: date,
        next_occurrence: date,
        end_date: date | None,
    ) -> None:
        """Reject inconsistent date relationships."""
        if start_date > next_occurrence:
            raise InvalidIncomeDatesError(
                "start_date must be on or before "
                "next_occurrence",
            )
        if end_date is not None:
            if start_date > end_date:
                raise InvalidIncomeDatesError(
                    "start_date must be on or before end_date",
                )
            if next_occurrence > end_date:
                raise InvalidIncomeDatesError(
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

    def create(self, data: IncomeCreate) -> Income:
        """Persist a new income from incoming data."""
        self._require_account(data.account_id)
        self._validate_dates(
            data.start_date,
            data.next_occurrence,
            data.end_date,
        )
        return self._repository.create(
            account_id=data.account_id,
            amount=data.amount,
            frequency=data.frequency,
            start_date=data.start_date,
            next_occurrence=data.next_occurrence,
            end_date=data.end_date,
            active=data.active,
        )

    def list_all(self) -> list[Income]:
        """Return every stored income."""
        return self._repository.list_all()

    def get_by_id(self, income_id: int) -> Income | None:
        """Return one stored income, if it exists."""
        return self._repository.get_by_id(income_id)

    def update(
        self,
        income_id: int,
        data: IncomeUpdate,
    ) -> Income | None:
        """Fully update a stored income, if it exists."""
        income = self._repository.get_by_id(income_id)
        if income is None:
            return None
        self._require_account(data.account_id)
        self._validate_dates(
            data.start_date,
            data.next_occurrence,
            data.end_date,
        )
        return self._repository.update(
            income_id=income_id,
            account_id=data.account_id,
            amount=data.amount,
            frequency=data.frequency,
            start_date=data.start_date,
            next_occurrence=data.next_occurrence,
            end_date=data.end_date,
            active=data.active,
        )
