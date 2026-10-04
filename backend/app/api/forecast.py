"""HTTP routes for forecasts."""

from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query

from app.db.session import Session
from app.db.session import get_db
from app.schemas.forecast import ForecastQuery
from app.schemas.forecast import ForecastResponse
from app.services.forecast import ForecastService


router = APIRouter()


@router.get(
    "/forecast",
    response_model=ForecastResponse,
)
def get_forecast(
    query: Annotated[ForecastQuery, Query()],
    session: Session = Depends(get_db),
) -> ForecastResponse:
    """Return projected income, expenses, and balances."""
    service = ForecastService(session)
    return service.get_forecast(
        from_date=query.from_date,
        to_date=query.to_date,
        group_by=query.group_by,
    )
