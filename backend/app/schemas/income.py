"""Pydantic schemas for the income API."""

from datetime import date
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field

from app.models.income import IncomeFrequency


class IncomeCreate(BaseModel):
    """Incoming data for creating an income."""

    account_id: int
    amount: Decimal = Field(gt=0)
    frequency: IncomeFrequency
    start_date: date
    next_occurrence: date
    end_date: date | None = None
    active: bool = True


class IncomeUpdate(BaseModel):
    """Incoming data for fully updating an income."""

    account_id: int
    amount: Decimal = Field(gt=0)
    frequency: IncomeFrequency
    start_date: date
    next_occurrence: date
    end_date: date | None
    active: bool


class IncomeResponse(BaseModel):
    """Income data returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    amount: Decimal = Field(gt=0)
    frequency: IncomeFrequency
    start_date: date
    next_occurrence: date
    end_date: date | None = None
    active: bool
    created_at: datetime
