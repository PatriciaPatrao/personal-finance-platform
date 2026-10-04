"""API tests for historical analysis."""

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


@pytest.fixture
def today() -> date:
    """Application current date used by analysis tests."""
    return date.today()


@pytest.fixture
def account_id(client: TestClient) -> int:
    """Create an account and return its id for analysis tests."""
    response = client.post(
        "/accounts",
        json={
            "name": "Conta Principal",
            "account_type": "bank",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_transaction(
    client: TestClient,
    account_id: int,
    *,
    amount: float,
    transaction_type: str,
    occurred_on: str,
    category: str | None = None,
    description: str | None = None,
) -> None:
    """Create a transaction through the API."""
    payload = {
        "account_id": account_id,
        "amount": amount,
        "transaction_type": transaction_type,
        "occurred_on": occurred_on,
    }
    if category is not None:
        payload["category"] = category
    if description is not None:
        payload["description"] = description
    response = client.post("/transactions", json=payload)
    assert response.status_code == 201


def _create_income(
    client: TestClient,
    account_id: int,
    *,
    amount: float,
    next_occurrence: date,
) -> None:
    """Create an income record that must not affect analysis."""
    response = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": amount,
            "frequency": "monthly",
            "start_date": _iso(next_occurrence),
            "next_occurrence": _iso(next_occurrence),
        },
    )
    assert response.status_code == 201


def _create_recurring_expense(
    client: TestClient,
    account_id: int,
    *,
    amount: float,
    next_occurrence: date,
) -> None:
    """Create a recurring expense that must not affect analysis."""
    response = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Rent",
            "amount": amount,
            "frequency": "monthly",
            "start_date": _iso(next_occurrence),
            "next_occurrence": _iso(next_occurrence),
        },
    )
    assert response.status_code == 201


def _period(body: dict, label: str) -> dict:
    """Return the cash-flow period with the given label."""
    return next(
        item for item in body["periods"] if item["period"] == label
    )


# --- Summary ---


def test_analysis_summary_valid_historical_period(
    client: TestClient,
    account_id: int,
    today: date,
) -> None:
    """GET /analysis/summary totals income and expenses in range."""
    from_date = today - timedelta(days=30)
    to_date = today - timedelta(days=1)
    _create_transaction(
        client,
        account_id,
        amount=2000.00,
        transaction_type="income",
        occurred_on=_iso(from_date + timedelta(days=1)),
    )
    _create_transaction(
        client,
        account_id,
        amount=800.00,
        transaction_type="expense",
        occurred_on=_iso(from_date + timedelta(days=2)),
        category="Housing",
    )
    _create_transaction(
        client,
        account_id,
        amount=550.00,
        transaction_type="expense",
        occurred_on=_iso(from_date + timedelta(days=3)),
        category="Food",
    )

    response = client.get(
        "/analysis/summary",
        params={"from": _iso(from_date), "to": _iso(to_date)},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["from_date"] == _iso(from_date)
    assert body["to_date"] == _iso(to_date)
    assert Decimal(body["total_income"]) == Decimal("2000.00")
    assert Decimal(body["total_expenses"]) == Decimal("1350.00")
    assert Decimal(body["net_cash_flow"]) == Decimal("650.00")


def test_analysis_summary_empty_period_returns_zeros(
    client: TestClient,
    today: date,
) -> None:
    """GET /analysis/summary returns zeros when no rows match."""
    from_date = today - timedelta(days=10)
    to_date = today - timedelta(days=1)

    response = client.get(
        "/analysis/summary",
        params={"from": _iso(from_date), "to": _iso(to_date)},
    )

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["total_income"]) == Decimal("0.00")
    assert Decimal(body["total_expenses"]) == Decimal("0.00")
    assert Decimal(body["net_cash_flow"]) == Decimal("0.00")


