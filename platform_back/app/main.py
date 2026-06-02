from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import courses, users, api_courses, api_surveys, chat
import app.models  # noqa: F401 — ensure models are registered before create_all

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Platform Back", version="1.0.0")

# The albusv2 frontend reaches us same-origin via the Vite proxy in dev; CORS is
# permissive here for SSE and any non-proxied/prod origin. No credentials are sent.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Internal management + generation surface (integer course ids).
app.include_router(courses.router)
app.include_router(users.router)
# Frontend-facing /api/* surface (the albusv2 contract): courses (string ids),
# surveys, and the Albus chat tutor (SSE).
app.include_router(api_courses.router)
app.include_router(api_surveys.router)
app.include_router(chat.router)


@app.get("/health")
def health():
    return {"status": "ok"}
