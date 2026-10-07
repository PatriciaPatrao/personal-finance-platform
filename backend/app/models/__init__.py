"""Import models so they register on the shared metadata."""

from app.models.account import Account
from app.models.financial_goal import FinancialGoal
from app.models.income import Income
from app.models.recurring_expense import RecurringExpense
from app.models.transaction import Transaction

__all__ = [
    "Account",
    "FinancialGoal",
    "Income",
    "RecurringExpense",
    "Transaction",
]
