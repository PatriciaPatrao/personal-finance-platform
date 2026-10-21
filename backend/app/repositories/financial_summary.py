"""Persistence for financial summary aggregates."""

from datetime import date
from decimal import Decimal

from sqlalchemy import case
from sqlalchemy import func
from sqlalchemy import select

from app.db.session import Session
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.transaction import TransactionType


_ZERO = Decimal("0.00")


class FinancialSummaryRepository:
    """Query aggregated income and expense totals."""

    def __init__(
        self,
        session: Session,
        household_id: int,
    ) -> None:
        """Bind the repository to one database session."""
        self._session = session
        self._household_id = household_id

    def get_totals_by_currency(
        self,
        from_date: date,
        to_date: date,
    ) -> list[tuple[str, Decimal, Decimal]]:
        """
        Return total income and expenses per account currency.

        Uses SQL SUM grouped by currency so rows are not loaded into Python.
        """
        income_sum = func.coalesce(
            func.sum(
                case(
                    (
                        Transaction.transaction_type
                        == TransactionType.INCOME,
                        Transaction.amount,
                    ),
                    else_=0,
                ),
            ),
            0,
        )
        expense_sum = func.coalesce(
            func.sum(
                case(
                    (
                        Transaction.transaction_type
                        == TransactionType.EXPENSE,
                        Transaction.amount,
                    ),
                    else_=0,
                ),
            ),
            0,
        )
        statement = (
            select(
                Account.currency,
                income_sum,
                expense_sum,
            )
            .select_from(Transaction)
            .join(Account, Transaction.account_id == Account.id)
            .where(
                Account.household_id == self._household_id,
                Transaction.occurred_on >= from_date,
                Transaction.occurred_on <= to_date,
            )
            .group_by(Account.currency)
            .order_by(Account.currency)
        )
        rows = self._session.execute(statement).all()
        return [
            (
                currency,
                self._as_money(income),
                self._as_money(expenses),
            )
            for currency, income, expenses in rows
        ]

    @staticmethod
    def _as_money(value: Decimal | int | None) -> Decimal:
        """Normalize an aggregate result to two decimal places."""
        if value is None:
            return _ZERO
        return Decimal(value).quantize(_ZERO)
