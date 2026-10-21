"""Links an identity-provider subject to a household and role."""

import enum
from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy import Enum
from sqlalchemy import ForeignKey
from sqlalchemy import String
from sqlalchemy import UniqueConstraint
from sqlalchemy import func
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base


class HouseholdRole(enum.Enum):
    """Permissions within one household."""

    OWNER = "owner"
    MEMBER = "member"


class HouseholdMembership(Base):
    """One user's membership in one household."""

    __tablename__ = "household_memberships"
    __table_args__ = (
        UniqueConstraint(
            "user_sub",
            name="uq_household_memberships_user_sub",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        nullable=False,
    )
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_sub: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    role: Mapped[HouseholdRole] = mapped_column(
        Enum(HouseholdRole, name="household_role_enum"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    household: Mapped["Household"] = relationship(
        back_populates="memberships",
    )
