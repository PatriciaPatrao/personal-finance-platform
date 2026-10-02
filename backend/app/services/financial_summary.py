"""Application logic for financial summaries."""

from datetime import date

from app.db.session import Session
from app.repositories.financial_summary import (
    FinancialSummaryRepository,
)
from app.schemas.financial_summary import FinancialSummaryResponse


class FinancialSummaryService:
    """Coordinate financial summary calculation."""

    def __init__(self, session: Session) -> None:
        """Bind the service to one database session."""
        self._repository = FinancialSummaryRepository(session)

    def get_summary(
        self,
        from_date: date,
        to_date: date,
    ) -> FinancialSummaryResponse:
        """Return income, expenses, and net cash flow for a period."""
        total_income, total_expenses = self._repository.get_totals(
            from_date=from_date,
            to_date=to_date,
        )
        net_cash_flow = total_income - total_expenses
        return FinancialSummaryResponse(
            from_date=from_date,
            to_date=to_date,
            total_income=total_income,
            total_expenses=total_expenses,
            net_cash_flow=net_cash_flow,
        )
