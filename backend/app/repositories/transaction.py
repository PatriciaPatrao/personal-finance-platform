"""Persistence for transaction records."""

from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.db.session import Session
from app.models.transaction import Transaction
from app.models.transaction import TransactionType


class TransactionRepository:
    """Store transaction rows."""

    def __init__(self, session: Session) -> None:
        """Bind the repository to one database session."""
        self._session = session

    def create(
        self,
        account_id: int,
        amount: Decimal,
        transaction_type: TransactionType,
        occurred_on: date,
        description: str | None = None,
        category: str | None = None,
    ) -> Transaction:
        """Insert a transaction and return it with generated fields."""
        transaction = Transaction(
            account_id=account_id,
            description=description,
            amount=amount,
            transaction_type=transaction_type,
            occurred_on=occurred_on,
            category=category,
        )
        self._session.add(transaction)
        self._session.commit()
        self._session.refresh(transaction)
        return transaction

    def list_all(self) -> list[Transaction]:
        """Return every transaction, newest first."""
        statement = select(Transaction).order_by(
            Transaction.occurred_on.desc(),
            Transaction.id.desc(),
        )
        return list(self._session.scalars(statement).all())

    def get_by_id(self, transaction_id: int) -> Transaction | None:
        """Return one transaction by its primary key, if it exists."""
        statement = select(Transaction).where(
            Transaction.id == transaction_id,
        )
        return self._session.scalars(statement).one_or_none()

    def delete(self, transaction_id: int) -> bool:
        """Remove a transaction from the database."""
        # TODO: consider soft delete because financial transactions may need an audit trail
        transaction = self.get_by_id(transaction_id)
        if transaction is None:
            return False
        self._session.delete(transaction)
        self._session.commit()
        return True
