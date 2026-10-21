"""HTTP routes for accounts."""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from app.api.deps import get_current_member
from app.core.auth.context import AuthenticatedMember
from app.db.session import Session
from app.db.session import get_db
from app.schemas.account import AccountCreate
from app.schemas.account import AccountResponse
from app.services.account import AccountService


router = APIRouter()


@router.post(
    "/accounts",
    response_model=AccountResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_account(
    data: AccountCreate,
    session: Session = Depends(get_db),
    member: AuthenticatedMember = Depends(get_current_member),
) -> AccountResponse:
    """Create an account and return the stored record."""
    service = AccountService(session, member.household_id)
    account = service.create(data)
    return AccountResponse.model_validate(account)


@router.get(
    "/accounts",
    response_model=list[AccountResponse],
)
def list_accounts(
    session: Session = Depends(get_db),
    member: AuthenticatedMember = Depends(get_current_member),
) -> list[AccountResponse]:
    """Return every stored account."""
    service = AccountService(session, member.household_id)
    accounts = service.list_all()
    return [
        AccountResponse.model_validate(account)
        for account in accounts
    ]


@router.get(
    "/accounts/{account_id}",
    response_model=AccountResponse,
)
def get_account(
    account_id: int,
    session: Session = Depends(get_db),
    member: AuthenticatedMember = Depends(get_current_member),
) -> AccountResponse:
    """Return one stored account."""
    service = AccountService(session, member.household_id)
    account = service.get_by_id(account_id)
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    return AccountResponse.model_validate(account)
