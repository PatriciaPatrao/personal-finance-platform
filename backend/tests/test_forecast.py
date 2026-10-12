"""API tests for read-only forecasts."""

import json
from datetime import date
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.services.occurrence import add_months


def _iso(value: date) -> str:
    """Format a date as an ISO string."""
    return value.isoformat()


def _month(value: date) -> str:
    """Format a date as a YYYY-MM period label."""
    return f"{value.year:04d}-{value.month:02d}"


def _projection(
    body: dict,
    currency: str | None = None,
) -> dict:
    """Return one currency projection from the response body."""
    projections = body["projections"]
    assert projections
    if currency is not None:
        return next(
            item
            for item in projections
            if item["currency"] == currency
        )
    assert len(projections) == 1
    return projections[0]


def _period(
    body: dict,
    label: str,
    *,
    currency: str | None = None,
) -> dict:
    """Return the forecast period with the given label."""
    projection = _projection(body, currency)
    return next(
        item
        for item in projection["periods"]
        if item["period"] == label
    )


@pytest.fixture
def today() -> date:
    """Application current date used by forecast tests."""
    return date.today()


def _create_account(
    client: TestClient,
    *,
    name: str = "Conta Principal",
    current_balance: float = 0,
    currency: str = "EUR",
) -> dict:
    """Create an account and return the response body."""
    response = client.post(
        "/accounts",
        json={
            "name": name,
            "account_type": "bank",
            "currency": currency,
            "current_balance": current_balance,
        },
    )
    assert response.status_code == 201
    return response.json()


def _create_income(
    client: TestClient,
    account_id: int,
    *,
    amount: float,
    frequency: str,
    next_occurrence: date,
    start_date: date | None = None,
    end_date: date | None = None,
    active: bool = True,
) -> dict:
    """Create an income and return the response body."""
    payload = {
        "account_id": account_id,
        "amount": amount,
        "frequency": frequency,
        "start_date": _iso(start_date or next_occurrence),
        "next_occurrence": _iso(next_occurrence),
        "active": active,
    }
    if end_date is not None:
        payload["end_date"] = _iso(end_date)
    response = client.post("/incomes", json=payload)
    assert response.status_code == 201
    return response.json()


def _create_expense(
    client: TestClient,
    account_id: int,
    *,
    amount: float,
    frequency: str,
    next_occurrence: date,
    start_date: date | None = None,
    end_date: date | None = None,
    active: bool = True,
) -> dict:
    """Create a recurring expense and return the body."""
    payload = {
        "account_id": account_id,
        "description": "Rent",
        "amount": amount,
        "frequency": frequency,
        "start_date": _iso(start_date or next_occurrence),
        "next_occurrence": _iso(next_occurrence),
        "active": active,
    }
    if end_date is not None:
        payload["end_date"] = _iso(end_date)
    response = client.post(
        "/recurring-expenses",
        json=payload,
    )
    assert response.status_code == 201
    return response.json()


