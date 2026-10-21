"""Persistence for account records."""

from decimal import Decimal

from sqlalchemy import select

from app.db.session import Session
from app.models.account import Account
from app.models.account import AccountType


class AccountRepository:
    """Store account rows scoped to one household."""

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
        name: str,
        account_type: AccountType,
        currency: str = "EUR",
        current_balance: Decimal = Decimal("0.00"),
    ) -> Account:
        """Insert an account and return it with generated fields."""
        account = Account(
            household_id=self._household_id,
            name=name,
            account_type=account_type,
            currency=currency,
            current_balance=current_balance,
        )
        self._session.add(account)
        self._session.commit()
        self._session.refresh(account)
        return account

    def list_all(self) -> list[Account]:
        """Return every account in the household, newest first."""
        statement = (
            select(Account)
            .where(Account.household_id == self._household_id)
            .order_by(
                Account.created_at.desc(),
                Account.id.desc(),
            )
        )
        return list(self._session.scalars(statement).all())

    def get_by_id(self, account_id: int) -> Account | None:
        """Return one account by primary key in this household."""
        statement = select(Account).where(
            Account.id == account_id,
            Account.household_id == self._household_id,
        )
        return self._session.scalars(statement).one_or_none()

    def get_by_id_for_update(
        self,
        account_id: int,
    ) -> Account | None:
        """Lock one account row in this household."""
        statement = (
            select(Account)
            .where(
                Account.id == account_id,
                Account.household_id == self._household_id,
            )
            .with_for_update()
        )
        return self._session.scalars(statement).one_or_none()

    def apply_balance_delta(
        self,
        account: Account,
        delta: Decimal,
    ) -> None:
        """Adjust stored balance on a locked or session-bound account row."""
        account.current_balance = account.current_balance + delta
