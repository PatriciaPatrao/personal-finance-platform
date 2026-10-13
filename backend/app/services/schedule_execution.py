"""Materialize one schedule occurrence as a transaction."""

from dataclasses import dataclass
from datetime import date

from sqlalchemy.exc import IntegrityError

from app.db.session import Session
from app.models.schedule_execution import ScheduleExecution
from app.models.schedule_execution import ScheduleSourceType
from app.models.transaction import Transaction
from app.models.transaction import TransactionType
from app.repositories.income import IncomeRepository
from app.repositories.recurring_expense import RecurringExpenseRepository
from app.repositories.schedule_execution import ScheduleExecutionRepository
from app.repositories.transaction import TransactionRepository
from app.services.domain_date import current_domain_date
from app.services.schedule_occurrence import is_eligible_execution_occurrence
from app.services.transaction import TransactionService


class ScheduleNotFoundError(Exception):
    """Raised when a schedule id does not exist."""


class ScheduleInactiveError(Exception):
    """Raised when execution is attempted on an inactive schedule."""


class OccurrenceNotEligibleError(Exception):
    """Raised when the occurrence date cannot be executed."""


@dataclass(frozen=True)
class ScheduleExecutionResult:
    """Outcome of an execution request."""

    execution: ScheduleExecution
    transaction: Transaction
    created: bool


class ScheduleExecutionService:
    """Execute one schedule occurrence with idempotency."""

    def __init__(self, session: Session) -> None:
        """Bind the service to one database session."""
        self._session = session
        self._executions = ScheduleExecutionRepository(session)
        self._incomes = IncomeRepository(session)
        self._expenses = RecurringExpenseRepository(session)
        self._transactions = TransactionRepository(session)
        self._transaction_service = TransactionService(session)

    def _existing_result(
        self,
        execution: ScheduleExecution,
    ) -> ScheduleExecutionResult:
        """Build a result for an already stored execution."""
        transaction = self._transactions.get_by_id(
            execution.transaction_id,
        )
        assert transaction is not None
        return ScheduleExecutionResult(
            execution=execution,
            transaction=transaction,
            created=False,
        )

    def _execute(
        self,
        source_type: ScheduleSourceType,
        source_id: int,
        occurrence_date: date,
        *,
        account_id: int,
        amount,
        transaction_type: TransactionType,
        description: str | None,
        category: str | None,
        next_occurrence: date,
        frequency,
        end_date: date | None,
        active: bool,
        domain_date: date,
    ) -> ScheduleExecutionResult:
        existing = self._executions.get_by_occurrence(
            source_type,
            source_id,
            occurrence_date,
        )
        if existing is not None:
            return self._existing_result(existing)

        if not active:
            raise ScheduleInactiveError(
                "Schedule is inactive",
            )
        if not is_eligible_execution_occurrence(
            next_occurrence,
            frequency,
            end_date,
            occurrence_date,
            domain_date,
        ):
            raise OccurrenceNotEligibleError(
                "Occurrence date is not eligible for execution",
            )

        try:
            transaction = (
                self._transaction_service.persist_new_with_balance(
                    account_id=account_id,
                    amount=amount,
                    transaction_type=transaction_type,
                    occurred_on=occurrence_date,
                    description=description,
                    category=category,
                )
            )
            execution = self._executions.add(
                source_type=source_type,
                source_id=source_id,
                occurrence_date=occurrence_date,
                transaction_id=transaction.id,
            )
            self._session.commit()
            self._session.refresh(execution)
            self._session.refresh(transaction)
            return ScheduleExecutionResult(
                execution=execution,
                transaction=transaction,
                created=True,
            )
        except IntegrityError:
            self._session.rollback()
            existing = self._executions.get_by_occurrence(
                source_type,
                source_id,
                occurrence_date,
            )
            if existing is not None:
                return self._existing_result(existing)
            raise
        except Exception:
            self._session.rollback()
            raise

    def execute_income(
        self,
        income_id: int,
        occurrence_date: date,
        *,
        domain_date: date | None = None,
    ) -> ScheduleExecutionResult:
        """Materialize one income occurrence."""
        income = self._incomes.get_by_id(income_id)
        if income is None:
            raise ScheduleNotFoundError(
                f"Income {income_id} not found",
            )
        as_of = domain_date or current_domain_date()
        return self._execute(
            ScheduleSourceType.INCOME,
            income_id,
            occurrence_date,
            account_id=income.account_id,
            amount=income.amount,
            transaction_type=TransactionType.INCOME,
            description=None,
            category=None,
            next_occurrence=income.next_occurrence,
            frequency=income.frequency,
            end_date=income.end_date,
            active=income.active,
            domain_date=as_of,
        )

    def execute_recurring_expense(
        self,
        expense_id: int,
        occurrence_date: date,
        *,
        domain_date: date | None = None,
    ) -> ScheduleExecutionResult:
        """Materialize one recurring expense occurrence."""
        expense = self._expenses.get_by_id(expense_id)
        if expense is None:
            raise ScheduleNotFoundError(
                f"Recurring expense {expense_id} not found",
            )
        as_of = domain_date or current_domain_date()
        return self._execute(
            ScheduleSourceType.RECURRING_EXPENSE,
            expense_id,
            occurrence_date,
            account_id=expense.account_id,
            amount=expense.amount,
            transaction_type=TransactionType.EXPENSE,
            description=expense.description,
            category=expense.category,
            next_occurrence=expense.next_occurrence,
            frequency=expense.frequency,
            end_date=expense.end_date,
            active=expense.active,
            domain_date=as_of,
        )
