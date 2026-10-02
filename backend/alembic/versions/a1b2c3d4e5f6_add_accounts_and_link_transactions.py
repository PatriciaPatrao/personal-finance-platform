"""add accounts and link transactions

Revision ID: a1b2c3d4e5f6
Revises: 8592b8780cb6
Create Date: 2026-10-02 14:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "8592b8780cb6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create accounts and attach existing transactions safely."""
    account_type_enum = sa.Enum(
        "BANK",
        "CASH",
        "CREDIT_CARD",
        "INVESTMENT",
        name="account_type_enum",
    )
    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "account_type",
            account_type_enum,
            nullable=False,
        ),
        sa.Column(
            "currency",
            sa.String(length=3),
            server_default="EUR",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column(
        "transactions",
        sa.Column("account_id", sa.Integer(), nullable=True),
    )

    connection = op.get_bind()
    null_count = connection.execute(
        sa.text(
            "SELECT COUNT(*) FROM transactions "
            "WHERE account_id IS NULL"
        ),
    ).scalar()
    if null_count and null_count > 0:
        account_id = connection.execute(
            sa.text(
                "INSERT INTO accounts "
                "(name, account_type, currency) "
                "VALUES "
                "('Unassigned', 'BANK', 'EUR') "
                "RETURNING id"
            ),
        ).scalar_one()
        connection.execute(
            sa.text(
                "UPDATE transactions "
                "SET account_id = :account_id "
                "WHERE account_id IS NULL"
            ),
            {"account_id": account_id},
        )

    op.create_foreign_key(
        "fk_transactions_account_id_accounts",
        "transactions",
        "accounts",
        ["account_id"],
        ["id"],
    )
    op.alter_column(
        "transactions",
        "account_id",
        existing_type=sa.Integer(),
        nullable=False,
    )


def downgrade() -> None:
    """Remove the account link and accounts table."""
    op.drop_constraint(
        "fk_transactions_account_id_accounts",
        "transactions",
        type_="foreignkey",
    )
    op.drop_column("transactions", "account_id")
    op.drop_table("accounts")
    sa.Enum(name="account_type_enum").drop(
        op.get_bind(),
        checkfirst=True,
    )
