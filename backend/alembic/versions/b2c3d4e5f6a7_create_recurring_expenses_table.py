"""create recurring expenses table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-02 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the recurring_expenses table and frequency enum."""
    recurring_frequency_enum = sa.Enum(
        "WEEKLY",
        "MONTHLY",
        "YEARLY",
        name="recurring_frequency_enum",
    )
    op.create_table(
        "recurring_expenses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column(
            "description",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "amount",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "frequency",
            recurring_frequency_enum,
            nullable=False,
        ),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column(
            "next_occurrence",
            sa.Date(),
            nullable=False,
        ),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column(
            "active",
            sa.Boolean(),
            server_default="true",
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
            name="ck_recurring_expenses_amount_positive",
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name="fk_recurring_expenses_account_id_accounts",
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Remove the recurring_expenses table and frequency enum."""
    op.drop_table("recurring_expenses")
    sa.Enum(name="recurring_frequency_enum").drop(
        op.get_bind(),
        checkfirst=True,
    )
