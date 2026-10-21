"""Schedule occurrence execution API tests."""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date
from datetime import timedelta
from decimal import Decimal
import threading
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func
from sqlalchemy import select
from app.models.account import Account
from app.models.schedule_execution import ScheduleExecution
from app.models.schedule_execution import ScheduleSourceType
from app.models.transaction import Transaction
from app.repositories.schedule_execution import ScheduleExecutionRepository
from app.services.schedule_execution import ScheduleExecutionResult
from app.services.schedule_execution import ScheduleExecutionService
from tests.conftest import SessionLocal


class _InitialAbsenceSynchroniser:
    """Barrier the first N absence checks across concurrent workers."""

    def __init__(
        self,
        parties: int = 2,
        timeout: float = 15.0,
    ) -> None:
        self._barrier = threading.Barrier(parties)
        self._lock = threading.Lock()
        self._absence_checks = 0
        self._parties = parties
        self._timeout = timeout

    @contextmanager
    def patch(self) -> Iterator[None]:
        """Wrap occurrence lookup so concurrent absence checks align."""
        original = ScheduleExecutionRepository.get_by_occurrence

        def wrapped(
            repo: ScheduleExecutionRepository,
            source_type: ScheduleSourceType,
            source_id: int,
            occurrence_date: date,
        ) -> ScheduleExecution | None:
            result = original(
                repo,
                source_type,
                source_id,
                occurrence_date,
            )
            if result is not None:
                return result
            with self._lock:
                self._absence_checks += 1
                synchronise = self._absence_checks <= self._parties
            if synchronise:
                self._barrier.wait(timeout=self._timeout)
            return result

        with patch.object(
            ScheduleExecutionRepository,
            "get_by_occurrence",
            wrapped,
        ):
            yield


def _household_id_for_account(account_id: int) -> int:
    """Read household_id for an account from a fresh session."""
    session = SessionLocal()
    try:
        account = session.get(Account, account_id)
        assert account is not None
        return account.household_id
    finally:
        session.close()


def _account_balance(account_id: int) -> Decimal:
    """Read stored balance from a fresh session."""
    session = SessionLocal()
    try:
        account = session.get(Account, account_id)
        assert account is not None
        return account.current_balance
    finally:
        session.close()


def _execution_count_for_occurrence(
    source_type: ScheduleSourceType,
    source_id: int,
    occurrence_date: date,
) -> int:
    """Count persisted executions for one occurrence identity."""
    session = SessionLocal()
    try:
        statement = (
            select(func.count())
            .select_from(ScheduleExecution)
            .where(
                ScheduleExecution.source_type == source_type,
                ScheduleExecution.source_id == source_id,
                ScheduleExecution.occurrence_date == occurrence_date,
            )
        )
        return int(session.scalar(statement) or 0)
    finally:
        session.close()


def _transaction_count() -> int:
    """Count all persisted transactions."""
    session = SessionLocal()
    try:
        statement = select(func.count()).select_from(Transaction)
        return int(session.scalar(statement) or 0)
    finally:
        session.close()


def _assert_same_occurrence_race_outcome(
    results: list[ScheduleExecutionResult],
    errors: list[BaseException],
    *,
    account_id: int,
    starting_balance: Decimal,
    expected_delta: Decimal,
    source_type: ScheduleSourceType,
    source_id: int,
    occurrence_date: date,
) -> None:
    """Assert one committed execution and matching service outcomes."""
    assert errors == []
    assert len(results) == 2
    assert sorted(result.created for result in results) == [
        False,
        True,
    ]
    first, second = results
    assert first.execution.id == second.execution.id
    assert first.transaction.id == second.transaction.id
    assert (
        _execution_count_for_occurrence(
            source_type,
            source_id,
            occurrence_date,
        )
        == 1
    )
    assert _transaction_count() == 1
    assert _account_balance(account_id) == starting_balance + expected_delta

    session = SessionLocal()
    try:
        execution = session.scalars(
            select(ScheduleExecution).where(
                ScheduleExecution.source_type == source_type,
                ScheduleExecution.source_id == source_id,
                ScheduleExecution.occurrence_date == occurrence_date,
            ),
        ).one()
        assert execution.transaction_id == first.transaction.id
        transaction = session.get(
            Transaction,
            execution.transaction_id,
        )
        assert transaction is not None
        assert transaction.account_id == account_id
    finally:
        session.close()