def test_analysis_summary_includes_boundary_dates(
    client: TestClient,
    account_id: int,
    today: date,
) -> None:
    """GET /analysis/summary includes from and to dates inclusively."""
    from_date = today - timedelta(days=10)
    to_date = today - timedelta(days=1)
    _create_transaction(
        client,
        account_id,
        amount=100.00,
        transaction_type="income",
        occurred_on=_iso(from_date),
    )
    _create_transaction(
        client,
        account_id,
        amount=40.00,
        transaction_type="expense",
        occurred_on=_iso(to_date),
    )

    response = client.get(
        "/analysis/summary",
        params={"from": _iso(from_date), "to": _iso(to_date)},
    )

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["total_income"]) == Decimal("100.00")
    assert Decimal(body["total_expenses"]) == Decimal("40.00")
    assert Decimal(body["net_cash_flow"]) == Decimal("60.00")


def test_analysis_summary_accepts_to_equal_today(
    client: TestClient,
    account_id: int,
    today: date,
) -> None:
    """GET /analysis/summary allows the current day as to."""
    _create_transaction(
        client,
        account_id,
        amount=50.00,
        transaction_type="expense",
        occurred_on=_iso(today),
        category="Food",
    )

    response = client.get(
        "/analysis/summary",
        params={"from": _iso(today), "to": _iso(today)},
    )

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["total_expenses"]) == Decimal("50.00")


def test_analysis_summary_ignores_income_and_recurring_expense(
    client: TestClient,
    account_id: int,
    today: date,
) -> None:
    """Analysis summary uses only Transaction rows."""
    from_date = today - timedelta(days=5)
    to_date = today
    _create_income(
        client,
        account_id,
        amount=9999.00,
        next_occurrence=today,
    )
    _create_recurring_expense(
        client,
        account_id,
        amount=8888.00,
        next_occurrence=today,
    )
    _create_transaction(
        client,
        account_id,
        amount=100.00,
        transaction_type="income",
        occurred_on=_iso(from_date),
    )

    response = client.get(
        "/analysis/summary",
        params={"from": _iso(from_date), "to": _iso(to_date)},
    )

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["total_income"]) == Decimal("100.00")
    assert Decimal(body["total_expenses"]) == Decimal("0.00")


def test_analysis_summary_rejects_from_after_to(
    client: TestClient,
    today: date,
) -> None:
    """GET /analysis/summary returns 422 when from is after to."""
    response = client.get(
        "/analysis/summary",
        params={
            "from": _iso(today),
            "to": _iso(today - timedelta(days=1)),
        },
    )
    assert response.status_code == 422


def test_analysis_summary_rejects_future_to(
    client: TestClient,
    today: date,
) -> None:
    """GET /analysis/summary returns 422 when to is in the future."""
    response = client.get(
        "/analysis/summary",
        params={
            "from": _iso(today),
            "to": _iso(today + timedelta(days=1)),
        },
    )
    assert response.status_code == 422


def test_analysis_summary_rejects_missing_from(
    client: TestClient,
    today: date,
) -> None:
    """GET /analysis/summary returns 422 when from is missing."""
    response = client.get(
        "/analysis/summary",
        params={"to": _iso(today)},
    )
    assert response.status_code == 422


def test_analysis_summary_rejects_missing_to(
    client: TestClient,
    today: date,
) -> None:
    """GET /analysis/summary returns 422 when to is missing."""
    response = client.get(
        "/analysis/summary",
        params={"from": _iso(today)},
    )
    assert response.status_code == 422


# --- Expenses by category ---


