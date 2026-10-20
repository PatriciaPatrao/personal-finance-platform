from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.accounts import router as accounts_router
from app.api.analysis import router as analysis_router
from app.api.financial_goals import router as financial_goals_router
from app.api.financial_summary import router as financial_summary_router
from app.api.forecast import router as forecast_router
from app.api.incomes import router as incomes_router
from app.api.recurring_expenses import router as recurring_expenses_router
from app.api.transactions import router as transactions_router
from app.core.config import Settings
from app.core.config import settings
from app.services.domain_date import current_domain_date


def build_app(config: Settings | None = None) -> FastAPI:
    """Create the FastAPI application with routers and middleware."""
    cfg = config or settings
    application = FastAPI(
        title="Personal Finance Platform API",
        version="0.1.0",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.resolved_cors_origins(),
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    application.include_router(accounts_router)
    application.include_router(analysis_router)
    application.include_router(financial_goals_router)
    application.include_router(financial_summary_router)
    application.include_router(forecast_router)
    application.include_router(incomes_router)
    application.include_router(recurring_expenses_router)
    application.include_router(transactions_router)

    @application.get("/")
    def root():
        return {
            "name": "Personal Finance Platform API",
            "version": "0.1.0",
            "status": "running",
        }

    @application.get("/health")
    def health_check():
        return {
            "status": "ok",
            "current_domain_date": current_domain_date().isoformat(),
        }

    return application


app = build_app()
