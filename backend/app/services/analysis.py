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
from app.schemas.analysis import CurrencyCashFlow
from app.schemas.analysis import CurrencyExpensesByCategory
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
        """Return expense totals grouped by currency and category."""
        rows = self._repository.get_expenses_by_category(
            from_date=from_date,
            to_date=to_date,
        )
        by_currency: dict[str, list[tuple[str | None, Decimal]]] = (
            defaultdict(list)
        )
        for currency, category, amount in rows:
            by_currency[currency].append((category, amount))

        currencies: list[CurrencyExpensesByCategory] = []
        for currency in sorted(by_currency):
            category_rows = by_currency[currency]
            total_expenses = _as_money(
                sum((amount for _, amount in category_rows), _ZERO),
            )
            if total_expenses == _ZERO:
                categories: list[ExpenseCategoryBreakdown] = []
            else:
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
                    for category, amount in category_rows
                ]
                categories.sort(
                    key=lambda item: (-item.amount, item.category),
                )
            currencies.append(
                CurrencyExpensesByCategory(
                    currency=currency,
                    total_expenses=total_expenses,
                    categories=categories,
                ),
            )

        return ExpensesByCategoryResponse(
            from_date=from_date,
            to_date=to_date,
            currencies=currencies,
        )

    def get_cash_flow(
        self,
        from_date: date,
        to_date: date,
        group_by: AnalysisGroupBy,
    ) -> CashFlowResponse:
        """Return income, expenses, and net cash flow by period and currency."""
        daily_totals = self._repository.get_daily_totals(
            from_date=from_date,
            to_date=to_date,
        )
        income_by_currency: dict[str, dict[str, Decimal]] = defaultdict(
            lambda: defaultdict(lambda: _ZERO),
        )
        expense_by_currency: dict[str, dict[str, Decimal]] = defaultdict(
            lambda: defaultdict(lambda: _ZERO),
        )
        for occurred_on, currency, income, expenses in daily_totals:
            key = _period_key(occurred_on, group_by)
            income_by_currency[currency][key] = (
                income_by_currency[currency][key] + income
            )
            expense_by_currency[currency][key] = (
                expense_by_currency[currency][key] + expenses
            )

        if group_by == AnalysisGroupBy.DAY:
            period_labels = _daily_periods(from_date, to_date)
        else:
            period_labels = _monthly_periods(
                from_date,
                to_date,
            )

        currency_blocks: list[CurrencyCashFlow] = []
        for currency in sorted(income_by_currency):
            periods = [
                CashFlowPeriod(
                    period=label,
                    income=_as_money(
                        income_by_currency[currency][label],
                    ),
                    expenses=_as_money(
                        expense_by_currency[currency][label],
                    ),
                    net_cash_flow=_as_money(
                        income_by_currency[currency][label]
                        - expense_by_currency[currency][label],
                    ),
                )
                for label in period_labels
            ]
            currency_blocks.append(
                CurrencyCashFlow(
                    currency=currency,
                    periods=periods,
                ),
            )

        return CashFlowResponse(
            from_date=from_date,
            to_date=to_date,
            group_by=group_by,
            currencies=currency_blocks,
        )
