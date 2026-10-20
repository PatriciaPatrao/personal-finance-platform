"""Tests for PostgreSQL connection URL normalization."""

from app.db.session import _with_psycopg2_driver


def test_with_psycopg2_driver_from_postgresql_scheme() -> None:
    url = "postgresql://user:pass@host:5432/db?sslmode=require"
    assert _with_psycopg2_driver(url) == (
        "postgresql+psycopg2://user:pass@host:5432/db?sslmode=require"
    )


def test_with_psycopg2_driver_from_postgres_scheme() -> None:
    """Neon and some hosts emit postgres:// instead of postgresql://."""
    url = "postgres://user:pass@ep.example.neon.tech/neondb?sslmode=require"
    assert _with_psycopg2_driver(url) == (
        "postgresql+psycopg2://user:pass@ep.example.neon.tech/"
        "neondb?sslmode=require"
    )


def test_with_psycopg2_driver_idempotent_when_driver_present() -> None:
    url = "postgresql+psycopg2://user:pass@host:5432/db"
    assert _with_psycopg2_driver(url) == url
