"""HTTP routes for financial goals and allocations."""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from app.db.session import Session
from app.db.session import get_db
from app.schemas.financial_goal import FinancialGoalCreate
from app.schemas.financial_goal import FinancialGoalResponse
from app.schemas.financial_goal import FinancialGoalUpdate
from app.schemas.financial_goal import GoalAllocationCreate
from app.schemas.financial_goal import GoalAllocationUpdate
from app.services.financial_goal import AccountNotFoundError
from app.services.financial_goal import AllocationAlreadyExistsError
from app.services.financial_goal import AllocationCapacityExceededError
from app.services.financial_goal import AllocationNotFoundError
from app.services.financial_goal import CurrencyChangeBlockedError
from app.services.financial_goal import CurrencyMismatchError
from app.services.financial_goal import FinancialGoalService
from app.services.financial_goal import GoalNotFoundError


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
    return service.create(data)


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
    except CurrencyChangeBlockedError as error:
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


@router.post(
    "/financial-goals/{goal_id}/allocations",
    response_model=FinancialGoalResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_goal_allocation(
    goal_id: int,
    data: GoalAllocationCreate,
    session: Session = Depends(get_db),
) -> FinancialGoalResponse:
    """Create an allocation for a goal and return the goal."""
    service = FinancialGoalService(session)
    try:
        return service.create_allocation(goal_id, data)
    except GoalNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial goal not found",
        )
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
    except AllocationAlreadyExistsError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )
    except AllocationCapacityExceededError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )


@router.put(
    "/financial-goals/{goal_id}/allocations/{allocation_id}",
    response_model=FinancialGoalResponse,
)
def update_goal_allocation(
    goal_id: int,
    allocation_id: int,
    data: GoalAllocationUpdate,
    session: Session = Depends(get_db),
) -> FinancialGoalResponse:
    """Update an allocation amount and return the goal."""
    service = FinancialGoalService(session)
    try:
        return service.update_allocation(goal_id, allocation_id, data)
    except GoalNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial goal not found",
        )
    except AllocationNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allocation not found",
        )
    except AccountNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    except AllocationCapacityExceededError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )


@router.delete(
    "/financial-goals/{goal_id}/allocations/{allocation_id}",
    response_model=FinancialGoalResponse,
)
def delete_goal_allocation(
    goal_id: int,
    allocation_id: int,
    session: Session = Depends(get_db),
) -> FinancialGoalResponse:
    """Delete an allocation and return the goal."""
    service = FinancialGoalService(session)
    try:
        return service.delete_allocation(goal_id, allocation_id)
    except GoalNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial goal not found",
        )
    except AllocationNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allocation not found",
        )
