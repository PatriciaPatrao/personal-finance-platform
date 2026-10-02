"""API tests for accounts."""

from fastapi.testclient import TestClient


def test_create_account_returns_created_account(
    client: TestClient,
) -> None:
    """POST /accounts stores a valid account and returns it."""
    payload = {
        "name": "Conta Principal",
        "account_type": "bank",
    }

    response = client.post("/accounts", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert body["name"] == payload["name"]
    assert body["account_type"] == payload["account_type"]
    assert body["currency"] == "EUR"
    assert body["created_at"]


def test_list_accounts_returns_stored_accounts(
    client: TestClient,
) -> None:
    """GET /accounts includes an account created through the API."""
    payload = {
        "name": "Conta Principal",
        "account_type": "bank",
    }

    created = client.post("/accounts", json=payload)

    assert created.status_code == 201
    created_body = created.json()

    response = client.get("/accounts")

    assert response.status_code == 200
    accounts = response.json()
    assert isinstance(accounts, list)
    stored = next(
        item for item in accounts
        if item["id"] == created_body["id"]
    )
    assert stored["id"] == created_body["id"]
    assert stored["name"] == payload["name"]
    assert stored["account_type"] == payload["account_type"]
    assert stored["currency"] == "EUR"


def test_get_account_returns_stored_account(
    client: TestClient,
) -> None:
    """GET /accounts/{id} returns an account created through the API."""
    payload = {
        "name": "Conta Principal",
        "account_type": "bank",
    }

    created = client.post("/accounts", json=payload)

    assert created.status_code == 201
    account_id = created.json()["id"]

    response = client.get(f"/accounts/{account_id}")

    assert response.status_code == 200
    stored = response.json()
    assert stored["id"] == account_id
    assert stored["name"] == payload["name"]
    assert stored["account_type"] == payload["account_type"]
    assert stored["currency"] == "EUR"


def test_get_account_returns_404_when_not_found(
    client: TestClient,
) -> None:
    """GET /accounts/{id} returns 404 when the id does not exist."""
    response = client.get("/accounts/999999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Account not found"
