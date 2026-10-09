"""Pydantic schemas for the financial goal API."""

from datetime import date
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel
from pydantic import Field


class FinancialGoalCreate(BaseModel):
    """Incoming data for creating a financial goal."""

    name: str = Field(min_length=1, max_length=100)
    target_amount: Decimal = Field(gt=0)
    currency: str = Field(
        default="EUR",
        min_length=3,
        max_length=3,
    )
    target_date: date | None = None


class FinancialGoalUpdate(BaseModel):
    """Incoming data for fully updating a financial goal."""

    name: str = Field(min_length=1, max_length=100)
    target_amount: Decimal = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)
    target_date: date | None


class GoalAllocationCreate(BaseModel):
    """Incoming data for creating a goal allocation."""

    account_id: int
    amount: Decimal = Field(gt=0)


class GoalAllocationUpdate(BaseModel):
    """Incoming data for updating a goal allocation amount."""

    amount: Decimal = Field(gt=0)


class GoalAllocationResponse(BaseModel):
    """Goal allocation data returned by the API."""

    id: int
    goal_id: int
    account_id: int
    amount: Decimal = Field(gt=0)
    funded_amount: Decimal
    created_at: datetime


class FinancialGoalResponse(BaseModel):
    """Financial goal data returned by the API."""

    id: int
    name: str
    target_amount: Decimal = Field(gt=0)
    currency: str
    target_date: date | None = None
    created_at: datetime
    allocations: list[GoalAllocationResponse] = Field(
        default_factory=list,
    )
    current_amount: Decimal | None = None
    progress: Decimal | None = None
    completed: bool | None = None