def test_analysis_expenses_grouped_by_category(
    client: TestClient,
    account_id: int,
    today: date,
) -> None:
    """GET /analysis/expenses groups expenses and computes percentages."""
    from_date = today - timedelta(days=20)
    to_date = today - timedelta(days=1)
    _create_transaction(
        client,
        account_id,
        amount=800.00,
        transaction_type="expense",
        occurred_on=_iso(from_date + timedelta(days=1)),
        category="Housing",
    )
    _create_transaction(
        client,
        account_id,
        amount=200.00,
        transaction_type="expense",
        occurred_on=_iso(from_date + timedelta(days=2)),
        category="Food",
    )
    _create_transaction(
        client,
        account_id,
        amount=150.00,
        transaction_type="expense",
        occurred_on=_iso(from_date + timedelta(days=3)),
        category="Food",
    )
    _create_transaction(
        client,
        account_id,
        amount=200.00,
        transaction_type="expense",
        occurred_on=_iso(from_date + timedelta(days=4)),
        category="Transport",
    )
    _create_transaction(
        client,
        account_id,
        amount=2000.00,
        transaction_type="income",
        occurred_on=_iso(from_date + timedelta(days=5)),
    )

    response = client.get(
        "/analysis/expenses",
        params={"from": _iso(from_date), "to": _iso(to_date)},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["from_date"] == _iso(from_date)
    assert body["to_date"] == _iso(to_date)
    assert Decimal(body["total_expenses"]) == Decimal("1350.00")
    assert [item["category"] for item in body["categories"]] == [
        "Housing",
        "Food",
        "Transport",
    ]
    assert Decimal(body["categories"][0]["amount"]) == Decimal(
        "800.00",
    )
    assert Decimal(body["categories"][0]["percentage"]) == Decimal(
        "59.26",
    )
    assert Decimal(body["categories"][1]["amount"]) == Decimal(
        "350.00",
    )
    assert Decimal(body["categories"][1]["percentage"]) == Decimal(
        "25.93",
    )
    assert Decimal(body["categories"][2]["amount"]) == Decimal(
        "200.00",
    )
    assert Decimal(body["categories"][2]["percentage"]) == Decimal(
        "14.81",
    )


def test_analysis_expenses_null_category_becomes_uncategorized(
    client: TestClient,
    account_id: int,
    today: date,
) -> None:
    """Null Transaction.category is returned as Uncategorized."""
    _create_transaction(
        client,
        account_id,
        amount=75.00,
        transaction_type="expense",
        occurred_on=_iso(today),
    )

    response = client.get(
        "/analysis/expenses",
        params={"from": _iso(today), "to": _iso(today)},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["categories"]) == 1
    assert body["categories"][0]["category"] == "Uncategorized"
    assert Decimal(body["categories"][0]["amount"]) == Decimal(
        "75.00",
    )
    assert Decimal(body["categories"][0]["percentage"]) == Decimal(
        "100.00",
    )


def test_analysis_expenses_zero_expenses_returns_empty_categories(
    client: TestClient,
    account_id: int,
    today: date,
) -> None:
    """Zero expenses returns an empty categories list."""
    _create_transaction(
        client,
        account_id,
        amount=100.00,
        transaction_type="income",
        occurred_on=_iso(today),
    )

    response = client.get(
        "/analysis/expenses",
        params={"from": _iso(today), "to": _iso(today)},
    )

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["total_expenses"]) == Decimal("0.00")
    assert body["categories"] == []


def test_analysis_expenses_deterministic_ordering(
    client: TestClient,
    account_id: int,
    today: date,
) -> None:
    """Equal amounts are ordered by category ascending."""
    _create_transaction(
        client,
        account_id,
        amount=100.00,
        transaction_type="expense",
        occurred_on=_iso(today),
        category="Transport",
    )
    _create_transaction(
        client,
        account_id,
        amount=100.00,
        transaction_type="expense",
        occurred_on=_iso(today),
        category="Food",
    )
    _create_transaction(
        client,
        account_id,
        amount=200.00,
        transaction_type="expense",
        occurred_on=_iso(today),
        category="Housing",
    )

    response = client.get(
        "/analysis/expenses",
        params={"from": _iso(today), "to": _iso(today)},
    )

    assert response.status_code == 200
    categories = [
        item["category"] for item in response.json()["categories"]
    ]
    assert categories == ["Housing", "Food", "Transport"]


def test_analysis_expenses_includes_boundary_dates(
    client: TestClient,
    account_id: int,
    today: date,
) -> None:
    """GET /analysis/expenses includes from and to dates inclusively."""
    from_date = today - timedelta(days=5)
    to_date = today
    _create_transaction(
        client,
        account_id,
        amount=10.00,
        transaction_type="expense",
        occurred_on=_iso(from_date),
        category="Food",
    )
    _create_transaction(
        client,
        account_id,
        amount=20.00,
        transaction_type="expense",
        occurred_on=_iso(to_date),
        category="Food",
    )
    _create_transaction(
        client,
        account_id,
        amount=99.00,
        transaction_type="expense",
        occurred_on=_iso(from_date - timedelta(days=1)),
        category="Food",
    )

    response = client.get(
        "/analysis/expenses",
        params={"from": _iso(from_date), "to": _iso(to_date)},
    )

    assert response.status_code == 200
    assert Decimal(response.json()["total_expenses"]) == Decimal(
        "30.00",
    )


