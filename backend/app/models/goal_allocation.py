"""Designation of existing Account money toward a Goal.

A GoalAllocation does not create, move, or reserve physical money.
Account.current_balance remains the source of truth.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Numeric
from sqlalchemy import UniqueConstraint
from sqlalchemy import func
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base


class GoalAllocation(Base):
    """One designation of Account money to a Financial Goal."""

    __tablename__ = "goal_allocations"
    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_goal_allocations_amount_positive",
        ),
        UniqueConstraint(
            "goal_id",
            "account_id",
            name="uq_goal_allocations_goal_id_account_id",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        nullable=False,
    )
    goal_id: Mapped[int] = mapped_column(
        ForeignKey(
            "financial_goals.id",
            name="fk_goal_allocations_goal_id_financial_goals",
        ),
        nullable=False,
    )
    account_id: Mapped[int] = mapped_column(
        ForeignKey(
            "accounts.id",
            name="fk_goal_allocations_account_id_accounts",
        ),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    goal: Mapped["FinancialGoal"] = relationship(
        back_populates="allocations",
    )
    account: Mapped["Account"] = relationship(
        back_populates="goal_allocations",
    )
