"""ORM and service tests for FinancialGoal and GoalAllocation."""

from datetime import date
from datetime import datetime
from datetime import timedelta
from datetime import timezone
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.account import AccountType
from app.models.financial_goal import FinancialGoal
from app.models.goal_allocation import GoalAllocation
from app.models.transaction import Transaction
from app.schemas.financial_goal import FinancialGoalCreate
from app.schemas.financial_goal import FinancialGoalUpdate
from app.schemas.financial_goal import GoalAllocationCreate
from app.schemas.financial_goal import GoalAllocationUpdate
from app.services.financial_goal import AllocationCapacityExceededError
from app.services.financial_goal import CurrencyMismatchError
from app.services.financial_goal import FinancialGoalService


def _account(
    session: Session,
    name: str = "Savings",
    balance: Decimal = Decimal("5000.00"),
    currency: str = "EUR",
) -> Account:
    account = Account(
        name=name,
        account_type=AccountType.BANK,
        currency=currency,
        current_balance=balance,
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


def test_goal_can_exist_without_allocation(
    db_session: Session,
) -> None:
    """A Goal with no allocations is a valid objective."""
    goal = FinancialGoal(
        name="Emergency Fund",
        target_amount=Decimal("10000.00"),
    )
    db_session.add(goal)
    db_session.commit()
    db_session.refresh(goal)

    assert goal.id is not None
    assert goal.allocations == []


def test_allocation_requires_goal_and_account(
    db_session: Session,
) -> None:
    """An allocation links an existing Goal and Account."""
    account = _account(db_session)
    goal = FinancialGoal(
        name="Vacation",
        target_amount=Decimal("2500.00"),
    )
    db_session.add(goal)
    db_session.commit()
    db_session.refresh(goal)

    allocation = GoalAllocation(
        goal_id=goal.id,
        account_id=account.id,
        amount=Decimal("1000.00"),
    )
    db_session.add(allocation)
    db_session.commit()
    db_session.refresh(allocation)

    assert allocation.goal_id == goal.id
    assert allocation.account_id == account.id
    assert allocation.amount == Decimal("1000.00")


def test_two_goals_can_share_one_account(
    db_session: Session,
) -> None:
    """An Account may fund multiple Goals through allocations."""
    account = _account(db_session, balance=Decimal("20000.00"))
    first = FinancialGoal(
        name="Emergency Fund",
        target_amount=Decimal("10000.00"),
    )
    second = FinancialGoal(
        name="Holiday",
        target_amount=Decimal("5000.00"),
    )
    db_session.add_all([first, second])
    db_session.commit()
    db_session.refresh(first)
    db_session.refresh(second)

    db_session.add_all(
        [
            GoalAllocation(
                goal_id=first.id,
                account_id=account.id,
                amount=Decimal("8000.00"),
            ),
            GoalAllocation(
                goal_id=second.id,
                account_id=account.id,
                amount=Decimal("2000.00"),
            ),
        ],
    )
    db_session.commit()

    service = FinancialGoalService(db_session)
    emergency = service.get_by_id(first.id)
    holiday = service.get_by_id(second.id)
    assert emergency is not None
    assert holiday is not None
    assert emergency.current_amount == Decimal("8000.00")
    assert holiday.current_amount == Decimal("2000.00")


def test_one_goal_can_use_multiple_accounts(
    db_session: Session,
) -> None:
    """A Goal may receive allocations from multiple Accounts."""
    main = _account(db_session, name="Main", balance=Decimal("3000.00"))
    savings = _account(
        db_session,
        name="Savings",
        balance=Decimal("2000.00"),
    )
    goal = FinancialGoal(
        name="Emergency Fund",
        target_amount=Decimal("10000.00"),
    )
    db_session.add(goal)
    db_session.commit()
    db_session.refresh(goal)

    service = FinancialGoalService(db_session)
    service.create_allocation(
        goal.id,
        GoalAllocationCreate(
            account_id=main.id,
            amount=Decimal("3000.00"),
        ),
    )
    response = service.create_allocation(
        goal.id,
        GoalAllocationCreate(
            account_id=savings.id,
            amount=Decimal("2000.00"),
        ),
    )

    assert response.current_amount == Decimal("5000.00")
    assert len(response.allocations) == 2


def test_duplicate_goal_account_allocation_rejected(
    db_session: Session,
) -> None:
    """At most one allocation exists for a Goal and Account pair."""
    account = _account(db_session)
    goal = FinancialGoal(
        name="Emergency Fund",
        target_amount=Decimal("10000.00"),
    )
    db_session.add(goal)
    db_session.commit()
    db_session.refresh(goal)

    db_session.add(
        GoalAllocation(
            goal_id=goal.id,
            account_id=account.id,
            amount=Decimal("1000.00"),
        ),
    )
    db_session.commit()
    db_session.add(
        GoalAllocation(
            goal_id=goal.id,
            account_id=account.id,
            amount=Decimal("500.00"),
        ),
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


@pytest.mark.parametrize(
    "amount",
    [Decimal("0.00"), Decimal("-1.00")],
)
def test_allocation_amount_must_be_positive(
    db_session: Session,
    amount: Decimal,
) -> None:
    """Allocation amount must be greater than zero."""
    account = _account(db_session)
    goal = FinancialGoal(
        name="Emergency Fund",
        target_amount=Decimal("10000.00"),
    )
    db_session.add(goal)
    db_session.commit()
    db_session.refresh(goal)

    db_session.add(
        GoalAllocation(
            goal_id=goal.id,
            account_id=account.id,
            amount=amount,
        ),
    )
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
    """Goal target_amount must be greater than zero."""
    goal = FinancialGoal(
        name="Broken",
        target_amount=target_amount,
    )
    db_session.add(goal)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_service_rejects_currency_mismatch(
    db_session: Session,
) -> None:
    """Allocation currency must match the Goal."""
    account = _account(db_session, currency="USD")
    service = FinancialGoalService(db_session)
    goal = service.create(
        FinancialGoalCreate(
            name="Emergency Fund",
            target_amount=Decimal("10000.00"),
            currency="EUR",
        ),
    )

    with pytest.raises(CurrencyMismatchError):
        service.create_allocation(
            goal.id,
            GoalAllocationCreate(
                account_id=account.id,
                amount=Decimal("100.00"),
            ),
        )


def test_service_rejects_over_capacity(
    db_session: Session,
) -> None:
    """Designated amounts may not exceed available capacity."""
    account = _account(db_session, balance=Decimal("1000.00"))
    service = FinancialGoalService(db_session)
    goal = service.create(
        FinancialGoalCreate(
            name="Emergency Fund",
            target_amount=Decimal("10000.00"),
        ),
    )

    with pytest.raises(AllocationCapacityExceededError):
        service.create_allocation(
            goal.id,
            GoalAllocationCreate(
                account_id=account.id,
                amount=Decimal("1000.01"),
            ),
        )


def test_service_allows_exact_capacity(
    db_session: Session,
) -> None:
    """Exact available capacity may be designated."""
    account = _account(db_session, balance=Decimal("1000.00"))
    service = FinancialGoalService(db_session)
    goal = service.create(
        FinancialGoalCreate(
            name="Emergency Fund",
            target_amount=Decimal("10000.00"),
        ),
    )

    response = service.create_allocation(
        goal.id,
        GoalAllocationCreate(
            account_id=account.id,
            amount=Decimal("1000.00"),
        ),
    )
    assert response.current_amount == Decimal("1000.00")
    db_session.refresh(account)
    assert account.current_balance == Decimal("1000.00")


def test_allocation_does_not_change_account_balance(
    db_session: Session,
) -> None:
    """Creating an allocation leaves Account.current_balance unchanged."""
    account = _account(db_session, balance=Decimal("5000.00"))
    service = FinancialGoalService(db_session)
    goal = service.create(
        FinancialGoalCreate(
            name="Emergency Fund",
            target_amount=Decimal("10000.00"),
        ),
    )
    service.create_allocation(
        goal.id,
        GoalAllocationCreate(
            account_id=account.id,
            amount=Decimal("1500.00"),
        ),
    )
    db_session.refresh(account)
    assert account.current_balance == Decimal("5000.00")


def test_progress_and_completion_from_allocations(
    db_session: Session,
) -> None:
    """Progress and completion are derived from funded allocations."""
    account = _account(db_session, balance=Decimal("15000.00"))
    service = FinancialGoalService(db_session)
    goal = service.create(
        FinancialGoalCreate(
            name="Emergency Fund",
            target_amount=Decimal("10000.00"),
        ),
    )
    response = service.create_allocation(
        goal.id,
        GoalAllocationCreate(
            account_id=account.id,
            amount=Decimal("5000.00"),
        ),
    )
    assert response.current_amount == Decimal("5000.00")
    assert response.progress == Decimal("0.5")
    assert response.completed is False

    completed = service.update_allocation(
        goal.id,
        response.allocations[0].id,
        GoalAllocationUpdate(amount=Decimal("10000.00")),
    )
    assert completed.progress == Decimal("1")
    assert completed.completed is True


def test_progress_capped_at_one(
    db_session: Session,
) -> None:
    """Progress stays at most 1 when funded amount exceeds the target."""
    account = _account(db_session, balance=Decimal("20000.00"))
    service = FinancialGoalService(db_session)
    goal = service.create(
        FinancialGoalCreate(
            name="Emergency Fund",
            target_amount=Decimal("10000.00"),
        ),
    )
    response = service.create_allocation(
        goal.id,
        GoalAllocationCreate(
            account_id=account.id,
            amount=Decimal("15000.00"),
        ),
    )
    assert response.current_amount == Decimal("15000.00")
    assert response.progress == Decimal("1")
    assert response.completed is True


def test_unallocated_goal_has_null_progress(
    db_session: Session,
) -> None:
    """A Goal with no allocations has unavailable progress fields."""
    service = FinancialGoalService(db_session)
    goal = service.create(
        FinancialGoalCreate(
            name="Idea",
            target_amount=Decimal("1000.00"),
        ),
    )
    assert goal.current_amount is None
    assert goal.progress is None
    assert goal.completed is None


def test_balance_decrease_funds_in_creation_order(
    db_session: Session,
) -> None:
    """Later lower balance funds earlier allocations first."""
    account = _account(db_session, balance=Decimal("10000.00"))
    service = FinancialGoalService(db_session)
    goal_a = service.create(
        FinancialGoalCreate(
            name="Goal A",
            target_amount=Decimal("10000.00"),
        ),
    )
    goal_b = service.create(
        FinancialGoalCreate(
            name="Goal B",
            target_amount=Decimal("10000.00"),
        ),
    )
    first = service.create_allocation(
        goal_a.id,
        GoalAllocationCreate(
            account_id=account.id,
            amount=Decimal("6000.00"),
        ),
    )
    second = service.create_allocation(
        goal_b.id,
        GoalAllocationCreate(
            account_id=account.id,
            amount=Decimal("4000.00"),
        ),
    )

    earlier = datetime.now(timezone.utc) - timedelta(minutes=1)
    later = datetime.now(timezone.utc)
    alloc_a = db_session.get(GoalAllocation, first.allocations[0].id)
    alloc_b = db_session.get(GoalAllocation, second.allocations[0].id)
    assert alloc_a is not None
    assert alloc_b is not None
    alloc_a.created_at = earlier
    alloc_b.created_at = later
    account.current_balance = Decimal("7000.00")
    db_session.commit()

    funded_a = service.get_by_id(goal_a.id)
    funded_b = service.get_by_id(goal_b.id)
    assert funded_a is not None
    assert funded_b is not None
    assert funded_a.allocations[0].amount == Decimal("6000.00")
    assert funded_a.allocations[0].funded_amount == Decimal("6000.00")
    assert funded_b.allocations[0].amount == Decimal("4000.00")
    assert funded_b.allocations[0].funded_amount == Decimal("1000.00")
    assert funded_a.current_amount == Decimal("6000.00")
    assert funded_b.current_amount == Decimal("1000.00")


def test_negative_balance_funds_nothing(
    db_session: Session,
) -> None:
    """Negative Account balance does not create positive Goal progress."""
    account = _account(db_session, balance=Decimal("1000.00"))
    service = FinancialGoalService(db_session)
    goal = service.create(
        FinancialGoalCreate(
            name="Emergency Fund",
            target_amount=Decimal("10000.00"),
        ),
    )
    created = service.create_allocation(
        goal.id,
        GoalAllocationCreate(
            account_id=account.id,
            amount=Decimal("500.00"),
        ),
    )
    account.current_balance = Decimal("-100.00")
    db_session.commit()

    response = service.get_by_id(goal.id)
    assert response is not None
    assert response.allocations[0].amount == Decimal("500.00")
    assert response.allocations[0].funded_amount == Decimal("0")
    assert response.current_amount == Decimal("0")
    assert response.progress == Decimal("0")
    assert response.completed is False
    assert created.current_amount == Decimal("500.00")


def test_reduce_and_delete_allocation(
    db_session: Session,
) -> None:
    """Allocation amounts can be reduced and rows can be deleted."""
    account = _account(db_session, balance=Decimal("5000.00"))
    service = FinancialGoalService(db_session)
    goal = service.create(
        FinancialGoalCreate(
            name="Emergency Fund",
            target_amount=Decimal("10000.00"),
        ),
    )
    created = service.create_allocation(
        goal.id,
        GoalAllocationCreate(
            account_id=account.id,
            amount=Decimal("2000.00"),
        ),
    )
    allocation_id = created.allocations[0].id
    reduced = service.update_allocation(
        goal.id,
        allocation_id,
        GoalAllocationUpdate(amount=Decimal("500.00")),
    )
    assert reduced.current_amount == Decimal("500.00")

    deleted = service.delete_allocation(goal.id, allocation_id)
    assert deleted.allocations == []
    assert deleted.current_amount is None
    db_session.refresh(account)
    assert account.current_balance == Decimal("5000.00")


def test_allocation_does_not_create_transactions(
    db_session: Session,
) -> None:
    """Allocation writes do not insert Transaction rows."""
    account = _account(db_session)
    service = FinancialGoalService(db_session)
    goal = service.create(
        FinancialGoalCreate(
            name="Emergency Fund",
            target_amount=Decimal("10000.00"),
        ),
    )
    service.create_allocation(
        goal.id,
        GoalAllocationCreate(
            account_id=account.id,
            amount=Decimal("100.00"),
        ),
    )
    transactions = db_session.query(Transaction).all()
    assert transactions == []


def test_goal_update_rejects_currency_change_with_allocations(
    db_session: Session,
) -> None:
    """Currency cannot change while allocations exist."""
    from app.services.financial_goal import CurrencyChangeBlockedError

    account = _account(db_session)
    service = FinancialGoalService(db_session)
    goal = service.create(
        FinancialGoalCreate(
            name="Emergency Fund",
            target_amount=Decimal("10000.00"),
            currency="EUR",
        ),
    )
    service.create_allocation(
        goal.id,
        GoalAllocationCreate(
            account_id=account.id,
            amount=Decimal("100.00"),
        ),
    )
    with pytest.raises(CurrencyChangeBlockedError):
        service.update(
            goal.id,
            FinancialGoalUpdate(
                name="Emergency Fund",
                target_amount=Decimal("10000.00"),
                currency="USD",
                target_date=None,
            ),
        )
