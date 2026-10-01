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
