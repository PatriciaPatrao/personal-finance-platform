"""create incomes table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-03 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the incomes table and frequency enum."""
    income_frequency_enum = sa.Enum(
        "WEEKLY",
        "MONTHLY",
        "YEARLY",
        name="income_frequency_enum",
    )
    op.create_table(
        "incomes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column(
            "amount",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
        ),
        sa.Column(
            "frequency",
            income_frequency_enum,
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
            name="ck_incomes_amount_positive",
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name="fk_incomes_account_id_accounts",
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Remove the incomes table and frequency enum."""
    op.drop_table("incomes")
    sa.Enum(name="income_frequency_enum").drop(
        op.get_bind(),
        checkfirst=True,
    )
