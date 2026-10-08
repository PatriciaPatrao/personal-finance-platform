"""API tests for financial goals."""

from decimal import Decimal

from fastapi.testclient import TestClient


def _create_account(
    client: TestClient,
    *,
    name: str = "Savings",
    currency: str = "EUR",
    current_balance: str = "0.00",
) -> dict:
    """Create an account and return its response body."""
    response = client.post(
        "/accounts",
        json={
            "name": name,
            "account_type": "bank",
            "currency": currency,
            "current_balance": current_balance,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_create_goal_without_account(
    client: TestClient,
) -> None:
    """POST /financial-goals stores an unlinked goal."""
    response = client.post(
        "/financial-goals",
        json={
            "name": "Emergency Fund",
            "target_amount": "10000.00",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert body["name"] == "Emergency Fund"
    assert Decimal(body["target_amount"]) == Decimal(
        "10000.00",
    )
    assert body["currency"] == "EUR"
    assert body["target_date"] is None
    assert body["account_id"] is None
    assert body["created_at"]
    assert body["current_amount"] is None
    assert body["progress"] is None
    assert body["completed"] is None


def test_create_goal_linked_to_account(
    client: TestClient,
) -> None:
    """POST /financial-goals can link to an existing account."""
    account = _create_account(
        client,
        current_balance="2500.00",
    )

    response = client.post(
        "/financial-goals",
        json={
            "name": "Vacation",
            "target_amount": "5000.00",
            "account_id": account["id"],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["account_id"] == account["id"]
    assert Decimal(body["current_amount"]) == Decimal(
        "2500.00",
    )
    assert Decimal(body["progress"]) == Decimal("0.5")
    assert body["completed"] is False


def test_create_rejects_nonexistent_account(
    client: TestClient,
) -> None:
    """POST rejects a missing account with 404."""
    response = client.post(
        "/financial-goals",
        json={
            "name": "Vacation",
            "target_amount": "5000.00",
            "account_id": 999999,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Account not found"


def test_create_rejects_currency_mismatch(
    client: TestClient,
) -> None:
    """POST rejects when Goal and Account currencies differ."""
    account = _create_account(client, currency="USD")

    response = client.post(
        "/financial-goals",
        json={
            "name": "Vacation",
            "target_amount": "5000.00",
            "currency": "EUR",
            "account_id": account["id"],
        },
    )

    assert response.status_code == 422
    assert "currency" in response.json()["detail"].lower()


def test_create_rejects_duplicate_goal_for_account(
    client: TestClient,
) -> None:
    """POST rejects a second Goal on the same Account."""
    account = _create_account(client)
    first = client.post(
        "/financial-goals",
        json={
            "name": "Emergency Fund",
            "target_amount": "10000.00",
            "account_id": account["id"],
        },
    )
    assert first.status_code == 201

    second = client.post(
        "/financial-goals",
        json={
            "name": "Vacation",
            "target_amount": "5000.00",
            "account_id": account["id"],
        },
    )

    assert second.status_code == 422
    assert "already" in second.json()["detail"].lower()


def test_create_rejects_non_positive_target_amount(
    client: TestClient,
) -> None:
    """POST rejects target_amount that is not greater than zero."""
    zero = client.post(
        "/financial-goals",
        json={
            "name": "Invalid",
            "target_amount": "0.00",
        },
    )
    negative = client.post(
        "/financial-goals",
        json={
            "name": "Invalid",
            "target_amount": "-1.00",
        },
    )

    assert zero.status_code == 422
    assert negative.status_code == 422


def test_create_defaults_currency_to_eur(
    client: TestClient,
) -> None:
    """POST omits currency and stores EUR."""
    response = client.post(
        "/financial-goals",
        json={
            "name": "Emergency Fund",
            "target_amount": "10000.00",
        },
    )

    assert response.status_code == 201
    assert response.json()["currency"] == "EUR"


def test_list_goals_returns_stored_goals(
    client: TestClient,
) -> None:
    """GET /financial-goals includes created goals."""
    created = client.post(
        "/financial-goals",
        json={
            "name": "Emergency Fund",
            "target_amount": "10000.00",
        },
    )
    assert created.status_code == 201
    created_id = created.json()["id"]

    response = client.get("/financial-goals")

    assert response.status_code == 200
    goals = response.json()
    assert isinstance(goals, list)
    stored = next(
        item for item in goals if item["id"] == created_id
    )
    assert stored["name"] == "Emergency Fund"


def test_get_goal_returns_one_goal(
    client: TestClient,
) -> None:
    """GET /financial-goals/{id} returns the stored goal."""
    created = client.post(
        "/financial-goals",
        json={
            "name": "Vacation",
            "target_amount": "2500.00",
            "currency": "USD",
        },
    )
    assert created.status_code == 201
    goal_id = created.json()["id"]

    response = client.get(f"/financial-goals/{goal_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == goal_id
    assert body["name"] == "Vacation"
    assert body["currency"] == "USD"


def test_get_missing_goal_returns_not_found(
    client: TestClient,
) -> None:
    """GET /financial-goals/{id} returns 404 when missing."""
    response = client.get("/financial-goals/999999")

    assert response.status_code == 404
    assert response.json()["detail"] == (
        "Financial goal not found"
    )


def test_linked_goal_uses_account_balance_as_current_amount(
    client: TestClient,
) -> None:
    """Linked current_amount equals Account.current_balance."""
    account = _create_account(
        client,
        current_balance="1234.56",
    )
    created = client.post(
        "/financial-goals",
        json={
            "name": "Buffer",
            "target_amount": "2000.00",
            "account_id": account["id"],
        },
    )

    assert created.status_code == 201
    assert Decimal(created.json()["current_amount"]) == (
        Decimal("1234.56")
    )


def test_progress_is_correctly_calculated(
    client: TestClient,
) -> None:
    """Progress is current_amount / target_amount when in range."""
    account = _create_account(
        client,
        current_balance="250.00",
    )
    created = client.post(
        "/financial-goals",
        json={
            "name": "Gadget",
            "target_amount": "1000.00",
            "account_id": account["id"],
        },
    )

    assert created.status_code == 201
    assert Decimal(created.json()["progress"]) == Decimal(
        "0.25",
    )
    assert created.json()["completed"] is False


def test_progress_is_capped_at_one(
    client: TestClient,
) -> None:
    """Progress is capped at 1 when balance exceeds target."""
    account = _create_account(
        client,
        current_balance="15000.00",
    )
    created = client.post(
        "/financial-goals",
        json={
            "name": "Emergency Fund",
            "target_amount": "10000.00",
            "account_id": account["id"],
        },
    )

    assert created.status_code == 201
    body = created.json()
    assert Decimal(body["current_amount"]) == Decimal(
        "15000.00",
    )
    assert Decimal(body["progress"]) == Decimal("1")
    assert body["completed"] is True


def test_negative_balance_produces_progress_zero(
    client: TestClient,
) -> None:
    """Negative Account balance floors progress at 0."""
    account = _create_account(
        client,
        current_balance="-100.00",
    )
    created = client.post(
        "/financial-goals",
        json={
            "name": "Recovery",
            "target_amount": "1000.00",
            "account_id": account["id"],
        },
    )

    assert created.status_code == 201
    body = created.json()
    assert Decimal(body["current_amount"]) == Decimal(
        "-100.00",
    )
    assert Decimal(body["progress"]) == Decimal("0")
    assert body["completed"] is False


def test_completed_when_current_reaches_target(
    client: TestClient,
) -> None:
    """Completed is true when current_amount equals target."""
    account = _create_account(
        client,
        current_balance="5000.00",
    )
    created = client.post(
        "/financial-goals",
        json={
            "name": "Laptop",
            "target_amount": "5000.00",
            "account_id": account["id"],
        },
    )

    assert created.status_code == 201
    body = created.json()
    assert Decimal(body["progress"]) == Decimal("1")
    assert body["completed"] is True


def test_unlinked_goal_returns_null_derived_values(
    client: TestClient,
) -> None:
    """Unlinked goals expose null derived fields, not zero."""
    created = client.post(
        "/financial-goals",
        json={
            "name": "Idea",
            "target_amount": "1000.00",
        },
    )

    assert created.status_code == 201
    body = created.json()
    assert body["current_amount"] is None
    assert body["progress"] is None
    assert body["completed"] is None


def test_update_goal_fields(
    client: TestClient,
) -> None:
    """PUT updates mutable Goal fields."""
    created = client.post(
        "/financial-goals",
        json={
            "name": "Old Name",
            "target_amount": "1000.00",
        },
    )
    assert created.status_code == 201
    goal_id = created.json()["id"]

    response = client.put(
        f"/financial-goals/{goal_id}",
        json={
            "name": "New Name",
            "target_amount": "2000.00",
            "currency": "USD",
            "target_date": "2027-12-31",
            "account_id": None,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "New Name"
    assert Decimal(body["target_amount"]) == Decimal(
        "2000.00",
    )
    assert body["currency"] == "USD"
    assert body["target_date"] == "2027-12-31"
    assert body["account_id"] is None


def test_update_target_recalculates_progress(
    client: TestClient,
) -> None:
    """PUT target change recalculates progress and completed."""
    account = _create_account(
        client,
        current_balance="5000.00",
    )
    created = client.post(
        "/financial-goals",
        json={
            "name": "Emergency Fund",
            "target_amount": "10000.00",
            "account_id": account["id"],
        },
    )
    assert created.status_code == 201
    goal_id = created.json()["id"]
    assert created.json()["completed"] is False

    response = client.put(
        f"/financial-goals/{goal_id}",
        json={
            "name": "Emergency Fund",
            "target_amount": "4000.00",
            "currency": "EUR",
            "target_date": None,
            "account_id": account["id"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["current_amount"]) == Decimal(
        "5000.00",
    )
    assert Decimal(body["progress"]) == Decimal("1")
    assert body["completed"] is True


def test_update_account_rejects_missing_account(
    client: TestClient,
) -> None:
    """PUT rejects linking to a missing Account."""
    created = client.post(
        "/financial-goals",
        json={
            "name": "Vacation",
            "target_amount": "5000.00",
        },
    )
    assert created.status_code == 201
    goal_id = created.json()["id"]

    response = client.put(
        f"/financial-goals/{goal_id}",
        json={
            "name": "Vacation",
            "target_amount": "5000.00",
            "currency": "EUR",
            "target_date": None,
            "account_id": 999999,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Account not found"


def test_update_account_rejects_currency_mismatch(
    client: TestClient,
) -> None:
    """PUT rejects linking when currencies differ."""
    account = _create_account(client, currency="GBP")
    created = client.post(
        "/financial-goals",
        json={
            "name": "Vacation",
            "target_amount": "5000.00",
            "currency": "EUR",
        },
    )
    assert created.status_code == 201
    goal_id = created.json()["id"]

    response = client.put(
        f"/financial-goals/{goal_id}",
        json={
            "name": "Vacation",
            "target_amount": "5000.00",
            "currency": "EUR",
            "target_date": None,
            "account_id": account["id"],
        },
    )

    assert response.status_code == 422
    assert "currency" in response.json()["detail"].lower()


def test_update_account_respects_one_goal_per_account(
    client: TestClient,
) -> None:
    """PUT cannot move a Goal onto an Account that has one."""
    first_account = _create_account(client, name="A")
    second_account = _create_account(client, name="B")
    first_goal = client.post(
        "/financial-goals",
        json={
            "name": "First",
            "target_amount": "1000.00",
            "account_id": first_account["id"],
        },
    )
    second_goal = client.post(
        "/financial-goals",
        json={
            "name": "Second",
            "target_amount": "2000.00",
            "account_id": second_account["id"],
        },
    )
    assert first_goal.status_code == 201
    assert second_goal.status_code == 201
    second_id = second_goal.json()["id"]

    response = client.put(
        f"/financial-goals/{second_id}",
        json={
            "name": "Second",
            "target_amount": "2000.00",
            "currency": "EUR",
            "target_date": None,
            "account_id": first_account["id"],
        },
    )

    assert response.status_code == 422
    assert "already" in response.json()["detail"].lower()


def test_goal_operations_do_not_modify_account_balance(
    client: TestClient,
) -> None:
    """Create and update Goals leave Account.current_balance."""
    account = _create_account(
        client,
        current_balance="777.77",
    )
    original_balance = Decimal(account["current_balance"])

    created = client.post(
        "/financial-goals",
        json={
            "name": "Protect Balance",
            "target_amount": "1000.00",
            "account_id": account["id"],
        },
    )
    assert created.status_code == 201
    goal_id = created.json()["id"]

    updated = client.put(
        f"/financial-goals/{goal_id}",
        json={
            "name": "Protect Balance",
            "target_amount": "2000.00",
            "currency": "EUR",
            "target_date": None,
            "account_id": account["id"],
        },
    )
    assert updated.status_code == 200

    stored = client.get(f"/accounts/{account['id']}")
    assert stored.status_code == 200
    assert Decimal(stored.json()["current_balance"]) == (
        original_balance
    )
