"""Pydantic schemas for the financial summary API."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import model_validator


class FinancialSummaryQuery(BaseModel):
    """Query parameters for a financial summary request."""

    model_config = ConfigDict(populate_by_name=True)

    from_date: date = Field(alias="from")
    to_date: date = Field(alias="to")

    @model_validator(mode="after")
    def validate_date_range(self) -> "FinancialSummaryQuery":
        """Reject a range where from is after to."""
        if self.from_date > self.to_date:
            raise ValueError(
                "from must be on or before to",
            )
        return self


class FinancialSummaryResponse(BaseModel):
    """Aggregated financial totals for a date range."""

    from_date: date
    to_date: date
    total_income: Decimal = Field(ge=0, decimal_places=2)
    total_expenses: Decimal = Field(ge=0, decimal_places=2)
    net_cash_flow: Decimal = Field(decimal_places=2)
