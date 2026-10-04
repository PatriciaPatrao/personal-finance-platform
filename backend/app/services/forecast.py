"""Read-only future cash-flow projections."""

from collections import defaultdict
from datetime import date
from datetime import timedelta
from decimal import Decimal

from app.db.session import Session
from app.repositories.account import AccountRepository
from app.repositories.income import IncomeRepository
from app.repositories.recurring_expense import (
    RecurringExpenseRepository,
)
from app.schemas.forecast import ForecastGroupBy
from app.schemas.forecast import ForecastPeriod
from app.schemas.forecast import ForecastResponse
from app.services.occurrence import add_months
from app.services.occurrence import generate_occurrences


_ZERO = Decimal("0.00")
_EUR = "EUR"


def _as_money(value: Decimal) -> Decimal:
    """Normalize money to two decimal places."""
    return Decimal(value).quantize(_ZERO)


def _period_key(occurrence: date, group_by: ForecastGroupBy) -> str:
    """Map an occurrence date to a daily or monthly period label."""
    if group_by == ForecastGroupBy.DAY:
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


class ForecastService:
    """Calculate future projections without writing data."""

    def __init__(self, session: Session) -> None:
        """Bind the service to one database session."""
        self._accounts = AccountRepository(session)
        self._incomes = IncomeRepository(session)
        self._expenses = RecurringExpenseRepository(session)

    def get_forecast(
        self,
        from_date: date,
        to_date: date,
        group_by: ForecastGroupBy,
        as_of: date | None = None,
    ) -> ForecastResponse:
        """Return projected periods for the requested range."""
        if as_of is None:
            as_of = date.today()
        starting_balance = _as_money(
            sum(
                (
                    account.current_balance
                    for account in self._accounts.list_all()
                ),
                _ZERO,
            ),
        )
        income_by_period: dict[str, Decimal] = defaultdict(
            lambda: _ZERO,
        )
        expense_by_period: dict[str, Decimal] = defaultdict(
            lambda: _ZERO,
        )
        for income in self._incomes.list_all():
            if not income.active:
                continue
            for occurrence in generate_occurrences(
                income.next_occurrence,
                income.frequency,
                income.end_date,
                from_date,
                to_date,
                as_of,
            ):
                key = _period_key(occurrence, group_by)
                income_by_period[key] = (
                    income_by_period[key] + income.amount
                )
        for expense in self._expenses.list_all():
            if not expense.active:
                continue
            for occurrence in generate_occurrences(
                expense.next_occurrence,
                expense.frequency,
                expense.end_date,
                from_date,
                to_date,
                as_of,
            ):
                key = _period_key(occurrence, group_by)
                expense_by_period[key] = (
                    expense_by_period[key] + expense.amount
                )
        if group_by == ForecastGroupBy.DAY:
            period_labels = _daily_periods(from_date, to_date)
        else:
            period_labels = _monthly_periods(
                from_date,
                to_date,
            )
        periods: list[ForecastPeriod] = []
        projected = starting_balance
        for label in period_labels:
            income_total = _as_money(income_by_period[label])
            expense_total = _as_money(expense_by_period[label])
            net_cash_flow = _as_money(
                income_total - expense_total,
            )
            projected = _as_money(projected + net_cash_flow)
            periods.append(
                ForecastPeriod(
                    period=label,
                    income=income_total,
                    expenses=expense_total,
                    net_cash_flow=net_cash_flow,
                    projected_balance=projected,
                ),
            )
        return ForecastResponse(
            from_date=from_date,
            to_date=to_date,
            currency=_EUR,
            group_by=group_by,
            periods=periods,
        )
