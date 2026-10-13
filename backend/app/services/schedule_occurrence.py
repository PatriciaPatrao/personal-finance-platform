"""Validation helpers for schedule occurrence dates."""

from datetime import date
from enum import Enum

from app.services.occurrence import generate_occurrences
from app.services.occurrence import next_after


def is_occurrence_on_schedule_grid(
    next_occurrence: date,
    frequency: Enum,
    end_date: date | None,
    occurrence_date: date,
) -> bool:
    """Return whether occurrence_date is a valid step on the schedule grid."""
    if occurrence_date < next_occurrence:
        return False
    if end_date is not None and occurrence_date > end_date:
        return False
    current = next_occurrence
    while current <= occurrence_date:
        if current == occurrence_date:
            return True
        if end_date is not None and current > end_date:
            return False
        current = next_after(current, frequency)
    return False


def is_eligible_execution_occurrence(
    next_occurrence: date,
    frequency: Enum,
    end_date: date | None,
    occurrence_date: date,
    current_domain_date: date,
) -> bool:
    """Return whether an occurrence may be executed on current_domain_date."""
    if occurrence_date != current_domain_date:
        return False
    return is_occurrence_on_schedule_grid(
        next_occurrence,
        frequency,
        end_date,
        occurrence_date,
    )


def occurrence_would_project_on_date(
    next_occurrence: date,
    frequency: Enum,
    end_date: date | None,
    occurrence_date: date,
    as_of: date,
) -> bool:
    """Return whether Forecast would include this date for as_of."""
    dates = generate_occurrences(
        next_occurrence,
        frequency,
        end_date,
        occurrence_date,
        occurrence_date,
        as_of,
    )
    return occurrence_date in dates
