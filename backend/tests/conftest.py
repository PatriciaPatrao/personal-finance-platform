"""Shared fixtures for the API test suite."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy import delete
from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.session import _with_psycopg2_driver
from app.db.session import get_db
from app.main import app
from app.models.account import Account
from app.models.transaction import Transaction


# Keep test rows in the existing "test" schema, away from public.
test_engine = create_engine(
    _with_psycopg2_driver(settings.database_url),
)


@event.listens_for(test_engine, "connect")
def _set_test_search_path(dbapi_connection, _connection_record) -> None:
    """Point each new test connection at the existing test schema."""
    cursor = dbapi_connection.cursor()
    cursor.execute("SET search_path TO test")
    cursor.close()


SessionLocal = sessionmaker(
    bind=test_engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def override_get_db() -> Generator[Session, None, None]:
    """Yield a session from the test engine."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# Delete children before parents when more tables are added.
_TABLES_TO_CLEAN = (Account, Transaction)


@pytest.fixture(autouse=True)
def clean_test_database() -> None:
    """Remove existing test rows before each test."""
    session = SessionLocal()
    try:
        for model in reversed(_TABLES_TO_CLEAN):
            session.execute(delete(model))
        session.commit()
    finally:
        session.close()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Provide a client whose database sessions use the test schema."""
    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Yield a session bound to the test schema and close it afterward."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
