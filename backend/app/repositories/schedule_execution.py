"""Persistence for schedule execution records."""

from datetime import date

from sqlalchemy import select

from app.db.session import Session
from app.models.schedule_execution import ScheduleExecution
from app.models.schedule_execution import ScheduleSourceType


class ScheduleExecutionRepository:
    """Store and query schedule execution rows."""

    def __init__(self, session: Session) -> None:
        """Bind the repository to one database session."""
        self._session = session

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
        return self._session.scalars(statement).one_or_none()

    def list_all(self) -> list[ScheduleExecution]:
        """Return every execution row."""
        statement = select(ScheduleExecution)
        return list(self._session.scalars(statement).all())

    def get_by_transaction_id(
        self,
        transaction_id: int,
    ) -> ScheduleExecution | None:
        """Return an execution linked to a transaction, if any."""
        statement = select(ScheduleExecution).where(
            ScheduleExecution.transaction_id == transaction_id,
        )
        return self._session.scalars(statement).one_or_none()

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
