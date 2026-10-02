"""Pydantic schemas for the recurring expense API."""

from datetime import date
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field

from app.models.recurring_expense import RecurringFrequency


class RecurringExpenseCreate(BaseModel):
    """Incoming data for creating a recurring expense."""

    account_id: int
    description: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(gt=0)
    category: str | None = None
    frequency: RecurringFrequency
    start_date: date
    next_occurrence: date
    end_date: date | None = None
    active: bool = True


class RecurringExpenseUpdate(BaseModel):
    """Incoming data for fully updating a recurring expense."""

    account_id: int
    description: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(gt=0)
    category: str | None
    frequency: RecurringFrequency
    start_date: date
    next_occurrence: date
    end_date: date | None
    active: bool


class RecurringExpenseResponse(BaseModel):
    """Recurring expense data returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    description: str
    amount: Decimal = Field(gt=0)
    category: str | None = None
    frequency: RecurringFrequency
    start_date: date
    next_occurrence: date
    end_date: date | None = None
    active: bool
    created_at: datetime
