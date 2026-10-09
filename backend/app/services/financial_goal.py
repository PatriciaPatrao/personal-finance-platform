"""Application logic for financial goals and allocations."""

from decimal import Decimal

from app.db.session import Session
from app.models.account import Account
from app.models.financial_goal import FinancialGoal
from app.models.goal_allocation import GoalAllocation
from app.repositories.account import AccountRepository
from app.repositories.financial_goal import (
    FinancialGoalRepository,
)
from app.repositories.goal_allocation import (
    GoalAllocationRepository,
)
from app.schemas.financial_goal import FinancialGoalCreate
from app.schemas.financial_goal import FinancialGoalResponse
from app.schemas.financial_goal import FinancialGoalUpdate
from app.schemas.financial_goal import GoalAllocationCreate
from app.schemas.financial_goal import GoalAllocationResponse
from app.schemas.financial_goal import GoalAllocationUpdate


class AccountNotFoundError(Exception):
    """Raised when an allocation references a missing account."""


class GoalNotFoundError(Exception):
    """Raised when a goal is missing."""


class AllocationNotFoundError(Exception):
    """Raised when an allocation is missing."""


class CurrencyMismatchError(Exception):
    """Raised when goal and account currencies differ."""


class AllocationAlreadyExistsError(Exception):
    """Raised when a goal already has an allocation for an account."""


class AllocationCapacityExceededError(Exception):
    """Raised when designated amounts would exceed account capacity."""


class CurrencyChangeBlockedError(Exception):
    """Raised when currency changes while allocations exist."""


