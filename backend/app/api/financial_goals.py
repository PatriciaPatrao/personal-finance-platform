"""HTTP routes for financial goals."""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from app.db.session import Session
from app.db.session import get_db
from app.schemas.financial_goal import FinancialGoalCreate
from app.schemas.financial_goal import FinancialGoalResponse
from app.schemas.financial_goal import FinancialGoalUpdate
from app.services.financial_goal import AccountAlreadyHasGoalError
from app.services.financial_goal import AccountNotFoundError
from app.services.financial_goal import CurrencyMismatchError
from app.services.financial_goal import FinancialGoalService


router = APIRouter()


@router.post(
    "/financial-goals",
    response_model=FinancialGoalResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_financial_goal(
    data: FinancialGoalCreate,
    session: Session = Depends(get_db),
) -> FinancialGoalResponse:
    """Create a financial goal and return it."""
    service = FinancialGoalService(session)
    try:
        return service.create(data)
    except AccountNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    except CurrencyMismatchError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )
    except AccountAlreadyHasGoalError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )


@router.get(
    "/financial-goals",
    response_model=list[FinancialGoalResponse],
)
def list_financial_goals(
    session: Session = Depends(get_db),
) -> list[FinancialGoalResponse]:
    """Return every stored financial goal."""
    service = FinancialGoalService(session)
    return service.list_all()


@router.get(
    "/financial-goals/{goal_id}",
    response_model=FinancialGoalResponse,
)
def get_financial_goal(
    goal_id: int,
    session: Session = Depends(get_db),
) -> FinancialGoalResponse:
    """Return one stored financial goal."""
    service = FinancialGoalService(session)
    goal = service.get_by_id(goal_id)
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial goal not found",
        )
    return goal


@router.put(
    "/financial-goals/{goal_id}",
    response_model=FinancialGoalResponse,
)
def update_financial_goal(
    goal_id: int,
    data: FinancialGoalUpdate,
    session: Session = Depends(get_db),
) -> FinancialGoalResponse:
    """Fully update a financial goal and return it."""
    service = FinancialGoalService(session)
    try:
        goal = service.update(goal_id, data)
    except AccountNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    except CurrencyMismatchError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )
    except AccountAlreadyHasGoalError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial goal not found",
        )
    return goal
