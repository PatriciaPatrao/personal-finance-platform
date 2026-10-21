"""Household invitation and membership authorization tests."""

import pytest
from fastapi.testclient import TestClient


def _create_owner_household(client: TestClient) -> None:
    response = client.post(
        "/accounts",
        json={"name": "Main", "account_type": "bank"},
    )
    assert response.status_code == 201


def test_member_cannot_create_invitation(
    make_client,
) -> None:
    """Only owners may create invitations."""
    with make_client("auth0|owner-a") as owner:
        _create_owner_household(owner)
        invite = owner.post("/households/invitations")
        assert invite.status_code == 201
        token = invite.json()["token"]
    with make_client("auth0|member-b") as member:
        accepted = member.post(
            "/households/invitations/accept",
            json={"token": token},
        )
        assert accepted.status_code == 200
        forbidden = member.post("/households/invitations")
        assert forbidden.status_code == 403


def test_member_cannot_add_members_by_sub(
    make_client,
) -> None:
    """Non-owners cannot call the advanced member endpoint."""
    with make_client("auth0|owner-only") as owner:
        _create_owner_household(owner)
        token = owner.post("/households/invitations").json()["token"]
    with make_client("auth0|not-owner") as other:
        accepted = other.post(
            "/households/invitations/accept",
            json={"token": token},
        )
        assert accepted.status_code == 200
        response = other.post(
            "/households/members",
            json={"user_sub": "auth0|someone"},
        )
        assert response.status_code == 403


def test_invitation_accept_uses_jwt_sub_not_body(
    make_client,
) -> None:
    """Acceptance binds the authenticated user, not a client-supplied sub."""
    with make_client("auth0|invite-owner") as owner:
        _create_owner_household(owner)
        token = owner.post("/households/invitations").json()["token"]
    with make_client("auth0|invite-member") as joiner:
        accepted = joiner.post(
            "/households/invitations/accept",
            json={"token": token},
        )
        assert accepted.status_code == 200
        body = accepted.json()
        assert body["user_sub"] == "auth0|invite-member"
        assert body["role"] == "member"
        me = joiner.get("/households/me")
        assert me.json()["household_id"] == body["household_id"]


def test_user_cannot_join_without_valid_invitation(
    make_client,
) -> None:
    """Fabricated tokens are rejected."""
    with make_client("auth0|lonely-user") as client:
        response = client.post(
            "/households/invitations/accept",
            json={"token": "not-a-real-invitation-token"},
        )
        assert response.status_code == 404


def test_invitation_join_blocked_when_household_has_data(
    make_client,
) -> None:
    """Users with an existing populated household cannot accept."""
    with make_client("auth0|busy-owner") as owner:
        _create_owner_household(owner)
        token = owner.post("/households/invitations").json()["token"]
    with make_client("auth0|busy-member") as member:
        member.post(
            "/accounts",
            json={"name": "Solo", "account_type": "bank"},
        )
        conflict = member.post(
            "/households/invitations/accept",
            json={"token": token},
        )
        assert conflict.status_code == 409


def test_owner_advanced_add_rejects_other_household_member(
    make_client,
) -> None:
    """Owner cannot pull a user out of another household by sub."""
    with make_client("auth0|house-b-owner") as owner_b:
        _create_owner_household(owner_b)
    with make_client("auth0|house-a-owner") as owner_a:
        _create_owner_household(owner_a)
        conflict = owner_a.post(
            "/households/members",
            json={"user_sub": "auth0|house-b-owner"},
        )
        assert conflict.status_code == 409


def test_invitation_accept_idempotent_for_same_user(
    make_client,
) -> None:
    """Accepting twice returns the same membership safely."""
    with make_client("auth0|idempotent-owner") as owner:
        _create_owner_household(owner)
        token = owner.post("/households/invitations").json()["token"]
    with make_client("auth0|idempotent-member") as member:
        first = member.post(
            "/households/invitations/accept",
            json={"token": token},
        )
        second = member.post(
            "/households/invitations/accept",
            json={"token": token},
        )
        assert first.status_code == 200
        assert second.status_code == 200
        assert first.json()["id"] == second.json()["id"]
