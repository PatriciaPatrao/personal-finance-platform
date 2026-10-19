"""Persistence queries for historical analysis aggregates."""

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


class AnalysisRepository:
    """Query historical transaction aggregates for analysis."""

    def __init__(self, session: Session) -> None:
        """Bind the repository to one database session."""
        self._session = session

    def get_expenses_by_category(
        self,
        from_date: date,
        to_date: date,
    ) -> list[tuple[str, str | None, Decimal]]:
        """
        Return expense totals grouped by account currency and category.

        Null categories stay null so the service can map them.
        """
        amount_sum = func.coalesce(func.sum(Transaction.amount), 0)
        statement = (
            select(
                Account.currency,
                Transaction.category,
                amount_sum,
            )
            .select_from(Transaction)
            .join(Account, Transaction.account_id == Account.id)
            .where(
                Transaction.transaction_type
                == TransactionType.EXPENSE,
                Transaction.occurred_on >= from_date,
                Transaction.occurred_on <= to_date,
            )
            .group_by(Account.currency, Transaction.category)
            .order_by(Account.currency, Transaction.category)
        )
        rows = self._session.execute(statement).all()
        return [
            (currency, category, self._as_money(amount))
            for currency, category, amount in rows
        ]

    def get_daily_totals(
        self,
        from_date: date,
        to_date: date,
    ) -> list[tuple[date, str, Decimal, Decimal]]:
        """
        Return income and expense totals for each day and currency with rows.

        Days with no transactions are omitted; the service fills empty periods.
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
                Transaction.occurred_on,
                Account.currency,
                income_sum,
                expense_sum,
            )
            .select_from(Transaction)
            .join(Account, Transaction.account_id == Account.id)
            .where(
                Transaction.occurred_on >= from_date,
                Transaction.occurred_on <= to_date,
            )
            .group_by(Transaction.occurred_on, Account.currency)
            .order_by(Account.currency, Transaction.occurred_on)
        )
        rows = self._session.execute(statement).all()
        return [
            (
                occurred_on,
                currency,
                self._as_money(income),
                self._as_money(expenses),
            )
            for occurred_on, currency, income, expenses in rows
        ]

    @staticmethod
    def _as_money(value: Decimal | int | None) -> Decimal:
        """Normalize an aggregate result to two decimal places."""
        if value is None:
            return _ZERO
        return Decimal(value).quantize(_ZERO)
