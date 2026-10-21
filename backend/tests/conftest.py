"""Shared fixtures for the API test suite."""

import os
from collections.abc import Callable
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy import delete
from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlalchemy.orm import sessionmaker


def _configure_test_auth_env() -> None:
    """Point Auth0 settings at local test JWKS before app import."""
    jwks_path = Path(__file__).parent / "_test_auth_jwks.json"
    os.environ.setdefault(
        "AUTH0_DOMAIN",
        "test-tenant.auth0.com",
    )
    os.environ.setdefault(
        "AUTH0_AUDIENCE",
        "https://api.personal-finance.test",
    )
    if jwks_path.is_file():
        os.environ.setdefault(
            "AUTH0_JWKS_JSON",
            jwks_path.read_text(encoding="utf-8"),
        )


_configure_test_auth_env()

from app.core.config import settings  # noqa: E402
from app.db.session import _with_psycopg2_driver  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.account import Account  # noqa: E402
from app.models.financial_goal import FinancialGoal  # noqa: E402
from app.models.goal_allocation import GoalAllocation  # noqa: E402
from app.models.household import Household  # noqa: E402
from app.models.household_invitation import HouseholdInvitation  # noqa: E402
from app.models.household_membership import HouseholdMembership  # noqa: E402
from app.models.income import Income  # noqa: E402
from app.models.recurring_expense import RecurringExpense  # noqa: E402
from app.models.schedule_execution import ScheduleExecution  # noqa: E402
from app.models.transaction import Transaction  # noqa: E402
from tests.test_jwt_helpers import auth_header  # noqa: E402


test_engine = create_engine(
    _with_psycopg2_driver(settings.database_url),
)


@event.listens_for(test_engine, "connect")
def _set_test_search_path(dbapi_connection, _connection_record) -> None:
    """Point each new test connection at the existing test schema."""
    cursor = dbapi_connection.cursor()
    cursor.execute("SET search_path TO test")
    cursor.close()
    dbapi_connection.commit()


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


_TABLES_TO_CLEAN = (
    Household,
    HouseholdInvitation,
    HouseholdMembership,
    Account,
    Transaction,
    ScheduleExecution,
    RecurringExpense,
    Income,
    FinancialGoal,
    GoalAllocation,
)


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
    """Authenticated client for the default test user."""
    yield from _client_for_sub("test-user-default")


@pytest.fixture
def unauthenticated_client() -> Generator[TestClient, None, None]:
    """API client without a bearer token."""
    import app.api.deps as deps_module

    deps_module._verifier = None
    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        deps_module._verifier = None


@pytest.fixture
def make_client() -> Callable[[str], contextmanager]:
    """Return a context manager factory for per-user clients."""

    @contextmanager
    def _for_sub(user_sub: str) -> Generator[TestClient, None, None]:
        yield from _client_for_sub(user_sub)

    return _for_sub


def _client_for_sub(
    user_sub: str,
) -> Generator[TestClient, None, None]:
    """Yield a TestClient with bearer auth for one subject."""
    import app.api.deps as deps_module

    deps_module._verifier = None
    app.dependency_overrides[get_db] = override_get_db
    headers = auth_header(user_sub)
    try:
        with TestClient(app, headers=headers) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        deps_module._verifier = None


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Yield a session bound to the test schema and close it afterward."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
