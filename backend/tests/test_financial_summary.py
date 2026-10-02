"""API tests for financial summaries."""

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def account_id(client: TestClient) -> int:
    """Create an account and return its id for summary tests."""
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
) -> None:
    """Create a transaction through the API."""
    response = client.post(
        "/transactions",
        json={
            "account_id": account_id,
            "amount": amount,
            "transaction_type": transaction_type,
            "occurred_on": occurred_on,
        },
    )
    assert response.status_code == 201


def test_financial_summary_sums_income_and_expenses(
    client: TestClient,
    account_id: int,
) -> None:
    """GET /financial-summary totals income and expenses in range."""
    _create_transaction(
        client,
        account_id,
        amount=3000.00,
        transaction_type="income",
        occurred_on="2026-10-05",
    )
    _create_transaction(
        client,
        account_id,
        amount=1000.00,
        transaction_type="expense",
        occurred_on="2026-10-10",
    )
    _create_transaction(
        client,
        account_id,
        amount=250.50,
        transaction_type="expense",
        occurred_on="2026-10-15",
    )

    response = client.get(
        "/financial-summary",
        params={"from": "2026-10-01", "to": "2026-10-31"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["from_date"] == "2026-10-01"
    assert body["to_date"] == "2026-10-31"
    assert Decimal(body["total_income"]) == Decimal("3000.00")
    assert Decimal(body["total_expenses"]) == Decimal("1250.50")
    assert Decimal(body["net_cash_flow"]) == Decimal("1749.50")


def test_financial_summary_returns_zeros_for_empty_period(
    client: TestClient,
) -> None:
    """GET /financial-summary returns zeros when no rows match."""
    response = client.get(
        "/financial-summary",
        params={"from": "2026-10-01", "to": "2026-10-31"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["from_date"] == "2026-10-01"
    assert body["to_date"] == "2026-10-31"
    assert Decimal(body["total_income"]) == Decimal("0.00")
    assert Decimal(body["total_expenses"]) == Decimal("0.00")
    assert Decimal(body["net_cash_flow"]) == Decimal("0.00")


def test_financial_summary_excludes_transactions_outside_range(
    client: TestClient,
    account_id: int,
) -> None:
    """GET /financial-summary ignores transactions outside the range."""
    _create_transaction(
        client,
        account_id,
        amount=500.00,
        transaction_type="income",
        occurred_on="2026-09-30",
    )
    _create_transaction(
        client,
        account_id,
        amount=200.00,
        transaction_type="expense",
        occurred_on="2026-11-01",
    )
    _create_transaction(
        client,
        account_id,
        amount=100.00,
        transaction_type="income",
        occurred_on="2026-10-15",
    )

    response = client.get(
        "/financial-summary",
        params={"from": "2026-10-01", "to": "2026-10-31"},
    )

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["total_income"]) == Decimal("100.00")
    assert Decimal(body["total_expenses"]) == Decimal("0.00")
    assert Decimal(body["net_cash_flow"]) == Decimal("100.00")


def test_financial_summary_includes_boundary_dates(
    client: TestClient,
    account_id: int,
) -> None:
    """GET /financial-summary includes from and to dates inclusively."""
    _create_transaction(
        client,
        account_id,
        amount=100.00,
        transaction_type="income",
        occurred_on="2026-10-01",
    )
    _create_transaction(
        client,
        account_id,
        amount=40.00,
        transaction_type="expense",
        occurred_on="2026-10-31",
    )

    response = client.get(
        "/financial-summary",
        params={"from": "2026-10-01", "to": "2026-10-31"},
    )

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["total_income"]) == Decimal("100.00")
    assert Decimal(body["total_expenses"]) == Decimal("40.00")
    assert Decimal(body["net_cash_flow"]) == Decimal("60.00")


def test_financial_summary_rejects_from_after_to(
    client: TestClient,
) -> None:
    """GET /financial-summary returns 422 when from is after to."""
    response = client.get(
        "/financial-summary",
        params={"from": "2026-10-31", "to": "2026-10-01"},
    )

    assert response.status_code == 422


def test_financial_summary_rejects_missing_from(
    client: TestClient,
) -> None:
    """GET /financial-summary returns 422 when from is missing."""
    response = client.get(
        "/financial-summary",
        params={"to": "2026-10-31"},
    )

    assert response.status_code == 422


def test_financial_summary_rejects_missing_to(
    client: TestClient,
) -> None:
    """GET /financial-summary returns 422 when to is missing."""
    response = client.get(
        "/financial-summary",
        params={"from": "2026-10-01"},
    )

    assert response.status_code == 422
