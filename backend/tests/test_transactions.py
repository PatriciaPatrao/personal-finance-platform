"""API tests for creating a transaction."""

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def account_id(client: TestClient) -> int:
    """Create an account and return its id for transaction tests."""
    response = client.post(
        "/accounts",
        json={
            "name": "Conta Principal",
            "account_type": "bank",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_create_transaction_returns_created_transaction(
    client: TestClient,
    account_id: int,
) -> None:
    """POST /transactions stores a valid transaction and returns it."""
    payload = {
        "account_id": account_id,
        "description": "Supermercado",
        "amount": 52.40,
        "transaction_type": "expense",
        "occurred_on": "2026-10-01",
        "category": "Food",
    }

    response = client.post("/transactions", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert body["account_id"] == account_id
    assert body["description"] == payload["description"]
    assert Decimal(body["amount"]) == Decimal("52.40")
    assert body["transaction_type"] == payload["transaction_type"]
    assert body["occurred_on"] == payload["occurred_on"]
    assert body["category"] == payload["category"]
    assert body["created_at"]


def test_create_transaction_rejects_zero_amount(
    client: TestClient,
    account_id: int,
) -> None:
    """POST /transactions rejects an amount of zero."""
    payload = {
        "account_id": account_id,
        "description": "Supermercado",
        "amount": 0,
        "transaction_type": "expense",
        "occurred_on": "2026-10-01",
        "category": "Food",
    }

    response = client.post("/transactions", json=payload)

    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any("amount" in error["loc"] for error in errors)


def test_create_transaction_rejects_negative_amount(
    client: TestClient,
    account_id: int,
) -> None:
    """POST /transactions rejects a negative amount."""
    payload = {
        "account_id": account_id,
        "description": "Supermercado",
        "amount": -10.50,
        "transaction_type": "expense",
        "occurred_on": "2026-10-01",
        "category": "Food",
    }

    response = client.post("/transactions", json=payload)

    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any("amount" in error["loc"] for error in errors)


def test_create_transaction_returns_404_for_missing_account(
    client: TestClient,
) -> None:
    """POST /transactions returns 404 for a missing account."""
    payload = {
        "account_id": 999999,
        "description": "Supermercado",
        "amount": 52.40,
        "transaction_type": "expense",
        "occurred_on": "2026-10-01",
        "category": "Food",
    }

    response = client.post("/transactions", json=payload)

    assert response.status_code == 404
    assert response.json()["detail"] == "Account not found"


def test_list_transactions_returns_stored_transactions(
    client: TestClient,
    account_id: int,
) -> None:
    """GET /transactions includes a transaction created through the API."""
    payload = {
        "account_id": account_id,
        "description": "Supermercado",
        "amount": 52.40,
        "transaction_type": "expense",
        "occurred_on": "2026-10-01",
        "category": "Food",
    }

    created = client.post("/transactions", json=payload)

    assert created.status_code == 201
    created_body = created.json()

    response = client.get("/transactions")

    assert response.status_code == 200
    transactions = response.json()
    assert isinstance(transactions, list)
    stored = next(
        item for item in transactions
        if item["id"] == created_body["id"]
    )
    assert stored["id"] == created_body["id"]
    assert stored["account_id"] == account_id
    assert stored["description"] == payload["description"]
    assert Decimal(stored["amount"]) == Decimal("52.40")
    assert stored["transaction_type"] == payload["transaction_type"]
    assert stored["occurred_on"] == payload["occurred_on"]
    assert stored["category"] == payload["category"]


def test_get_transaction_returns_stored_transaction(
    client: TestClient,
    account_id: int,
) -> None:
    """GET /transactions/{id} returns a transaction created through the API."""
    payload = {
        "account_id": account_id,
        "description": "Supermercado",
        "amount": 52.40,
        "transaction_type": "expense",
        "occurred_on": "2026-10-01",
        "category": "Food",
    }

    created = client.post("/transactions", json=payload)

    assert created.status_code == 201
    transaction_id = created.json()["id"]

    response = client.get(f"/transactions/{transaction_id}")

    assert response.status_code == 200
    stored = response.json()
    assert stored["id"] == transaction_id
    assert stored["account_id"] == account_id
    assert stored["description"] == payload["description"]
    assert Decimal(stored["amount"]) == Decimal("52.40")
    assert stored["transaction_type"] == payload["transaction_type"]
    assert stored["occurred_on"] == payload["occurred_on"]
    assert stored["category"] == payload["category"]


def test_get_transaction_returns_404_when_not_found(
    client: TestClient,
) -> None:
    """GET /transactions/{id} returns 404 when the id does not exist."""
    response = client.get("/transactions/999999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Transaction not found"


def test_delete_transaction_removes_stored_transaction(
    client: TestClient,
    account_id: int,
) -> None:
    """DELETE /transactions/{id} removes a stored transaction."""
    payload = {
        "account_id": account_id,
        "description": "Supermercado",
        "amount": 52.40,
        "transaction_type": "expense",
        "occurred_on": "2026-10-01",
        "category": "Food",
    }

    created = client.post("/transactions", json=payload)

    assert created.status_code == 201
    transaction_id = created.json()["id"]

    deleted = client.delete(f"/transactions/{transaction_id}")

    assert deleted.status_code == 204
    assert deleted.content == b""

    response = client.get(f"/transactions/{transaction_id}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Transaction not found"


def test_delete_transaction_returns_404_when_not_found(
    client: TestClient,
) -> None:
    """DELETE /transactions/{id} returns 404 when the id does not exist."""
    response = client.delete("/transactions/999999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Transaction not found"


def test_update_transaction_returns_updated_transaction(
    client: TestClient,
    account_id: int,
) -> None:
    """PUT /transactions/{id} updates all editable fields."""
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
    assert created.status_code == 201
    created_body = created.json()
    transaction_id = created_body["id"]
    created_at = created_body["created_at"]

    update_payload = {
        "account_id": other_account_id,
        "description": "Salário",
        "amount": 1500.00,
        "transaction_type": "income",
        "occurred_on": "2026-10-02",
        "category": "Salary",
    }

    response = client.put(
        f"/transactions/{transaction_id}",
        json=update_payload,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == transaction_id
    assert body["account_id"] == other_account_id
    assert body["description"] == update_payload["description"]
    assert Decimal(body["amount"]) == Decimal("1500.00")
    assert body["transaction_type"] == update_payload["transaction_type"]
    assert body["occurred_on"] == update_payload["occurred_on"]
    assert body["category"] == update_payload["category"]
    assert body["created_at"] == created_at


def test_update_transaction_returns_404_when_not_found(
    client: TestClient,
    account_id: int,
) -> None:
    """PUT /transactions/{id} returns 404 when the id does not exist."""
    response = client.put(
        "/transactions/999999",
        json={
            "account_id": account_id,
            "description": "Salário",
            "amount": 1500.00,
            "transaction_type": "income",
            "occurred_on": "2026-10-02",
            "category": "Salary",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Transaction not found"


def test_update_transaction_returns_404_for_missing_account(
    client: TestClient,
    account_id: int,
) -> None:
    """PUT /transactions/{id} returns 404 for a missing account."""
    created = client.post(
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
    assert created.status_code == 201
    transaction_id = created.json()["id"]

    response = client.put(
        f"/transactions/{transaction_id}",
        json={
            "account_id": 999999,
            "description": "Salário",
            "amount": 1500.00,
            "transaction_type": "income",
            "occurred_on": "2026-10-02",
            "category": "Salary",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Account not found"


def test_update_transaction_rejects_zero_amount(
    client: TestClient,
    account_id: int,
) -> None:
    """PUT /transactions/{id} rejects an amount of zero."""
    created = client.post(
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
    assert created.status_code == 201
    transaction_id = created.json()["id"]

    response = client.put(
        f"/transactions/{transaction_id}",
        json={
            "account_id": account_id,
            "description": "Salário",
            "amount": 0,
            "transaction_type": "income",
            "occurred_on": "2026-10-02",
            "category": "Salary",
        },
    )

    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any("amount" in error["loc"] for error in errors)


def test_update_transaction_persists_updated_values(
    client: TestClient,
    account_id: int,
) -> None:
    """GET after PUT returns the updated transaction values."""
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
    assert created.status_code == 201
    transaction_id = created.json()["id"]

    update_payload = {
        "account_id": other_account_id,
        "description": "Salário",
        "amount": 1500.00,
        "transaction_type": "income",
        "occurred_on": "2026-10-02",
        "category": "Salary",
    }

    updated = client.put(
        f"/transactions/{transaction_id}",
        json=update_payload,
    )
    assert updated.status_code == 200

    response = client.get(f"/transactions/{transaction_id}")

    assert response.status_code == 200
    stored = response.json()
    assert stored["id"] == transaction_id
    assert stored["account_id"] == other_account_id
    assert stored["description"] == update_payload["description"]
    assert Decimal(stored["amount"]) == Decimal("1500.00")
    assert stored["transaction_type"] == update_payload["transaction_type"]
    assert stored["occurred_on"] == update_payload["occurred_on"]
    assert stored["category"] == update_payload["category"]
