"""create goal_allocations and drop goal account_id

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-10-08 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add goal_allocations and remove the direct Goal.account_id link."""
    op.create_table(
        "goal_allocations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("goal_id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column(
            "amount",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "amount > 0",
            name="ck_goal_allocations_amount_positive",
        ),
        sa.ForeignKeyConstraint(
            ["goal_id"],
            ["financial_goals.id"],
            name="fk_goal_allocations_goal_id_financial_goals",
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name="fk_goal_allocations_account_id_accounts",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "goal_id",
            "account_id",
            name="uq_goal_allocations_goal_id_account_id",
        ),
    )
    op.drop_index(
        "uq_financial_goals_account_id",
        table_name="financial_goals",
    )
    op.drop_constraint(
        "fk_financial_goals_account_id_accounts",
        "financial_goals",
        type_="foreignkey",
    )
    op.drop_column("financial_goals", "account_id")


def downgrade() -> None:
    """Restore nullable Goal.account_id without recreating links."""
    op.add_column(
        "financial_goals",
        sa.Column("account_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_financial_goals_account_id_accounts",
        "financial_goals",
        "accounts",
        ["account_id"],
        ["id"],
    )
    op.create_index(
        "uq_financial_goals_account_id",
        "financial_goals",
        ["account_id"],
        unique=True,
        postgresql_where=sa.text("account_id IS NOT NULL"),
    )
    op.drop_table("goal_allocations")
