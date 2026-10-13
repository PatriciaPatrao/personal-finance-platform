"""Signed balance deltas from transaction fields."""

from decimal import Decimal

from app.models.transaction import Transaction
from app.models.transaction import TransactionType


def balance_delta(
    transaction_type: TransactionType,
    amount: Decimal,
) -> Decimal:
    """Return the change to apply to Account.current_balance."""
    if transaction_type == TransactionType.INCOME:
        return amount
    return -amount


def balance_delta_for_transaction(transaction: Transaction) -> Decimal:
    """Return the balance effect of a stored transaction row."""
    return balance_delta(
        transaction.transaction_type,
        transaction.amount,
    )
