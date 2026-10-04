"""add account current_balance

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-03 15:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add current_balance to accounts."""
    op.add_column(
        "accounts",
        sa.Column(
            "current_balance",
            sa.Numeric(precision=12, scale=2),
            server_default="0",
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Remove current_balance from accounts."""
    op.drop_column("accounts", "current_balance")
