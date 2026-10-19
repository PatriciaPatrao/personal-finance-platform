"""Tests for CORS origin configuration parsing."""

import os

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.core.cors_origins import parse_cors_origins
from app.core.cors_origins import resolve_cors_origins
from app.main import build_app


def test_parse_cors_origins_splits_and_trims() -> None:
    assert parse_cors_origins(
        "http://localhost:4200, https://app.example.com",
    ) == [
        "http://localhost:4200",
        "https://app.example.com",
    ]


def test_parse_cors_origins_rejects_wildcard() -> None:
    with pytest.raises(ValueError, match="Wildcard"):
        parse_cors_origins("*")


def test_development_defaults_to_local_angular_origin() -> None:
    assert resolve_cors_origins(
        app_env="development",
        cors_origins_raw=None,
    ) == ["http://localhost:4200"]


def test_production_requires_explicit_origins() -> None:
    with pytest.raises(ValueError, match="CORS_ORIGINS is required"):
        resolve_cors_origins(
            app_env="production",
            cors_origins_raw=None,
        )


def test_settings_production_requires_cors_origins(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    monkeypatch.setenv(
        "DATABASE_URL",
        os.environ.get(
            "DATABASE_URL",
            "postgresql://user:pass@localhost:5432/postgres",
        ),
    )
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        Settings()


def _preflight(client: TestClient, origin: str):
    return client.options(
        "/health",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )


def test_build_app_allows_multiple_configured_origins() -> None:
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://user:pass@localhost:5432/postgres",
    )
    cfg = Settings(
        database_url=database_url,
        app_env="development",
        cors_origins=(
            "http://localhost:4200,https://staging.example.com"
        ),
    )
    client = TestClient(build_app(cfg))
    allowed = _preflight(client, "https://staging.example.com")
    assert allowed.status_code == 200
    assert (
        allowed.headers["access-control-allow-origin"]
        == "https://staging.example.com"
    )

    rejected = _preflight(client, "http://evil.example")
    assert rejected.status_code == 400
    assert "Disallowed CORS origin" in rejected.text
