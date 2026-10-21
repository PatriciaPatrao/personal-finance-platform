"""HTTP routes for forecasts."""

from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query

from app.api.deps import get_current_member
from app.core.auth.context import AuthenticatedMember
from app.db.session import Session
from app.db.session import get_db
from app.schemas.forecast import ForecastQuery
from app.schemas.forecast import ForecastResponse
from app.services.forecast import ForecastAccountNotFoundError
from app.services.forecast import ForecastService


router = APIRouter()


@router.get(
    "/forecast",
    response_model=ForecastResponse,
)
def get_forecast(
    query: Annotated[ForecastQuery, Query()],
    session: Session = Depends(get_db),
    member: AuthenticatedMember = Depends(get_current_member),
) -> ForecastResponse:
    """Return projected income, expenses, and balances."""
    service = ForecastService(session, member.household_id)
    try:
        return service.get_forecast(
            from_date=query.from_date,
            to_date=query.to_date,
            group_by=query.group_by,
            group_by_overrides=query.group_by_overrides,
            account_id=query.account_id,
        )
    except ForecastAccountNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error