def _forecast(
    client: TestClient,
    from_date: date,
    to_date: date,
    group_by: str,
    *,
    account_id: int | None = None,
    group_by_overrides: str | None = None,
) -> dict:
    """Call GET /forecast and return the JSON body."""
    params: dict[str, str | int] = {
        "from": _iso(from_date),
        "to": _iso(to_date),
        "group_by": group_by,
    }
    if group_by_overrides is not None:
        params["group_by_overrides"] = group_by_overrides
    if account_id is not None:
        params["account_id"] = account_id
    response = client.get(
        "/forecast",
        params=params,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["projections"]
    if account_id is None:
        assert body["scope"] == "household"
        assert body["account_id"] is None
    else:
        assert body["scope"] == "account"
        assert body["account_id"] == account_id
        assert len(body["projections"]) == 1
    return body


def test_forecast_uses_one_account_current_balance(
    client: TestClient,
    today: date,
) -> None:
    """Starting projected balance equals one account balance."""
    _create_account(client, current_balance=2800.00)
    body = _forecast(client, today, today, "day")
    period = _period(body, _iso(today))
    assert Decimal(period["income"]) == Decimal("0.00")
    assert Decimal(period["expenses"]) == Decimal("0.00")
    assert Decimal(period["net_cash_flow"]) == Decimal("0.00")
    assert Decimal(period["projected_balance"]) == Decimal(
        "2800.00",
    )


def test_forecast_aggregates_multiple_account_balances(
    client: TestClient,
    today: date,
) -> None:
    """Starting balance is the sum of every account."""
    _create_account(client, name="One", current_balance=1000)
    _create_account(client, name="Two", current_balance=500)
    body = _forecast(client, today, today, "day")
    period = _period(body, _iso(today))
    assert Decimal(period["projected_balance"]) == Decimal(
        "1500.00",
    )


def test_forecast_zero_balances(
    client: TestClient,
    today: date,
) -> None:
    """Zero account balances produce a zero starting projection."""
    _create_account(client, current_balance=0)
    body = _forecast(client, today, today, "day")
    period = _period(body, _iso(today))
    assert Decimal(period["projected_balance"]) == Decimal("0.00")


def test_forecast_does_not_modify_account_balances(
    client: TestClient,
    today: date,
) -> None:
    """GET /forecast leaves account current_balance unchanged."""
    created = _create_account(client, current_balance=2800)
    account_id = created["id"]
    _forecast(client, today, today, "day")
    stored = client.get(f"/accounts/{account_id}")
    assert stored.status_code == 200
    assert Decimal(stored.json()["current_balance"]) == Decimal(
        "2800.00",
    )


def test_forecast_monthly_income_occurrences(
    client: TestClient,
    today: date,
) -> None:
    """Monthly salary is counted on each monthly occurrence."""
    account = _create_account(client)
    to_date = add_months(today, 2)
    _create_income(
        client,
        account["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=today,
    )
    body = _forecast(client, today, to_date, "month")
    first = _period(body, _month(today))
    second = _period(body, _month(add_months(today, 1)))
    assert Decimal(first["income"]) == Decimal("2000.00")
    assert Decimal(second["income"]) == Decimal("2000.00")


def test_forecast_weekly_income_occurrences(
    client: TestClient,
    today: date,
) -> None:
    """Weekly salary is counted on each weekly occurrence."""
    account = _create_account(client)
    to_date = today + timedelta(days=14)
    _create_income(
        client,
        account["id"],
        amount=800,
        frequency="weekly",
        next_occurrence=today,
    )
    body = _forecast(client, today, to_date, "day")
    assert Decimal(
        _period(body, _iso(today))["income"],
    ) == Decimal("800.00")
    assert Decimal(
        _period(body, _iso(today + timedelta(days=7)))["income"],
    ) == Decimal("800.00")
    assert Decimal(
        _period(body, _iso(today + timedelta(days=14)))["income"],
    ) == Decimal("800.00")
    assert Decimal(
        _period(body, _iso(today + timedelta(days=1)))["income"],
    ) == Decimal("0.00")


def test_forecast_yearly_income_occurrences(
    client: TestClient,
    today: date,
) -> None:
    """Yearly salary is counted once per year."""
    account = _create_account(client)
    to_date = add_months(today, 12)
    _create_income(
        client,
        account["id"],
        amount=30000,
        frequency="yearly",
        next_occurrence=today,
    )
    body = _forecast(client, today, to_date, "month")
    assert Decimal(
        _period(body, _month(today))["income"],
    ) == Decimal("30000.00")
    next_year = add_months(today, 12)
    assert Decimal(
        _period(body, _month(next_year))["income"],
    ) == Decimal("30000.00")


def test_forecast_ignores_inactive_income(
    client: TestClient,
    today: date,
) -> None:
    """Inactive salary is excluded from the forecast."""
    account = _create_account(client)
    _create_income(
        client,
        account["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=today,
        active=False,
    )
    body = _forecast(client, today, today, "day")
    assert Decimal(
        _period(body, _iso(today))["income"],
    ) == Decimal("0.00")


def test_forecast_income_end_date_stops_occurrences(
    client: TestClient,
    today: date,
) -> None:
    """Salary occurrences after end_date are not generated."""
    account = _create_account(client)
    to_date = add_months(today, 2)
    _create_income(
        client,
        account["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=today,
        end_date=today,
    )
    body = _forecast(client, today, to_date, "month")
    assert Decimal(
        _period(body, _month(today))["income"],
    ) == Decimal("2000.00")
    later = _month(add_months(today, 1))
    if later != _month(today):
        assert Decimal(
            _period(body, later)["income"],
        ) == Decimal("0.00")


def test_forecast_includes_income_on_from_date(
    client: TestClient,
    today: date,
) -> None:
    """An occurrence exactly on from is included."""
    account = _create_account(client)
    _create_income(
        client,
        account["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=today,
    )
    body = _forecast(client, today, today, "day")
    assert Decimal(
        _period(body, _iso(today))["income"],
    ) == Decimal("2000.00")


def test_forecast_includes_income_on_to_date(
    client: TestClient,
    today: date,
) -> None:
    """An occurrence exactly on to is included."""
    account = _create_account(client)
    to_date = today + timedelta(days=7)
    _create_income(
        client,
        account["id"],
        amount=800,
        frequency="weekly",
        next_occurrence=today,
    )
    body = _forecast(client, today, to_date, "day")
    assert Decimal(
        _period(body, _iso(to_date))["income"],
    ) == Decimal("800.00")


def test_forecast_ignores_income_before_from(
    client: TestClient,
    today: date,
) -> None:
    """Occurrences before from are ignored."""
    account = _create_account(client)
    _create_income(
        client,
        account["id"],
        amount=800,
        frequency="weekly",
        next_occurrence=today,
    )
    from_date = today + timedelta(days=1)
    to_date = today + timedelta(days=5)
    body = _forecast(client, from_date, to_date, "day")
    assert all(
        Decimal(item["income"]) == Decimal("0.00")
        for item in _projection(body)["periods"]
    )


def test_forecast_ignores_income_after_to(
    client: TestClient,
    today: date,
) -> None:
    """Occurrences after to are ignored."""
    account = _create_account(client)
    _create_income(
        client,
        account["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=today + timedelta(days=10),
    )
    body = _forecast(
        client,
        today,
        today + timedelta(days=5),
        "day",
    )
    assert all(
        Decimal(item["income"]) == Decimal("0.00")
        for item in _projection(body)["periods"]
    )


def _freeze_forecast_today(
    monkeypatch: pytest.MonkeyPatch,
    frozen: date,
) -> None:
    """Make ForecastService treat frozen as today."""

    class FrozenDate(date):
        """date subclass whose today() is fixed."""

        @classmethod
        def today(cls) -> date:
            """Return the frozen application date."""
            return frozen

    monkeypatch.setattr(
        "app.services.forecast.date",
        FrozenDate,
    )


def test_forecast_monthly_expense_on_october_second(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """100 is counted on 2 Oct, 2 Nov, and 2 Dec when not past."""
    _freeze_forecast_today(monkeypatch, date(2026, 10, 1))
    account = _create_account(client)
    _create_expense(
        client,
        account["id"],
        amount=100,
        frequency="monthly",
        start_date=date(2026, 9, 2),
        next_occurrence=date(2026, 10, 2),
        end_date=date(2027, 4, 9),
    )
    body = _forecast(
        client,
        date(2026, 10, 1),
        date(2027, 1, 31),
        "day",
    )
    assert Decimal(
        _period(body, "2026-10-02")["expenses"],
    ) == Decimal("100.00")
    assert Decimal(
        _period(body, "2026-11-02")["expenses"],
    ) == Decimal("100.00")
    assert Decimal(
        _period(body, "2026-12-02")["expenses"],
    ) == Decimal("100.00")


def test_forecast_omits_october_second_when_it_is_before_today(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """2 October is omitted after today; November still counts 100."""
    _freeze_forecast_today(monkeypatch, date(2026, 10, 11))
    account = _create_account(client)
    _create_expense(
        client,
        account["id"],
        amount=100,
        frequency="monthly",
        start_date=date(2026, 9, 2),
        next_occurrence=date(2026, 10, 2),
        end_date=date(2027, 4, 9),
    )
    body = _forecast(
        client,
        date(2026, 10, 1),
        date(2027, 1, 31),
        "day",
    )
    assert Decimal(
        _period(body, "2026-10-02")["expenses"],
    ) == Decimal("0.00")
    assert Decimal(
        _period(body, "2026-11-02")["expenses"],
    ) == Decimal("100.00")
    assert Decimal(
        _period(body, "2026-12-02")["expenses"],
    ) == Decimal("100.00")


def test_forecast_monthly_recurring_expense(
    client: TestClient,
    today: date,
) -> None:
    """Monthly recurring expenses appear in matching months."""
    account = _create_account(client)
    to_date = add_months(today, 1)
    _create_expense(
        client,
        account["id"],
        amount=900,
        frequency="monthly",
        next_occurrence=today,
    )
    body = _forecast(client, today, to_date, "month")
    assert Decimal(
        _period(body, _month(today))["expenses"],
    ) == Decimal("900.00")


def test_forecast_weekly_recurring_expense(
    client: TestClient,
    today: date,
) -> None:
    """Weekly recurring expenses appear on weekly dates."""
    account = _create_account(client)
    to_date = today + timedelta(days=7)
    _create_expense(
        client,
        account["id"],
        amount=50,
        frequency="weekly",
        next_occurrence=today,
    )
    body = _forecast(client, today, to_date, "day")
    assert Decimal(
        _period(body, _iso(today))["expenses"],
    ) == Decimal("50.00")
    assert Decimal(
        _period(body, _iso(to_date))["expenses"],
    ) == Decimal("50.00")


def test_forecast_yearly_recurring_expense(
    client: TestClient,
    today: date,
) -> None:
    """Yearly recurring expenses appear once per year."""
    account = _create_account(client)
    _create_expense(
        client,
        account["id"],
        amount=1200,
        frequency="yearly",
        next_occurrence=today,
    )
    body = _forecast(client, today, today, "day")
    assert Decimal(
        _period(body, _iso(today))["expenses"],
    ) == Decimal("1200.00")


def test_forecast_ignores_inactive_recurring_expense(
    client: TestClient,
    today: date,
) -> None:
    """Inactive recurring expenses are excluded."""
    account = _create_account(client)
    _create_expense(
        client,
        account["id"],
        amount=900,
        frequency="monthly",
        next_occurrence=today,
        active=False,
    )
    body = _forecast(client, today, today, "day")
    assert Decimal(
        _period(body, _iso(today))["expenses"],
    ) == Decimal("0.00")


def test_forecast_recurring_expense_end_date_stops(
    client: TestClient,
    today: date,
) -> None:
    """Recurring expense occurrences stop at end_date."""
    account = _create_account(client)
    to_date = today + timedelta(days=21)
    _create_expense(
        client,
        account["id"],
        amount=50,
        frequency="weekly",
        next_occurrence=today,
        end_date=today + timedelta(days=7),
    )
    body = _forecast(client, today, to_date, "day")
    assert Decimal(
        _period(body, _iso(today + timedelta(days=7)))["expenses"],
    ) == Decimal("50.00")
    assert Decimal(
        _period(body, _iso(today + timedelta(days=14)))["expenses"],
    ) == Decimal("0.00")


def test_forecast_recurring_expense_boundaries_inclusive(
    client: TestClient,
    today: date,
) -> None:
    """Recurring expense dates on from and to are included."""
    account = _create_account(client)
    to_date = today + timedelta(days=7)
    _create_expense(
        client,
        account["id"],
        amount=50,
        frequency="weekly",
        next_occurrence=today,
    )
    body = _forecast(client, today, to_date, "day")
    assert Decimal(
        _period(body, _iso(today))["expenses"],
    ) == Decimal("50.00")
    assert Decimal(
        _period(body, _iso(to_date))["expenses"],
    ) == Decimal("50.00")


def test_forecast_income_only(
    client: TestClient,
    today: date,
) -> None:
    """Income without expenses increases projected balance."""
    account = _create_account(client, current_balance=1000)
    _create_income(
        client,
        account["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=today,
    )
    body = _forecast(client, today, today, "day")
    period = _period(body, _iso(today))
    assert Decimal(period["income"]) == Decimal("2000.00")
    assert Decimal(period["expenses"]) == Decimal("0.00")
    assert Decimal(period["net_cash_flow"]) == Decimal("2000.00")
    assert Decimal(period["projected_balance"]) == Decimal(
        "3000.00",
    )


def test_forecast_expenses_only(
    client: TestClient,
    today: date,
) -> None:
    """Expenses without income decrease projected balance."""
    account = _create_account(client, current_balance=1000)
    _create_expense(
        client,
        account["id"],
        amount=400,
        frequency="monthly",
        next_occurrence=today,
    )
    body = _forecast(client, today, today, "day")
    period = _period(body, _iso(today))
    assert Decimal(period["income"]) == Decimal("0.00")
    assert Decimal(period["expenses"]) == Decimal("400.00")
    assert Decimal(period["net_cash_flow"]) == Decimal("-400.00")
    assert Decimal(period["projected_balance"]) == Decimal(
        "600.00",
    )


def test_forecast_income_and_expenses(
    client: TestClient,
    today: date,
) -> None:
    """Income minus expenses is the period net cash flow."""
    account = _create_account(client, current_balance=2800)
    _create_income(
        client,
        account["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=today,
    )
    _create_expense(
        client,
        account["id"],
        amount=900,
        frequency="monthly",
        next_occurrence=today,
    )
    body = _forecast(client, today, today, "day")
    period = _period(body, _iso(today))
    assert Decimal(period["income"]) == Decimal("2000.00")
    assert Decimal(period["expenses"]) == Decimal("900.00")
    assert Decimal(period["net_cash_flow"]) == Decimal("1100.00")
    assert Decimal(period["projected_balance"]) == Decimal(
        "3900.00",
    )


def test_forecast_projected_balance_across_periods(
    client: TestClient,
    today: date,
) -> None:
    """Projected balance carries forward across days."""
    account = _create_account(client, current_balance=1000)
    payday = today + timedelta(days=1)
    _create_income(
        client,
        account["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=payday,
    )
    to_date = today + timedelta(days=2)
    body = _forecast(client, today, to_date, "day")
    day_one = _period(body, _iso(today))
    day_two = _period(body, _iso(payday))
    day_three = _period(body, _iso(to_date))
    assert Decimal(day_one["projected_balance"]) == Decimal(
        "1000.00",
    )
    assert Decimal(day_two["income"]) == Decimal("2000.00")
    assert Decimal(day_two["projected_balance"]) == Decimal(
        "3000.00",
    )
    assert Decimal(day_three["net_cash_flow"]) == Decimal("0.00")
    assert Decimal(day_three["projected_balance"]) == Decimal(
        "3000.00",
    )


def test_forecast_empty_period_keeps_balance(
    client: TestClient,
    today: date,
) -> None:
    """Empty periods have zero flow and unchanged balance."""
    _create_account(client, current_balance=500)
    tomorrow = today + timedelta(days=1)
    body = _forecast(client, today, tomorrow, "day")
    first = _period(body, _iso(today))
    second = _period(body, _iso(tomorrow))
    assert Decimal(first["net_cash_flow"]) == Decimal("0.00")
    assert Decimal(second["net_cash_flow"]) == Decimal("0.00")
    assert Decimal(first["projected_balance"]) == Decimal("500.00")
    assert Decimal(second["projected_balance"]) == Decimal("500.00")


def test_forecast_daily_grouping(
    client: TestClient,
    today: date,
) -> None:
    """Daily grouping uses ISO date period labels."""
    _create_account(client)
    body = _forecast(
        client,
        today,
        today + timedelta(days=1),
        "day",
    )
    assert body["group_by"] == "day"
    projection = _projection(body)
    assert projection["currency"] == "EUR"
    assert projection["periods"][0]["period"] == _iso(today)


def test_forecast_monthly_grouping(
    client: TestClient,
    today: date,
) -> None:
    """Monthly grouping uses YYYY-MM period labels."""
    _create_account(client)
    to_date = add_months(date(today.year, today.month, 1), 1)
    if to_date < today:
        to_date = today
    body = _forecast(client, today, to_date, "month")
    assert body["group_by"] == "month"
    assert _projection(body)["periods"][0]["period"] == _month(today)


def test_forecast_returns_all_daily_periods(
    client: TestClient,
    today: date,
) -> None:
    """Every date in the inclusive daily range is returned."""
    _create_account(client)
    to_date = today + timedelta(days=2)
    body = _forecast(client, today, to_date, "day")
    labels = [item["period"] for item in _projection(body)["periods"]]
    assert labels == [
        _iso(today),
        _iso(today + timedelta(days=1)),
        _iso(to_date),
    ]


def test_forecast_returns_all_monthly_periods(
    client: TestClient,
    today: date,
) -> None:
    """Every intersecting calendar month is returned."""
    _create_account(client)
    from_date = date(today.year, today.month, 1)
    to_date = add_months(from_date, 2)
    body = _forecast(client, from_date, to_date, "month")
    labels = [item["period"] for item in _projection(body)["periods"]]
    assert labels == [
        _month(from_date),
        _month(add_months(from_date, 1)),
        _month(to_date),
    ]


def test_forecast_missing_from_returns_422(
    client: TestClient,
    today: date,
) -> None:
    """Missing from is rejected."""
    response = client.get(
        "/forecast",
        params={"to": _iso(today), "group_by": "day"},
    )
    assert response.status_code == 422


def test_forecast_missing_to_returns_422(
    client: TestClient,
    today: date,
) -> None:
    """Missing to is rejected."""
    response = client.get(
        "/forecast",
        params={"from": _iso(today), "group_by": "day"},
    )
    assert response.status_code == 422


def test_forecast_missing_group_by_returns_422(
    client: TestClient,
    today: date,
) -> None:
    """Missing group_by is rejected."""
    response = client.get(
        "/forecast",
        params={"from": _iso(today), "to": _iso(today)},
    )
    assert response.status_code == 422


def test_forecast_invalid_group_by_returns_422(
    client: TestClient,
    today: date,
) -> None:
    """An unknown group_by value is rejected."""
    response = client.get(
        "/forecast",
        params={
            "from": _iso(today),
            "to": _iso(today),
            "group_by": "week",
        },
    )
    assert response.status_code == 422


def test_forecast_from_after_to_returns_422(
    client: TestClient,
    today: date,
) -> None:
    """from after to is rejected."""
    response = client.get(
        "/forecast",
        params={
            "from": _iso(today + timedelta(days=1)),
            "to": _iso(today),
            "group_by": "day",
        },
    )
    assert response.status_code == 422


def test_forecast_does_not_create_transactions(
    client: TestClient,
    today: date,
) -> None:
    """Forecasting does not insert transactions."""
    account = _create_account(client)
    _create_income(
        client,
        account["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=today,
    )
    before = client.get("/transactions")
    assert before.status_code == 200
    before_count = len(before.json())
    _forecast(client, today, today, "day")
    after = client.get("/transactions")
    assert after.status_code == 200
    assert len(after.json()) == before_count


def test_forecast_does_not_modify_accounts(
    client: TestClient,
    today: date,
) -> None:
    """Forecasting leaves the account record unchanged."""
    created = _create_account(client, current_balance=2800)
    account_id = created["id"]
    _forecast(client, today, today, "day")
    stored = client.get(f"/accounts/{account_id}")
    assert stored.status_code == 200
    body = stored.json()
    assert body["id"] == created["id"]
    assert body["name"] == created["name"]
    assert body["account_type"] == created["account_type"]
    assert body["currency"] == created["currency"]
    assert Decimal(body["current_balance"]) == Decimal(
        created["current_balance"],
    )
    assert body["created_at"] == created["created_at"]


def test_forecast_does_not_modify_income(
    client: TestClient,
    today: date,
) -> None:
    """Forecasting leaves stored income unchanged."""
    account = _create_account(client)
    created = _create_income(
        client,
        account["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=today,
    )
    _forecast(client, today, today, "day")
    stored = client.get(f"/incomes/{created['id']}")
    assert stored.status_code == 200
    assert stored.json() == created


def test_forecast_does_not_modify_recurring_expenses(
    client: TestClient,
    today: date,
) -> None:
    """Forecasting leaves stored recurring expenses unchanged."""
    account = _create_account(client)
    created = _create_expense(
        client,
        account["id"],
        amount=900,
        frequency="monthly",
        next_occurrence=today,
    )
    _forecast(client, today, today, "day")
    stored = client.get(
        f"/recurring-expenses/{created['id']}",
    )
    assert stored.status_code == 200
    assert stored.json() == created


def test_forecast_reflects_updated_income_amount(
    client: TestClient,
    today: date,
) -> None:
    """Editing salary amount changes projected income by the same delta."""
    account = _create_account(client, current_balance=93000)
    created = _create_income(
        client,
        account["id"],
        amount=1500,
        frequency="monthly",
        next_occurrence=today,
    )
    before = _forecast(client, today, today, "day")
    ending_before = Decimal(
        _period(before, _iso(today))["projected_balance"],
    )

    updated = client.put(
        f"/incomes/{created['id']}",
        json={
            "account_id": account["id"],
            "amount": 500,
            "frequency": "monthly",
            "start_date": created["start_date"],
            "next_occurrence": created["next_occurrence"],
            "end_date": None,
            "active": True,
        },
    )
    assert updated.status_code == 200

    after = _forecast(client, today, today, "day")
    period = _period(after, _iso(today))
    assert Decimal(period["income"]) == Decimal("500.00")
    ending_after = Decimal(period["projected_balance"])
    assert ending_before - ending_after == Decimal("1000.00")


def test_historical_transactions_do_not_influence_forecast(
    client: TestClient,
    today: date,
) -> None:
    """Past transactions are not a forecasting source."""
    account = _create_account(client, current_balance=1000)
    transaction = client.post(
        "/transactions",
        json={
            "account_id": account["id"],
            "description": "Old expense",
            "amount": 999.00,
            "transaction_type": "expense",
            "occurred_on": _iso(today - timedelta(days=1)),
        },
    )
    assert transaction.status_code == 201
    body = _forecast(client, today, today, "day")
    period = _period(body, _iso(today))
    assert Decimal(period["income"]) == Decimal("0.00")
    assert Decimal(period["expenses"]) == Decimal("0.00")
    assert Decimal(period["projected_balance"]) == Decimal(
        "1000.00",
    )


def test_forecast_account_scope_isolates_schedules(
    client: TestClient,
    today: date,
) -> None:
    """Schedules on one account do not affect another account forecast."""
    account_a = _create_account(
        client,
        name="Checking",
        current_balance=1000,
    )
    account_b = _create_account(
        client,
        name="Savings",
        current_balance=5000,
    )
    _create_income(
        client,
        account_a["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=today,
    )
    body_b = _forecast(
        client,
        today,
        today,
        "day",
        account_id=account_b["id"],
    )
    period_b = _period(body_b, _iso(today))
    assert _projection(body_b)["currency"] == "EUR"
    assert Decimal(period_b["income"]) == Decimal("0.00")
    assert Decimal(period_b["projected_balance"]) == Decimal(
        "5000.00",
    )


def test_forecast_account_scope_excludes_inactive_schedule(
    client: TestClient,
    today: date,
) -> None:
    """Inactive salary is excluded from an account-scoped forecast."""
    account = _create_account(client, current_balance=1000)
    _create_income(
        client,
        account["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=today,
        active=False,
    )
    body = _forecast(
        client,
        today,
        today,
        "day",
        account_id=account["id"],
    )
    period = _period(body, _iso(today))
    assert Decimal(period["income"]) == Decimal("0.00")
    assert Decimal(period["projected_balance"]) == Decimal(
        "1000.00",
    )


def test_forecast_account_scope_with_no_schedules(
    client: TestClient,
    today: date,
) -> None:
    """An account without schedules keeps a flat projected balance."""
    account = _create_account(client, current_balance=750)
    body = _forecast(
        client,
        today,
        today,
        "day",
        account_id=account["id"],
    )
    period = _period(body, _iso(today))
    assert Decimal(period["net_cash_flow"]) == Decimal("0.00")
    assert Decimal(period["projected_balance"]) == Decimal("750.00")


def test_forecast_account_scope_returns_404_for_missing_account(
    client: TestClient,
    today: date,
) -> None:
    """Unknown account_id is rejected."""
    response = client.get(
        "/forecast",
        params={
            "from": _iso(today),
            "to": _iso(today),
            "group_by": "day",
            "account_id": 999999,
        },
    )
    assert response.status_code == 404


def test_forecast_account_scope_uses_account_currency(
    client: TestClient,
    today: date,
) -> None:
    """Account-scoped responses label the account currency."""
    account = _create_account(
        client,
        current_balance=100,
        currency="USD",
    )
    body = _forecast(
        client,
        today,
        today,
        "day",
        account_id=account["id"],
    )
    assert _projection(body)["currency"] == "USD"


def test_forecast_household_returns_projection_per_currency(
    client: TestClient,
    today: date,
) -> None:
    """Mixed-currency households return one projection per currency."""
    eur_account = _create_account(
        client,
        name="EUR account",
        currency="EUR",
        current_balance=1000,
    )
    usd_account = _create_account(
        client,
        name="USD account",
        currency="USD",
        current_balance=200,
    )
    _create_income(
        client,
        eur_account["id"],
        amount=500,
        frequency="monthly",
        next_occurrence=today,
    )
    _create_expense(
        client,
        usd_account["id"],
        amount=50,
        frequency="monthly",
        next_occurrence=today,
    )
    body = _forecast(client, today, today, "day")
    assert [item["currency"] for item in body["projections"]] == [
        "EUR",
        "USD",
    ]
    eur = _projection(body, "EUR")
    usd = _projection(body, "USD")
    assert Decimal(eur["starting_balance"]) == Decimal("1000.00")
    assert Decimal(usd["starting_balance"]) == Decimal("200.00")
    eur_period = _period(body, _iso(today), currency="EUR")
    usd_period = _period(body, _iso(today), currency="USD")
    assert Decimal(eur_period["income"]) == Decimal("500.00")
    assert Decimal(usd_period["expenses"]) == Decimal("50.00")
    assert Decimal(eur_period["projected_balance"]) == Decimal("1500.00")
    assert Decimal(usd_period["projected_balance"]) == Decimal("150.00")


def test_forecast_household_supports_per_currency_group_by(
    client: TestClient,
    today: date,
) -> None:
    """Each currency projection can use its own grouping."""
    eur_account = _create_account(
        client,
        name="EUR account",
        currency="EUR",
        current_balance=1000,
    )
    usd_account = _create_account(
        client,
        name="USD account",
        currency="USD",
        current_balance=200,
    )
    _create_income(
        client,
        eur_account["id"],
        amount=500,
        frequency="monthly",
        next_occurrence=today,
    )
    _create_expense(
        client,
        usd_account["id"],
        amount=50,
        frequency="monthly",
        next_occurrence=today,
    )
    body = _forecast(
        client,
        today,
        today,
        "month",
        group_by_overrides=json.dumps({"USD": "day"}),
    )
    eur = _projection(body, "EUR")
    usd = _projection(body, "USD")
    assert eur["group_by"] == "month"
    assert usd["group_by"] == "day"
    assert eur["periods"][0]["period"] == _month(today)
    assert usd["periods"][0]["period"] == _iso(today)


def test_forecast_household_matches_sum_of_account_scopes(
    client: TestClient,
    today: date,
) -> None:
    """Household period totals equal the sum of per-account forecasts."""
    account_a = _create_account(
        client,
        name="Main",
        current_balance=1000,
    )
    account_b = _create_account(
        client,
        name="Side",
        current_balance=500,
    )
    _create_income(
        client,
        account_a["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=today,
    )
    _create_expense(
        client,
        account_b["id"],
        amount=100,
        frequency="monthly",
        next_occurrence=today,
    )
    household = _forecast(client, today, today, "day")
    scope_a = _forecast(
        client,
        today,
        today,
        "day",
        account_id=account_a["id"],
    )
    scope_b = _forecast(
        client,
        today,
        today,
        "day",
        account_id=account_b["id"],
    )
    label = _iso(today)
    home = _period(household, label)
    part_a = _period(scope_a, label)
    part_b = _period(scope_b, label)
    assert Decimal(_projection(household)["starting_balance"]) == (
        Decimal(_projection(scope_a)["starting_balance"])
        + Decimal(_projection(scope_b)["starting_balance"])
    )
    assert Decimal(home["income"]) == (
        Decimal(part_a["income"]) + Decimal(part_b["income"])
    )
    assert Decimal(home["expenses"]) == (
        Decimal(part_a["expenses"]) + Decimal(part_b["expenses"])
    )
    assert Decimal(home["net_cash_flow"]) == (
        Decimal(part_a["net_cash_flow"])
        + Decimal(part_b["net_cash_flow"])
    )
    assert Decimal(home["projected_balance"]) == (
        Decimal(part_a["projected_balance"])
        + Decimal(part_b["projected_balance"])
    )


def test_forecast_account_scope_matches_household_single_account(
    client: TestClient,
    today: date,
) -> None:
    """One account with schedules matches household and account scope."""
    account = _create_account(client, current_balance=2800)
    _create_income(
        client,
        account["id"],
        amount=2000,
        frequency="monthly",
        next_occurrence=today,
    )
    household = _forecast(client, today, today, "day")
    scoped = _forecast(
        client,
        today,
        today,
        "day",
        account_id=account["id"],
    )
    label = _iso(today)
    assert _period(household, label) == _period(scoped, label)
    assert _projection(household)["starting_balance"] == _projection(
        scoped,
    )["starting_balance"]


def test_forecast_household_currency_matches_account_scopes(
    client: TestClient,
    today: date,
) -> None:
    """Each household currency projection matches its account scopes."""
    eur_main = _create_account(
        client,
        name="EUR main",
        currency="EUR",
        current_balance=1000,
    )
    eur_side = _create_account(
        client,
        name="EUR side",
        currency="EUR",
        current_balance=250,
    )
    usd_account = _create_account(
        client,
        name="USD",
        currency="USD",
        current_balance=80,
    )
    _create_income(
        client,
        eur_main["id"],
        amount=100,
        frequency="monthly",
        next_occurrence=today,
    )
    _create_expense(
        client,
        usd_account["id"],
        amount=20,
        frequency="monthly",
        next_occurrence=today,
    )
    household = _forecast(client, today, today, "day")
    eur_scope_main = _forecast(
        client,
        today,
        today,
        "day",
        account_id=eur_main["id"],
    )
    eur_scope_side = _forecast(
        client,
        today,
        today,
        "day",
        account_id=eur_side["id"],
    )
    usd_scope = _forecast(
        client,
        today,
        today,
        "day",
        account_id=usd_account["id"],
    )
    label = _iso(today)
    home_eur = _period(household, label, currency="EUR")
    home_usd = _period(household, label, currency="USD")
    assert Decimal(_projection(household, "EUR")["starting_balance"]) == (
        Decimal(_projection(eur_scope_main)["starting_balance"])
        + Decimal(_projection(eur_scope_side)["starting_balance"])
    )
    assert Decimal(home_eur["income"]) == Decimal(
        _period(eur_scope_main, label)["income"],
    )
    assert Decimal(home_eur["projected_balance"]) == Decimal("1350.00")
    assert Decimal(home_usd["expenses"]) == Decimal(
        _period(usd_scope, label)["expenses"],
    )
    assert Decimal(_projection(household, "USD")["starting_balance"]) == Decimal(
        _projection(usd_scope)["starting_balance"],
    )
