"""Application logic for recording transactions."""

from app.db.session import Session
from app.models.transaction import Transaction
from app.repositories.transaction import TransactionRepository
from app.schemas.transaction import TransactionCreate


class TransactionService:
    """Coordinate creation of a transaction."""

    def __init__(self, session: Session) -> None:
        """Bind the service to one database session."""
        self._repository = TransactionRepository(session)

    def create(self, data: TransactionCreate) -> Transaction:
        """Persist a new transaction from incoming data."""
        return self._repository.create(
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

    def delete(self, transaction_id: int) -> bool:
        """Remove a transaction from the database."""
        return self._repository.delete(transaction_id)
