from fastapi import FastAPI

from app.api.accounts import router as accounts_router
from app.api.financial_summary import router as financial_summary_router
from app.api.forecast import router as forecast_router
from app.api.incomes import router as incomes_router
from app.api.recurring_expenses import router as recurring_expenses_router
from app.api.transactions import router as transactions_router

app = FastAPI(
    title="Personal Finance Platform API",
    version="0.1.0",
)

app.include_router(accounts_router)
app.include_router(financial_summary_router)
app.include_router(forecast_router)
app.include_router(incomes_router)
app.include_router(recurring_expenses_router)
app.include_router(transactions_router)


@app.get("/")
def root():
    return {
        "name": "Personal Finance Platform API",
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}
