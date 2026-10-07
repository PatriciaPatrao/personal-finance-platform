"""Financial goals that name a future objective.

Progress and completion are derived from an associated Account
when one exists. This model does not store a current amount,
completed flag, or active flag.
"""

from datetime import date
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint
from sqlalchemy import Date
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Index
from sqlalchemy import Numeric
from sqlalchemy import String
from sqlalchemy import func
from sqlalchemy import text
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base


class FinancialGoal(Base):
    """One future financial objective."""

    __tablename__ = "financial_goals"
    __table_args__ = (
        CheckConstraint(
            "target_amount > 0",
            name="ck_financial_goals_target_amount_positive",
        ),
        Index(
            "uq_financial_goals_account_id",
            "account_id",
            unique=True,
            postgresql_where=text("account_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    target_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="EUR",
        server_default="EUR",
    )
    target_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    account_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "accounts.id",
            name="fk_financial_goals_account_id_accounts",
        ),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    account: Mapped["Account | None"] = relationship(
        back_populates="financial_goal",
    )
