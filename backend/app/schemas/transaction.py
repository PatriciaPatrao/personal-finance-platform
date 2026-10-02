"""Pydantic schemas for the transaction API."""

from datetime import date
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field

from app.models.transaction import TransactionType


class TransactionCreate(BaseModel):
    """Incoming data for creating a transaction."""

    account_id: int
    description: str | None = None
    amount: Decimal = Field(gt=0)
    transaction_type: TransactionType
    occurred_on: date
    category: str | None = None


class TransactionUpdate(BaseModel):
    """Incoming data for fully updating a transaction."""

    account_id: int
    description: str | None
    amount: Decimal = Field(gt=0)
    transaction_type: TransactionType
    occurred_on: date
    category: str | None


class TransactionResponse(BaseModel):
    """Transaction data returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    description: str | None = None
    amount: Decimal = Field(gt=0)
    transaction_type: TransactionType
    occurred_on: date
    category: str | None = None
    created_at: datetime
