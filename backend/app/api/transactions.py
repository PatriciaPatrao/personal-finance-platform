"""HTTP routes for transactions."""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
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


@router.get(
    "/transactions",
    response_model=list[TransactionResponse],
)
def list_transactions(
    session: Session = Depends(get_db),
) -> list[TransactionResponse]:
    """Return every stored transaction."""
    service = TransactionService(session)
    transactions = service.list_all()
    return [
        TransactionResponse.model_validate(transaction)
        for transaction in transactions
    ]


@router.get(
    "/transactions/{transaction_id}",
    response_model=TransactionResponse,
)
def get_transaction(
    transaction_id: int,
    session: Session = Depends(get_db),
) -> TransactionResponse:
    """Return one stored transaction."""
    service = TransactionService(session)
    transaction = service.get_by_id(transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    return TransactionResponse.model_validate(transaction)


@router.delete(
    "/transactions/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_transaction(
    transaction_id: int,
    session: Session = Depends(get_db),
) -> None:
    """Remove a transaction from the database."""
    service = TransactionService(session)
    deleted = service.delete(transaction_id)
    if deleted is False:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    return None
