"""Household membership routes."""

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from app.api.deps import get_current_member
from app.api.deps import require_owner
from app.core.auth.context import AuthenticatedMember
from app.db.session import Session
from app.db.session import get_db
from app.schemas.household import HouseholdInvitationAccept
from app.schemas.household import HouseholdInvitationCreateResponse
from app.schemas.household import HouseholdMeResponse
from app.schemas.household import HouseholdMemberCreate
from app.schemas.household import HouseholdMemberResponse
from app.services.household import HouseholdService
from app.services.household import InvalidInvitationError
from app.services.household import InvitationExpiredError
from app.services.household import MembershipConflictError


router = APIRouter(prefix="/households", tags=["households"])


@router.get(
    "/me",
    response_model=HouseholdMeResponse,
)
def get_household_me(
    member: AuthenticatedMember = Depends(get_current_member),
) -> HouseholdMeResponse:
    """Return the authenticated user's household membership."""
    return HouseholdMeResponse(
        household_id=member.household_id,
        user_sub=member.user_sub,
        role=member.role.value,
    )


@router.post(
    "/invitations",
    response_model=HouseholdInvitationCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_household_invitation(
    member: AuthenticatedMember = Depends(require_owner),
    session: Session = Depends(get_db),
) -> HouseholdInvitationCreateResponse:
    """Create a time-limited invitation for another user to join."""
    service = HouseholdService(session)
    token, expires_at = service.create_invitation(
        owner_household_id=member.household_id,
    )
    return HouseholdInvitationCreateResponse(
        token=token,
        expires_at=expires_at,
    )


@router.post(
    "/invitations/accept",
    response_model=HouseholdMemberResponse,
)
def accept_household_invitation(
    data: HouseholdInvitationAccept,
    member: AuthenticatedMember = Depends(get_current_member),
    session: Session = Depends(get_db),
) -> HouseholdMemberResponse:
    """Join a household using an invitation and the JWT subject."""
    service = HouseholdService(session)
    try:
        created = service.accept_invitation(
            token=data.token,
            user_sub=member.user_sub,
        )
    except InvalidInvitationError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        )
    except InvitationExpiredError as error:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=str(error),
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
    """Add a member by Auth0 subject when the owner already knows it."""
    service = HouseholdService(session)
    try:
        created = service.add_member(
            owner_household_id=member.household_id,
            owner_user_sub=member.user_sub,
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
