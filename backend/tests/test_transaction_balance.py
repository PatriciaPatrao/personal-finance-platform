"""Transaction writes update Account.current_balance atomically."""

from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient


def _create_account(
    client: TestClient,
    *,
    balance: float = 1000.0,
) -> int:
    response = client.post(
        "/accounts",
        json={
            "name": "Balance test",
            "account_type": "bank",
            "current_balance": balance,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_create_income_transaction_increases_balance(
    client: TestClient,
) -> None:
    """POST /transactions adds income to current_balance."""
    account_id = _create_account(client, balance=1000.0)
    response = client.post(
        "/transactions",
        json={
            "account_id": account_id,
            "amount": 250.00,
            "transaction_type": "income",
            "occurred_on": "2026-10-01",
        },
    )
    assert response.status_code == 201
    stored = client.get(f"/accounts/{account_id}")
    assert Decimal(stored.json()["current_balance"]) == Decimal(
        "1250.00",
    )


def test_create_expense_transaction_decreases_balance(
    client: TestClient,
) -> None:
    """POST /transactions subtracts expense from current_balance."""
    account_id = _create_account(client, balance=1000.0)
    response = client.post(
        "/transactions",
        json={
            "account_id": account_id,
            "amount": 150.00,
            "transaction_type": "expense",
            "occurred_on": "2026-10-01",
        },
    )
    assert response.status_code == 201
    stored = client.get(f"/accounts/{account_id}")
    assert Decimal(stored.json()["current_balance"]) == Decimal(
        "850.00",
    )


def test_update_transaction_adjusts_balance(
    client: TestClient,
) -> None:
    """PUT /transactions applies the net balance difference."""
    account_id = _create_account(client, balance=500.0)
    created = client.post(
        "/transactions",
        json={
            "account_id": account_id,
            "amount": 100.00,
            "transaction_type": "income",
            "occurred_on": "2026-10-01",
        },
    )
    transaction_id = created.json()["id"]
    updated = client.put(
        f"/transactions/{transaction_id}",
        json={
            "account_id": account_id,
            "amount": 200.00,
            "transaction_type": "income",
            "occurred_on": "2026-10-01",
            "description": None,
            "category": None,
        },
    )
    assert updated.status_code == 200
    stored = client.get(f"/accounts/{account_id}")
    assert Decimal(stored.json()["current_balance"]) == Decimal(
        "700.00",
    )


def test_delete_transaction_reverses_balance(
    client: TestClient,
) -> None:
    """DELETE /transactions reverses the balance effect."""
    account_id = _create_account(client, balance=500.0)
    created = client.post(
        "/transactions",
        json={
            "account_id": account_id,
            "amount": 75.00,
            "transaction_type": "expense",
            "occurred_on": "2026-10-01",
        },
    )
    transaction_id = created.json()["id"]
    deleted = client.delete(f"/transactions/{transaction_id}")
    assert deleted.status_code == 204
    stored = client.get(f"/accounts/{account_id}")
    assert Decimal(stored.json()["current_balance"]) == Decimal(
        "500.00",
    )
