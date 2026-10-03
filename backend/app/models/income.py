"""Expected future salary records.

This domain stores salary only. Other income categories remain
separate future features.
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
from sqlalchemy import func
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base


class IncomeFrequency(enum.Enum):
    """How often the salary is expected to repeat."""

    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class Income(Base):
    """One expected future salary for an account."""

    __tablename__ = "incomes"
    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_incomes_amount_positive",
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
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )
    frequency: Mapped[IncomeFrequency] = mapped_column(
        Enum(
            IncomeFrequency,
            name="income_frequency_enum",
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
        back_populates="incomes",
    )
