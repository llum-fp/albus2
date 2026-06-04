"""Startup schema migration + disk<->DB reconciliation for courses.

This module runs once at app startup (from ``app/main.py``) and keeps the
``courses`` table consistent with the JSON files in ``COURSES_DIR``:

1. ``ensure_published_column`` adds the ``published`` column the first time the
   app runs after the feature lands (``create_all`` never ALTERs an existing
   table). On that one-time migration it publishes every already-``completed``
   course, so the courses that existed before this feature stay visible.

2. ``reconcile`` (every startup):
   - marks orphan ``pending`` builds as ``failed`` (their headless ``claude``
     subprocess did not survive the previous process), and
   - back-fills a ``published`` DB row for any JSON file on disk that has no
     row yet (a course that exists on disk is treated as published).
   It never re-publishes existing rows, so an admin's later Unpublish sticks.
"""
import logging

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.config import COURSES_DIR
from app.crud.role import get_or_create_role
from app.models.course import Course
from app.models.role import VALID_ROLES
from app.services.course_files import read_course_meta, stem_to_session

log = logging.getLogger("platform_back.course_sync")


def ensure_base_roles(db: Session) -> None:
    """Make sure the built-in roles (VALID_ROLES) exist on every startup, so an
    already-created platform.db picks up newly-added base roles (e.g. End-user)
    without needing a re-seed. Idempotent: get_or_create_role is a no-op when the
    role is already present."""
    for name in VALID_ROLES:
        get_or_create_role(db, name)
    log.info("Ensured base roles: %s", ", ".join(VALID_ROLES))


def ensure_published_column(engine) -> bool:
    """Add ``courses.published`` if missing; one-time publish of completed courses.

    Returns True if the column was just created (migration happened).
    """
    insp = inspect(engine)
    cols = {c["name"] for c in insp.get_columns("courses")}
    if "published" in cols:
        return False
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE courses ADD COLUMN published BOOLEAN NOT NULL DEFAULT 0"))
        # One-time: courses that already existed before this feature stay visible.
        conn.execute(text("UPDATE courses SET published = 1 WHERE status = 'completed'"))
    log.info("Migrated: added courses.published and published existing completed courses")
    return True


def ensure_podcast_columns(engine) -> bool:
    """Add ``courses.podcast_status`` / ``courses.podcast_path`` if missing
    (``create_all`` never ALTERs an existing table). Returns True if a column was
    just created."""
    insp = inspect(engine)
    cols = {c["name"] for c in insp.get_columns("courses")}
    missing = [c for c in ("podcast_status", "podcast_path") if c not in cols]
    if not missing:
        return False
    with engine.begin() as conn:
        if "podcast_status" in missing:
            conn.execute(text("ALTER TABLE courses ADD COLUMN podcast_status VARCHAR(20) NOT NULL DEFAULT 'none'"))
        if "podcast_path" in missing:
            conn.execute(text("ALTER TABLE courses ADD COLUMN podcast_path VARCHAR(1000)"))
    log.info("Migrated: added courses.%s", ", ".join(missing))
    return True


def reconcile(db: Session) -> dict:
    """Mark orphan pending builds failed and back-fill rows for on-disk courses."""
    # 1. Orphan pending builds: their subprocess died with the previous process.
    orphaned = db.query(Course).filter(Course.status == "pending").all()
    for course in orphaned:
        course.status = "failed"

    # 1b. Orphan podcast generations: their TTS worker thread died with the
    # previous process. Reset so the admin can retry (independent of `status`).
    orphan_podcasts = db.query(Course).filter(Course.podcast_status == "pending").all()
    for course in orphan_podcasts:
        course.podcast_status = "failed"

    # 2. Back-fill a row for every JSON file that has none (published by default).
    existing = {c.session_id for c in db.query(Course.session_id).all() if c.session_id}
    backfilled = 0
    if COURSES_DIR.exists():
        for path in sorted(COURSES_DIR.glob("*.json")):
            session_id = stem_to_session(path.stem)
            if session_id in existing:
                continue
            db.add(Course(
                session_id=session_id,
                json_path=str(path),
                status="completed",
                published=True,
                **read_course_meta(str(path)),
            ))
            existing.add(session_id)
            backfilled += 1

    db.commit()
    result = {
        "orphaned_failed": len(orphaned),
        "orphan_podcasts_failed": len(orphan_podcasts),
        "backfilled": backfilled,
    }
    log.info("Course reconcile: %s", result)
    return result
