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


def _summary_block(body: dict, currency: str = "EUR") -> dict:
    """Return totals for one currency from a financial summary response."""
    return next(
        item for item in body["by_currency"] if item["currency"] == currency
    )


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
    totals = _summary_block(body)
    assert Decimal(totals["total_income"]) == Decimal("3000.00")
    assert Decimal(totals["total_expenses"]) == Decimal("1250.50")
    assert Decimal(totals["net_cash_flow"]) == Decimal("1749.50")


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
    assert body["by_currency"] == []


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
    totals = _summary_block(body)
    assert Decimal(totals["total_income"]) == Decimal("100.00")
    assert Decimal(totals["total_expenses"]) == Decimal("0.00")
    assert Decimal(totals["net_cash_flow"]) == Decimal("100.00")


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
    totals = _summary_block(body)
    assert Decimal(totals["total_income"]) == Decimal("100.00")
    assert Decimal(totals["total_expenses"]) == Decimal("40.00")
    assert Decimal(totals["net_cash_flow"]) == Decimal("60.00")


def test_financial_summary_rejects_from_after_to(
    client: TestClient,
) -> None:
    """GET /financial-summary returns 422 when from is after to."""
    response = client.get(
        "/financial-summary",
        params={"from": "2026-10-31", "to": "2026-10-01"},
    )

    assert response.status_code == 422


def test_financial_summary_groups_by_currency(
    client: TestClient,
) -> None:
    """GET /financial-summary keeps EUR and USD totals separate."""
    eur_account = client.post(
        "/accounts",
        json={
            "name": "EUR Account",
            "account_type": "bank",
            "currency": "EUR",
        },
    ).json()["id"]
    usd_account = client.post(
        "/accounts",
        json={
            "name": "USD Account",
            "account_type": "bank",
            "currency": "USD",
        },
    ).json()["id"]
    _create_transaction(
        client,
        eur_account,
        amount=100.00,
        transaction_type="income",
        occurred_on="2026-10-05",
    )
    _create_transaction(
        client,
        usd_account,
        amount=50.00,
        transaction_type="income",
        occurred_on="2026-10-05",
    )
    _create_transaction(
        client,
        eur_account,
        amount=40.00,
        transaction_type="expense",
        occurred_on="2026-10-06",
    )

    response = client.get(
        "/financial-summary",
        params={"from": "2026-10-01", "to": "2026-10-31"},
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["currency"] for item in body["by_currency"]] == [
        "EUR",
        "USD",
    ]
    eur = _summary_block(body, "EUR")
    usd = _summary_block(body, "USD")
    assert Decimal(eur["total_income"]) == Decimal("100.00")
    assert Decimal(eur["total_expenses"]) == Decimal("40.00")
    assert Decimal(eur["net_cash_flow"]) == Decimal("60.00")
    assert Decimal(usd["total_income"]) == Decimal("50.00")
    assert Decimal(usd["total_expenses"]) == Decimal("0.00")
    assert Decimal(usd["net_cash_flow"]) == Decimal("50.00")


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
