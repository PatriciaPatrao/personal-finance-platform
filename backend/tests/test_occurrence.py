"""Unit tests for occurrence date stepping."""

from datetime import date

from app.models.income import IncomeFrequency
from app.services.occurrence import add_months
from app.services.occurrence import generate_occurrences
from app.services.occurrence import next_after


def test_add_months_clamps_january_31_to_february() -> None:
    """January 31 plus one month lands on February's last day."""
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)


def test_add_months_uses_leap_day_when_present() -> None:
    """January 31 plus one month uses 29 February in a leap year."""
    assert add_months(date(2028, 1, 31), 1) == date(2028, 2, 29)


def test_next_after_weekly_adds_seven_days() -> None:
    """Weekly frequency advances by seven days."""
    assert next_after(
        date(2026, 10, 3),
        IncomeFrequency.WEEKLY,
    ) == date(2026, 10, 10)


def test_generate_occurrences_stops_on_inclusive_end_date() -> None:
    """Occurrences after end_date are not generated."""
    dates = generate_occurrences(
        next_occurrence=date(2026, 1, 1),
        frequency=IncomeFrequency.MONTHLY,
        end_date=date(2026, 2, 1),
        from_date=date(2026, 1, 1),
        to_date=date(2026, 6, 1),
        as_of=date(2026, 1, 1),
    )
    assert dates == [date(2026, 1, 1), date(2026, 2, 1)]


def test_generate_occurrences_skips_dates_before_as_of() -> None:
    """Past occurrences are not future expectations."""
    dates = generate_occurrences(
        next_occurrence=date(2026, 1, 1),
        frequency=IncomeFrequency.WEEKLY,
        end_date=None,
        from_date=date(2026, 1, 1),
        to_date=date(2026, 1, 20),
        as_of=date(2026, 1, 10),
    )
    assert dates == [date(2026, 1, 15)]
