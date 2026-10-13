"""Application calendar date for Forecast as_of and schedule execution."""

from datetime import date


def current_domain_date() -> date:
    """Return today's date using the same semantics as Forecast as_of default."""
    return date.today()
