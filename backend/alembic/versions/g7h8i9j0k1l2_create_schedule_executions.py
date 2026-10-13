"""create schedule_executions

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-10-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "g7h8i9j0k1l2"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create schedule_executions and source type enum."""
    schedule_source_type_enum = postgresql.ENUM(
        "income",
        "recurring_expense",
        name="schedule_source_type_enum",
        create_type=False,
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE schedule_source_type_enum AS ENUM "
        "('income', 'recurring_expense'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$;",
    )
    op.create_table(
        "schedule_executions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "source_type",
            schedule_source_type_enum,
            nullable=False,
        ),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("occurrence_date", sa.Date(), nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transactions.id"],
            name="fk_schedule_executions_transaction_id",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_type",
            "source_id",
            "occurrence_date",
            name="uq_schedule_executions_occurrence",
        ),
        sa.UniqueConstraint(
            "transaction_id",
            name="uq_schedule_executions_transaction_id",
        ),
    )


def downgrade() -> None:
    """Drop schedule_executions."""
    op.drop_table("schedule_executions")
    sa.Enum(name="schedule_source_type_enum").drop(
        op.get_bind(),
        checkfirst=True,
    )
