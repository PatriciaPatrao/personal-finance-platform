"""Infrastructure tests for the isolated test database."""

from fastapi.testclient import TestClient


def test_transactions_endpoint_uses_isolated_test_database(
    client: TestClient,
) -> None:
    """GET /transactions reads the empty test schema."""
    response = client.get("/transactions")

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert payload == []


def test_accounts_endpoint_uses_isolated_test_database(
    client: TestClient,
) -> None:
    """GET /accounts reads the empty test schema."""
    response = client.get("/accounts")

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert payload == []
