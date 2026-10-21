"""Persistence for transaction records."""

from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.db.session import Session
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.transaction import TransactionType


class TransactionRepository:
    """Store transaction rows scoped to one household."""

    def __init__(
        self,
        session: Session,
        household_id: int,
    ) -> None:
        """Bind the repository to one database session."""
        self._session = session
        self._household_id = household_id

    def add(
        self,
        account_id: int,
        amount: Decimal,
        transaction_type: TransactionType,
        occurred_on: date,
        description: str | None = None,
        category: str | None = None,
    ) -> Transaction:
        """Insert a transaction in the current session without committing."""
        transaction = Transaction(
            account_id=account_id,
            description=description,
            amount=amount,
            transaction_type=transaction_type,
            occurred_on=occurred_on,
            category=category,
        )
        self._session.add(transaction)
        return transaction

    def create(
        self,
        account_id: int,
        amount: Decimal,
        transaction_type: TransactionType,
        occurred_on: date,
        description: str | None = None,
        category: str | None = None,
    ) -> Transaction:
        """Insert a transaction and commit (legacy callers)."""
        transaction = self.add(
            account_id=account_id,
            amount=amount,
            transaction_type=transaction_type,
            occurred_on=occurred_on,
            description=description,
            category=category,
        )
        self._session.commit()
        self._session.refresh(transaction)
        return transaction

    def list_all(self) -> list[Transaction]:
        """Return every transaction in the household, newest first."""
        statement = (
            select(Transaction)
            .join(Account, Transaction.account_id == Account.id)
            .where(Account.household_id == self._household_id)
            .order_by(
                Transaction.occurred_on.desc(),
                Transaction.id.desc(),
            )
        )
        return list(self._session.scalars(statement).all())

    def get_by_id(self, transaction_id: int) -> Transaction | None:
        """Return one transaction in this household, if it exists."""
        statement = (
            select(Transaction)
            .join(Account, Transaction.account_id == Account.id)
            .where(
                Transaction.id == transaction_id,
                Account.household_id == self._household_id,
            )
        )
        return self._session.scalars(statement).one_or_none()

    def update_fields(
        self,
        transaction: Transaction,
        account_id: int,
        amount: Decimal,
        transaction_type: TransactionType,
        occurred_on: date,
        description: str | None = None,
        category: str | None = None,
    ) -> Transaction:
        """Update editable fields on a session-bound transaction."""
        transaction.account_id = account_id
        transaction.description = description
        transaction.amount = amount
        transaction.transaction_type = transaction_type
        transaction.occurred_on = occurred_on
        transaction.category = category
        return transaction

    def update(
        self,
        transaction_id: int,
        account_id: int,
        amount: Decimal,
        transaction_type: TransactionType,
        occurred_on: date,
        description: str | None = None,
        category: str | None = None,
    ) -> Transaction | None:
        """Update editable fields on a transaction and commit."""
        transaction = self.get_by_id(transaction_id)
        if transaction is None:
            return None
        self.update_fields(
            transaction,
            account_id=account_id,
            amount=amount,
            transaction_type=transaction_type,
            occurred_on=occurred_on,
            description=description,
            category=category,
        )
        self._session.commit()
        self._session.refresh(transaction)
        return transaction

    def delete_row(self, transaction: Transaction) -> None:
        """Remove a session-bound transaction without committing."""
        self._session.delete(transaction)

    def delete(self, transaction_id: int) -> bool:
        """Remove a transaction from the database."""
        transaction = self.get_by_id(transaction_id)
        if transaction is None:
            return False
        self.delete_row(transaction)
        self._session.commit()
        return True

    def commit(self) -> None:
        """Commit the current session."""
        self._session.commit()

    def rollback(self) -> None:
        """Roll back the current session."""
        self._session.rollback()

    def refresh(self, transaction: Transaction) -> None:
        """Refresh a transaction from the database."""
        self._session.refresh(transaction)
