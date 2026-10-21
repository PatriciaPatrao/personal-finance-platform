"""households and auth scoping

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-10-20 18:00:00.000000

Adds households, memberships, and required household_id on accounts and
financial_goals. Aborts when legacy rows exist so data is not silently
assigned to a user.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision: str = "h8i9j0k1l2m3"
down_revision: Union[str, Sequence[str], None] = "g7h8i9j0k1l2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_LEGACY_TABLES = (
    "accounts",
    "financial_goals",
    "transactions",
    "incomes",
    "recurring_expenses",
    "goal_allocations",
    "schedule_executions",
)


def _assert_empty_legacy_data() -> None:
    """Fail when financial rows exist without household ownership."""
    bind = op.get_bind()
    for table in _LEGACY_TABLES:
        count = bind.execute(
            text(f"SELECT COUNT(*) FROM {table}"),
        ).scalar_one()
        if count and int(count) > 0:
            raise RuntimeError(
                "Migration h8i9j0k1l2m3 requires an empty database "
                f"or manual bootstrap: found {count} row(s) in "
                f"{table}. Do not assign global records to a user "
                "automatically.",
            )


def upgrade() -> None:
    """Create household tables and scope accounts and goals."""
    _assert_empty_legacy_data()

    household_role_enum = sa.Enum(
        "OWNER",
        "MEMBER",
        name="household_role_enum",
    )
    op.create_table(
        "households",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "household_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("user_sub", sa.String(length=255), nullable=False),
        sa.Column("role", household_role_enum, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_sub",
            name="uq_household_memberships_user_sub",
        ),
    )
    op.create_index(
        "ix_household_memberships_household_id",
        "household_memberships",
        ["household_id"],
    )

    op.add_column(
        "accounts",
        sa.Column("household_id", sa.Integer(), nullable=False),
    )
    op.create_foreign_key(
        "fk_accounts_household_id_households",
        "accounts",
        "households",
        ["household_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_accounts_household_id",
        "accounts",
        ["household_id"],
    )

    op.add_column(
        "financial_goals",
        sa.Column("household_id", sa.Integer(), nullable=False),
    )
    op.create_foreign_key(
        "fk_financial_goals_household_id_households",
        "financial_goals",
        "households",
        ["household_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_financial_goals_household_id",
        "financial_goals",
        ["household_id"],
    )


def downgrade() -> None:
    """Remove household scoping (empty database only)."""
    _assert_empty_legacy_data()

    op.drop_index(
        "ix_financial_goals_household_id",
        table_name="financial_goals",
    )
    op.drop_constraint(
        "fk_financial_goals_household_id_households",
        "financial_goals",
        type_="foreignkey",
    )
    op.drop_column("financial_goals", "household_id")

    op.drop_index("ix_accounts_household_id", table_name="accounts")
    op.drop_constraint(
        "fk_accounts_household_id_households",
        "accounts",
        type_="foreignkey",
    )
    op.drop_column("accounts", "household_id")

    op.drop_index(
        "ix_household_memberships_household_id",
        table_name="household_memberships",
    )
    op.drop_table("household_memberships")
    op.drop_table("households")
    op.execute("DROP TYPE IF EXISTS household_role_enum")
