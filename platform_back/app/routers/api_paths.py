"""Learner-facing learning-paths API."""
from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.crud.learning_path import get_visible_paths, get_path
from app.crud.progress import get_user_progress
from app.services.course_files import json_path_for_session, read_course_meta, course_counts, session_to_stem

router = APIRouter(prefix="/api/paths", tags=["frontend-paths"])


def _build_progress_map(db: Session, user_id: int | None) -> dict:
    if not user_id:
        return {}
    records = get_user_progress(db, user_id)
    return {r.course_id: r for r in records}


def _course_summary(session_id: str) -> dict:
    path = json_path_for_session(session_id)
    meta = read_course_meta(path)
    module_count, lesson_count = course_counts(path)
    return {
        "id": session_id,
        "title": meta.get("title") or "",
        "description": meta.get("description") or "",
        "language": meta.get("language"),
        "module_count": module_count,
        "lesson_count": lesson_count,
    }


@router.get("")
def list_paths(
    user_id: int | None = Query(default=None),
    x_albus_role: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    paths = get_visible_paths(db, x_albus_role)
    progress_map = _build_progress_map(db, user_id)

    result = []
    for path in paths:
        total = len(path.courses)
        completed = sum(
            1 for c in path.courses
            if progress_map.get(session_to_stem(c.course_session_id)) and
            progress_map[session_to_stem(c.course_session_id)].completed
        )
        result.append({
            "id": path.id,
            "title": path.title,
            "description": path.description,
            "profile": path.profile,
            "course_count": total,
            "completed_count": completed,
        })
    return result


@router.get("/{path_id}")
def get_path_detail(
    path_id: int,
    user_id: int | None = Query(default=None),
    x_albus_role: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    path = get_path(db, path_id)
    if not path or not path.published:
        from fastapi import HTTPException
        raise HTTPException(404, "Path not found")

    progress_map = _build_progress_map(db, user_id)

    courses = []
    for c in path.courses:
        sid = c.course_session_id
        prog = progress_map.get(session_to_stem(sid))
        summary = _course_summary(sid)
        summary["position"] = c.position
        summary["progress"] = {
            "furthest": prog.furthest if prog else 0,
            "total": prog.total if prog else 0,
            "completed": prog.completed if prog else False,
        } if prog else None
        courses.append(summary)

    total = len(courses)
    completed = sum(1 for c in courses if c.get("progress") and c["progress"]["completed"])

    return {
        "id": path.id,
        "title": path.title,
        "description": path.description,
        "profile": path.profile,
        "course_count": total,
        "completed_count": completed,
        "courses": courses,
    }
