"""Household membership routes."""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from app.api.deps import require_owner
from app.core.auth.context import AuthenticatedMember
from app.db.session import Session
from app.db.session import get_db
from app.schemas.household import HouseholdMemberCreate
from app.schemas.household import HouseholdMemberResponse
from app.services.household import HouseholdService
from app.services.household import MembershipConflictError


router = APIRouter(prefix="/households", tags=["households"])


@router.post(
    "/members",
    response_model=HouseholdMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_household_member(
    data: HouseholdMemberCreate,
    member: AuthenticatedMember = Depends(require_owner),
    session: Session = Depends(get_db),
) -> HouseholdMemberResponse:
    """Add a member to the authenticated owner's household."""
    service = HouseholdService(session)
    try:
        created = service.add_member(
            owner_household_id=member.household_id,
            user_sub=data.user_sub,
        )
    except MembershipConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        )
    return HouseholdMemberResponse(
        id=created.id,
        household_id=created.household_id,
        user_sub=created.user_sub,
        role=created.role.value,
    )
