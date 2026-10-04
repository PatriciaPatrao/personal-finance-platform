"""Deterministic future occurrence dates from a schedule."""

from calendar import monthrange
from datetime import date
from datetime import timedelta
from enum import Enum


def add_months(start: date, months: int) -> date:
    """Advance a date by calendar months, clamping the day."""
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    last_day = monthrange(year, month)[1]
    day = min(start.day, last_day)
    return date(year, month, day)


def next_after(current: date, frequency: Enum) -> date:
    """Return the next occurrence after current for frequency."""
    value = frequency.value
    if value == "weekly":
        return current + timedelta(days=7)
    if value == "monthly":
        return add_months(current, 1)
    if value == "yearly":
        return add_months(current, 12)
    raise ValueError(f"Unsupported frequency: {value}")


def generate_occurrences(
    next_occurrence: date,
    frequency: Enum,
    end_date: date | None,
    from_date: date,
    to_date: date,
    as_of: date,
) -> list[date]:
    """Return in-range future occurrence dates from a schedule.

    Generation starts at next_occurrence. Dates before as_of, before
    from_date, or after to_date are omitted. end_date is inclusive.
    """
    occurrences: list[date] = []
    current = next_occurrence
    while current <= to_date:
        if end_date is not None and current > end_date:
            break
        if (
            current >= from_date
            and current >= as_of
        ):
            occurrences.append(current)
        current = next_after(current, frequency)
    return occurrences
