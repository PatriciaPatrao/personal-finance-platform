"""Application logic for recording transactions."""

from decimal import Decimal

from sqlalchemy.exc import IntegrityError

from app.db.session import Session
from app.models.transaction import Transaction
from app.repositories.account import AccountRepository
from app.repositories.schedule_execution import ScheduleExecutionRepository
from app.repositories.transaction import TransactionRepository
from app.schemas.transaction import TransactionCreate
from app.schemas.transaction import TransactionUpdate
from app.services.balance_effect import balance_delta
from app.services.balance_effect import balance_delta_for_transaction


class AccountNotFoundError(Exception):
    """Raised when a transaction references a missing account."""


class TransactionLinkedToScheduleError(Exception):
    """Raised when a schedule-linked transaction cannot be changed."""


class TransactionService:
    """Coordinate transaction writes and account balance updates."""

    def __init__(
        self,
        session: Session,
        household_id: int,
    ) -> None:
        """Bind the service to one database session."""
        self._session = session
        self._household_id = household_id
        self._repository = TransactionRepository(
            session,
            household_id,
        )
        self._account_repository = AccountRepository(
            session,
            household_id,
        )
        self._execution_repository = ScheduleExecutionRepository(
            session,
            household_id,
        )

    def _ensure_not_schedule_linked(
        self,
        transaction_id: int,
    ) -> None:
        """Reject changes to transactions materialized from schedules."""
        if self._execution_repository.get_by_transaction_id(
            transaction_id,
        ):
            raise TransactionLinkedToScheduleError(
                "Schedule-generated transactions cannot be edited or "
                "deleted",
            )

    def _apply_delta_to_account(
        self,
        account_id: int,
        delta: Decimal,
    ) -> None:
        """Lock an account and apply a signed balance delta."""
        account = self._account_repository.get_by_id_for_update(
            account_id,
        )
        if account is None:
            raise AccountNotFoundError(
                f"Account {account_id} not found",
            )
        self._account_repository.apply_balance_delta(
            account,
            delta,
        )

    def persist_new_with_balance(
        self,
        *,
        account_id: int,
        amount: Decimal,
        transaction_type,
        occurred_on,
        description: str | None = None,
        category: str | None = None,
    ) -> Transaction:
        """Insert a transaction and balance delta without committing."""
        delta = balance_delta(transaction_type, amount)
        self._apply_delta_to_account(account_id, delta)
        transaction = self._repository.add(
            account_id=account_id,
            amount=amount,
            transaction_type=transaction_type,
            occurred_on=occurred_on,
            description=description,
            category=category,
        )
        self._session.flush()
        return transaction

    def create_with_balance(
        self,
        *,
        account_id: int,
        amount: Decimal,
        transaction_type,
        occurred_on,
        description: str | None = None,
        category: str | None = None,
    ) -> Transaction:
        """Insert a transaction and update balance in one commit."""
        try:
            transaction = self.persist_new_with_balance(
                account_id=account_id,
                amount=amount,
                transaction_type=transaction_type,
                occurred_on=occurred_on,
                description=description,
                category=category,
            )
            self._repository.commit()
            self._repository.refresh(transaction)
            return transaction
        except Exception:
            self._repository.rollback()
            raise

    def create(self, data: TransactionCreate) -> Transaction:
        """Persist a new transaction from incoming data."""
        return self.create_with_balance(
            account_id=data.account_id,
            amount=data.amount,
            transaction_type=data.transaction_type,
            occurred_on=data.occurred_on,
            description=data.description,
            category=data.category,
        )

    def list_all(self) -> list[Transaction]:
        """Return every stored transaction."""
        return self._repository.list_all()

    def get_by_id(self, transaction_id: int) -> Transaction | None:
        """Return one stored transaction, if it exists."""
        return self._repository.get_by_id(transaction_id)

    def update(
        self,
        transaction_id: int,
        data: TransactionUpdate,
    ) -> Transaction | None:
        """Fully update a stored transaction, if it exists."""
        transaction = self._repository.get_by_id(transaction_id)
        if transaction is None:
            return None
        self._ensure_not_schedule_linked(transaction_id)

        old_account_id = transaction.account_id
        new_account_id = data.account_id
        old_delta = balance_delta_for_transaction(transaction)
        new_delta = balance_delta(
            data.transaction_type,
            data.amount,
        )

        try:
            if old_account_id == new_account_id:
                self._apply_delta_to_account(
                    old_account_id,
                    new_delta - old_delta,
                )
            else:
                self._apply_delta_to_account(
                    old_account_id,
                    -old_delta,
                )
                self._apply_delta_to_account(
                    new_account_id,
                    new_delta,
                )

            self._repository.update_fields(
                transaction,
                account_id=data.account_id,
                amount=data.amount,
                transaction_type=data.transaction_type,
                occurred_on=data.occurred_on,
                description=data.description,
                category=data.category,
            )
            self._repository.commit()
            self._repository.refresh(transaction)
            return transaction
        except AccountNotFoundError:
            self._repository.rollback()
            raise
        except Exception:
            self._repository.rollback()
            raise

    def delete(self, transaction_id: int) -> bool:
        """Remove a transaction and reverse its balance effect."""
        transaction = self._repository.get_by_id(transaction_id)
        if transaction is None:
            return False
        self._ensure_not_schedule_linked(transaction_id)

        reversal = -balance_delta_for_transaction(transaction)
        try:
            self._apply_delta_to_account(
                transaction.account_id,
                reversal,
            )
            self._repository.delete_row(transaction)
            self._repository.commit()
            return True
        except Exception:
            self._repository.rollback()
            raise