def _run_income_execute_worker(
    income_id: int,
    occurrence_date: date,
    household_id: int,
    synchroniser: _InitialAbsenceSynchroniser,
    results: list[ScheduleExecutionResult],
    errors: list[BaseException],
) -> None:
    session = SessionLocal()
    try:
        with synchroniser.patch():
            service = ScheduleExecutionService(
                session,
                household_id,
            )
            results.append(
                service.execute_income(
                    income_id,
                    occurrence_date,
                    domain_date=occurrence_date,
                ),
            )
    except BaseException as error:
        errors.append(error)
    finally:
        session.close()


def _run_expense_execute_worker(
    expense_id: int,
    occurrence_date: date,
    household_id: int,
    synchroniser: _InitialAbsenceSynchroniser,
    results: list[ScheduleExecutionResult],
    errors: list[BaseException],
) -> None:
    session = SessionLocal()
    try:
        with synchroniser.patch():
            service = ScheduleExecutionService(
                session,
                household_id,
            )
            results.append(
                service.execute_recurring_expense(
                    expense_id,
                    occurrence_date,
                    domain_date=occurrence_date,
                ),
            )
    except BaseException as error:
        errors.append(error)
    finally:
        session.close()


def _start_join_workers(
    workers: list[threading.Thread],
    timeout: float = 30.0,
) -> None:
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join(timeout=timeout)
        assert not worker.is_alive(), (
            "Worker did not finish within the timeout"
        )


@pytest.fixture
def today() -> date:
    """Application current domain date."""
    return date.today()


def _iso(value: date) -> str:
    return value.isoformat()


def _create_account(client: TestClient, balance: float = 1000.0) -> dict:
    response = client.post(
        "/accounts",
        json={
            "name": "Exec account",
            "account_type": "bank",
            "current_balance": balance,
        },
    )
    assert response.status_code == 201
    return response.json()


def _create_income(
    client: TestClient,
    account_id: int,
    *,
    amount: float,
    next_occurrence: date,
    active: bool = True,
) -> dict:
    response = client.post(
        "/incomes",
        json={
            "account_id": account_id,
            "amount": amount,
            "frequency": "monthly",
            "start_date": _iso(next_occurrence),
            "next_occurrence": _iso(next_occurrence),
            "active": active,
        },
    )
    assert response.status_code == 201
    return response.json()


