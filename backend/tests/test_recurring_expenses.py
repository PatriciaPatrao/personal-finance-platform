"""API tests for recurring expenses."""

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def account_id(client: TestClient) -> int:
    """Create an account and return its id."""
    response = client.post(
        "/accounts",
        json={
            "name": "Conta Principal",
            "account_type": "bank",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_create_recurring_expense_returns_created_record(
    client: TestClient,
    account_id: int,
) -> None:
    """POST /recurring-expenses stores a valid record."""
    payload = {
        "account_id": account_id,
        "description": "Netflix",
        "amount": 15.99,
        "frequency": "monthly",
        "start_date": "2026-10-01",
        "next_occurrence": "2026-11-01",
    }

    response = client.post(
        "/recurring-expenses",
        json=payload,
    )

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert body["account_id"] == account_id
    assert body["description"] == "Netflix"
    assert Decimal(body["amount"]) == Decimal("15.99")
    assert body["category"] is None
    assert body["frequency"] == "monthly"
    assert body["start_date"] == "2026-10-01"
    assert body["next_occurrence"] == "2026-11-01"
    assert body["end_date"] is None
    assert body["active"] is True
    assert body["created_at"]


def test_create_recurring_expense_defaults_active_to_true(
    client: TestClient,
    account_id: int,
) -> None:
    """POST omits active and stores active as true."""
    payload = {
        "account_id": account_id,
        "description": "Netflix",
        "amount": 15.99,
        "frequency": "monthly",
        "start_date": "2026-10-01",
        "next_occurrence": "2026-11-01",
    }

    response = client.post(
        "/recurring-expenses",
        json=payload,
    )

    assert response.status_code == 201
    assert response.json()["active"] is True


def test_list_recurring_expenses_orders_by_next_occurrence(
    client: TestClient,
    account_id: int,
) -> None:
    """GET /recurring-expenses returns next_occurrence ascending."""
    later = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Insurance",
            "amount": 100.00,
            "frequency": "yearly",
            "start_date": "2026-01-01",
            "next_occurrence": "2026-12-01",
        },
    )
    earlier = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Netflix",
            "amount": 15.99,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert later.status_code == 201
    assert earlier.status_code == 201

    response = client.get("/recurring-expenses")

    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 2
    ids = [item["id"] for item in items]
    assert ids.index(earlier.json()["id"]) < ids.index(
        later.json()["id"],
    )
    dates = [item["next_occurrence"] for item in items]
    assert dates == sorted(dates)


