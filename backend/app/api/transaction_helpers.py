"""Shared HTTP helpers for transaction routes."""

from app.db.session import Session
from app.models.transaction import Transaction
from app.repositories.schedule_execution import ScheduleExecutionRepository
from app.schemas.transaction import TransactionResponse


def transaction_response(
    session: Session,
    transaction: Transaction,
    *,
    linked_to_schedule_execution: bool | None = None,
) -> TransactionResponse:
    """Build a transaction API response with schedule linkage."""
    if linked_to_schedule_execution is None:
        linked_to_schedule_execution = (
            ScheduleExecutionRepository(session).get_by_transaction_id(
                transaction.id,
            )
            is not None
        )
    body = TransactionResponse.model_validate(transaction)
    return body.model_copy(
        update={
            "linked_to_schedule_execution": (
                linked_to_schedule_execution
            ),
        },
    )


def transaction_responses_for_list(
    session: Session,
    transactions: list[Transaction],
) -> list[TransactionResponse]:
    """Build transaction responses using one bulk execution lookup."""
    linked_ids = ScheduleExecutionRepository(
        session,
    ).linked_transaction_ids(transaction.id for transaction in transactions)
    return [
        transaction_response(
            session,
            transaction,
            linked_to_schedule_execution=(
                transaction.id in linked_ids
            ),
        )
        for transaction in transactions
    ]
