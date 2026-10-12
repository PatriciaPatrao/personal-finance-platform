"""Pydantic schemas for the forecast API."""

import enum
import json
from datetime import date
from decimal import Decimal

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import field_validator
from pydantic import model_validator


class ForecastGroupBy(enum.Enum):
    """How forecast periods are grouped."""

    DAY = "day"
    MONTH = "month"


class ForecastScope(enum.Enum):
    """Whether the projection covers all accounts or one."""

    HOUSEHOLD = "household"
    ACCOUNT = "account"


class ForecastQuery(BaseModel):
    """Query parameters for a forecast request."""

    model_config = ConfigDict(populate_by_name=True)

    from_date: date = Field(alias="from")
    to_date: date = Field(alias="to")
    group_by: ForecastGroupBy
    group_by_overrides: dict[str, ForecastGroupBy] | None = None
    account_id: int | None = None

    @field_validator("group_by_overrides", mode="before")
    @classmethod
    def parse_group_by_overrides(
        cls,
        value: object,
    ) -> dict[str, ForecastGroupBy] | None:
        """Accept JSON or a dict for per-currency grouping."""
        if value is None or value == "":
            return None
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            return json.loads(value)
        raise ValueError("group_by_overrides must be a JSON object")

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


class ForecastCurrencyProjection(BaseModel):
    """Projected cash flow for one currency."""

    currency: str
    group_by: ForecastGroupBy
    starting_balance: Decimal = Field(decimal_places=2)
    periods: list[ForecastPeriod]


class ForecastResponse(BaseModel):
    """Projected cash flow for a date range."""

    from_date: date
    to_date: date
    group_by: ForecastGroupBy
    scope: ForecastScope
    account_id: int | None = None
    projections: list[ForecastCurrencyProjection]
