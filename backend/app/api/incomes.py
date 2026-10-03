"""HTTP routes for incomes."""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from app.db.session import Session
from app.db.session import get_db
from app.schemas.income import IncomeCreate
from app.schemas.income import IncomeResponse
from app.schemas.income import IncomeUpdate
from app.services.income import AccountNotFoundError
from app.services.income import IncomeService
from app.services.income import InvalidIncomeDatesError


router = APIRouter()


@router.post(
    "/incomes",
    response_model=IncomeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_income(
    data: IncomeCreate,
    session: Session = Depends(get_db),
) -> IncomeResponse:
    """Create an income and return the stored record."""
    service = IncomeService(session)
    try:
        income = service.create(data)
    except AccountNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    except InvalidIncomeDatesError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )
    return IncomeResponse.model_validate(income)


@router.get(
    "/incomes",
    response_model=list[IncomeResponse],
)
def list_incomes(
    session: Session = Depends(get_db),
) -> list[IncomeResponse]:
    """Return every stored income."""
    service = IncomeService(session)
    incomes = service.list_all()
    return [
        IncomeResponse.model_validate(item)
        for item in incomes
    ]


@router.get(
    "/incomes/{income_id}",
    response_model=IncomeResponse,
)
def get_income(
    income_id: int,
    session: Session = Depends(get_db),
) -> IncomeResponse:
    """Return one stored income."""
    service = IncomeService(session)
    income = service.get_by_id(income_id)
    if income is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Income not found",
        )
    return IncomeResponse.model_validate(income)


@router.put(
    "/incomes/{income_id}",
    response_model=IncomeResponse,
)
def update_income(
    income_id: int,
    data: IncomeUpdate,
    session: Session = Depends(get_db),
) -> IncomeResponse:
    """Fully update an income and return it."""
    service = IncomeService(session)
    try:
        income = service.update(income_id, data)
    except AccountNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    except InvalidIncomeDatesError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )
    if income is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Income not found",
        )
    return IncomeResponse.model_validate(income)
