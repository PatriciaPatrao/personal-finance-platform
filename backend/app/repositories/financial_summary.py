"""Persistence for financial summary aggregates."""

from datetime import date
from decimal import Decimal

from sqlalchemy import case
from sqlalchemy import func
from sqlalchemy import select

from app.db.session import Session
from app.models.transaction import Transaction
from app.models.transaction import TransactionType


_ZERO = Decimal("0.00")


class FinancialSummaryRepository:
    """Query aggregated income and expense totals."""

    def __init__(self, session: Session) -> None:
        """Bind the repository to one database session."""
        self._session = session

    def get_totals(
        self,
        from_date: date,
        to_date: date,
    ) -> tuple[Decimal, Decimal]:
        """
        Return total income and total expenses for the inclusive range.

        Uses SQL SUM so rows are not loaded into Python.
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
        statement = select(
            income_sum,
            expense_sum,
        ).where(
            Transaction.occurred_on >= from_date,
            Transaction.occurred_on <= to_date,
        )
        row = self._session.execute(statement).one()
        total_income = self._as_money(row[0])
        total_expenses = self._as_money(row[1])
        return total_income, total_expenses

    @staticmethod
    def _as_money(value: Decimal | int | None) -> Decimal:
        """Normalize an aggregate result to two decimal places."""
        if value is None:
            return _ZERO
        return Decimal(value).quantize(_ZERO)
