"""Application logic for managing accounts."""

from app.db.session import Session
from app.models.account import Account
from app.repositories.account import AccountRepository
from app.schemas.account import AccountCreate


class AccountService:
    """Coordinate account operations."""

    def __init__(self, session: Session) -> None:
        """Bind the service to one database session."""
        self._repository = AccountRepository(session)

    def create(self, data: AccountCreate) -> Account:
        """Persist a new account from incoming data."""
        return self._repository.create(
            name=data.name,
            account_type=data.account_type,
            currency=data.currency,
        )

    def list_all(self) -> list[Account]:
        """Return every stored account."""
        return self._repository.list_all()

    def get_by_id(self, account_id: int) -> Account | None:
        """Return one stored account, if it exists."""
        return self._repository.get_by_id(account_id)
