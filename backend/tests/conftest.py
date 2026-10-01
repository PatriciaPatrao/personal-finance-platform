"""Shared fixtures for the API test suite."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Provide a synchronous client for the FastAPI application."""
    with TestClient(app) as test_client:
        yield test_client
