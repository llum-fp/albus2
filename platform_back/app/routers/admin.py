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
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import COURSES_DIR, EXTRACTS_DIR
from app.database import SessionLocal, get_db
from app.models.course import Course
from app.crud.course import (
    get_course,
    get_courses,
    set_course_published,
    update_course_details,
)
from app.crud.user import create_user, delete_user, get_user_by_email, get_users, update_user
from app.crud.survey import get_surveys, survey_stats
from app.schemas.admin import (
    AdminCourseDetail,
    AdminCourseRead,
    BuildJobRead,
    CourseDetailsUpdate,
    SurveyStatsItem,
)
from app.schemas.course import CourseRequest, CourseUpdateRequest
from app.schemas.survey import SurveyRead
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.agents_back import create_course as agents_create
from app.services.agents_back import update_course as agents_update
from app.services.course_files import (
    course_counts,
    read_course_meta,
    session_to_stem,
    update_course_json,
)


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
        if profile not in ("technical", "sales"):
            raise HTTPException(status_code=400, detail="department must be 'technical' or 'sales'")
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
# Surveys
# --------------------------------------------------------------------------- #
@router.get("/surveys")
def admin_list_surveys(db: Session = Depends(get_db)):
    """Raw survey records + per-course aggregates for the feedback dashboard."""
    records = [SurveyRead.model_validate(s) for s in get_surveys(db)]
    stats = [SurveyStatsItem.model_validate(s) for s in survey_stats(db)]
    return {"records": records, "stats": stats}
