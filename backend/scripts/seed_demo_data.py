#!/usr/bin/env python3
"""Seed deterministic demo transactions for local development.

Creates one demo bank account and historical Transaction rows for
2026-01-01 through 2026-09-30. Safe to run repeatedly: if the demo
account already has transactions, the script exits without inserting.
"""

from __future__ import annotations

import sys
from collections import defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import func
from sqlalchemy import select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal
from app.models.account import Account
from app.models.account import AccountType
from app.models.transaction import Transaction
from app.models.transaction import TransactionType


DEMO_ACCOUNT_NAME = "Demo Main Account"
DEMO_CURRENCY = "EUR"
PERIOD_START = date(2026, 1, 1)
PERIOD_END = date(2026, 9, 30)
_ZERO = Decimal("0.00")

# Explicit seed rows: (occurred_on, type, category, description, amount).
# Amounts are exact; monthly expense totals match the validation table.
SEED_TRANSACTIONS: list[
    tuple[date, TransactionType, str, str, Decimal]
] = [
    # January — expenses 1420.00, salary 2000.00
    (
        date(2026, 1, 3),
        TransactionType.EXPENSE,
        "Housing",
        "Rent",
        Decimal("750.00"),
    ),
    (
        date(2026, 1, 5),
        TransactionType.EXPENSE,
        "Food",
        "Groceries",
        Decimal("185.00"),
    ),
    (
        date(2026, 1, 8),
        TransactionType.EXPENSE,
        "Food",
        "Supermarket",
        Decimal("95.00"),
    ),
    (
        date(2026, 1, 10),
        TransactionType.EXPENSE,
        "Transport",
        "Fuel",
        Decimal("55.00"),
    ),
    (
        date(2026, 1, 12),
        TransactionType.EXPENSE,
        "Transport",
        "Public transport",
        Decimal("40.00"),
    ),
    (
        date(2026, 1, 15),
        TransactionType.EXPENSE,
        "Utilities",
        "Electricity",
        Decimal("85.00"),
    ),
    (
        date(2026, 1, 16),
        TransactionType.EXPENSE,
        "Utilities",
        "Water",
        Decimal("25.00"),
    ),
    (
        date(2026, 1, 18),
        TransactionType.EXPENSE,
        "Telecom",
        "Internet",
        Decimal("35.00"),
    ),
    (
        date(2026, 1, 19),
        TransactionType.EXPENSE,
        "Telecom",
        "Mobile phone",
        Decimal("20.00"),
    ),
    (
        date(2026, 1, 20),
        TransactionType.EXPENSE,
        "Subscriptions",
        "Streaming subscription",
        Decimal("15.00"),
    ),
    (
        date(2026, 1, 22),
        TransactionType.EXPENSE,
        "Sport",
        "Gym",
        Decimal("40.00"),
    ),
    (
        date(2026, 1, 25),
        TransactionType.EXPENSE,
        "Health",
        "Pharmacy",
        Decimal("30.00"),
    ),
    (
        date(2026, 1, 28),
        TransactionType.EXPENSE,
        "Food",
        "Restaurant",
        Decimal("45.00"),
    ),
    (
        date(2026, 1, 30),
        TransactionType.INCOME,
        "Salary",
        "Salary",
        Decimal("2000.00"),
    ),
    # February — expenses 1510.00, salary 2000.00
    (
        date(2026, 2, 2),
        TransactionType.EXPENSE,
        "Housing",
        "Rent",
        Decimal("750.00"),
    ),
    (
        date(2026, 2, 4),
        TransactionType.EXPENSE,
        "Food",
        "Groceries",
        Decimal("310.00"),
    ),
    (
        date(2026, 2, 9),
        TransactionType.EXPENSE,
        "Transport",
        "Fuel",
        Decimal("70.00"),
    ),
    (
        date(2026, 2, 12),
        TransactionType.EXPENSE,
        "Utilities",
        "Electricity",
        Decimal("90.00"),
    ),
    (
        date(2026, 2, 14),
        TransactionType.EXPENSE,
        "Telecom",
        "Internet",
        Decimal("35.00"),
    ),
    (
        date(2026, 2, 15),
        TransactionType.EXPENSE,
        "Telecom",
        "Mobile phone",
        Decimal("20.00"),
    ),
    (
        date(2026, 2, 16),
        TransactionType.EXPENSE,
        "Subscriptions",
        "Streaming subscription",
        Decimal("15.00"),
    ),
    (
        date(2026, 2, 18),
        TransactionType.EXPENSE,
        "Sport",
        "Gym",
        Decimal("40.00"),
    ),
    (
        date(2026, 2, 20),
        TransactionType.EXPENSE,
        "Health",
        "Pharmacy",
        Decimal("25.00"),
    ),
    (
        date(2026, 2, 22),
        TransactionType.EXPENSE,
        "Shopping",
        "Clothing",
        Decimal("80.00"),
    ),
    (
        date(2026, 2, 24),
        TransactionType.EXPENSE,
        "Food",
        "Restaurant",
        Decimal("55.00"),
    ),
    (
        date(2026, 2, 26),
        TransactionType.EXPENSE,
        "Entertainment",
        "Cinema",
        Decimal("20.00"),
    ),
    (
        date(2026, 2, 27),
        TransactionType.INCOME,
        "Salary",
        "Salary",
        Decimal("2000.00"),
    ),
    # March — expenses 1380.00, salary 2000.00
    (
        date(2026, 3, 2),
        TransactionType.EXPENSE,
        "Housing",
        "Rent",
        Decimal("750.00"),
    ),
    (
        date(2026, 3, 5),
        TransactionType.EXPENSE,
        "Food",
        "Groceries",
        Decimal("195.00"),
    ),
    (
        date(2026, 3, 8),
        TransactionType.EXPENSE,
        "Food",
        "Supermarket",
        Decimal("110.00"),
    ),
    (
        date(2026, 3, 10),
        TransactionType.EXPENSE,
        "Transport",
        "Public transport",
        Decimal("45.00"),
    ),
    (
        date(2026, 3, 12),
        TransactionType.EXPENSE,
        "Utilities",
        "Electricity",
        Decimal("75.00"),
    ),
    (
        date(2026, 3, 14),
        TransactionType.EXPENSE,
        "Utilities",
        "Water",
        Decimal("25.00"),
    ),
    (
        date(2026, 3, 16),
        TransactionType.EXPENSE,
        "Telecom",
        "Internet",
        Decimal("35.00"),
    ),
    (
        date(2026, 3, 17),
        TransactionType.EXPENSE,
        "Telecom",
        "Mobile phone",
        Decimal("20.00"),
    ),
    (
        date(2026, 3, 18),
        TransactionType.EXPENSE,
        "Subscriptions",
        "Streaming subscription",
        Decimal("15.00"),
    ),
    (
        date(2026, 3, 20),
        TransactionType.EXPENSE,
        "Sport",
        "Gym",
        Decimal("40.00"),
    ),
    (
        date(2026, 3, 24),
        TransactionType.EXPENSE,
        "Health",
        "Pharmacy",
        Decimal("20.00"),
    ),
    (
        date(2026, 3, 27),
        TransactionType.EXPENSE,
        "Food",
        "Restaurant",
        Decimal("50.00"),
    ),
    (
        date(2026, 3, 31),
        TransactionType.INCOME,
        "Salary",
        "Salary",
        Decimal("2000.00"),
    ),
    # April — expenses 1760.00, salary 2000.00
    (
        date(2026, 4, 2),
        TransactionType.EXPENSE,
        "Housing",
        "Rent",
        Decimal("750.00"),
    ),
    (
        date(2026, 4, 4),
        TransactionType.EXPENSE,
        "Food",
        "Groceries",
        Decimal("210.00"),
    ),
    (
        date(2026, 4, 7),
        TransactionType.EXPENSE,
        "Food",
        "Supermarket",
        Decimal("120.00"),
    ),
    (
        date(2026, 4, 9),
        TransactionType.EXPENSE,
        "Transport",
        "Fuel",
        Decimal("115.00"),
    ),
    (
        date(2026, 4, 14),
        TransactionType.EXPENSE,
        "Utilities",
        "Electricity",
        Decimal("80.00"),
    ),
    (
        date(2026, 4, 15),
        TransactionType.EXPENSE,
        "Utilities",
        "Water",
        Decimal("30.00"),
    ),
    (
        date(2026, 4, 16),
        TransactionType.EXPENSE,
        "Telecom",
        "Internet",
        Decimal("35.00"),
    ),
    (
        date(2026, 4, 17),
        TransactionType.EXPENSE,
        "Telecom",
        "Mobile phone",
        Decimal("20.00"),
    ),
    (
        date(2026, 4, 18),
        TransactionType.EXPENSE,
        "Subscriptions",
        "Streaming subscription",
        Decimal("15.00"),
    ),
    (
        date(2026, 4, 20),
        TransactionType.EXPENSE,
        "Sport",
        "Gym",
        Decimal("40.00"),
    ),
    (
        date(2026, 4, 22),
        TransactionType.EXPENSE,
        "Sport",
        "Sports equipment",
        Decimal("180.00"),
    ),
    (
        date(2026, 4, 24),
        TransactionType.EXPENSE,
        "Health",
        "Pharmacy",
        Decimal("35.00"),
    ),
    (
        date(2026, 4, 26),
        TransactionType.EXPENSE,
        "Shopping",
        "Clothing",
        Decimal("70.00"),
    ),
    (
        date(2026, 4, 28),
        TransactionType.EXPENSE,
        "Food",
        "Restaurant",
        Decimal("40.00"),
    ),
    (
        date(2026, 4, 29),
        TransactionType.EXPENSE,
        "Entertainment",
        "Cinema",
        Decimal("20.00"),
    ),
    (
        date(2026, 4, 30),
        TransactionType.INCOME,
        "Salary",
        "Salary",
        Decimal("2000.00"),
    ),
    # May — expenses 1450.00, salary 2000.00
    (
        date(2026, 5, 2),
        TransactionType.EXPENSE,
        "Housing",
        "Rent",
        Decimal("750.00"),
    ),
    (
        date(2026, 5, 5),
        TransactionType.EXPENSE,
        "Food",
        "Groceries",
        Decimal("185.00"),
    ),
    (
        date(2026, 5, 8),
        TransactionType.EXPENSE,
        "Food",
        "Supermarket",
        Decimal("100.00"),
    ),
    (
        date(2026, 5, 10),
        TransactionType.EXPENSE,
        "Transport",
        "Fuel",
        Decimal("55.00"),
    ),
    (
        date(2026, 5, 13),
        TransactionType.EXPENSE,
        "Utilities",
        "Electricity",
        Decimal("70.00"),
    ),
    (
        date(2026, 5, 15),
        TransactionType.EXPENSE,
        "Telecom",
        "Internet",
        Decimal("35.00"),
    ),
    (
        date(2026, 5, 16),
        TransactionType.EXPENSE,
        "Telecom",
        "Mobile phone",
        Decimal("20.00"),
    ),
    (
        date(2026, 5, 17),
        TransactionType.EXPENSE,
        "Subscriptions",
        "Streaming subscription",
        Decimal("15.00"),
    ),
    (
        date(2026, 5, 19),
        TransactionType.EXPENSE,
        "Sport",
        "Gym",
        Decimal("40.00"),
    ),
    (
        date(2026, 5, 22),
        TransactionType.EXPENSE,
        "Health",
        "Pharmacy",
        Decimal("28.00"),
    ),
    (
        date(2026, 5, 24),
        TransactionType.EXPENSE,
        "Food",
        "Restaurant",
        Decimal("72.00"),
    ),
    (
        date(2026, 5, 26),
        TransactionType.EXPENSE,
        "Entertainment",
        "Cinema",
        Decimal("15.00"),
    ),
    (
        date(2026, 5, 28),
        TransactionType.EXPENSE,
        "Shopping",
        "Clothing",
        Decimal("65.00"),
    ),
    (
        date(2026, 5, 29),
        TransactionType.INCOME,
        "Salary",
        "Salary",
        Decimal("2000.00"),
    ),
    # June — expenses 1620.00, salary 2000.00
    (
        date(2026, 6, 2),
        TransactionType.EXPENSE,
        "Housing",
        "Rent",
        Decimal("750.00"),
    ),
    (
        date(2026, 6, 4),
        TransactionType.EXPENSE,
        "Food",
        "Groceries",
        Decimal("350.00"),
    ),
    (
        date(2026, 6, 9),
        TransactionType.EXPENSE,
        "Transport",
        "Fuel",
        Decimal("75.00"),
    ),
    (
        date(2026, 6, 11),
        TransactionType.EXPENSE,
        "Transport",
        "Public transport",
        Decimal("40.00"),
    ),
    (
        date(2026, 6, 13),
        TransactionType.EXPENSE,
        "Utilities",
        "Electricity",
        Decimal("95.00"),
    ),
    (
        date(2026, 6, 14),
        TransactionType.EXPENSE,
        "Utilities",
        "Water",
        Decimal("28.00"),
    ),
    (
        date(2026, 6, 16),
        TransactionType.EXPENSE,
        "Telecom",
        "Internet",
        Decimal("35.00"),
    ),
    (
        date(2026, 6, 17),
        TransactionType.EXPENSE,
        "Telecom",
        "Mobile phone",
        Decimal("20.00"),
    ),
    (
        date(2026, 6, 18),
        TransactionType.EXPENSE,
        "Subscriptions",
        "Streaming subscription",
        Decimal("15.00"),
    ),
    (
        date(2026, 6, 20),
        TransactionType.EXPENSE,
        "Sport",
        "Gym",
        Decimal("40.00"),
    ),
    (
        date(2026, 6, 23),
        TransactionType.EXPENSE,
        "Health",
        "Pharmacy",
        Decimal("32.00"),
    ),
    (
        date(2026, 6, 25),
        TransactionType.EXPENSE,
        "Shopping",
        "Clothing",
        Decimal("90.00"),
    ),
    (
        date(2026, 6, 28),
        TransactionType.EXPENSE,
        "Food",
        "Restaurant",
        Decimal("50.00"),
    ),
    (
        date(2026, 6, 30),
        TransactionType.INCOME,
        "Salary",
        "Salary",
        Decimal("2000.00"),
    ),
    # July — expenses 1900.00, salary 2000.00
    (
        date(2026, 7, 2),
        TransactionType.EXPENSE,
        "Housing",
        "Rent",
        Decimal("750.00"),
    ),
    (
        date(2026, 7, 5),
        TransactionType.EXPENSE,
        "Food",
        "Groceries",
        Decimal("370.00"),
    ),
    (
        date(2026, 7, 9),
        TransactionType.EXPENSE,
        "Transport",
        "Fuel",
        Decimal("120.00"),
    ),
    (
        date(2026, 7, 14),
        TransactionType.EXPENSE,
        "Utilities",
        "Electricity",
        Decimal("100.00"),
    ),
    (
        date(2026, 7, 15),
        TransactionType.EXPENSE,
        "Utilities",
        "Water",
        Decimal("30.00"),
    ),
    (
        date(2026, 7, 16),
        TransactionType.EXPENSE,
        "Telecom",
        "Internet",
        Decimal("35.00"),
    ),
    (
        date(2026, 7, 17),
        TransactionType.EXPENSE,
        "Telecom",
        "Mobile phone",
        Decimal("20.00"),
    ),
    (
        date(2026, 7, 18),
        TransactionType.EXPENSE,
        "Subscriptions",
        "Streaming subscription",
        Decimal("15.00"),
    ),
    (
        date(2026, 7, 20),
        TransactionType.EXPENSE,
        "Sport",
        "Gym",
        Decimal("40.00"),
    ),
    (
        date(2026, 7, 22),
        TransactionType.EXPENSE,
        "Health",
        "Pharmacy",
        Decimal("40.00"),
    ),
    (
        date(2026, 7, 24),
        TransactionType.EXPENSE,
        "Shopping",
        "Clothing",
        Decimal("305.00"),
    ),
    (
        date(2026, 7, 27),
        TransactionType.EXPENSE,
        "Food",
        "Restaurant",
        Decimal("55.00"),
    ),
    (
        date(2026, 7, 29),
        TransactionType.EXPENSE,
        "Entertainment",
        "Cinema",
        Decimal("20.00"),
    ),
    (
        date(2026, 7, 31),
        TransactionType.INCOME,
        "Salary",
        "Salary",
        Decimal("2000.00"),
    ),
    # August — expenses 1570.00, salary 2000.00
    (
        date(2026, 8, 2),
        TransactionType.EXPENSE,
        "Housing",
        "Rent",
        Decimal("750.00"),
    ),
    (
        date(2026, 8, 5),
        TransactionType.EXPENSE,
        "Food",
        "Groceries",
        Decimal("315.00"),
    ),
    (
        date(2026, 8, 9),
        TransactionType.EXPENSE,
        "Transport",
        "Fuel",
        Decimal("65.00"),
    ),
    (
        date(2026, 8, 12),
        TransactionType.EXPENSE,
        "Utilities",
        "Electricity",
        Decimal("85.00"),
    ),
    (
        date(2026, 8, 14),
        TransactionType.EXPENSE,
        "Utilities",
        "Water",
        Decimal("25.00"),
    ),
    (
        date(2026, 8, 16),
        TransactionType.EXPENSE,
        "Telecom",
        "Internet",
        Decimal("35.00"),
    ),
    (
        date(2026, 8, 17),
        TransactionType.EXPENSE,
        "Telecom",
        "Mobile phone",
        Decimal("20.00"),
    ),
    (
        date(2026, 8, 18),
        TransactionType.EXPENSE,
        "Subscriptions",
        "Streaming subscription",
        Decimal("15.00"),
    ),
    (
        date(2026, 8, 20),
        TransactionType.EXPENSE,
        "Sport",
        "Gym",
        Decimal("40.00"),
    ),
    (
        date(2026, 8, 22),
        TransactionType.EXPENSE,
        "Health",
        "Pharmacy",
        Decimal("30.00"),
    ),
    (
        date(2026, 8, 25),
        TransactionType.EXPENSE,
        "Shopping",
        "Clothing",
        Decimal("95.00"),
    ),
    (
        date(2026, 8, 27),
        TransactionType.EXPENSE,
        "Food",
        "Restaurant",
        Decimal("70.00"),
    ),
    (
        date(2026, 8, 29),
        TransactionType.EXPENSE,
        "Entertainment",
        "Cinema",
        Decimal("25.00"),
    ),
    (
        date(2026, 8, 31),
        TransactionType.INCOME,
        "Salary",
        "Salary",
        Decimal("2000.00"),
    ),
    # September — expenses 1350.00, salary 2000.00
    (
        date(2026, 9, 2),
        TransactionType.EXPENSE,
        "Housing",
        "Rent",
        Decimal("750.00"),
    ),
    (
        date(2026, 9, 5),
        TransactionType.EXPENSE,
        "Food",
        "Groceries",
        Decimal("230.00"),
    ),
    (
        date(2026, 9, 9),
        TransactionType.EXPENSE,
        "Transport",
        "Fuel",
        Decimal("65.00"),
    ),
    (
        date(2026, 9, 11),
        TransactionType.EXPENSE,
        "Transport",
        "Public transport",
        Decimal("40.00"),
    ),
    (
        date(2026, 9, 14),
        TransactionType.EXPENSE,
        "Utilities",
        "Electricity",
        Decimal("70.00"),
    ),
    (
        date(2026, 9, 16),
        TransactionType.EXPENSE,
        "Telecom",
        "Internet",
        Decimal("35.00"),
    ),
    (
        date(2026, 9, 17),
        TransactionType.EXPENSE,
        "Telecom",
        "Mobile phone",
        Decimal("20.00"),
    ),
    (
        date(2026, 9, 18),
        TransactionType.EXPENSE,
        "Subscriptions",
        "Streaming subscription",
        Decimal("15.00"),
    ),
    (
        date(2026, 9, 20),
        TransactionType.EXPENSE,
        "Sport",
        "Gym",
        Decimal("40.00"),
    ),
    (
        date(2026, 9, 23),
        TransactionType.EXPENSE,
        "Health",
        "Pharmacy",
        Decimal("25.00"),
    ),
    (
        date(2026, 9, 26),
        TransactionType.EXPENSE,
        "Food",
        "Restaurant",
        Decimal("45.00"),
    ),
    (
        date(2026, 9, 28),
        TransactionType.EXPENSE,
        "Entertainment",
        "Cinema",
        Decimal("15.00"),
    ),
    (
        date(2026, 9, 30),
        TransactionType.INCOME,
        "Salary",
        "Salary",
        Decimal("2000.00"),
    ),
]


