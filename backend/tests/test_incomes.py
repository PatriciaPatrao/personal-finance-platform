"""API tests for incomes."""

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


def _assert_no_income_type_or_description(body: dict) -> None:
    """Salary records must not expose description or income_type."""
    assert "description" not in body
    assert "income_type" not in body


def test_create_income_returns_created_record(
    client: TestClient,
    account_id: int,
) -> None:
    """POST /incomes stores a valid salary record."""
    payload = {
        "account_id": account_id,
        "amount": 2500.00,
        "frequency": "monthly",
        "start_date": "2026-10-01",
        "next_occurrence": "2026-11-01",
    }

    response = client.post("/incomes", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert body["account_id"] == account_id
    assert Decimal(body["amount"]) == Decimal("2500.00")
    assert body["frequency"] == "monthly"
    assert body["start_date"] == "2026-10-01"
    assert body["next_occurrence"] == "2026-11-01"
    assert body["end_date"] is None
    assert body["active"] is True
    assert body["created_at"]
    _assert_no_income_type_or_description(body)


def test_create_income_defaults_active_to_true(
    client: TestClient,
    account_id: int,
) -> None:
    """POST omits active and stores active as true."""
    payload = {
        "account_id": account_id,
        "amount": 2500.00,
        "frequency": "monthly",
        "start_date": "2026-10-01",
        "next_occurrence": "2026-11-01",
    }

    response = client.post("/incomes", json=payload)

    assert response.status_code == 201
    assert response.json()["active"] is True


def test_create_income_defaults_end_date_to_none(
    client: TestClient,
    account_id: int,
) -> None:
    """POST omits end_date and stores it as null."""
    payload = {
        "account_id": account_id,
        "amount": 2500.00,
        "frequency": "monthly",
        "start_date": "2026-10-01",
        "next_occurrence": "2026-11-01",
    }

    response = client.post("/incomes", json=payload)

    assert response.status_code == 201
    assert response.json()["end_date"] is None


def test_list_incomes_orders_by_next_occurrence(
    client: TestClient,
    account_id: int,
) -> None:
    """GET /incomes returns next_occurrence ascending."""
    later = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 30000.00,
            "frequency": "yearly",
            "start_date": "2026-01-01",
            "next_occurrence": "2026-12-01",
        },
    )
    earlier = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 2500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert later.status_code == 201
    assert earlier.status_code == 201

    response = client.get("/incomes")

    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 2
    ids = [item["id"] for item in items]
    assert ids.index(earlier.json()["id"]) < ids.index(
        later.json()["id"],
    )
    dates = [item["next_occurrence"] for item in items]
    assert dates == sorted(dates)
    for item in items:
        _assert_no_income_type_or_description(item)


