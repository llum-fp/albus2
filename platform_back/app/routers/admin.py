"""Admin console surface — ``/api/admin/*``, role-gated.

Everything the admin panel calls lives here under ``/api`` so the Vite dev proxy
(/api -> :8001) reaches it. Course create/revise are long (a headless ``claude``
build of 5-30 min), so they run in a **background thread**: the endpoint creates
a ``pending`` Course row and returns immediately; the thread fills it in when the
build finishes. The Activity panel polls ``GET /api/admin/jobs`` (Course rows),
so in-progress builds survive page reloads / leaving the site.

Auth: a lightweight ``X-Albus-Role: Admin`` header check, consistent with the
client-side login stub. NOTE: the header is client-controlled — this is UI
gating, not real security. Real auth is out of scope until the login is real.
"""
import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import COURSES_DIR, EXTRACTS_DIR, LOGS_DIR, PODCASTS_DIR
from app.database import SessionLocal, get_db
from app.models.course import Course
from app.crud.course import (
    get_course,
    get_courses,
    set_course_published,
    set_podcast,
    update_course_details,
)
from app.crud.user import create_user, delete_user, get_user_by_email, get_users, update_user
from app.crud.role import get_or_create_role, get_role_by_name, get_roles
from app.crud.survey import get_surveys, survey_stats
from app.schemas.admin import (
    AdminCourseDetail,
    AdminCourseRead,
    BuildJobRead,
    CourseDetailsUpdate,
    ProfileCreate,
    ProfileCreateResult,
    SurveyStatsItem,
)
from app.schemas.course import CourseRequest, CourseUpdateRequest
from app.schemas.survey import SurveyRead
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.agents_back import create_course as agents_create
from app.services.agents_back import create_podcast as agents_create_podcast
from app.services.agents_back import create_role as agents_create_role
from app.services.agents_back import update_course as agents_update
from app.services import profile_builds, tts
from app.util.slug import slugify
from app.services.course_files import (
    course_counts,
    read_course_meta,
    session_to_stem,
    update_course_json,
)


log = logging.getLogger("platform_back.admin")


def require_admin(x_albus_role: str | None = Header(default=None)) -> None:
    """Gate every admin route on the X-Albus-Role header (client-side stub auth)."""
    if x_albus_role != "Admin":
        raise HTTPException(status_code=403, detail="Admin role required")


router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# --------------------------------------------------------------------------- #
# Background build workers
# --------------------------------------------------------------------------- #
def _local_json_path(raw: str | None) -> str | None:
    """Map an agents_back json_path onto our COURSES_DIR by basename."""
    if not raw:
        return None
    return str(COURSES_DIR / os.path.basename(raw))


def _local_podcast_path(raw: str | None) -> str | None:
    """Map an agents_back podcast artifact path onto our PODCASTS_DIR by basename."""
    if not raw:
        return None
    return str(PODCASTS_DIR / os.path.basename(raw))


def _finish_build(db_id: int, result: dict) -> None:
    """Write a finished build's result onto its Course row."""
    with SessionLocal() as db:
        course = db.get(Course, db_id)
        if not course:
            return
        local_path = _local_json_path(result.get("json_path"))
        session_id = result.get("session_id")
        # Set session_id only if free (the `harcoded` shortcut reuses an existing
        # one; session_id is unique, so don't collide — just leave it null).
        if session_id and not course.session_id:
            taken = (
                db.query(Course.id)
                .filter(Course.session_id == session_id, Course.id != db_id)
                .first()
            )
            if not taken:
                course.session_id = session_id
        if local_path:
            course.json_path = local_path
        for key, value in read_course_meta(local_path).items():
            if value is not None:
                setattr(course, key, value)
        course.status = "completed" if result.get("json_exists") else "failed"
        course.updated_at = datetime.now(timezone.utc)
        db.commit()


def _mark_failed(db_id: int) -> None:
    with SessionLocal() as db:
        course = db.get(Course, db_id)
        if course:
            course.status = "failed"
            course.updated_at = datetime.now(timezone.utc)
            db.commit()


def _build_worker(db_id: int, payload: dict) -> None:
    try:
        result = agents_create(payload)
    except Exception:
        _mark_failed(db_id)
        return
    _finish_build(db_id, result)


def _revise_worker(db_id: int, session_id: str, feedback: str) -> None:
    try:
        result = agents_update(session_id, feedback)
    except Exception:
        _mark_failed(db_id)
        return
    _finish_build(db_id, result)


