"""ORM tests for FinancialGoal persistence."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.account import AccountType
from app.models.financial_goal import FinancialGoal


def test_goal_can_exist_without_account(
    db_session: Session,
) -> None:
    """A Goal with no Account is a valid objective."""
    goal = FinancialGoal(
        name="Emergency Fund",
        target_amount=Decimal("10000.00"),
    )
    db_session.add(goal)
    db_session.commit()
    db_session.refresh(goal)

    assert goal.id is not None
    assert goal.account_id is None
    assert goal.account is None


def test_goal_can_reference_existing_account(
    db_session: Session,
) -> None:
    """A Goal can link to an Account and both sides load."""
    account = Account(
        name="Savings",
        account_type=AccountType.BANK,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    goal = FinancialGoal(
        name="Vacation",
        target_amount=Decimal("2500.00"),
        account_id=account.id,
    )
    db_session.add(goal)
    db_session.commit()
    db_session.refresh(goal)
    db_session.refresh(account)

    assert goal.account_id == account.id
    assert goal.account.id == account.id
    assert account.financial_goal.id == goal.id


def test_two_unlinked_goals_can_exist(
    db_session: Session,
) -> None:
    """Multiple Goals may omit an Account."""
    first = FinancialGoal(
        name="Emergency Fund",
        target_amount=Decimal("10000.00"),
    )
    second = FinancialGoal(
        name="Vacation",
        target_amount=Decimal("2500.00"),
        target_date=date(2027, 6, 1),
    )
    db_session.add_all([first, second])
    db_session.commit()
    db_session.refresh(first)
    db_session.refresh(second)

    assert first.id != second.id
    assert first.account_id is None
    assert second.account_id is None


def test_two_goals_cannot_link_same_account(
    db_session: Session,
) -> None:
    """MVP: an Account may be associated with at most one Goal."""
    account = Account(
        name="Savings",
        account_type=AccountType.BANK,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    first = FinancialGoal(
        name="Emergency Fund",
        target_amount=Decimal("10000.00"),
        account_id=account.id,
    )
    db_session.add(first)
    db_session.commit()

    second = FinancialGoal(
        name="Vacation",
        target_amount=Decimal("2500.00"),
        account_id=account.id,
    )
    db_session.add(second)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


@pytest.mark.parametrize(
    "target_amount",
    [Decimal("0.00"), Decimal("-1.00")],
)
def test_goal_target_amount_must_be_positive(
    db_session: Session,
    target_amount: Decimal,
) -> None:
    """target_amount must be greater than zero."""
    goal = FinancialGoal(
        name="Invalid Target",
        target_amount=target_amount,
    )
    db_session.add(goal)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_goal_currency_defaults_to_eur(
    db_session: Session,
) -> None:
    """Omitting currency stores EUR via the server default."""
    goal = FinancialGoal(
        name="Emergency Fund",
        target_amount=Decimal("10000.00"),
    )
    db_session.add(goal)
    db_session.commit()
    db_session.refresh(goal)

    assert goal.currency == "EUR"
