"""Read-only future cash-flow projections."""

from collections import defaultdict
from datetime import date
from datetime import timedelta
from decimal import Decimal

from app.db.session import Session
from app.models.income import Income
from app.models.recurring_expense import RecurringExpense
from app.repositories.account import AccountRepository
from app.repositories.income import IncomeRepository
from app.repositories.recurring_expense import (
    RecurringExpenseRepository,
)
from app.schemas.forecast import ForecastGroupBy
from app.schemas.forecast import ForecastPeriod
from app.schemas.forecast import ForecastResponse
from app.schemas.forecast import ForecastScope
from app.services.occurrence import add_months
from app.services.occurrence import generate_occurrences


_ZERO = Decimal("0.00")
_DEFAULT_CURRENCY = "EUR"

MIXED_CURRENCY_HOUSEHOLD_DETAIL = (
    "Household forecast requires every account to use the same "
    "currency. Select an account or use accounts in one currency."
)


class ForecastAccountNotFoundError(Exception):
    """Raised when a forecast references a missing account."""


class MixedCurrencyHouseholdForecastError(Exception):
    """Raised when household forecast spans multiple currencies."""


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


def _accumulate_schedule_amounts(
    incomes: list[Income],
    expenses: list[RecurringExpense],
    from_date: date,
    to_date: date,
    group_by: ForecastGroupBy,
    as_of: date,
) -> tuple[dict[str, Decimal], dict[str, Decimal]]:
    """Sum income and expense amounts into period buckets."""
    income_by_period: dict[str, Decimal] = defaultdict(
        lambda: _ZERO,
    )
    expense_by_period: dict[str, Decimal] = defaultdict(
        lambda: _ZERO,
    )
    for income in incomes:
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
    for expense in expenses:
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
    return income_by_period, expense_by_period


def _build_periods(
    starting_balance: Decimal,
    incomes: list[Income],
    expenses: list[RecurringExpense],
    from_date: date,
    to_date: date,
    group_by: ForecastGroupBy,
    as_of: date,
) -> list[ForecastPeriod]:
    """Return projected periods for schedules and a starting balance."""
    income_by_period, expense_by_period = _accumulate_schedule_amounts(
        incomes,
        expenses,
        from_date,
        to_date,
        group_by,
        as_of,
    )
    if group_by == ForecastGroupBy.DAY:
        period_labels = _daily_periods(from_date, to_date)
    else:
        period_labels = _monthly_periods(from_date, to_date)
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
    return periods


def _household_currency(accounts: list) -> str:
    """Return the shared currency code or raise when mixed."""
    currencies = {account.currency for account in accounts}
    if len(currencies) > 1:
        raise MixedCurrencyHouseholdForecastError(
            MIXED_CURRENCY_HOUSEHOLD_DETAIL,
        )
    if len(currencies) == 1:
        return next(iter(currencies))
    return _DEFAULT_CURRENCY


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
        account_id: int | None = None,
        as_of: date | None = None,
    ) -> ForecastResponse:
        """Return projected periods for the requested range."""
        if as_of is None:
            as_of = date.today()

        all_incomes = self._incomes.list_all()
        all_expenses = self._expenses.list_all()

        if account_id is not None:
            account = self._accounts.get_by_id(account_id)
            if account is None:
                raise ForecastAccountNotFoundError(
                    f"Account {account_id} not found",
                )
            starting_balance = _as_money(account.current_balance)
            incomes = [
                income
                for income in all_incomes
                if income.account_id == account_id
            ]
            expenses = [
                expense
                for expense in all_expenses
                if expense.account_id == account_id
            ]
            periods = _build_periods(
                starting_balance,
                incomes,
                expenses,
                from_date,
                to_date,
                group_by,
                as_of,
            )
            return ForecastResponse(
                from_date=from_date,
                to_date=to_date,
                currency=account.currency,
                group_by=group_by,
                scope=ForecastScope.ACCOUNT,
                account_id=account_id,
                periods=periods,
            )

        accounts = self._accounts.list_all()
        currency = _household_currency(accounts)
        starting_balance = _as_money(
            sum(
                (account.current_balance for account in accounts),
                _ZERO,
            ),
        )
        periods = _build_periods(
            starting_balance,
            all_incomes,
            all_expenses,
            from_date,
            to_date,
            group_by,
            as_of,
        )
        return ForecastResponse(
            from_date=from_date,
            to_date=to_date,
            currency=currency,
            group_by=group_by,
            scope=ForecastScope.HOUSEHOLD,
            account_id=None,
            periods=periods,
        )
