"""Persistence for transaction records."""

from datetime import date
from decimal import Decimal

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
        amount: Decimal,
        transaction_type: TransactionType,
        occurred_on: date,
        description: str | None = None,
        category: str | None = None,
    ) -> Transaction:
        """Insert a transaction and return it with generated fields."""
        transaction = Transaction(
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
