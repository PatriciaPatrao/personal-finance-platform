"""Records materialized schedule occurrences."""

import enum
from datetime import date
from datetime import datetime

from sqlalchemy import Date
from sqlalchemy import DateTime
from sqlalchemy import Enum
from sqlalchemy import ForeignKey
from sqlalchemy import UniqueConstraint
from sqlalchemy import func
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base


class ScheduleSourceType(enum.Enum):
    """Which schedule table an execution refers to."""

    INCOME = "income"
    RECURRING_EXPENSE = "recurring_expense"


class ScheduleExecution(Base):
    """One executed schedule occurrence linked to a transaction."""

    __tablename__ = "schedule_executions"
    __table_args__ = (
        UniqueConstraint(
            "source_type",
            "source_id",
            "occurrence_date",
            name="uq_schedule_executions_occurrence",
        ),
        UniqueConstraint(
            "transaction_id",
            name="uq_schedule_executions_transaction_id",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        nullable=False,
    )
    source_type: Mapped[ScheduleSourceType] = mapped_column(
        Enum(
            ScheduleSourceType,
            values_callable=lambda enum: [item.value for item in enum],
            name="schedule_source_type_enum",
        ),
        nullable=False,
    )
    source_id: Mapped[int] = mapped_column(
        nullable=False,
    )
    occurrence_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    transaction: Mapped["Transaction"] = relationship()
