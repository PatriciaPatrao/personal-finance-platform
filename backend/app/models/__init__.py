"""Import models so they register on the shared metadata."""

from app.models.account import Account
from app.models.financial_goal import FinancialGoal
from app.models.household import Household
from app.models.household_invitation import HouseholdInvitation
from app.models.household_membership import HouseholdMembership
from app.models.household_membership import HouseholdRole
from app.models.goal_allocation import GoalAllocation
from app.models.income import Income
from app.models.recurring_expense import RecurringExpense
from app.models.schedule_execution import ScheduleExecution
from app.models.schedule_execution import ScheduleSourceType
from app.models.transaction import Transaction

__all__ = [
    "Account",
    "FinancialGoal",
    "Household",
    "HouseholdInvitation",
    "HouseholdMembership",
    "HouseholdRole",
    "GoalAllocation",
    "Income",
    "RecurringExpense",
    "ScheduleExecution",
    "ScheduleSourceType",
    "Transaction",
]