def _podcast_worker(db_id: int, session_id: str) -> None:
    """Generate a course's podcast in the background: agents_back writes the
    dialogue script, then the TTS service renders it to one audio file. Updates the
    Course.podcast_* columns when done (or marks it failed). Runs in its own thread
    like the build/revise workers, so the request returns immediately."""
    import json
    log.info("[podcast %s] starting generation (course db_id=%s)", session_id, db_id)
    try:
        result = agents_create_podcast({"session_id": session_id})
        script_path = _local_podcast_path(result.get("script_path")) or str(
            PODCASTS_DIR / f"script_{session_id}.json"
        )
        if not result.get("script_exists") or not os.path.exists(script_path):
            raise RuntimeError(f"podcast script was not produced (agents_back result={result})")
        with open(script_path, encoding="utf-8") as fh:
            script = json.load(fh)
        out_path = PODCASTS_DIR / f"podcast_{session_id}.wav"
        log.info("[podcast %s] script ready (%d turns); synthesizing audio…",
                 session_id, len(script.get("turns", [])))
        tts.synthesize_podcast(script, out_path)
    except Exception:
        # Log the real cause (the worker runs in a thread; without this the failure
        # was invisible — only podcast_status flipped to "failed").
        log.exception("[podcast %s] generation FAILED", session_id)
        with SessionLocal() as db:
            set_podcast(db, db_id, status="failed")
        return
    log.info("[podcast %s] completed -> %s", session_id, out_path)
    with SessionLocal() as db:
        set_podcast(db, db_id, status="completed", path=str(out_path))


def _spawn(target, *args) -> None:
    threading.Thread(target=target, args=args, daemon=True).start()


# --------------------------------------------------------------------------- #
# Serialization helpers
# --------------------------------------------------------------------------- #
def _course_stem(course: Course) -> str:
    if course.json_path:
        return Path(course.json_path).stem
    if course.session_id:
        return session_to_stem(course.session_id)
    return ""


def _podcast_url(course: Course) -> str | None:
    """Served URL for a course's podcast audio when the file exists on disk, else
    None. Derived from the session id (the file is podcast_<sid>.wav under the
    /api/podcasts mount)."""
    sid = course.session_id
    if sid and (PODCASTS_DIR / f"podcast_{sid}.wav").exists():
        return f"/api/podcasts/podcast_{sid}.wav"
    return None


def _build_stage(course: Course) -> str | None:
    """Coarse build stage for the Activity monitor, derived from which per-session
    files exist on the shared agents_directory disk (cheap os.path.exists, only on
    poll — never touches the build). reading_source -> writing_course -> finishing."""
    if course.status == "completed":
        return "done"
    if course.status == "failed":
        return "failed"
    if course.status != "pending":
        return None
    sid = course.session_id
    if not sid:
        return "reading_source"  # build just started, id not yet known
    if os.path.exists(COURSES_DIR / f"course_{sid}.json"):
        return "finishing"
    if os.path.exists(EXTRACTS_DIR / f"source_{sid}.md"):
        return "writing_course"
    return "reading_source"


def _admin_course_dict(course: Course) -> dict:
    modules, lessons = course_counts(course.json_path)
    return {
        "id": _course_stem(course),
        "db_id": course.id,
        "session_id": course.session_id,
        "title": course.title,
        "description": course.description,
        "language": course.language,
        "profile": course.profile,
        "status": course.status,
        "published": bool(course.published),
        "podcast_status": course.podcast_status,
        "podcast_url": _podcast_url(course),
        "module_count": modules,
        "lesson_count": lessons,
        "created_at": course.created_at,
        "updated_at": course.updated_at,
    }


# --------------------------------------------------------------------------- #
# Courses
# --------------------------------------------------------------------------- #
@router.get("/courses", response_model=list[AdminCourseRead])
def admin_list_courses(db: Session = Depends(get_db)):
    """All courses (Draft + Published), newest first."""
    courses = sorted(get_courses(db, limit=1000), key=lambda c: c.created_at, reverse=True)
    return [_admin_course_dict(c) for c in courses]


