"""API tests for financial goals and allocations."""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.transaction import Transaction


def _create_account(
    client: TestClient,
    name: str = "Savings",
    balance: str = "5000.00",
    currency: str = "EUR",
) -> dict:
    response = client.post(
        "/accounts",
        json={
            "name": name,
            "account_type": "bank",
            "currency": currency,
            "current_balance": balance,
        },
    )
    assert response.status_code == 201
    return response.json()


def _create_goal(
    client: TestClient,
    name: str = "Emergency Fund",
    target_amount: str = "10000.00",
    currency: str = "EUR",
) -> dict:
    response = client.post(
        "/financial-goals",
        json={
            "name": name,
            "target_amount": target_amount,
            "currency": currency,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_create_goal_without_allocation(
    client: TestClient,
) -> None:
    """POST /financial-goals stores an unallocated goal."""
    body = _create_goal(client)
    assert body["name"] == "Emergency Fund"
    assert body["allocations"] == []
    assert body["current_amount"] is None
    assert body["progress"] is None
    assert body["completed"] is None
    assert "account_id" not in body


def test_create_allocation(
    client: TestClient,
) -> None:
    """POST allocation designates existing account money."""
    account = _create_account(client)
    goal = _create_goal(client)
    response = client.post(
        f"/financial-goals/{goal['id']}/allocations",
        json={
            "account_id": account["id"],
            "amount": "1500.00",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["current_amount"] == "1500.00"
    assert Decimal(body["progress"]) == Decimal("0.15")
    assert len(body["allocations"]) == 1
    assert body["allocations"][0]["amount"] == "1500.00"
    assert body["allocations"][0]["funded_amount"] == "1500.00"

    account_after = client.get(f"/accounts/{account['id']}")
    assert account_after.json()["current_balance"] == "5000.00"


def test_allocation_requires_valid_goal(
    client: TestClient,
) -> None:
    """Allocation against a missing goal returns 404."""
    account = _create_account(client)
    response = client.post(
        "/financial-goals/999999/allocations",
        json={"account_id": account["id"], "amount": "100.00"},
    )
    assert response.status_code == 404


def test_allocation_requires_valid_account(
    client: TestClient,
) -> None:
    """Allocation against a missing account returns 404."""
    goal = _create_goal(client)
    response = client.post(
        f"/financial-goals/{goal['id']}/allocations",
        json={"account_id": 999999, "amount": "100.00"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Account not found"


def test_allocation_rejects_non_positive_amount(
    client: TestClient,
) -> None:
    """Allocation amount must be greater than zero."""
    account = _create_account(client)
    goal = _create_goal(client)
    response = client.post(
        f"/financial-goals/{goal['id']}/allocations",
        json={"account_id": account["id"], "amount": "0"},
    )
    assert response.status_code == 422


def test_allocation_rejects_currency_mismatch(
    client: TestClient,
) -> None:
    """Account currency must match Goal currency."""
    account = _create_account(client, currency="USD")
    goal = _create_goal(client, currency="EUR")
    response = client.post(
        f"/financial-goals/{goal['id']}/allocations",
        json={"account_id": account["id"], "amount": "100.00"},
    )
    assert response.status_code == 422
    assert "currency" in response.json()["detail"].lower()


def test_allocation_allows_exact_capacity(
    client: TestClient,
) -> None:
    """Exact available capacity is accepted."""
    account = _create_account(client, balance="1000.00")
    goal = _create_goal(client)
    response = client.post(
        f"/financial-goals/{goal['id']}/allocations",
        json={"account_id": account["id"], "amount": "1000.00"},
    )
    assert response.status_code == 201
    assert response.json()["current_amount"] == "1000.00"


def test_allocation_rejects_over_capacity(
    client: TestClient,
) -> None:
    """Amounts above available capacity are rejected."""
    account = _create_account(client, balance="1000.00")
    goal = _create_goal(client)
    response = client.post(
        f"/financial-goals/{goal['id']}/allocations",
        json={"account_id": account["id"], "amount": "1000.01"},
    )
    assert response.status_code == 422
    assert "available" in response.json()["detail"].lower()


def test_multiple_goals_one_account(
    client: TestClient,
) -> None:
    """One Account may fund multiple Goals within capacity."""
    account = _create_account(client, balance="20000.00")
    emergency = _create_goal(client, name="Emergency Fund")
    holiday = _create_goal(client, name="Holiday", target_amount="5000.00")

    first = client.post(
        f"/financial-goals/{emergency['id']}/allocations",
        json={"account_id": account["id"], "amount": "8000.00"},
    )
    second = client.post(
        f"/financial-goals/{holiday['id']}/allocations",
        json={"account_id": account["id"], "amount": "2000.00"},
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["current_amount"] == "8000.00"
    assert second.json()["current_amount"] == "2000.00"


def test_one_goal_multiple_accounts(
    client: TestClient,
) -> None:
    """One Goal may receive allocations from multiple Accounts."""
    main = _create_account(client, name="Main", balance="3000.00")
    savings = _create_account(client, name="Savings", balance="2000.00")
    goal = _create_goal(client)

    client.post(
        f"/financial-goals/{goal['id']}/allocations",
        json={"account_id": main["id"], "amount": "3000.00"},
    )
    response = client.post(
        f"/financial-goals/{goal['id']}/allocations",
        json={"account_id": savings["id"], "amount": "2000.00"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["current_amount"] == "5000.00"
    assert len(body["allocations"]) == 2


def test_progress_capped_and_completion(
    client: TestClient,
) -> None:
    """Progress is capped at 1 and completion is derived."""
    account = _create_account(client, balance="20000.00")
    goal = _create_goal(client, target_amount="10000.00")
    response = client.post(
        f"/financial-goals/{goal['id']}/allocations",
        json={"account_id": account["id"], "amount": "15000.00"},
    )
    body = response.json()
    assert Decimal(body["progress"]) == Decimal("1")
    assert body["completed"] is True
    assert body["current_amount"] == "15000.00"


def test_update_and_delete_allocation(
    client: TestClient,
) -> None:
    """PUT reduces amount; DELETE removes the designation."""
    account = _create_account(client)
    goal = _create_goal(client)
    created = client.post(
        f"/financial-goals/{goal['id']}/allocations",
        json={"account_id": account["id"], "amount": "2000.00"},
    ).json()
    allocation_id = created["allocations"][0]["id"]

    updated = client.put(
        f"/financial-goals/{goal['id']}/allocations/{allocation_id}",
        json={"amount": "500.00"},
    )
    assert updated.status_code == 200
    assert updated.json()["current_amount"] == "500.00"

    deleted = client.delete(
        f"/financial-goals/{goal['id']}/allocations/{allocation_id}",
    )
    assert deleted.status_code == 200
    assert deleted.json()["allocations"] == []
    assert deleted.json()["current_amount"] is None

    account_after = client.get(f"/accounts/{account['id']}")
    assert account_after.json()["current_balance"] == "5000.00"


def test_allocation_does_not_create_transactions(
    client: TestClient,
    db_session: Session,
) -> None:
    """Allocation endpoints do not insert Transaction rows."""
    account = _create_account(client)
    goal = _create_goal(client)
    client.post(
        f"/financial-goals/{goal['id']}/allocations",
        json={"account_id": account["id"], "amount": "100.00"},
    )
    assert db_session.query(Transaction).count() == 0


def test_list_and_get_include_allocations(
    client: TestClient,
) -> None:
    """GET list and detail include allocations and derived progress."""
    account = _create_account(client)
    goal = _create_goal(client)
    client.post(
        f"/financial-goals/{goal['id']}/allocations",
        json={"account_id": account["id"], "amount": "2500.00"},
    )

    listed = client.get("/financial-goals")
    assert listed.status_code == 200
    assert listed.json()[0]["current_amount"] == "2500.00"

    detail = client.get(f"/financial-goals/{goal['id']}")
    assert detail.status_code == 200
    assert Decimal(detail.json()["progress"]) == Decimal("0.25")


def test_update_goal_objective_fields(
    client: TestClient,
) -> None:
    """PUT goal updates objective fields without account_id."""
    goal = _create_goal(client)
    response = client.put(
        f"/financial-goals/{goal['id']}",
        json={
            "name": "Rainy Day",
            "target_amount": "12000.00",
            "currency": "EUR",
            "target_date": "2028-01-31",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Rainy Day"
    assert body["target_amount"] == "12000.00"
    assert body["target_date"] == "2028-01-31"


def test_currency_change_blocked_with_allocations(
    client: TestClient,
) -> None:
    """Goal currency cannot change while allocations exist."""
    account = _create_account(client)
    goal = _create_goal(client)
    client.post(
        f"/financial-goals/{goal['id']}/allocations",
        json={"account_id": account["id"], "amount": "100.00"},
    )
    response = client.put(
        f"/financial-goals/{goal['id']}",
        json={
            "name": goal["name"],
            "target_amount": goal["target_amount"],
            "currency": "USD",
            "target_date": None,
        },
    )
    assert response.status_code == 422


def test_second_allocation_respects_remaining_capacity(
    client: TestClient,
) -> None:
    """Capacity considers all designations on the Account."""
    account = _create_account(client, balance="1000.00")
    first = _create_goal(client, name="A")
    second = _create_goal(client, name="B")
    client.post(
        f"/financial-goals/{first['id']}/allocations",
        json={"account_id": account["id"], "amount": "700.00"},
    )
    rejected = client.post(
        f"/financial-goals/{second['id']}/allocations",
        json={"account_id": account["id"], "amount": "400.00"},
    )
    assert rejected.status_code == 422
    accepted = client.post(
        f"/financial-goals/{second['id']}/allocations",
        json={"account_id": account["id"], "amount": "300.00"},
    )
    assert accepted.status_code == 201