def test_get_recurring_expense_returns_stored_record(
    client: TestClient,
    account_id: int,
) -> None:
    """GET /recurring-expenses/{id} returns the stored record."""
    payload = {
        "account_id": account_id,
        "description": "Netflix",
        "amount": 15.99,
        "category": "Entertainment",
        "frequency": "monthly",
        "start_date": "2026-10-01",
        "next_occurrence": "2026-11-01",
        "end_date": "2027-10-01",
        "active": True,
    }
    created = client.post(
        "/recurring-expenses",
        json=payload,
    )
    assert created.status_code == 201
    recurring_expense_id = created.json()["id"]

    response = client.get(
        f"/recurring-expenses/{recurring_expense_id}",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == recurring_expense_id
    assert body["account_id"] == account_id
    assert body["description"] == payload["description"]
    assert Decimal(body["amount"]) == Decimal("15.99")
    assert body["category"] == payload["category"]
    assert body["frequency"] == payload["frequency"]
    assert body["start_date"] == payload["start_date"]
    assert body["next_occurrence"] == payload[
        "next_occurrence"
    ]
    assert body["end_date"] == payload["end_date"]
    assert body["active"] is True


def test_get_recurring_expense_returns_404_when_not_found(
    client: TestClient,
) -> None:
    """GET /recurring-expenses/{id} returns 404 when missing."""
    response = client.get("/recurring-expenses/999999")

    assert response.status_code == 404
    assert response.json()["detail"] == (
        "Recurring expense not found"
    )


def test_create_recurring_expense_returns_404_for_missing_account(
    client: TestClient,
) -> None:
    """POST returns 404 when the account does not exist."""
    payload = {
        "account_id": 999999,
        "description": "Netflix",
        "amount": 15.99,
        "frequency": "monthly",
        "start_date": "2026-10-01",
        "next_occurrence": "2026-11-01",
    }

    response = client.post(
        "/recurring-expenses",
        json=payload,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Account not found"


def test_update_recurring_expense_updates_all_fields(
    client: TestClient,
    account_id: int,
) -> None:
    """PUT updates business fields and keeps id and created_at."""
    other_account = client.post(
        "/accounts",
        json={
            "name": "Conta Poupança",
            "account_type": "bank",
        },
    )
    assert other_account.status_code == 201
    other_account_id = other_account.json()["id"]

    created = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Netflix",
            "amount": 15.99,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert created.status_code == 201
    created_body = created.json()
    recurring_expense_id = created_body["id"]
    created_at = created_body["created_at"]

    update_payload = {
        "account_id": other_account_id,
        "description": "Spotify",
        "amount": 9.99,
        "category": "Music",
        "frequency": "yearly",
        "start_date": "2026-09-01",
        "next_occurrence": "2026-10-15",
        "end_date": "2027-09-01",
        "active": False,
    }

    response = client.put(
        f"/recurring-expenses/{recurring_expense_id}",
        json=update_payload,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == recurring_expense_id
    assert body["account_id"] == other_account_id
    assert body["description"] == update_payload[
        "description"
    ]
    assert Decimal(body["amount"]) == Decimal("9.99")
    assert body["category"] == update_payload["category"]
    assert body["frequency"] == update_payload["frequency"]
    assert body["start_date"] == update_payload["start_date"]
    assert body["next_occurrence"] == update_payload[
        "next_occurrence"
    ]
    assert body["end_date"] == update_payload["end_date"]
    assert body["active"] is False
    assert body["created_at"] == created_at


def test_update_recurring_expense_returns_404_when_not_found(
    client: TestClient,
    account_id: int,
) -> None:
    """PUT returns 404 when the recurring expense is missing."""
    response = client.put(
        "/recurring-expenses/999999",
        json={
            "account_id": account_id,
            "description": "Spotify",
            "amount": 9.99,
            "category": "Music",
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
            "end_date": None,
            "active": True,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == (
        "Recurring expense not found"
    )


def test_update_recurring_expense_returns_404_for_missing_account(
    client: TestClient,
    account_id: int,
) -> None:
    """PUT returns 404 when the new account does not exist."""
    created = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Netflix",
            "amount": 15.99,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert created.status_code == 201
    recurring_expense_id = created.json()["id"]

    response = client.put(
        f"/recurring-expenses/{recurring_expense_id}",
        json={
            "account_id": 999999,
            "description": "Spotify",
            "amount": 9.99,
            "category": "Music",
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
            "end_date": None,
            "active": True,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Account not found"


def test_create_recurring_expense_rejects_zero_amount(
    client: TestClient,
    account_id: int,
) -> None:
    """POST rejects an amount of zero."""
    response = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Netflix",
            "amount": 0,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )

    assert response.status_code == 422


def test_update_recurring_expense_rejects_zero_amount(
    client: TestClient,
    account_id: int,
) -> None:
    """PUT rejects an amount of zero."""
    created = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Netflix",
            "amount": 15.99,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert created.status_code == 201
    recurring_expense_id = created.json()["id"]

    response = client.put(
        f"/recurring-expenses/{recurring_expense_id}",
        json={
            "account_id": account_id,
            "description": "Netflix",
            "amount": 0,
            "category": None,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
            "end_date": None,
            "active": True,
        },
    )

    assert response.status_code == 422


def test_create_rejects_start_date_after_next_occurrence(
    client: TestClient,
    account_id: int,
) -> None:
    """POST rejects start_date after next_occurrence."""
    response = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Netflix",
            "amount": 15.99,
            "frequency": "monthly",
            "start_date": "2026-12-01",
            "next_occurrence": "2026-11-01",
        },
    )

    assert response.status_code == 422


def test_create_rejects_end_date_before_start_date(
    client: TestClient,
    account_id: int,
) -> None:
    """POST rejects end_date before start_date."""
    response = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Insurance",
            "amount": 100.00,
            "frequency": "yearly",
            "start_date": "2026-01-01",
            "next_occurrence": "2026-01-01",
            "end_date": "2025-12-31",
        },
    )

    assert response.status_code == 422


def test_create_rejects_next_occurrence_after_end_date(
    client: TestClient,
    account_id: int,
) -> None:
    """POST rejects next_occurrence after end_date."""
    response = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Insurance",
            "amount": 100.00,
            "frequency": "yearly",
            "start_date": "2026-01-01",
            "next_occurrence": "2027-01-01",
            "end_date": "2026-12-31",
        },
    )

    assert response.status_code == 422


