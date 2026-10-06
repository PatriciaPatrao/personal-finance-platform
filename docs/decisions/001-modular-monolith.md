# Modular monolith

## Status

Accepted

## Context

The product is an MVP (`Personal Finance Platform API` version `0.1.0`). One Angular client talks to one FastAPI process, which uses one SQLAlchemy session and one PostgreSQL database.

Domain areas already have clear boundaries inside that process: accounts, transactions, scheduled income, recurring expenses, analysis, and forecast. Accounts, transactions, incomes, and recurring expenses share foreign keys to `accounts`. Analysis and Forecast are read models over those tables. They do not call each other. Persistence stays in one schema.

There is no authentication, no per-user tenancy, and no separately deployed service. Redis, message queues, background workers, and cluster orchestration are not present.

## Decision

Keep the backend as a modular monolith: domain modules inside one FastAPI application and one database, not independently deployed services.

That matches the current scale. Module boundaries are already visible in `backend/app/api/`, `services/`, `repositories/`, and `models/`, and `backend/app/main.py` mounts them on a single app. Deployment and development stay one process (`uvicorn`), one database, and one client.

Distributed-system machinery is avoided because there is no ownership split that would justify network boundaries. Calculation is already isolated enough that a boundary can be extracted later if scale or ownership requires it. That extraction is not implemented.

## Consequences

- A request uses one database session. Cross-module reads do not cross a network.
- Analysis and Forecast can stay independent without separate stores or deployments.
- Shared tables and foreign keys remain easy to change together.
- Operational surface stays small: PostgreSQL, Alembic, and one API process.
- Later extraction is possible because modules already isolate calculation. It is not a current architecture.

## Alternatives considered

**Microservices.** Rejected for the current product. Splitting the API would add network boundaries, deployment, and consistency costs without a corresponding ownership split. Microservices were not implemented, and this decision is not based on a benchmark of a distributed design.
