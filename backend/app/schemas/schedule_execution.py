"""Pydantic schemas for schedule execution API."""

from datetime import date
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field

from app.models.schedule_execution import ScheduleSourceType
from app.models.transaction import TransactionType


class ScheduleExecutionCreate(BaseModel):
    """Incoming data to execute one schedule occurrence."""

    occurrence_date: date


class ScheduleExecutionResponse(BaseModel):
    """Execution result returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    source_type: ScheduleSourceType
    source_id: int
    occurrence_date: date
    transaction_id: int
    created_at: datetime
    transaction_account_id: int
    transaction_amount: Decimal = Field(decimal_places=2)
    transaction_type: TransactionType
    transaction_occurred_on: date
