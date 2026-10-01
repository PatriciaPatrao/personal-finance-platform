"""API tests for creating a transaction."""

from decimal import Decimal

from fastapi.testclient import TestClient


def test_create_transaction_returns_created_transaction(
    client: TestClient,
) -> None:
    """POST /transactions stores a valid transaction and returns it."""
    payload = {
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
    assert body["description"] == payload["description"]
    assert Decimal(body["amount"]) == Decimal("52.40")
    assert body["transaction_type"] == payload["transaction_type"]
    assert body["occurred_on"] == payload["occurred_on"]
    assert body["category"] == payload["category"]
    assert body["created_at"]


def test_create_transaction_rejects_zero_amount(
    client: TestClient,
) -> None:
    """POST /transactions rejects an amount of zero."""
    payload = {
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
) -> None:
    """POST /transactions rejects a negative amount."""
    payload = {
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


def test_list_transactions_returns_stored_transactions(
    client: TestClient,
) -> None:
    """GET /transactions includes a transaction created through the API."""
    payload = {
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
    assert stored["description"] == payload["description"]
    assert Decimal(stored["amount"]) == Decimal("52.40")
    assert stored["transaction_type"] == payload["transaction_type"]
    assert stored["occurred_on"] == payload["occurred_on"]
    assert stored["category"] == payload["category"]


def test_get_transaction_returns_stored_transaction(
    client: TestClient,
) -> None:
    """GET /transactions/{id} returns a transaction created through the API."""
    payload = {
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
) -> None:
    """DELETE /transactions/{id} removes a stored transaction."""
    payload = {
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
