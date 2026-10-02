"""ORM tests for the Account ↔ Transaction relationship."""

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.account import AccountType
from app.models.transaction import Transaction
from app.models.transaction import TransactionType


def test_account_and_transaction_relationship_is_bidirectional(
    db_session: Session,
) -> None:
    """Account.transactions and Transaction.account load each other."""
    account = Account(
        name="Conta Principal",
        account_type=AccountType.BANK,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    transaction = Transaction(
        account_id=account.id,
        description="Supermercado",
        amount=Decimal("52.40"),
        transaction_type=TransactionType.EXPENSE,
        occurred_on=date(2026, 10, 1),
        category="Food",
    )
    db_session.add(transaction)
    db_session.commit()
    db_session.refresh(transaction)
    db_session.refresh(account)

    assert transaction.account.id == account.id
    assert any(
        item.id == transaction.id
        for item in account.transactions
    )
