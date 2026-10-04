"""Read-only historical analysis over persisted transactions."""

from collections import defaultdict
from datetime import date
from datetime import timedelta
from decimal import Decimal

from app.db.session import Session
from app.repositories.analysis import AnalysisRepository
from app.schemas.analysis import AnalysisGroupBy
from app.schemas.analysis import CashFlowPeriod
from app.schemas.analysis import CashFlowResponse
from app.schemas.analysis import ExpenseCategoryBreakdown
from app.schemas.analysis import ExpensesByCategoryResponse
from app.schemas.financial_summary import FinancialSummaryResponse
from app.services.financial_summary import FinancialSummaryService
from app.services.occurrence import add_months


_ZERO = Decimal("0.00")
_UNCATEGORIZED = "Uncategorized"


def _as_money(value: Decimal) -> Decimal:
    """Normalize money to two decimal places."""
    return Decimal(value).quantize(_ZERO)


def _period_key(
    occurrence: date,
    group_by: AnalysisGroupBy,
) -> str:
    """Map a transaction date to a daily or monthly period label."""
    if group_by == AnalysisGroupBy.DAY:
        return occurrence.isoformat()
    return f"{occurrence.year:04d}-{occurrence.month:02d}"


def _daily_periods(from_date: date, to_date: date) -> list[str]:
    """Return every inclusive date label in the range."""
    labels: list[str] = []
    current = from_date
    while current <= to_date:
        labels.append(current.isoformat())
        current += timedelta(days=1)
    return labels


def _monthly_periods(from_date: date, to_date: date) -> list[str]:
    """Return every calendar month that intersects the range."""
    labels: list[str] = []
    current = date(from_date.year, from_date.month, 1)
    last = date(to_date.year, to_date.month, 1)
    while current <= last:
        labels.append(
            f"{current.year:04d}-{current.month:02d}",
        )
        current = add_months(current, 1)
    return labels


class AnalysisService:
    """Coordinate historical analysis without writing data."""

    def __init__(self, session: Session) -> None:
        """Bind the service to one database session."""
        self._repository = AnalysisRepository(session)
        self._summary = FinancialSummaryService(session)

    def get_summary(
        self,
        from_date: date,
        to_date: date,
    ) -> FinancialSummaryResponse:
        """Return income, expenses, and net cash flow for a period."""
        return self._summary.get_summary(
            from_date=from_date,
            to_date=to_date,
        )

    def get_expenses_by_category(
        self,
        from_date: date,
        to_date: date,
    ) -> ExpensesByCategoryResponse:
        """Return expense totals grouped by category."""
        rows = self._repository.get_expenses_by_category(
            from_date=from_date,
            to_date=to_date,
        )
        total_expenses = _as_money(
            sum((amount for _, amount in rows), _ZERO),
        )
        if total_expenses == _ZERO:
            return ExpensesByCategoryResponse(
                from_date=from_date,
                to_date=to_date,
                total_expenses=_ZERO,
                categories=[],
            )
        categories = [
            ExpenseCategoryBreakdown(
                category=(
                    category
                    if category is not None
                    else _UNCATEGORIZED
                ),
                amount=amount,
                percentage=_as_money(
                    amount / total_expenses * 100,
                ),
            )
            for category, amount in rows
        ]
        categories.sort(
            key=lambda item: (-item.amount, item.category),
        )
        return ExpensesByCategoryResponse(
            from_date=from_date,
            to_date=to_date,
            total_expenses=total_expenses,
            categories=categories,
        )

    def get_cash_flow(
        self,
        from_date: date,
        to_date: date,
        group_by: AnalysisGroupBy,
    ) -> CashFlowResponse:
        """Return income, expenses, and net cash flow by period."""
        daily_totals = self._repository.get_daily_totals(
            from_date=from_date,
            to_date=to_date,
        )
        income_by_period: dict[str, Decimal] = defaultdict(
            lambda: _ZERO,
        )
        expense_by_period: dict[str, Decimal] = defaultdict(
            lambda: _ZERO,
        )
        for occurred_on, income, expenses in daily_totals:
            key = _period_key(occurred_on, group_by)
            income_by_period[key] = (
                income_by_period[key] + income
            )
            expense_by_period[key] = (
                expense_by_period[key] + expenses
            )
        if group_by == AnalysisGroupBy.DAY:
            period_labels = _daily_periods(from_date, to_date)
        else:
            period_labels = _monthly_periods(
                from_date,
                to_date,
            )
        periods = [
            CashFlowPeriod(
                period=label,
                income=_as_money(income_by_period[label]),
                expenses=_as_money(expense_by_period[label]),
                net_cash_flow=_as_money(
                    income_by_period[label]
                    - expense_by_period[label],
                ),
            )
            for label in period_labels
        ]
        return CashFlowResponse(
            from_date=from_date,
            to_date=to_date,
            group_by=group_by,
            periods=periods,
        )
