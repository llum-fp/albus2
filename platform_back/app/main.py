from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import IMAGES_DIR, PODCASTS_DIR
from app.database import engine, Base, SessionLocal
from app.routers import (
    courses, users, api_courses, api_surveys, api_pages, api_users, api_progress, chat, admin,
)
from app.routers import admin_paths, api_paths, api_profiles
import app.models  # noqa: F401 — ensure models are registered before create_all
from app.services.course_sync import (
    ensure_base_roles, ensure_podcast_columns, ensure_published_column, reconcile,
)

Base.metadata.create_all(bind=engine)
# Add new columns if missing (create_all never ALTERs existing tables): the
# courses.published flag and the podcast_* columns. Then ensure the built-in roles
# exist and reconcile the DB with the JSON files on disk (back-fill rows, fail
# orphan pending builds + podcast generations). See course_sync.py.
ensure_published_column(engine)
ensure_podcast_columns(engine)
with SessionLocal() as _db:
    ensure_base_roles(_db)
    reconcile(_db)

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
app.include_router(api_pages.router)
app.include_router(api_users.router)
app.include_router(api_progress.router)
app.include_router(chat.router)
app.include_router(api_paths.router)
app.include_router(api_profiles.router)
# Admin console surface (/api/admin/*), role-gated.
app.include_router(admin.router)
app.include_router(admin_paths.router)

# Serve course screenshots over HTTP. A JSON image path "images/<session>/x.png"
# is served at "/api/media/<session>/x.png" (the frontend strips the leading
# "images/"; see mediaUrl()). Under /api so the Vite dev proxy forwards it.
# check_dir=False so a missing folder just 404s instead of failing startup.
app.mount("/api/media", StaticFiles(directory=str(IMAGES_DIR), check_dir=False), name="media")

# Serve generated podcast audio. The TTS service writes "podcast_<sid>.wav" into
# PODCASTS_DIR; it's served at "/api/podcasts/podcast_<sid>.wav" (under /api so the
# Vite dev proxy forwards it). check_dir=False so a missing folder just 404s.
app.mount("/api/podcasts", StaticFiles(directory=str(PODCASTS_DIR), check_dir=False), name="podcasts")


@app.get("/health")
def health():
    return {"status": "ok"}