def test_deactivate_recurring_expense_keeps_the_record(
    client: TestClient,
    account_id: int,
) -> None:
    """Setting active to false does not delete the record."""
    created = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Netflix",
            "amount": 15.99,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert created.status_code == 201
    created_body = created.json()
    recurring_expense_id = created_body["id"]

    response = client.put(
        f"/recurring-expenses/{recurring_expense_id}",
        json={
            "account_id": account_id,
            "description": created_body["description"],
            "amount": 15.99,
            "category": None,
            "frequency": "monthly",
            "start_date": created_body["start_date"],
            "next_occurrence": created_body[
                "next_occurrence"
            ],
            "end_date": None,
            "active": False,
        },
    )

    assert response.status_code == 200
    assert response.json()["active"] is False

    stored = client.get(
        f"/recurring-expenses/{recurring_expense_id}",
    )
    assert stored.status_code == 200
    assert stored.json()["active"] is False
    assert stored.json()["id"] == recurring_expense_id


def test_deactivating_recurring_expense_does_not_affect_transactions(
    client: TestClient,
    account_id: int,
) -> None:
    """Deactivating a recurring expense leaves transactions intact."""
    transaction = client.post(
        "/transactions",
        json={
            "account_id": account_id,
            "description": "Supermercado",
            "amount": 52.40,
            "transaction_type": "expense",
            "occurred_on": "2026-10-01",
            "category": "Food",
        },
    )
    assert transaction.status_code == 201
    transaction_body = transaction.json()
    transaction_id = transaction_body["id"]

    recurring = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Netflix",
            "amount": 15.99,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert recurring.status_code == 201
    recurring_body = recurring.json()

    deactivated = client.put(
        f"/recurring-expenses/{recurring_body['id']}",
        json={
            "account_id": account_id,
            "description": recurring_body["description"],
            "amount": 15.99,
            "category": None,
            "frequency": "monthly",
            "start_date": recurring_body["start_date"],
            "next_occurrence": recurring_body[
                "next_occurrence"
            ],
            "end_date": None,
            "active": False,
        },
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["active"] is False

    response = client.get(f"/transactions/{transaction_id}")

    assert response.status_code == 200
    stored = response.json()
    assert stored["id"] == transaction_id
    assert stored["account_id"] == transaction_body[
        "account_id"
    ]
    assert stored["description"] == transaction_body[
        "description"
    ]
    assert Decimal(stored["amount"]) == Decimal(
        transaction_body["amount"],
    )
    assert stored["transaction_type"] == transaction_body[
        "transaction_type"
    ]
    assert stored["occurred_on"] == transaction_body[
        "occurred_on"
    ]
    assert stored["category"] == transaction_body["category"]
    assert stored["created_at"] == transaction_body[
        "created_at"
    ]