class FinancialGoalService:
    """Coordinate financial goal and allocation operations."""

    def __init__(self, session: Session) -> None:
        """Bind the service to one database session."""
        self._repository = FinancialGoalRepository(session)
        self._allocation_repository = GoalAllocationRepository(
            session,
        )
        self._account_repository = AccountRepository(session)

    def _available_capacity(self, account: Account) -> Decimal:
        """Return the positive capacity available for designations."""
        return max(Decimal("0"), account.current_balance)

    def _designated_sum_for_account(
        self,
        account_id: int,
        exclude_allocation_id: int | None = None,
    ) -> Decimal:
        """Sum designated amounts for an account."""
        total = Decimal("0")
        for allocation in self._allocation_repository.list_by_account_id(
            account_id,
        ):
            if (
                exclude_allocation_id is not None
                and allocation.id == exclude_allocation_id
            ):
                continue
            total += allocation.amount
        return total

    def _funded_amounts_for_account(
        self,
        account: Account,
        allocations: list[GoalAllocation],
    ) -> dict[int, Decimal]:
        """Apply ordered funding for one account's allocations."""
        remaining = self._available_capacity(account)
        funded: dict[int, Decimal] = {}
        ordered = sorted(
            allocations,
            key=lambda item: (item.created_at, item.id),
        )
        for allocation in ordered:
            amount = min(allocation.amount, remaining)
            funded[allocation.id] = amount
            remaining -= amount
        return funded

    def _build_response(
        self,
        goal: FinancialGoal,
    ) -> FinancialGoalResponse:
        """Build a response with allocations and derived progress."""
        allocations = list(goal.allocations)
        if not allocations:
            return FinancialGoalResponse(
                id=goal.id,
                name=goal.name,
                target_amount=goal.target_amount,
                currency=goal.currency,
                target_date=goal.target_date,
                created_at=goal.created_at,
                allocations=[],
                current_amount=None,
                progress=None,
                completed=None,
            )

        accounts: dict[int, Account] = {}
        funded_by_id: dict[int, Decimal] = {}
        for allocation in allocations:
            account_id = allocation.account_id
            if account_id in accounts:
                continue
            account = allocation.account
            if account is None:
                account = self._account_repository.get_by_id(account_id)
            if account is None:
                raise AccountNotFoundError(
                    f"Account {account_id} not found",
                )
            accounts[account_id] = account
            account_allocations = (
                self._allocation_repository.list_by_account_id(
                    account_id,
                )
            )
            funded_by_id.update(
                self._funded_amounts_for_account(
                    account,
                    account_allocations,
                ),
            )

        allocation_responses: list[GoalAllocationResponse] = []
        current_amount = Decimal("0")
        for allocation in sorted(
            allocations,
            key=lambda item: (item.created_at, item.id),
        ):
            funded_amount = funded_by_id[allocation.id]
            current_amount += funded_amount
            allocation_responses.append(
                GoalAllocationResponse(
                    id=allocation.id,
                    goal_id=allocation.goal_id,
                    account_id=allocation.account_id,
                    amount=allocation.amount,
                    funded_amount=funded_amount,
                    created_at=allocation.created_at,
                ),
            )

        raw_progress = current_amount / goal.target_amount
        progress = max(
            Decimal("0"),
            min(Decimal("1"), raw_progress),
        )
        completed = current_amount >= goal.target_amount
        return FinancialGoalResponse(
            id=goal.id,
            name=goal.name,
            target_amount=goal.target_amount,
            currency=goal.currency,
            target_date=goal.target_date,
            created_at=goal.created_at,
            allocations=allocation_responses,
            current_amount=current_amount,
            progress=progress,
            completed=completed,
        )

    def create(
        self,
        data: FinancialGoalCreate,
    ) -> FinancialGoalResponse:
        """Persist a new financial goal from incoming data."""
        goal = self._repository.create(
            name=data.name,
            target_amount=data.target_amount,
            currency=data.currency,
            target_date=data.target_date,
        )
        loaded = self._repository.get_by_id(goal.id)
        assert loaded is not None
        return self._build_response(loaded)

    def list_all(self) -> list[FinancialGoalResponse]:
        """Return every stored financial goal."""
        goals = self._repository.list_all()
        return [self._build_response(goal) for goal in goals]

    def get_by_id(
        self,
        goal_id: int,
    ) -> FinancialGoalResponse | None:
        """Return one stored financial goal, if it exists."""
        goal = self._repository.get_by_id(goal_id)
        if goal is None:
            return None
        return self._build_response(goal)

    def update(
        self,
        goal_id: int,
        data: FinancialGoalUpdate,
    ) -> FinancialGoalResponse | None:
        """Fully update a stored financial goal, if it exists."""
        existing = self._repository.get_by_id(goal_id)
        if existing is None:
            return None
        if (
            data.currency != existing.currency
            and existing.allocations
        ):
            raise CurrencyChangeBlockedError(
                "Goal currency cannot change while allocations exist",
            )
        updated = self._repository.update(
            goal_id=goal_id,
            name=data.name,
            target_amount=data.target_amount,
            currency=data.currency,
            target_date=data.target_date,
        )
        if updated is None:
            return None
        loaded = self._repository.get_by_id(updated.id)
        assert loaded is not None
        return self._build_response(loaded)

    def create_allocation(
        self,
        goal_id: int,
        data: GoalAllocationCreate,
    ) -> FinancialGoalResponse:
        """Create an allocation for a goal and return the goal."""
        goal = self._repository.get_by_id(goal_id)
        if goal is None:
            raise GoalNotFoundError(
                f"Financial goal {goal_id} not found",
            )

        account = self._account_repository.get_by_id_for_update(
            data.account_id,
        )
        if account is None:
            raise AccountNotFoundError(
                f"Account {data.account_id} not found",
            )
        if account.currency != goal.currency:
            raise CurrencyMismatchError(
                "Goal currency must match Account currency",
            )

        existing = self._allocation_repository.get_by_goal_and_account(
            goal_id,
            data.account_id,
        )
        if existing is not None:
            raise AllocationAlreadyExistsError(
                "Goal already has an allocation for this account",
            )

        designated = self._designated_sum_for_account(data.account_id)
        capacity = self._available_capacity(account)
        if designated + data.amount > capacity:
            raise AllocationCapacityExceededError(
                "Allocation exceeds available account balance",
            )

        self._allocation_repository.create(
            goal_id=goal_id,
            account_id=data.account_id,
            amount=data.amount,
        )
        loaded = self._repository.get_by_id(goal_id)
        assert loaded is not None
        return self._build_response(loaded)

    def update_allocation(
        self,
        goal_id: int,
        allocation_id: int,
        data: GoalAllocationUpdate,
    ) -> FinancialGoalResponse:
        """Update an allocation amount and return the goal."""
        goal = self._repository.get_by_id(goal_id)
        if goal is None:
            raise GoalNotFoundError(
                f"Financial goal {goal_id} not found",
            )

        allocation = self._allocation_repository.get_by_id(
            allocation_id,
        )
        if allocation is None or allocation.goal_id != goal_id:
            raise AllocationNotFoundError(
                f"Allocation {allocation_id} not found",
            )

        increasing = data.amount > allocation.amount
        if increasing:
            account = self._account_repository.get_by_id_for_update(
                allocation.account_id,
            )
        else:
            account = self._account_repository.get_by_id(
                allocation.account_id,
            )
        if account is None:
            raise AccountNotFoundError(
                f"Account {allocation.account_id} not found",
            )

        if increasing:
            designated = self._designated_sum_for_account(
                allocation.account_id,
                exclude_allocation_id=allocation_id,
            )
            capacity = self._available_capacity(account)
            if designated + data.amount > capacity:
                raise AllocationCapacityExceededError(
                    "Allocation exceeds available account balance",
                )

        self._allocation_repository.update_amount(
            allocation_id,
            data.amount,
        )
        loaded = self._repository.get_by_id(goal_id)
        assert loaded is not None
        return self._build_response(loaded)

    def delete_allocation(
        self,
        goal_id: int,
        allocation_id: int,
    ) -> FinancialGoalResponse:
        """Delete an allocation and return the goal."""
        goal = self._repository.get_by_id(goal_id)
        if goal is None:
            raise GoalNotFoundError(
                f"Financial goal {goal_id} not found",
            )

        allocation = self._allocation_repository.get_by_id(
            allocation_id,
        )
        if allocation is None or allocation.goal_id != goal_id:
            raise AllocationNotFoundError(
                f"Allocation {allocation_id} not found",
            )

        self._allocation_repository.delete(allocation_id)
        loaded = self._repository.get_by_id(goal_id)
        assert loaded is not None
        return self._build_response(loaded)
