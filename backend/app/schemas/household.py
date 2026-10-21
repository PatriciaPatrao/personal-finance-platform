"""Schemas for household membership."""

from pydantic import BaseModel
from pydantic import Field


class HouseholdMemberCreate(BaseModel):
    """Request body to add a household member."""

    user_sub: str = Field(min_length=1, max_length=255)


class HouseholdMemberResponse(BaseModel):
    """Stored household membership."""

    id: int
    household_id: int
    user_sub: str
    role: str
