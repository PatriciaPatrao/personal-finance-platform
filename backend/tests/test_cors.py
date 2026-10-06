"""Tests for browser CORS preflight against the Angular origin."""

from fastapi.testclient import TestClient


def _preflight(
    client: TestClient,
    path: str,
    method: str,
    *,
    origin: str = "http://localhost:4200",
):
    return client.options(
        path,
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "content-type",
        },
    )


def test_preflight_allows_put_from_angular_origin(client: TestClient) -> None:
    response = _preflight(client, "/transactions/1", "PUT")

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:4200"
    assert "PUT" in response.headers["access-control-allow-methods"]


def test_preflight_allows_delete_from_angular_origin(client: TestClient) -> None:
    response = _preflight(client, "/transactions/1", "DELETE")

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:4200"
    assert "DELETE" in response.headers["access-control-allow-methods"]


def test_preflight_allows_post_from_angular_origin(client: TestClient) -> None:
    response = _preflight(client, "/transactions", "POST")

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:4200"
    assert "POST" in response.headers["access-control-allow-methods"]


def test_preflight_allows_get_from_angular_origin(client: TestClient) -> None:
    response = _preflight(client, "/transactions", "GET")

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:4200"
    assert "GET" in response.headers["access-control-allow-methods"]


def test_preflight_rejects_unknown_origin(client: TestClient) -> None:
    response = _preflight(
        client,
        "/transactions/1",
        "PUT",
        origin="http://evil.example",
    )

    assert response.status_code == 400
    assert "Disallowed CORS origin" in response.text
