"""Expected recurring financial commitments.

This MVP stores one fixed expected amount per recurring expense.
A later iteration may represent amounts that vary by occurrence,
such as utilities, without replacing this column.
"""

import enum
from datetime import date
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean
from sqlalchemy import CheckConstraint
from sqlalchemy import Date
from sqlalchemy import DateTime
from sqlalchemy import Enum
from sqlalchemy import ForeignKey
from sqlalchemy import Numeric
from sqlalchemy import String
from sqlalchemy import func
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base


class RecurringFrequency(enum.Enum):
    """How often the commitment is expected to repeat."""

    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class RecurringExpense(Base):
    """One expected future recurring financial commitment.

    MVP assumes a fixed expected amount. Variable amounts between
    occurrences (for example utilities) remain a future capability.
    """

    __tablename__ = "recurring_expenses"
    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_recurring_expenses_amount_positive",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        nullable=False,
    )
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id"),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )
    category: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    frequency: Mapped[RecurringFrequency] = mapped_column(
        Enum(
            RecurringFrequency,
            name="recurring_frequency_enum",
        ),
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    next_occurrence: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    end_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    account: Mapped["Account"] = relationship(
        back_populates="recurring_expenses",
    )
