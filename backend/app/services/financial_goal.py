"""Application logic for financial goals."""

from decimal import Decimal

from app.db.session import Session
from app.models.account import Account
from app.models.financial_goal import FinancialGoal
from app.repositories.account import AccountRepository
from app.repositories.financial_goal import (
    FinancialGoalRepository,
)
from app.schemas.financial_goal import FinancialGoalCreate
from app.schemas.financial_goal import FinancialGoalResponse
from app.schemas.financial_goal import FinancialGoalUpdate


class AccountNotFoundError(Exception):
    """Raised when a goal references a missing account."""


class CurrencyMismatchError(Exception):
    """Raised when goal and account currencies differ."""


class AccountAlreadyHasGoalError(Exception):
    """Raised when an account already has a linked goal."""


class FinancialGoalService:
    """Coordinate financial goal operations."""

    def __init__(self, session: Session) -> None:
        """Bind the service to one database session."""
        self._repository = FinancialGoalRepository(session)
        self._account_repository = AccountRepository(session)

    def _validate_account_link(
        self,
        account_id: int,
        currency: str,
        exclude_goal_id: int | None = None,
    ) -> Account:
        """Require a matching free account for a goal link."""
        account = self._account_repository.get_by_id(
            account_id,
        )
        if account is None:
            raise AccountNotFoundError(
                f"Account {account_id} not found",
            )
        if account.currency != currency:
            raise CurrencyMismatchError(
                "Goal currency must match Account currency",
            )
        existing = self._repository.get_by_account_id(
            account_id,
        )
        if existing is not None:
            if (
                exclude_goal_id is None
                or existing.id != exclude_goal_id
            ):
                raise AccountAlreadyHasGoalError(
                    "Account already has a financial goal",
                )
        return account

    def _build_response(
        self,
        goal: FinancialGoal,
    ) -> FinancialGoalResponse:
        """Build a response with derived progress fields."""
        if goal.account_id is None:
            return FinancialGoalResponse(
                id=goal.id,
                name=goal.name,
                target_amount=goal.target_amount,
                currency=goal.currency,
                target_date=goal.target_date,
                account_id=None,
                created_at=goal.created_at,
                current_amount=None,
                progress=None,
                completed=None,
            )

        account = goal.account
        if account is None:
            account = self._account_repository.get_by_id(
                goal.account_id,
            )
        if account is None:
            raise AccountNotFoundError(
                f"Account {goal.account_id} not found",
            )

        current_amount = account.current_balance
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
            account_id=goal.account_id,
            created_at=goal.created_at,
            current_amount=current_amount,
            progress=progress,
            completed=completed,
        )

    def create(
        self,
        data: FinancialGoalCreate,
    ) -> FinancialGoalResponse:
        """Persist a new financial goal from incoming data."""
        if data.account_id is not None:
            self._validate_account_link(
                data.account_id,
                data.currency,
            )
        goal = self._repository.create(
            name=data.name,
            target_amount=data.target_amount,
            currency=data.currency,
            target_date=data.target_date,
            account_id=data.account_id,
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
        if data.account_id is not None:
            self._validate_account_link(
                data.account_id,
                data.currency,
                exclude_goal_id=goal_id,
            )
        updated = self._repository.update(
            goal_id=goal_id,
            name=data.name,
            target_amount=data.target_amount,
            currency=data.currency,
            target_date=data.target_date,
            account_id=data.account_id,
        )
        if updated is None:
            return None
        loaded = self._repository.get_by_id(updated.id)
        assert loaded is not None
        return self._build_response(loaded)
