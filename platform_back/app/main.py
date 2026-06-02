from fastapi import FastAPI
from app.database import engine, Base
from app.routers import courses, users
import app.models  # noqa: F401 — ensure models are registered before create_all

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Platform Back", version="1.0.0")

app.include_router(courses.router)
app.include_router(users.router)


@app.get("/health")
def health():
    return {"status": "ok"}
