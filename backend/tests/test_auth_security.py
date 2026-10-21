"""Authentication and cross-household isolation tests."""

from datetime import date
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from tests.test_jwt_helpers import auth_header
from tests.test_jwt_helpers import mint_test_access_token


PROTECTED_ROUTES: list[tuple[str, str, dict | None]] = [
    ("GET", "/accounts", None),
    ("POST", "/accounts", {"name": "A", "account_type": "bank"}),
    ("GET", "/transactions", None),
    (
        "POST",
        "/transactions",
        {
            "account_id": 1,
            "description": "x",
            "amount": 1,
            "transaction_type": "expense",
            "occurred_on": "2026-10-01",
        },
    ),
    ("GET", "/incomes", None),
    ("GET", "/recurring-expenses", None),
    ("GET", "/financial-goals", None),
    (
        "GET",
        "/financial-summary",
        None,
    ),
    (
        "GET",
        "/analysis/summary",
        None,
    ),
    (
        "GET",
        "/analysis/expenses",
        None,
    ),
    (
        "GET",
        "/analysis/cash-flow",
        None,
    ),
    (
        "GET",
        "/forecast",
        None,
    ),
]


@pytest.mark.parametrize(
    "method,path,body",
    PROTECTED_ROUTES,
)
def test_protected_routes_require_bearer_token(
    unauthenticated_client: TestClient,
    method: str,
    path: str,
    body: dict | None,
) -> None:
    """Financial routes return 401 without Authorization."""
    params = None
    if path == "/financial-summary":
        params = {
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
        }
    elif path in {
        "/analysis/summary",
        "/analysis/expenses",
        "/analysis/cash-flow",
    }:
        params = {
            "from": "2026-10-01",
            "to": "2026-10-31",
        }
        if path == "/analysis/cash-flow":
            params["group_by"] = "day"
    elif path == "/forecast":
        params = {
            "from_date": "2026-10-01",
            "to_date": "2026-10-31",
            "group_by": "month",
        }
    response = unauthenticated_client.request(
        method,
        path,
        json=body,
        params=params,
    )
    assert response.status_code == 401


def test_invalid_token_rejected(
    unauthenticated_client: TestClient,
) -> None:
    """Malformed bearer tokens are rejected."""
    response = unauthenticated_client.get(
        "/accounts",
        headers={"Authorization": "Bearer not-a-jwt"},
    )
    assert response.status_code == 401


def test_expired_token_rejected(
    unauthenticated_client: TestClient,
) -> None:
    """Expired tokens are rejected."""
    token = mint_test_access_token(
        "expired-user",
        expired=True,
    )
    response = unauthenticated_client.get(
        "/accounts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401


def test_wrong_audience_rejected(
    unauthenticated_client: TestClient,
) -> None:
    """Tokens with the wrong audience are rejected."""
    token = mint_test_access_token(
        "wrong-aud",
        audience="https://wrong-audience",
    )
    response = unauthenticated_client.get(
        "/accounts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401


def _seed_household(client: TestClient) -> dict:
    """Create account, transaction, income, goal for isolation tests."""
    account = client.post(
        "/accounts",
        json={"name": "Main", "account_type": "bank"},
    )
    assert account.status_code == 201
    account_id = account.json()["id"]
    txn = client.post(
        "/transactions",
        json={
            "account_id": account_id,
            "description": "Shop",
            "amount": 10,
            "transaction_type": "expense",
            "occurred_on": "2026-10-05",
        },
    )
    assert txn.status_code == 201
    income = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": 100,
            "frequency": "monthly",
            "start_date": "2026-10-01",
            "next_occurrence": "2026-10-01",
        },
    )
    assert income.status_code == 201
    goal = client.post(
        "/financial-goals",
        json={
            "name": "Fund",
            "target_amount": 1000,
            "currency": "EUR",
        },
    )
    assert goal.status_code == 201
    return {
        "account_id": account_id,
        "transaction_id": txn.json()["id"],
        "income_id": income.json()["id"],
        "goal_id": goal.json()["id"],
    }


def test_cross_household_resource_access_denied(
    make_client,
) -> None:
    """Household two cannot access household one resources by id."""
    with make_client("auth0|household-one") as client_one:
        ids = _seed_household(client_one)
    with make_client("auth0|household-two") as client_two:
        assert (
            client_two.get(
                f"/accounts/{ids['account_id']}",
            ).status_code
            == 404
        )
        assert (
            client_two.get(
                f"/transactions/{ids['transaction_id']}",
            ).status_code
            == 404
        )
        assert (
            client_two.get(
                f"/incomes/{ids['income_id']}",
            ).status_code
            == 404
        )
        assert (
            client_two.get(
                f"/financial-goals/{ids['goal_id']}",
            ).status_code
            == 404
        )


def test_cross_household_list_and_aggregates_empty(
    make_client,
) -> None:
    """Lists and aggregates exclude other households' data."""
    to_date = date.today()
    from_date = to_date - timedelta(days=7)
    with make_client("auth0|iso-h1") as client_one:
        _seed_household(client_one)
    with make_client("auth0|iso-h2") as client_two:
        assert client_two.get("/accounts").json() == []
        assert client_two.get("/transactions").json() == []
        summary = client_two.get(
            "/financial-summary",
            params={
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
            },
        )
        assert summary.status_code == 200
        assert summary.json()["by_currency"] == []
        analysis = client_two.get(
            "/analysis/summary",
            params={
                "from": from_date.isoformat(),
                "to": to_date.isoformat(),
            },
        )
        assert analysis.status_code == 200
        assert analysis.json()["by_currency"] == []


def test_cross_household_schedule_execution_denied(
    make_client,
) -> None:
    """Cannot execute another household's income schedule."""
    with make_client("auth0|sched-h1") as client_one:
        account = client_one.post(
            "/accounts",
            json={"name": "Main", "account_type": "bank"},
        ).json()
        income = client_one.post(
            "/incomes",
            json={
                "account_id": account["id"],
                "amount": 50,
                "frequency": "monthly",
                "start_date": "2026-10-01",
                "next_occurrence": "2026-10-01",
            },
        ).json()
        income_id = income["id"]
    with make_client("auth0|sched-h2") as client_two:
        response = client_two.post(
            f"/incomes/{income_id}/executions",
            json={"occurrence_date": "2026-10-01"},
        )
        assert response.status_code == 404


def test_first_login_household_bootstrap_idempotent(
    make_client,
) -> None:
    """Repeated requests do not create duplicate memberships."""
    with make_client("auth0|bootstrap-user") as first:
        first.post(
            "/accounts",
            json={"name": "Main", "account_type": "bank"},
        )
    with make_client("auth0|bootstrap-user") as second:
        second.post(
            "/accounts",
            json={"name": "Other", "account_type": "cash"},
        )
    from tests.conftest import SessionLocal
    from app.models.household_membership import HouseholdMembership
    from sqlalchemy import func
    from sqlalchemy import select

    session = SessionLocal()
    try:
        count = session.scalar(
            select(func.count())
            .select_from(HouseholdMembership)
            .where(
                HouseholdMembership.user_sub
                == "auth0|bootstrap-user",
            ),
        )
        assert count == 1
    finally:
        session.close()


def test_health_remains_public(
    unauthenticated_client: TestClient,
) -> None:
    """Health check does not require authentication."""
    response = unauthenticated_client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