def _create_expense(
    client: TestClient,
    account_id: int,
    *,
    amount: float,
    next_occurrence: date,
    active: bool = True,
) -> dict:
    response = client.post(
        "/recurring-expenses",
        json={
            "account_id": account_id,
            "description": "Rent",
            "amount": amount,
            "frequency": "monthly",
            "start_date": _iso(next_occurrence),
            "next_occurrence": _iso(next_occurrence),
            "active": active,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_execute_income_occurrence_today(
    client: TestClient,
    today: date,
) -> None:
    """Eligible income execution creates transaction and balance."""
    account = _create_account(client, balance=500.0)
    income = _create_income(
        client,
        account["id"],
        amount=200.0,
        next_occurrence=today,
    )
    response = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["transaction_amount"] == "200.00"
    assert body["transaction_type"] == "income"
    stored = client.get(f"/accounts/{account['id']}")
    assert Decimal(stored.json()["current_balance"]) == Decimal(
        "700.00",
    )


def test_execute_expense_occurrence_today(
    client: TestClient,
    today: date,
) -> None:
    """Eligible expense execution decreases balance."""
    account = _create_account(client, balance=500.0)
    expense = _create_expense(
        client,
        account["id"],
        amount=50.0,
        next_occurrence=today,
    )
    response = client.post(
        f"/recurring-expenses/{expense['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    assert response.status_code == 201
    stored = client.get(f"/accounts/{account['id']}")
    assert Decimal(stored.json()["current_balance"]) == Decimal(
        "450.00",
    )


def test_execute_rejects_past_occurrence(
    client: TestClient,
    today: date,
) -> None:
    """Past occurrence_date is not eligible."""
    account = _create_account(client)
    past = today - timedelta(days=7)
    income = _create_income(
        client,
        account["id"],
        amount=100.0,
        next_occurrence=past,
    )
    response = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(past)},
    )
    assert response.status_code == 422


def test_execute_rejects_future_occurrence(
    client: TestClient,
    today: date,
) -> None:
    """Future occurrence_date is not eligible."""
    account = _create_account(client)
    future = today + timedelta(days=7)
    income = _create_income(
        client,
        account["id"],
        amount=100.0,
        next_occurrence=future,
    )
    response = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(future)},
    )
    assert response.status_code == 422


def test_execute_rejects_inactive_schedule(
    client: TestClient,
    today: date,
) -> None:
    """Inactive schedules cannot be executed."""
    account = _create_account(client)
    income = _create_income(
        client,
        account["id"],
        amount=100.0,
        next_occurrence=today,
        active=False,
    )
    response = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    assert response.status_code == 422


def test_execute_idempotent_replay(
    client: TestClient,
    today: date,
) -> None:
    """Duplicate execution returns 200 without extra balance change."""
    account = _create_account(client, balance=1000.0)
    income = _create_income(
        client,
        account["id"],
        amount=100.0,
        next_occurrence=today,
    )
    first = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    second = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["transaction_id"] == second.json()[
        "transaction_id"
    ]
    stored = client.get(f"/accounts/{account['id']}")
    assert Decimal(stored.json()["current_balance"]) == Decimal(
        "1100.00",
    )
    transactions = client.get("/transactions").json()
    assert len(transactions) == 1


def test_execution_linked_transaction_cannot_be_deleted(
    client: TestClient,
    today: date,
) -> None:
    """DELETE /transactions is blocked for schedule-generated rows."""
    account = _create_account(client)
    income = _create_income(
        client,
        account["id"],
        amount=50.0,
        next_occurrence=today,
    )
    executed = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    transaction_id = executed.json()["transaction_id"]
    deleted = client.delete(f"/transactions/{transaction_id}")
    assert deleted.status_code == 409


def test_execution_linked_transaction_cannot_be_updated(
    client: TestClient,
    today: date,
) -> None:
    """PUT /transactions is blocked for schedule-generated rows."""
    account = _create_account(client)
    income = _create_income(
        client,
        account["id"],
        amount=50.0,
        next_occurrence=today,
    )
    executed = client.post(
        f"/incomes/{income['id']}/executions",
        json={"occurrence_date": _iso(today)},
    )
    transaction_id = executed.json()["transaction_id"]
    updated = client.put(
        f"/transactions/{transaction_id}",
        json={
            "account_id": account["id"],
            "amount": 99.0,
            "transaction_type": "income",
            "occurred_on": _iso(today),
            "description": None,
            "category": None,
        },
    )
    assert updated.status_code == 409


