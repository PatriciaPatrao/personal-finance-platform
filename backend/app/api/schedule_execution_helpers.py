"""Shared HTTP helpers for schedule execution routes."""

from fastapi import status
from fastapi.responses import JSONResponse

from app.schemas.schedule_execution import ScheduleExecutionResponse
from app.services.schedule_execution import ScheduleExecutionResult


def schedule_execution_response(
    result: ScheduleExecutionResult,
) -> JSONResponse:
    """Return 201 for a new execution or 200 for an idempotent replay."""
    body = ScheduleExecutionResponse(
        id=result.execution.id,
        source_type=result.execution.source_type,
        source_id=result.execution.source_id,
        occurrence_date=result.execution.occurrence_date,
        transaction_id=result.execution.transaction_id,
        created_at=result.execution.created_at,
        transaction_account_id=result.transaction.account_id,
        transaction_amount=result.transaction.amount,
        transaction_type=result.transaction.transaction_type,
        transaction_occurred_on=result.transaction.occurred_on,
    )
    status_code = (
        status.HTTP_201_CREATED
        if result.created
        else status.HTTP_200_OK
    )
    return JSONResponse(
        status_code=status_code,
        content=body.model_dump(mode="json"),
    )
