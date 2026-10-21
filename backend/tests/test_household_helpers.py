"""Create household rows in ORM tests."""

from sqlalchemy.orm import Session

from app.models.household import Household

_HOUSEHOLD_KEY = "_pfp_test_household_id"


def household_id_for_session(session: Session) -> int:
    """Return one household id per session (reused within a test)."""
    if _HOUSEHOLD_KEY not in session.info:
        household = Household()
        session.add(household)
        session.flush()
        session.info[_HOUSEHOLD_KEY] = household.id
    return int(session.info[_HOUSEHOLD_KEY])
