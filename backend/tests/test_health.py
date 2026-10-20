"""Tests for the health endpoint."""

from fastapi.testclient import TestClient


def test_health_endpoint_returns_ok(client: TestClient) -> None:
    """GET /health reports that the API is running."""
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "current_domain_date" in body
    assert len(body["current_domain_date"]) == 10
    assert body["current_domain_date"][4] == "-"
    assert body["current_domain_date"][7] == "-"
