"""Pydantic schemas for the forecast API."""

import enum
from datetime import date
from decimal import Decimal

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import model_validator


class ForecastGroupBy(enum.Enum):
    """How forecast periods are grouped."""

    DAY = "day"
    MONTH = "month"


class ForecastQuery(BaseModel):
    """Query parameters for a forecast request."""

    model_config = ConfigDict(populate_by_name=True)

    from_date: date = Field(alias="from")
    to_date: date = Field(alias="to")
    group_by: ForecastGroupBy

    @model_validator(mode="after")
    def validate_date_range(self) -> "ForecastQuery":
        """Reject a range where from is after to."""
        if self.from_date > self.to_date:
            raise ValueError(
                "from must be on or before to",
            )
        return self


class ForecastPeriod(BaseModel):
    """One daily or monthly forecast bucket."""

    period: str
    income: Decimal = Field(ge=0, decimal_places=2)
    expenses: Decimal = Field(ge=0, decimal_places=2)
    net_cash_flow: Decimal = Field(decimal_places=2)
    projected_balance: Decimal = Field(decimal_places=2)


class ForecastResponse(BaseModel):
    """Projected cash flow for a date range."""

    from_date: date
    to_date: date
    currency: str
    group_by: ForecastGroupBy
    periods: list[ForecastPeriod]
