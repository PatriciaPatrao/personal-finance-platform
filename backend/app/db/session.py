"""SQLAlchemy engine and request-scoped database sessions."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


def _with_psycopg2_driver(database_url: str) -> str:
    """Use psycopg2, the PostgreSQL driver installed for this API."""
    prefix = "postgresql://"
    driver = "postgresql+psycopg2://"

    if database_url.startswith(prefix):
        return driver + database_url[len(prefix):]
    
    return database_url


engine = create_engine(
    _with_psycopg2_driver(settings.database_url)
)

SessionLocal = sessionmaker(
    bind=engine, 
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """Yield a session and close it after the request."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
