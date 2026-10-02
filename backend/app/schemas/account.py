"""Pydantic schemas for the account API."""

from datetime import datetime

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field

from app.models.account import AccountType


class AccountCreate(BaseModel):
    """Incoming data for creating an account."""

    name: str = Field(min_length=1, max_length=100)
    account_type: AccountType
    currency: str = Field(
        default="EUR",
        min_length=3,
        max_length=3,
    )


class AccountResponse(BaseModel):
    """Account data returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    account_type: AccountType
    currency: str
    created_at: datetime