def test_get_income_returns_stored_record(
    client: TestClient,
    account_id: int,
) -> None:
    """GET /incomes/{id} returns the stored record."""
    payload = {
        "account_id": account_id,
        "amount": 2500.00,
        "frequency": "monthly",
        "start_date": "2026-10-01",
        "next_occurrence": "2026-11-01",
        "end_date": "2027-10-01",
        "active": True,
    }
    created = client.post("/incomes", json=payload)
    assert created.status_code == 201
    income_id = created.json()["id"]

    response = client.get(f"/incomes/{income_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == income_id
    assert body["account_id"] == account_id
    assert Decimal(body["amount"]) == Decimal("2500.00")
    assert body["frequency"] == payload["frequency"]
    assert body["start_date"] == payload["start_date"]
    assert body["next_occurrence"] == payload[
        "next_occurrence"
    ]
    assert body["end_date"] == payload["end_date"]
    assert body["active"] is True
    _assert_no_income_type_or_description(body)


def test_get_income_returns_404_when_not_found(
    client: TestClient,
) -> None:
    """GET /incomes/{id} returns 404 when missing."""
    response = client.get("/incomes/999999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Income not found"


def test_create_income_returns_404_for_missing_account(
    client: TestClient,
) -> None:
    """POST returns 404 when the account does not exist."""
    payload = {
        "account_id": 999999,
        "amount": 2500.00,
        "frequency": "monthly",
        "start_date": "2026-10-01",
        "next_occurrence": "2026-11-01",
    }

    response = client.post("/incomes", json=payload)

    assert response.status_code == 404
    assert response.json()["detail"] == "Account not found"


def test_update_income_updates_all_fields(
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
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 2500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert created.status_code == 201
    created_body = created.json()
    income_id = created_body["id"]
    created_at = created_body["created_at"]

    update_payload = {
        "account_id": other_account_id,
        "amount": 800.00,
        "frequency": "weekly",
        "start_date": "2026-09-01",
        "next_occurrence": "2026-10-15",
        "end_date": "2027-09-01",
        "active": False,
    }

    response = client.put(
        f"/incomes/{income_id}",
        json=update_payload,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == income_id
    assert body["account_id"] == other_account_id
    assert Decimal(body["amount"]) == Decimal("800.00")
    assert body["frequency"] == update_payload["frequency"]
    assert body["start_date"] == update_payload["start_date"]
    assert body["next_occurrence"] == update_payload[
        "next_occurrence"
    ]
    assert body["end_date"] == update_payload["end_date"]
    assert body["active"] is False
    assert body["created_at"] == created_at
    _assert_no_income_type_or_description(body)


def test_update_income_returns_404_when_not_found(
    client: TestClient,
    account_id: int,
) -> None:
    """PUT returns 404 when the income is missing."""
    response = client.put(
        "/incomes/999999",
        json={
            "account_id": account_id,
            "amount": 2500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
            "end_date": None,
            "active": True,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Income not found"


def test_update_income_returns_404_for_missing_account(
    client: TestClient,
    account_id: int,
) -> None:
    """PUT returns 404 when the new account does not exist."""
    created = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 2500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert created.status_code == 201
    income_id = created.json()["id"]

    response = client.put(
        f"/incomes/{income_id}",
        json={
            "account_id": 999999,
            "amount": 2600.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
            "end_date": None,
            "active": True,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Account not found"


def test_create_income_rejects_zero_amount(
    client: TestClient,
    account_id: int,
) -> None:
    """POST rejects an amount of zero."""
    response = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 0,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )

    assert response.status_code == 422


def test_create_income_rejects_negative_amount(
    client: TestClient,
    account_id: int,
) -> None:
    """POST rejects a negative amount."""
    response = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": -100,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )

    assert response.status_code == 422


def test_update_income_rejects_zero_amount(
    client: TestClient,
    account_id: int,
) -> None:
    """PUT rejects an amount of zero."""
    created = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 2500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert created.status_code == 201
    income_id = created.json()["id"]

    response = client.put(
        f"/incomes/{income_id}",
        json={
            "account_id": account_id,
            "amount": 0,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
            "end_date": None,
            "active": True,
        },
    )

    assert response.status_code == 422


def test_update_income_rejects_negative_amount(
    client: TestClient,
    account_id: int,
) -> None:
    """PUT rejects a negative amount."""
    created = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 2500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert created.status_code == 201
    income_id = created.json()["id"]

    response = client.put(
        f"/incomes/{income_id}",
        json={
            "account_id": account_id,
            "amount": -50,
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
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 2500.00,
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
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 30000.00,
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
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 30000.00,
            "frequency": "yearly",
            "start_date": "2026-01-01",
            "next_occurrence": "2027-01-01",
            "end_date": "2026-12-31",
        },
    )

    assert response.status_code == 422


def test_deactivate_income_keeps_the_record(
    client: TestClient,
    account_id: int,
) -> None:
    """Setting active to false does not delete the record."""
    created = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 2500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert created.status_code == 201
    created_body = created.json()
    income_id = created_body["id"]

    response = client.put(
        f"/incomes/{income_id}",
        json={
            "account_id": account_id,
            "amount": 2500.00,
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

    stored = client.get(f"/incomes/{income_id}")
    assert stored.status_code == 200
    assert stored.json()["active"] is False
    assert stored.json()["id"] == income_id

    listed = client.get("/incomes")
    assert listed.status_code == 200
    ids = [item["id"] for item in listed.json()]
    assert income_id in ids


def test_multiple_income_records_can_exist(
    client: TestClient,
    account_id: int,
) -> None:
    """A user can store more than one salary."""
    first = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 2500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    second = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 800.00,
            "frequency": "weekly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-10-08",
        },
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]

    response = client.get("/incomes")
    assert response.status_code == 200
    ids = [item["id"] for item in response.json()]
    assert first.json()["id"] in ids
    assert second.json()["id"] in ids


def test_creating_income_does_not_create_a_transaction(
    client: TestClient,
    account_id: int,
) -> None:
    """POST /incomes leaves the transaction list unchanged."""
    before = client.get("/transactions")
    assert before.status_code == 200
    before_count = len(before.json())

    response = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 2500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert response.status_code == 201

    after = client.get("/transactions")
    assert after.status_code == 200
    assert len(after.json()) == before_count


def test_updating_income_does_not_modify_transactions(
    client: TestClient,
    account_id: int,
) -> None:
    """Updating an income leaves existing transactions intact."""
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

    created = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 2500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert created.status_code == 201
    created_body = created.json()

    updated = client.put(
        f"/incomes/{created_body['id']}",
        json={
            "account_id": account_id,
            "amount": 2600.00,
            "frequency": "monthly",
            "start_date": created_body["start_date"],
            "next_occurrence": created_body[
                "next_occurrence"
            ],
            "end_date": None,
            "active": False,
        },
    )
    assert updated.status_code == 200

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


def test_delete_income_endpoint_does_not_exist(
    client: TestClient,
    account_id: int,
) -> None:
    """DELETE /incomes/{id} is not available."""
    created = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 2500.00,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-11-01",
        },
    )
    assert created.status_code == 201
    income_id = created.json()["id"]

    response = client.delete(f"/incomes/{income_id}")

    assert response.status_code == 405
    stored = client.get(f"/incomes/{income_id}")
    assert stored.status_code == 200
    assert stored.json()["id"] == income_id