@router.get("/courses/{db_id}", response_model=AdminCourseDetail)
def admin_get_course(db_id: int, db: Session = Depends(get_db)):
    course = get_course(db, db_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    data = _admin_course_dict(course)
    content = None
    if course.json_path and os.path.exists(course.json_path):
        import json
        with open(course.json_path, encoding="utf-8") as fh:
            content = json.load(fh)
    return {**data, "content": content}


@router.post("/courses", status_code=202)
def admin_create_course(body: CourseRequest, db: Session = Depends(get_db)):
    """Kick off a course build in the background. Returns the new db_id at once;
    the row starts as Draft + pending and the Activity panel tracks it."""
    payload = body.model_dump(exclude_none=True)
    # agents_back wants page ids under `page_ids`; CourseRequest normalizes
    # page_id to a list, so remap it.
    page_ids = payload.pop("page_id", None)
    if page_ids:
        payload["page_ids"] = page_ids
    payload.pop("feedback", None)

    # Generate the session_id here (not in agents_back) and hand it over, so we
    # know it up front and can derive the build stage from its files.
    session_id = str(uuid.uuid4())
    payload["session_id"] = session_id

    course = Course(
        session_id=session_id,
        page_id=body.page_id,
        topic=body.topic,
        profile=body.profile,
        duration_min=body.duration_min,
        status="pending",
        published=False,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    _spawn(_build_worker, course.id, payload)
    return {"db_id": course.id, "status": "pending"}


@router.patch("/courses/{db_id}", status_code=202)
def admin_revise_course(db_id: int, body: CourseUpdateRequest, db: Session = Depends(get_db)):
    """Kick off a feedback revision in the background (resumes the session)."""
    course = get_course(db, db_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not course.session_id:
        raise HTTPException(status_code=400, detail="Course has no session_id — cannot revise")
    if course.status == "pending":
        raise HTTPException(status_code=409, detail="A build is already running for this course")
    course.status = "pending"
    course.updated_at = datetime.now(timezone.utc)
    db.commit()
    _spawn(_revise_worker, course.id, course.session_id, body.feedback)
    return {"db_id": course.id, "status": "pending"}


@router.patch("/courses/{db_id}/details", response_model=AdminCourseRead)
def admin_update_course_details(db_id: int, body: CourseDetailsUpdate, db: Session = Depends(get_db)):
    """Edit course metadata in place (no rebuild): title/description (written to
    the JSON the learner reads + the DB cache) and department/profile (DB)."""
    course = get_course(db, db_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    profile = body.profile
    if profile is not None:
        profile = profile.strip().lower()
        valid = {slugify(r.name) for r in get_roles(db) if r.name != "Admin"}
        if profile not in valid:
            raise HTTPException(
                status_code=400,
                detail=f"department must be one of: {', '.join(sorted(valid))}",
            )
    if (body.title is not None or body.description is not None) and course.json_path:
        update_course_json(course.json_path, title=body.title, description=body.description)
    updated = update_course_details(
        db, db_id, title=body.title, description=body.description,
        profile=profile, duration_min=body.duration_min,
    )
    return _admin_course_dict(updated)


@router.post("/courses/{db_id}/publish", response_model=AdminCourseRead)
def admin_publish(db_id: int, db: Session = Depends(get_db)):
    course = get_course(db, db_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.status != "completed":
        raise HTTPException(status_code=409, detail="Only a completed course can be published")
    course = set_course_published(db, db_id, True)
    return _admin_course_dict(course)


@router.post("/courses/{db_id}/unpublish", response_model=AdminCourseRead)
def admin_unpublish(db_id: int, db: Session = Depends(get_db)):
    course = get_course(db, db_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    course = set_course_published(db, db_id, False)
    return _admin_course_dict(course)


@router.post("/courses/{db_id}/podcast", status_code=202)
def admin_generate_podcast(db_id: int, db: Session = Depends(get_db)):
    """Kick off a NotebookLM-style two-host podcast for a course in the background:
    agents_back writes the dialogue script, then the TTS service renders the audio.
    Returns immediately; poll the courses list/detail for ``podcast_status``
    (pending -> completed/failed) and ``podcast_url`` once ready."""
    course = get_course(db, db_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.status != "completed":
        raise HTTPException(status_code=409, detail="Only a completed course can have a podcast")
    if not course.session_id:
        raise HTTPException(status_code=400, detail="Course has no session_id — cannot generate a podcast")
    if not (COURSES_DIR / f"course_{course.session_id}.json").exists():
        raise HTTPException(status_code=409, detail="Course content file is missing — cannot generate a podcast")
    if course.podcast_status == "pending":
        raise HTTPException(status_code=409, detail="A podcast is already being generated for this course")
    course.podcast_status = "pending"
    course.updated_at = datetime.now(timezone.utc)
    db.commit()
    _spawn(_podcast_worker, course.id, course.session_id)
    return {"db_id": course.id, "podcast_status": "pending"}


# --------------------------------------------------------------------------- #
# Activity / build jobs
# --------------------------------------------------------------------------- #
@router.get("/jobs", response_model=list[BuildJobRead])
def admin_list_jobs(limit: int = 50, db: Session = Depends(get_db)):
    """Recent builds (Course rows) for the Activity panel, newest activity first.
    Persisted in the DB, so in-progress builds survive reloads."""
    courses = (
        db.query(Course)
        .order_by(Course.updated_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "db_id": c.id,
            "session_id": c.session_id,
            "title": c.title,
            "page_id": c.page_id,
            "profile": c.profile,
            "status": c.status,
            "running": c.status == "pending",
            "stage": _build_stage(c),
            "created_at": c.created_at,
            "updated_at": c.updated_at,
        }
        for c in courses
    ]


# --------------------------------------------------------------------------- #
# Logs
# --------------------------------------------------------------------------- #
_ANSI = __import__("re").compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
_ALLOWED_SERVICES = {"agents_back", "platform_back", "albusv2"}


@router.get("/logs")
def admin_get_logs(service: str = "platform_back", lines: int = 200):
    """Tail the last ``lines`` lines of a service log file from .logs/."""
    if service not in _ALLOWED_SERVICES:
        raise HTTPException(status_code=400, detail=f"service must be one of: {', '.join(sorted(_ALLOWED_SERVICES))}")
    log_path = LOGS_DIR / f"{service}.log"
    if not log_path.exists():
        return {"service": service, "lines": []}
    from collections import deque
    with open(log_path, encoding="utf-8", errors="replace") as fh:
        tail = list(deque(fh, maxlen=lines))
    return {"service": service, "lines": [_ANSI.sub("", ln).rstrip("\n") for ln in tail]}


# --------------------------------------------------------------------------- #
# Users
# --------------------------------------------------------------------------- #
@router.get("/users", response_model=list[UserRead])
def admin_list_users(db: Session = Depends(get_db)):
    return get_users(db, limit=1000)


@router.post("/users", response_model=UserRead, status_code=201)
def admin_create_user(data: UserCreate, db: Session = Depends(get_db)):
    if get_user_by_email(db, data.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    return create_user(db, data)


@router.patch("/users/{user_id}", response_model=UserRead)
def admin_update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db)):
    if data.email:
        owner = get_user_by_email(db, data.email)
        if owner and owner.id != user_id:
            raise HTTPException(status_code=409, detail="Email already registered")
    user = update_user(db, user_id, data)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/users/{user_id}", status_code=204)
def admin_delete_user(user_id: int, db: Session = Depends(get_db)):
    if not delete_user(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")


# --------------------------------------------------------------------------- #
# Profiles (departments / learner roles)
# --------------------------------------------------------------------------- #
def _profile_worker(slug: str, name: str, description: str) -> None:
    """Author the profile's course-creator agent in the background (a ~minutes
    headless build). Updates the in-memory build status when it finishes."""
    try:
        result = agents_create_role({"name": name, "slug": slug, "description": description})
        if result.get("agent_exists"):
            profile_builds.clear(slug)        # success -> status derives "ready" from the file
        else:
            profile_builds.mark_failed(slug)
    except Exception:  # noqa: BLE001
        profile_builds.mark_failed(slug)


@router.post("/profiles", response_model=ProfileCreateResult, status_code=202)
def admin_create_profile(body: ProfileCreate, db: Session = Depends(get_db)):
    """Create a new learner profile (department/role): a ``roles`` row so learners
    can be assigned it and the catalog filtered to it, plus a Claude
    course-creator agent authored by agents_back.

    Returns immediately (202): the role is created synchronously, but the agent
    build runs in a background thread (it takes minutes). Poll ``GET /api/profiles``
    for ``agent_status`` (pending -> ready/failed). A role persists even if the
    agent build fails — courses then fall back to the technical-course-creator
    agent — and re-POSTing such a profile retries the build."""
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    slug = slugify(name)
    if not slug:
        raise HTTPException(status_code=400, detail="could not derive a slug from name")

    existing = get_role_by_name(db, name)
    status = profile_builds.agent_status(slug)
    if existing and status in ("ready", "pending"):
        # Already has (or is building) its agent — nothing to retry.
        raise HTTPException(status_code=409, detail="Profile already exists")

    role = existing or get_or_create_role(db, name)  # commits

    profile_builds.mark_pending(slug)
    _spawn(_profile_worker, slug, name, body.description)
    return {
        "role_id": role.id,
        "name": role.name,
        "slug": slug,
        "profile": slug,
        "agent_status": "pending",
    }


# --------------------------------------------------------------------------- #
# Surveys
# --------------------------------------------------------------------------- #
@router.get("/surveys")
def admin_list_surveys(db: Session = Depends(get_db)):
    """Raw survey records + per-course aggregates for the feedback dashboard."""
    records = [SurveyRead.model_validate(s) for s in get_surveys(db)]
    stats = [SurveyStatsItem.model_validate(s) for s in survey_stats(db)]
    return {"records": records, "stats": stats}
