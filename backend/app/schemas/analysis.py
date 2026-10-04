"""Pydantic schemas for the analysis API."""

import enum
from datetime import date
from decimal import Decimal

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import model_validator


class AnalysisGroupBy(enum.Enum):
    """How cash-flow periods are grouped."""

    DAY = "day"
    MONTH = "month"


class AnalysisDateRangeQuery(BaseModel):
    """Historical date range shared by analysis endpoints."""

    model_config = ConfigDict(populate_by_name=True)

    from_date: date = Field(alias="from")
    to_date: date = Field(alias="to")

    @model_validator(mode="after")
    def validate_date_range(self) -> "AnalysisDateRangeQuery":
        """Reject invalid or future-ending historical ranges."""
        if self.from_date > self.to_date:
            raise ValueError(
                "from must be on or before to",
            )
        if self.to_date > date.today():
            raise ValueError(
                "to must not be in the future",
            )
        return self


class AnalysisCashFlowQuery(AnalysisDateRangeQuery):
    """Query parameters for cash-flow analysis."""

    group_by: AnalysisGroupBy


class ExpenseCategoryBreakdown(BaseModel):
    """One category amount and its share of total expenses."""

    category: str
    amount: Decimal = Field(ge=0, decimal_places=2)
    percentage: Decimal = Field(ge=0, decimal_places=2)


class ExpensesByCategoryResponse(BaseModel):
    """Expense totals grouped by category for a date range."""

    from_date: date
    to_date: date
    total_expenses: Decimal = Field(ge=0, decimal_places=2)
    categories: list[ExpenseCategoryBreakdown]


class CashFlowPeriod(BaseModel):
    """One daily or monthly historical cash-flow bucket."""

    period: str
    income: Decimal = Field(ge=0, decimal_places=2)
    expenses: Decimal = Field(ge=0, decimal_places=2)
    net_cash_flow: Decimal = Field(decimal_places=2)


class CashFlowResponse(BaseModel):
    """Historical cash flow for a date range."""

    from_date: date
    to_date: date
    group_by: AnalysisGroupBy
    periods: list[CashFlowPeriod]
