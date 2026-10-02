"""Financial accounts that hold transactions."""

import enum
from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy import Enum
from sqlalchemy import String
from sqlalchemy import func
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base


class AccountType(enum.Enum):
    """What kind of account holds the money."""

    BANK = "bank"
    CASH = "cash"
    CREDIT_CARD = "credit_card"
    INVESTMENT = "investment"


class Account(Base):
    """One place where money is held."""

    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    account_type: Mapped[AccountType] = mapped_column(
        Enum(AccountType, name="account_type_enum"),
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="EUR",
        server_default="EUR",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="account",
    )
