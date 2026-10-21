"""Application logic for financial summaries."""

from datetime import date
from decimal import Decimal

from app.db.session import Session
from app.repositories.financial_summary import (
    FinancialSummaryRepository,
)
from app.schemas.financial_summary import CurrencyFinancialTotals
from app.schemas.financial_summary import FinancialSummaryResponse


_ZERO = Decimal("0.00")


class FinancialSummaryService:
    """Coordinate financial summary calculation."""

    def __init__(
        self,
        session: Session,
        household_id: int,
    ) -> None:
        """Bind the service to one database session."""
        self._repository = FinancialSummaryRepository(
            session,
            household_id,
        )

    def get_summary(
        self,
        from_date: date,
        to_date: date,
    ) -> FinancialSummaryResponse:
        """Return income, expenses, and net cash flow per currency."""
        rows = self._repository.get_totals_by_currency(
            from_date=from_date,
            to_date=to_date,
        )
        by_currency = [
            CurrencyFinancialTotals(
                currency=currency,
                total_income=total_income,
                total_expenses=total_expenses,
                net_cash_flow=total_income - total_expenses,
            )
            for currency, total_income, total_expenses in rows
        ]
        return FinancialSummaryResponse(
            from_date=from_date,
            to_date=to_date,
            by_currency=by_currency,
        )
