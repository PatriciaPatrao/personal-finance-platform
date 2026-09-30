"""Declarative base shared by every database model."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class that application models inherit from."""
    pass