def _as_money(value: Decimal) -> Decimal:
    """Normalize money to two decimal places."""
    return Decimal(value).quantize(_ZERO)


def _format_money(value: Decimal) -> str:
    """Format a money amount for the console summary."""
    return f"EUR {_as_money(value):,.2f}"


def _find_demo_accounts(session) -> list[Account]:
    """Return accounts matching the demo marker."""
    statement = select(Account).where(
        Account.name == DEMO_ACCOUNT_NAME,
        Account.account_type == AccountType.BANK,
        Account.currency == DEMO_CURRENCY,
    )
    return list(session.scalars(statement).all())


def _count_transactions(session, account_id: int) -> int:
    """Count transactions linked to one account."""
    statement = (
        select(func.count())
        .select_from(Transaction)
        .where(Transaction.account_id == account_id)
    )
    return int(session.scalar(statement) or 0)


def _account_totals(
    session,
    account_id: int,
) -> tuple[int, Decimal, Decimal]:
    """Return count, income total, and expense total for an account."""
    rows = session.execute(
        select(
            Transaction.transaction_type,
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .where(Transaction.account_id == account_id)
        .group_by(Transaction.transaction_type),
    ).all()
    income = _ZERO
    expenses = _ZERO
    count = _count_transactions(session, account_id)
    for transaction_type, amount in rows:
        money = _as_money(amount)
        if transaction_type == TransactionType.INCOME:
            income = money
        elif transaction_type == TransactionType.EXPENSE:
            expenses = money
    return count, income, expenses


def _print_summary(
    *,
    created: bool,
    transaction_count: int,
    income: Decimal,
    expenses: Decimal,
) -> None:
    """Print a concise seed result for the console."""
    net = _as_money(income - expenses)
    if created:
        print("Demo seed completed.")
        print(f"Account: {DEMO_ACCOUNT_NAME}")
        print(f"Transactions created: {transaction_count}")
    else:
        print(
            "Existing demo dataset detected; "
            "no duplicate data was inserted.",
        )
        print(f"Account: {DEMO_ACCOUNT_NAME}")
        print(f"Transactions present: {transaction_count}")
    print(
        f"Period: {PERIOD_START.isoformat()} -> "
        f"{PERIOD_END.isoformat()}",
    )
    print(f"Income: {_format_money(income)}")
    print(f"Expenses: {_format_money(expenses)}")
    print(f"Net cash flow: {_format_money(net)}")


def _validate_seed_dataset() -> None:
    """Fail fast if the embedded dataset is inconsistent."""
    if len(SEED_TRANSACTIONS) != 125:
        raise RuntimeError(
            "Expected 125 seed transactions, "
            f"got {len(SEED_TRANSACTIONS)}",
        )
    monthly_income: dict[tuple[int, int], Decimal] = (
        defaultdict(lambda: _ZERO)
    )
    monthly_expense: dict[tuple[int, int], Decimal] = (
        defaultdict(lambda: _ZERO)
    )
    for occurred_on, txn_type, _, _, amount in SEED_TRANSACTIONS:
        if not (PERIOD_START <= occurred_on <= PERIOD_END):
            raise RuntimeError(
                f"Seed date out of range: {occurred_on}",
            )
        key = (occurred_on.year, occurred_on.month)
        money = _as_money(amount)
        if txn_type == TransactionType.INCOME:
            monthly_income[key] += money
        else:
            monthly_expense[key] += money
    expected_expenses = {
        (2026, 1): Decimal("1420.00"),
        (2026, 2): Decimal("1510.00"),
        (2026, 3): Decimal("1380.00"),
        (2026, 4): Decimal("1760.00"),
        (2026, 5): Decimal("1450.00"),
        (2026, 6): Decimal("1620.00"),
        (2026, 7): Decimal("1900.00"),
        (2026, 8): Decimal("1570.00"),
        (2026, 9): Decimal("1350.00"),
    }
    for key, expected in expected_expenses.items():
        income = _as_money(monthly_income[key])
        expenses = _as_money(monthly_expense[key])
        if income != Decimal("2000.00"):
            raise RuntimeError(
                f"Bad income for {key}: {income}",
            )
        if expenses != expected:
            raise RuntimeError(
                f"Bad expenses for {key}: {expenses}",
            )


def seed_demo_data() -> int:
    """Insert the demo dataset once, then exit without duplicating."""
    _validate_seed_dataset()
    session = SessionLocal()
    try:
        matches = _find_demo_accounts(session)
        if len(matches) > 1:
            print(
                "Error: multiple demo accounts named "
                f"'{DEMO_ACCOUNT_NAME}' were found. "
                "Resolve the duplicates before seeding.",
            )
            return 1
        if len(matches) == 1:
            account = matches[0]
            existing = _count_transactions(session, account.id)
            if existing > 0:
                count, income, expenses = _account_totals(
                    session,
                    account.id,
                )
                _print_summary(
                    created=False,
                    transaction_count=count,
                    income=income,
                    expenses=expenses,
                )
                return 0
        else:
            account = Account(
                name=DEMO_ACCOUNT_NAME,
                account_type=AccountType.BANK,
                currency=DEMO_CURRENCY,
                current_balance=_ZERO,
            )
            session.add(account)
            session.flush()

        for (
            occurred_on,
            txn_type,
            category,
            description,
            amount,
        ) in SEED_TRANSACTIONS:
            session.add(
                Transaction(
                    account_id=account.id,
                    description=description,
                    amount=amount,
                    transaction_type=txn_type,
                    occurred_on=occurred_on,
                    category=category,
                ),
            )
        session.commit()
        count, income, expenses = _account_totals(
            session,
            account.id,
        )
        _print_summary(
            created=True,
            transaction_count=count,
            income=income,
            expenses=expenses,
        )
        return 0
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def main() -> None:
    """CLI entry point."""
    raise SystemExit(seed_demo_data())


if __name__ == "__main__":
    main()
