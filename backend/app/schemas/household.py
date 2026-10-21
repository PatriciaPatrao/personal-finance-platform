"""Schemas for household membership."""

from datetime import datetime

from pydantic import BaseModel
from pydantic import Field


class HouseholdMemberCreate(BaseModel):
    """Request body to add a household member by Auth0 subject."""

    user_sub: str = Field(min_length=1, max_length=255)


class HouseholdMemberResponse(BaseModel):
    """Stored household membership."""

    id: int
    household_id: int
    user_sub: str
    role: str


class HouseholdMeResponse(BaseModel):
    """Authenticated user's household membership."""

    household_id: int
    user_sub: str
    role: str


class HouseholdInvitationCreateResponse(BaseModel):
    """New invitation token for the owner to share."""

    token: str
    expires_at: datetime


class HouseholdInvitationAccept(BaseModel):
    """Redeem an invitation after Auth0 sign-in."""

    token: str = Field(min_length=16, max_length=512)
