"""Household groups users who share financial data."""

from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy import func
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base


class Household(Base):
    """One shared financial workspace."""

    __tablename__ = "households"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    memberships: Mapped[list["HouseholdMembership"]] = relationship(
        back_populates="household",
    )
