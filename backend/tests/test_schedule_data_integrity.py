"""Schedule writes must not mutate transactions or account balances."""

from decimal import Decimal

from fastapi.testclient import TestClient


def _account_balance(client: TestClient, account_id: int) -> Decimal:
    response = client.get(f"/accounts/{account_id}")
    assert response.status_code == 200
    return Decimal(response.json()["current_balance"])


def _transaction_snapshot(client: TestClient) -> list[int]:
    response = client.get("/transactions")
    assert response.status_code == 200
    return [item["id"] for item in response.json()]


def test_income_schedule_writes_leave_balance_and_transactions_unchanged(
    client: TestClient,
) -> None:
    """Create, update, deactivate, and reactivate salary schedules."""
    account = client.post(
        "/accounts",
        json={
            "name": "Schedule integrity",
            "account_type": "bank",
            "current_balance": "1234.56",
        },
    )
    assert account.status_code == 201
    account_id = account.json()["id"]
    balance_before = _account_balance(client, account_id)
    tx_before = _transaction_snapshot(client)

    created = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 1500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert created.status_code == 201
    income_id = created.json()["id"]
    assert _account_balance(client, account_id) == balance_before
    assert _transaction_snapshot(client) == tx_before

    updated = client.put(
        f"/incomes/{income_id}",
        json={
            "account_id": account_id,
            "amount": 500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
            "end_date": None,
            "active": False,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["active"] is False
    assert _account_balance(client, account_id) == balance_before
    assert _transaction_snapshot(client) == tx_before

    reactivated = client.put(
        f"/incomes/{income_id}",
        json={
            "account_id": account_id,
            "amount": 500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
            "end_date": None,
            "active": True,
        },
    )
    assert reactivated.status_code == 200
    assert reactivated.json()["active"] is True
    assert _account_balance(client, account_id) == balance_before
    assert _transaction_snapshot(client) == tx_before


def test_recurring_expense_schedule_writes_leave_balance_unchanged(
    client: TestClient,
) -> None:
    """Create, update, and deactivate recurring expenses."""
    account = client.post(
        "/accounts",
        json={
            "name": "Expense integrity",
            "account_type": "bank",
            "current_balance": "2500.00",
        },
    )
    assert account.status_code == 201
    account_id = account.json()["id"]
    balance_before = _account_balance(client, account_id)
    tx_before = _transaction_snapshot(client)

    created = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Car",
            "amount": 100.00,
            "frequency": "monthly",
            "start_date": "2026-09-02",
            "next_occurrence": "2026-10-02",
        },
    )
    assert created.status_code == 201
    expense_id = created.json()["id"]
    assert _account_balance(client, account_id) == balance_before
    assert _transaction_snapshot(client) == tx_before

    deactivated = client.put(
        f"/recurring-expenses/{expense_id}",
        json={
            "account_id": account_id,
            "description": "Car",
            "amount": 100.00,
            "category": None,
            "frequency": "monthly",
            "start_date": "2026-09-02",
            "next_occurrence": "2026-10-02",
            "end_date": "2027-04-09",
            "active": False,
        },
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["active"] is False
    assert _account_balance(client, account_id) == balance_before
    assert _transaction_snapshot(client) == tx_before


def test_rejected_income_create_leaves_balance_unchanged(
    client: TestClient,
) -> None:
    """Invalid POST /incomes does not write schedules or touch balances."""
    account = client.post(
        "/accounts",
        json={
            "name": "Rejected create",
            "account_type": "bank",
            "current_balance": "100.00",
        },
    )
    assert account.status_code == 201
    account_id = account.json()["id"]
    balance_before = _account_balance(client, account_id)
    incomes_before = client.get("/incomes").json()

    rejected = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 0,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert rejected.status_code == 422
    assert _account_balance(client, account_id) == balance_before
    assert client.get("/incomes").json() == incomes_before
    assert _transaction_snapshot(client) == []
