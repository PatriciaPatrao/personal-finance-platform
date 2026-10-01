"""HTTP routes for transactions."""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import status

from app.db.session import Session
from app.db.session import get_db
from app.schemas.transaction import TransactionCreate
from app.schemas.transaction import TransactionResponse
from app.services.transaction import TransactionService


router = APIRouter()


@router.post(
    "/transactions",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(
    data: TransactionCreate,
    session: Session = Depends(get_db),
) -> TransactionResponse:
    """Create a transaction and return the stored record."""
    service = TransactionService(session)
    transaction = service.create(data)
    return TransactionResponse.model_validate(transaction)
