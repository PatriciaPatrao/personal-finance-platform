"""Persistence for schedule execution records."""

from collections.abc import Iterable
from datetime import date

from sqlalchemy import select

from app.db.session import Session
from app.models.account import Account
from app.models.schedule_execution import ScheduleExecution
from app.models.schedule_execution import ScheduleSourceType
from app.models.transaction import Transaction


class ScheduleExecutionRepository:
    """Store and query schedule execution rows for one household."""

    def __init__(
        self,
        session: Session,
        household_id: int,
    ) -> None:
        """Bind the repository to one database session."""
        self._session = session
        self._household_id = household_id

    def get_by_occurrence(
        self,
        source_type: ScheduleSourceType,
        source_id: int,
        occurrence_date: date,
    ) -> ScheduleExecution | None:
        """Return an execution for the given occurrence identity, if any."""
        statement = select(ScheduleExecution).where(
            ScheduleExecution.source_type == source_type,
            ScheduleExecution.source_id == source_id,
            ScheduleExecution.occurrence_date == occurrence_date,
        )
        execution = self._session.scalars(statement).one_or_none()
        if execution is None:
            return None
        if not self._execution_in_household(execution):
            return None
        return execution

    def _execution_in_household(
        self,
        execution: ScheduleExecution,
    ) -> bool:
        """Return True when the execution's transaction is in-household."""
        statement = (
            select(Transaction.id)
            .join(Account, Transaction.account_id == Account.id)
            .where(
                Transaction.id == execution.transaction_id,
                Account.household_id == self._household_id,
            )
        )
        return self._session.scalars(statement).one_or_none() is not None

    def list_all(self) -> list[ScheduleExecution]:
        """Return every execution row in this household."""
        statement = (
            select(ScheduleExecution)
            .join(
                Transaction,
                ScheduleExecution.transaction_id == Transaction.id,
            )
            .join(Account, Transaction.account_id == Account.id)
            .where(Account.household_id == self._household_id)
        )
        return list(self._session.scalars(statement).all())

    def get_by_transaction_id(
        self,
        transaction_id: int,
    ) -> ScheduleExecution | None:
        """Return an execution linked to a household transaction."""
        statement = (
            select(ScheduleExecution)
            .join(
                Transaction,
                ScheduleExecution.transaction_id == Transaction.id,
            )
            .join(Account, Transaction.account_id == Account.id)
            .where(
                ScheduleExecution.transaction_id == transaction_id,
                Account.household_id == self._household_id,
            )
        )
        return self._session.scalars(statement).one_or_none()

    def linked_transaction_ids(
        self,
        transaction_ids: Iterable[int],
    ) -> set[int]:
        """Return linked transaction ids that belong to this household."""
        ids = list(transaction_ids)
        if not ids:
            return set()
        statement = (
            select(ScheduleExecution.transaction_id)
            .join(
                Transaction,
                ScheduleExecution.transaction_id == Transaction.id,
            )
            .join(Account, Transaction.account_id == Account.id)
            .where(
                ScheduleExecution.transaction_id.in_(ids),
                Account.household_id == self._household_id,
            )
        )
        return set(self._session.scalars(statement).all())

    def add(
        self,
        source_type: ScheduleSourceType,
        source_id: int,
        occurrence_date: date,
        transaction_id: int,
    ) -> ScheduleExecution:
        """Attach a new execution row to the current session."""
        execution = ScheduleExecution(
            source_type=source_type,
            source_id=source_id,
            occurrence_date=occurrence_date,
            transaction_id=transaction_id,
        )
        self._session.add(execution)
        return execution
