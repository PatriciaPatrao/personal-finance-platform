"""HTTP routes for recurring expenses."""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from app.db.session import Session
from app.db.session import get_db
from app.schemas.recurring_expense import RecurringExpenseCreate
from app.schemas.recurring_expense import (
    RecurringExpenseResponse,
)
from app.schemas.recurring_expense import RecurringExpenseUpdate
from app.services.recurring_expense import AccountNotFoundError
from app.services.recurring_expense import (
    InvalidRecurringExpenseDatesError,
)
from app.services.recurring_expense import RecurringExpenseService


router = APIRouter()


@router.post(
    "/recurring-expenses",
    response_model=RecurringExpenseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_recurring_expense(
    data: RecurringExpenseCreate,
    session: Session = Depends(get_db),
) -> RecurringExpenseResponse:
    """Create a recurring expense and return the stored record."""
    service = RecurringExpenseService(session)
    try:
        recurring_expense = service.create(data)
    except AccountNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    except InvalidRecurringExpenseDatesError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )
    return RecurringExpenseResponse.model_validate(
        recurring_expense,
    )


@router.get(
    "/recurring-expenses",
    response_model=list[RecurringExpenseResponse],
)
def list_recurring_expenses(
    session: Session = Depends(get_db),
) -> list[RecurringExpenseResponse]:
    """Return every stored recurring expense."""
    service = RecurringExpenseService(session)
    recurring_expenses = service.list_all()
    return [
        RecurringExpenseResponse.model_validate(item)
        for item in recurring_expenses
    ]


@router.get(
    "/recurring-expenses/{recurring_expense_id}",
    response_model=RecurringExpenseResponse,
)
def get_recurring_expense(
    recurring_expense_id: int,
    session: Session = Depends(get_db),
) -> RecurringExpenseResponse:
    """Return one stored recurring expense."""
    service = RecurringExpenseService(session)
    recurring_expense = service.get_by_id(
        recurring_expense_id,
    )
    if recurring_expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring expense not found",
        )
    return RecurringExpenseResponse.model_validate(
        recurring_expense,
    )


@router.put(
    "/recurring-expenses/{recurring_expense_id}",
    response_model=RecurringExpenseResponse,
)
def update_recurring_expense(
    recurring_expense_id: int,
    data: RecurringExpenseUpdate,
    session: Session = Depends(get_db),
) -> RecurringExpenseResponse:
    """Fully update a recurring expense and return it."""
    service = RecurringExpenseService(session)
    try:
        recurring_expense = service.update(
            recurring_expense_id,
            data,
        )
    except AccountNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    except InvalidRecurringExpenseDatesError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )
    if recurring_expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring expense not found",
        )
    return RecurringExpenseResponse.model_validate(
        recurring_expense,
    )
