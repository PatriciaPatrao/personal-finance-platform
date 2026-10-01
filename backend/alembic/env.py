"""Alembic environment connected to the application database."""

import os
import re
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

from app.core.config import settings
from app.db.base import Base
from app.db.session import _with_psycopg2_driver


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _import_models() -> None:
    """Import model modules so their tables are on Base.metadata."""
    import app.models  # noqa: F401


_import_models()

database_url = _with_psycopg2_driver(settings.database_url)
# ConfigParser treats "%" as interpolation. Escape the URL.
config.set_main_option(
    "sqlalchemy.url",
    database_url.replace("%", "%%"),
)

target_metadata = Base.metadata

schema = os.environ.get("ALEMBIC_SCHEMA", "public")
if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", schema) is None:
    raise RuntimeError("ALEMBIC_SCHEMA must be a PostgreSQL identifier")


def run_migrations_offline() -> None:
    """Emit SQL for the migrations without connecting."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema=schema,
    )

    with context.begin_transaction():
        context.execute(f"SET search_path TO {schema}")
        context.run_migrations()


def run_migrations_online() -> None:
    """Apply migrations through a database connection."""
    section = config.get_section(config.config_ini_section, {})
    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_schema=schema,
        )

        with context.begin_transaction():
            context.execute(f"SET search_path TO {schema}")
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