def test_analysis_expenses_rejects_from_after_to(
    client: TestClient,
    today: date,
) -> None:
    """GET /analysis/expenses returns 422 when from is after to."""
    response = client.get(
        "/analysis/expenses",
        params={
            "from": _iso(today),
            "to": _iso(today - timedelta(days=1)),
        },
    )
    assert response.status_code == 422


def test_analysis_expenses_rejects_future_to(
    client: TestClient,
    today: date,
) -> None:
    """GET /analysis/expenses returns 422 when to is in the future."""
    response = client.get(
        "/analysis/expenses",
        params={
            "from": _iso(today),
            "to": _iso(today + timedelta(days=1)),
        },
    )
    assert response.status_code == 422


# --- Cash flow ---


def test_analysis_cash_flow_daily_grouping(
    client: TestClient,
    account_id: int,
    today: date,
) -> None:
    """GET /analysis/cash-flow groups by day and fills empty periods."""
    day_one = today - timedelta(days=2)
    day_two = today - timedelta(days=1)
    day_three = today
    _create_transaction(
        client,
        account_id,
        amount=2000.00,
        transaction_type="income",
        occurred_on=_iso(day_one),
    )
    _create_transaction(
        client,
        account_id,
        amount=400.00,
        transaction_type="expense",
        occurred_on=_iso(day_one),
        category="Food",
    )
    _create_transaction(
        client,
        account_id,
        amount=100.00,
        transaction_type="expense",
        occurred_on=_iso(day_three),
        category="Transport",
    )

    response = client.get(
        "/analysis/cash-flow",
        params={
            "from": _iso(day_one),
            "to": _iso(day_three),
            "group_by": "day",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["group_by"] == "day"
    assert [item["period"] for item in body["periods"]] == [
        _iso(day_one),
        _iso(day_two),
        _iso(day_three),
    ]
    first = _period(body, _iso(day_one))
    assert Decimal(first["income"]) == Decimal("2000.00")
    assert Decimal(first["expenses"]) == Decimal("400.00")
    assert Decimal(first["net_cash_flow"]) == Decimal("1600.00")
    middle = _period(body, _iso(day_two))
    assert Decimal(middle["income"]) == Decimal("0.00")
    assert Decimal(middle["expenses"]) == Decimal("0.00")
    assert Decimal(middle["net_cash_flow"]) == Decimal("0.00")
    last = _period(body, _iso(day_three))
    assert Decimal(last["income"]) == Decimal("0.00")
    assert Decimal(last["expenses"]) == Decimal("100.00")
    assert Decimal(last["net_cash_flow"]) == Decimal("-100.00")


def test_analysis_cash_flow_monthly_grouping(
    client: TestClient,
    account_id: int,
    today: date,
) -> None:
    """GET /analysis/cash-flow groups by calendar month."""
    first_month = add_months(
        date(today.year, today.month, 1),
        -2,
    )
    second_month = add_months(first_month, 1)
    third_month = date(today.year, today.month, 1)
    from_date = first_month.replace(day=15)
    mid_date = second_month.replace(day=15)
    to_date = today

    _create_transaction(
        client,
        account_id,
        amount=2000.00,
        transaction_type="income",
        occurred_on=_iso(from_date),
    )
    _create_transaction(
        client,
        account_id,
        amount=1400.00,
        transaction_type="expense",
        occurred_on=_iso(from_date),
        category="Housing",
    )
    _create_transaction(
        client,
        account_id,
        amount=2000.00,
        transaction_type="income",
        occurred_on=_iso(mid_date),
    )
    _create_transaction(
        client,
        account_id,
        amount=1500.00,
        transaction_type="expense",
        occurred_on=_iso(mid_date),
        category="Housing",
    )
    _create_transaction(
        client,
        account_id,
        amount=2000.00,
        transaction_type="income",
        occurred_on=_iso(to_date),
    )
    _create_transaction(
        client,
        account_id,
        amount=1350.00,
        transaction_type="expense",
        occurred_on=_iso(to_date),
        category="Housing",
    )

    response = client.get(
        "/analysis/cash-flow",
        params={
            "from": _iso(from_date),
            "to": _iso(to_date),
            "group_by": "month",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["group_by"] == "month"
    assert [item["period"] for item in body["periods"]] == [
        _month(first_month),
        _month(second_month),
        _month(third_month),
    ]
    first = _period(body, _month(first_month))
    assert Decimal(first["income"]) == Decimal("2000.00")
    assert Decimal(first["expenses"]) == Decimal("1400.00")
    assert Decimal(first["net_cash_flow"]) == Decimal("600.00")
    second = _period(body, _month(second_month))
    assert Decimal(second["income"]) == Decimal("2000.00")
    assert Decimal(second["expenses"]) == Decimal("1500.00")
    assert Decimal(second["net_cash_flow"]) == Decimal("500.00")
    third = _period(body, _month(third_month))
    assert Decimal(third["income"]) == Decimal("2000.00")
    assert Decimal(third["expenses"]) == Decimal("1350.00")
    assert Decimal(third["net_cash_flow"]) == Decimal("650.00")


def test_analysis_cash_flow_empty_periods_returned(
    client: TestClient,
    today: date,
) -> None:
    """Empty ranges still return every period with zeros."""
    from_date = today - timedelta(days=2)

    response = client.get(
        "/analysis/cash-flow",
        params={
            "from": _iso(from_date),
            "to": _iso(today),
            "group_by": "day",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["periods"]) == 3
    for item in body["periods"]:
        assert Decimal(item["income"]) == Decimal("0.00")
        assert Decimal(item["expenses"]) == Decimal("0.00")
        assert Decimal(item["net_cash_flow"]) == Decimal("0.00")


def test_analysis_cash_flow_includes_boundary_dates(
    client: TestClient,
    account_id: int,
    today: date,
) -> None:
    """GET /analysis/cash-flow includes from and to dates inclusively."""
    from_date = today - timedelta(days=1)
    _create_transaction(
        client,
        account_id,
        amount=100.00,
        transaction_type="income",
        occurred_on=_iso(from_date),
    )
    _create_transaction(
        client,
        account_id,
        amount=40.00,
        transaction_type="expense",
        occurred_on=_iso(today),
        category="Food",
    )

    response = client.get(
        "/analysis/cash-flow",
        params={
            "from": _iso(from_date),
            "to": _iso(today),
            "group_by": "day",
        },
    )

    assert response.status_code == 200
    body = response.json()
    first = _period(body, _iso(from_date))
    assert Decimal(first["income"]) == Decimal("100.00")
    last = _period(body, _iso(today))
    assert Decimal(last["expenses"]) == Decimal("40.00")


def test_analysis_cash_flow_rejects_from_after_to(
    client: TestClient,
    today: date,
) -> None:
    """GET /analysis/cash-flow returns 422 when from is after to."""
    response = client.get(
        "/analysis/cash-flow",
        params={
            "from": _iso(today),
            "to": _iso(today - timedelta(days=1)),
            "group_by": "day",
        },
    )
    assert response.status_code == 422


def test_analysis_cash_flow_rejects_future_to(
    client: TestClient,
    today: date,
) -> None:
    """GET /analysis/cash-flow returns 422 when to is in the future."""
    response = client.get(
        "/analysis/cash-flow",
        params={
            "from": _iso(today),
            "to": _iso(today + timedelta(days=1)),
            "group_by": "day",
        },
    )
    assert response.status_code == 422


def test_analysis_cash_flow_rejects_invalid_group_by(
    client: TestClient,
    today: date,
) -> None:
    """GET /analysis/cash-flow returns 422 for unknown group_by."""
    response = client.get(
        "/analysis/cash-flow",
        params={
            "from": _iso(today),
            "to": _iso(today),
            "group_by": "week",
        },
    )
    assert response.status_code == 422


def test_analysis_cash_flow_rejects_missing_group_by(
    client: TestClient,
    today: date,
) -> None:
    """GET /analysis/cash-flow returns 422 when group_by is missing."""
    response = client.get(
        "/analysis/cash-flow",
        params={"from": _iso(today), "to": _iso(today)},
    )
    assert response.status_code == 422
