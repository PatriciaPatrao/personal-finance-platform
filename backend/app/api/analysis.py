"""HTTP routes for historical analysis."""

from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query

from app.db.session import Session
from app.db.session import get_db
from app.schemas.analysis import AnalysisCashFlowQuery
from app.schemas.analysis import AnalysisDateRangeQuery
from app.schemas.analysis import CashFlowResponse
from app.schemas.analysis import ExpensesByCategoryResponse
from app.schemas.financial_summary import FinancialSummaryResponse
from app.services.analysis import AnalysisService


router = APIRouter(prefix="/analysis")


@router.get(
    "/summary",
    response_model=FinancialSummaryResponse,
)
def get_analysis_summary(
    query: Annotated[AnalysisDateRangeQuery, Query()],
    session: Session = Depends(get_db),
) -> FinancialSummaryResponse:
    """Return historical income, expenses, and net cash flow."""
    service = AnalysisService(session)
    return service.get_summary(
        from_date=query.from_date,
        to_date=query.to_date,
    )


@router.get(
    "/expenses",
    response_model=ExpensesByCategoryResponse,
)
def get_analysis_expenses(
    query: Annotated[AnalysisDateRangeQuery, Query()],
    session: Session = Depends(get_db),
) -> ExpensesByCategoryResponse:
    """Return historical expenses grouped by category."""
    service = AnalysisService(session)
    return service.get_expenses_by_category(
        from_date=query.from_date,
        to_date=query.to_date,
    )


@router.get(
    "/cash-flow",
    response_model=CashFlowResponse,
)
def get_analysis_cash_flow(
    query: Annotated[AnalysisCashFlowQuery, Query()],
    session: Session = Depends(get_db),
) -> CashFlowResponse:
    """Return historical cash flow grouped by day or month."""
    service = AnalysisService(session)
    return service.get_cash_flow(
        from_date=query.from_date,
        to_date=query.to_date,
        group_by=query.group_by,
    )
