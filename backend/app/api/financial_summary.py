"""HTTP routes for financial summaries."""

from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query

from app.db.session import Session
from app.db.session import get_db
from app.schemas.financial_summary import FinancialSummaryQuery
from app.schemas.financial_summary import FinancialSummaryResponse
from app.services.financial_summary import FinancialSummaryService


router = APIRouter()


@router.get(
    "/financial-summary",
    response_model=FinancialSummaryResponse,
)
def get_financial_summary(
    query: Annotated[FinancialSummaryQuery, Query()],
    session: Session = Depends(get_db),
) -> FinancialSummaryResponse:
    """Return income, expenses, and net cash flow for a date range."""
    service = FinancialSummaryService(session)
    return service.get_summary(
        from_date=query.from_date,
        to_date=query.to_date,
    )
