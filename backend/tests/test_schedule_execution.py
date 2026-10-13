"""Schedule occurrence execution API tests."""

from datetime import date
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def today() -> date:
    """Application current domain date."""
    return date.today()


def _iso(value: date) -> str:
    return value.isoformat()


def _create_account(client: TestClient, balance: float = 1000.0) -> dict:
    response = client.post(
        "/accounts",
        json={
            "name": "Exec account",
            "account_type": "bank",
            "current_balance": balance,
        },
    )
    assert response.status_code == 201
    return response.json()


def _create_income(
    client: TestClient,
    account_id: int,
    *,
    amount: float,
    next_occurrence: date,
    active: bool = True,
) -> dict:
    response = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": amount,
            "frequency": "monthly",
            "start_date": _iso(next_occurrence),
            "next_occurrence": _iso(next_occurrence),
            "active": active,
        },
    )
    assert response.status_code == 201
    return response.json()


def _create_expense(
    client: TestClient,
    account_id: int,
    *,
    amount: float,
    next_occurrence: date,
    active: bool = True,
) -> dict:
    response = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Rent",
            "amount": amount,
            "frequency": "monthly",
            "start_date": _iso(next_occurrence),
            "next_occurrence": _iso(next_occurrence),
            "active": active,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_execute_income_occurrence_today(
    client: TestClient,
    today: date,
) -> None:
    """Eligible income execution creates transaction and balance."""
    account = _create_account(client, balance=500.0)
    income = _create_income(
        client,
        account["id"],
        amount=200.0,
        next_occurrence=today,
    )
    response = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["transaction_amount"] == "200.00"
    assert body["transaction_type"] == "income"
    stored = client.get(f"/accounts/{account['id']}")
    assert Decimal(stored.json()["current_balance"]) == Decimal(
        "700.00",
    )


def test_execute_expense_occurrence_today(
    client: TestClient,
    today: date,
) -> None:
    """Eligible expense execution decreases balance."""
    account = _create_account(client, balance=500.0)
    expense = _create_expense(
        client,
        account["id"],
        amount=50.0,
        next_occurrence=today,
    )
    response = client.post(
        f"/recurring-expenses/{expense['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    assert response.status_code == 201
    stored = client.get(f"/accounts/{account['id']}")
    assert Decimal(stored.json()["current_balance"]) == Decimal(
        "450.00",
    )


def test_execute_rejects_past_occurrence(
    client: TestClient,
    today: date,
) -> None:
    """Past occurrence_date is not eligible."""
    account = _create_account(client)
    past = today - timedelta(days=7)
    income = _create_income(
        client,
        account["id"],
        amount=100.0,
        next_occurrence=past,
    )
    response = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(past)},
    )
    assert response.status_code == 422


def test_execute_rejects_future_occurrence(
    client: TestClient,
    today: date,
) -> None:
    """Future occurrence_date is not eligible."""
    account = _create_account(client)
    future = today + timedelta(days=7)
    income = _create_income(
        client,
        account["id"],
        amount=100.0,
        next_occurrence=future,
    )
    response = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(future)},
    )
    assert response.status_code == 422


def test_execute_rejects_inactive_schedule(
    client: TestClient,
    today: date,
) -> None:
    """Inactive schedules cannot be executed."""
    account = _create_account(client)
    income = _create_income(
        client,
        account["id"],
        amount=100.0,
        next_occurrence=today,
        active=False,
    )
    response = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    assert response.status_code == 422


def test_execute_idempotent_replay(
    client: TestClient,
    today: date,
) -> None:
    """Duplicate execution returns 200 without extra balance change."""
    account = _create_account(client, balance=1000.0)
    income = _create_income(
        client,
        account["id"],
        amount=100.0,
        next_occurrence=today,
    )
    first = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    second = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["transaction_id"] == second.json()[
        "transaction_id"
    ]
    stored = client.get(f"/accounts/{account['id']}")
    assert Decimal(stored.json()["current_balance"]) == Decimal(
        "1100.00",
    )
    transactions = client.get("/transactions").json()
    assert len(transactions) == 1


def test_execution_linked_transaction_cannot_be_deleted(
    client: TestClient,
    today: date,
) -> None:
    """DELETE /transactions is blocked for schedule-generated rows."""
    account = _create_account(client)
    income = _create_income(
        client,
        account["id"],
        amount=50.0,
        next_occurrence=today,
    )
    executed = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    transaction_id = executed.json()["transaction_id"]
    deleted = client.delete(f"/transactions/{transaction_id}")
    assert deleted.status_code == 409


def test_execution_linked_transaction_cannot_be_updated(
    client: TestClient,
    today: date,
) -> None:
    """PUT /transactions is blocked for schedule-generated rows."""
    account = _create_account(client)
    income = _create_income(
        client,
        account["id"],
        amount=50.0,
        next_occurrence=today,
    )
    executed = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    transaction_id = executed.json()["transaction_id"]
    updated = client.put(
        f"/transactions/{transaction_id}",
        json={
            "account_id": account["id"],
            "amount": 99.0,
            "transaction_type": "income",
            "occurred_on": _iso(today),
            "description": None,
            "category": None,
        },
    )
    assert updated.status_code == 409
