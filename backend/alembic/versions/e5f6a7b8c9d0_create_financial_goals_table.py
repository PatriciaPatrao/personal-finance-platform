"""create financial goals table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-07 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the financial_goals table and MVP account uniqueness."""
    op.create_table(
        "financial_goals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "target_amount",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
        ),
        sa.Column(
            "currency",
            sa.String(length=3),
            server_default="EUR",
            nullable=False,
        ),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("account_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "target_amount > 0",
            name="ck_financial_goals_target_amount_positive",
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name="fk_financial_goals_account_id_accounts",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_financial_goals_account_id",
        "financial_goals",
        ["account_id"],
        unique=True,
        postgresql_where=sa.text("account_id IS NOT NULL"),
    )


def downgrade() -> None:
    """Remove the financial_goals table and MVP account uniqueness."""
    op.drop_index(
        "uq_financial_goals_account_id",
        table_name="financial_goals",
    )
    op.drop_table("financial_goals")