def test_concurrent_income_execution_same_occurrence(
    client: TestClient,
    today: date,
) -> None:
    """Concurrent income executes persist one row and one balance delta."""
    account = _create_account(client, balance=1000.0)
    income = _create_income(
        client,
        account["id"],
        amount=150.0,
        next_occurrence=today,
    )
    household_id = _household_id_for_account(account["id"])
    synchroniser = _InitialAbsenceSynchroniser()
    results: list[ScheduleExecutionResult] = []
    errors: list[BaseException] = []
    workers = [
        threading.Thread(
            target=_run_income_execute_worker,
            args=(
                income["id"],
                today,
                household_id,
                synchroniser,
                results,
                errors,
            ),
        ),
        threading.Thread(
            target=_run_income_execute_worker,
            args=(
                income["id"],
                today,
                household_id,
                synchroniser,
                results,
                errors,
            ),
        ),
    ]
    _start_join_workers(workers)
    _assert_same_occurrence_race_outcome(
        results,
        errors,
        account_id=account["id"],
        starting_balance=Decimal("1000.00"),
        expected_delta=Decimal("150.00"),
        source_type=ScheduleSourceType.INCOME,
        source_id=income["id"],
        occurrence_date=today,
    )


def test_concurrent_expense_execution_same_occurrence(
    client: TestClient,
    today: date,
) -> None:
    """Concurrent expense executes persist one row and one balance delta."""
    account = _create_account(client, balance=800.0)
    expense = _create_expense(
        client,
        account["id"],
        amount=40.0,
        next_occurrence=today,
    )
    household_id = _household_id_for_account(account["id"])
    synchroniser = _InitialAbsenceSynchroniser()
    results: list[ScheduleExecutionResult] = []
    errors: list[BaseException] = []
    workers = [
        threading.Thread(
            target=_run_expense_execute_worker,
            args=(
                expense["id"],
                today,
                household_id,
                synchroniser,
                results,
                errors,
            ),
        ),
        threading.Thread(
            target=_run_expense_execute_worker,
            args=(
                expense["id"],
                today,
                household_id,
                synchroniser,
                results,
                errors,
            ),
        ),
    ]
    _start_join_workers(workers)
    _assert_same_occurrence_race_outcome(
        results,
        errors,
        account_id=account["id"],
        starting_balance=Decimal("800.00"),
        expected_delta=Decimal("-40.00"),
        source_type=ScheduleSourceType.RECURRING_EXPENSE,
        source_id=expense["id"],
        occurrence_date=today,
    )


def test_concurrent_distinct_occurrences_same_account(
    client: TestClient,
    today: date,
) -> None:
    """Two schedules on one account may execute concurrently."""
    account = _create_account(client, balance=1000.0)
    first_income = _create_income(
        client,
        account["id"],
        amount=100.0,
        next_occurrence=today,
    )
    second_income = _create_income(
        client,
        account["id"],
        amount=250.0,
        next_occurrence=today,
    )
    results: list[ScheduleExecutionResult] = []
    errors: list[BaseException] = []

    household_id = _household_id_for_account(account["id"])

    def run_one(income_id: int) -> None:
        session = SessionLocal()
        try:
            service = ScheduleExecutionService(
                session,
                household_id,
            )
            results.append(
                service.execute_income(
                    income_id,
                    today,
                    domain_date=today,
                ),
            )
        except BaseException as error:
            errors.append(error)
        finally:
            session.close()

    workers = [
        threading.Thread(
            target=run_one,
            args=(first_income["id"],),
        ),
        threading.Thread(
            target=run_one,
            args=(second_income["id"],),
        ),
    ]
    _start_join_workers(workers)

    assert errors == []
    assert len(results) == 2
    assert all(result.created for result in results)
    assert results[0].execution.id != results[1].execution.id
    assert results[0].transaction.id != results[1].transaction.id
    assert _transaction_count() == 2
    assert (
        _execution_count_for_occurrence(
            ScheduleSourceType.INCOME,
            first_income["id"],
            today,
        )
        == 1
    )
    assert (
        _execution_count_for_occurrence(
            ScheduleSourceType.INCOME,
            second_income["id"],
            today,
        )
        == 1
    )
    assert _account_balance(account["id"]) == Decimal("1350.00")
