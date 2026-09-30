from fastapi import FastAPI

app = FastAPI(
    title="Personal Finance Platform API",
    version="0.1.0",
)


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
