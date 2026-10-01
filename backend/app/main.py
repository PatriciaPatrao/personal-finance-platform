from fastapi import FastAPI

from app.api.transactions import router

app = FastAPI(
    title="Personal Finance Platform API",
    version="0.1.0",
)

app.include_router(router)


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
