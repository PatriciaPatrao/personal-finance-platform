"""HTTP routes for transactions."""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from app.api.deps import get_current_member
from app.api.transaction_helpers import transaction_response
from app.api.transaction_helpers import transaction_responses_for_list
from app.core.auth.context import AuthenticatedMember
from app.db.session import Session
from app.db.session import get_db
from app.schemas.transaction import TransactionCreate
from app.schemas.transaction import TransactionResponse
from app.schemas.transaction import TransactionUpdate
from app.services.transaction import AccountNotFoundError
from app.services.transaction import TransactionLinkedToScheduleError
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
    member: AuthenticatedMember = Depends(get_current_member),
) -> TransactionResponse:
    """Create a transaction and return the stored record."""
    service = TransactionService(session, member.household_id)
    try:
        transaction = service.create(data)
    except AccountNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    return transaction_response(
        session,
        transaction,
        household_id=member.household_id,
    )


@router.get(
    "/transactions",
    response_model=list[TransactionResponse],
)
def list_transactions(
    session: Session = Depends(get_db),
    member: AuthenticatedMember = Depends(get_current_member),
) -> list[TransactionResponse]:
    """Return every stored transaction."""
    service = TransactionService(session, member.household_id)
    transactions = service.list_all()
    return transaction_responses_for_list(
        session,
        transactions,
        household_id=member.household_id,
    )


@router.get(
    "/transactions/{transaction_id}",
    response_model=TransactionResponse,
)
def get_transaction(
    transaction_id: int,
    session: Session = Depends(get_db),
    member: AuthenticatedMember = Depends(get_current_member),
) -> TransactionResponse:
    """Return one stored transaction."""
    service = TransactionService(session, member.household_id)
    transaction = service.get_by_id(transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    return transaction_response(
        session,
        transaction,
        household_id=member.household_id,
    )


@router.put(
    "/transactions/{transaction_id}",
    response_model=TransactionResponse,
)
def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    session: Session = Depends(get_db),
    member: AuthenticatedMember = Depends(get_current_member),
) -> TransactionResponse:
    """Fully update a transaction and return the stored record."""
    service = TransactionService(session, member.household_id)
    try:
        transaction = service.update(transaction_id, data)
    except TransactionLinkedToScheduleError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        )
    except AccountNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    return transaction_response(
        session,
        transaction,
        household_id=member.household_id,
    )


@router.delete(
    "/transactions/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_transaction(
    transaction_id: int,
    session: Session = Depends(get_db),
    member: AuthenticatedMember = Depends(get_current_member),
) -> None:
    """Remove a transaction from the database."""
    service = TransactionService(session, member.household_id)
    try:
        deleted = service.delete(transaction_id)
    except TransactionLinkedToScheduleError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        )
    if deleted is False:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    return None
