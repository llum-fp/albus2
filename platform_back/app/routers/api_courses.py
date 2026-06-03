"""Frontend-facing course read API — the albusv2 contract.

Serves the courses our agents pipeline writes (``config.COURSES_DIR``) in the
exact shape the React frontend expects, with NO data transform: our generated
JSON already matches the frontend's Course/Module/Lesson/Question types.

- ``GET /api/courses`` -> ``CourseSummary[]`` (id = filename stem, plus computed
  ``module_count`` / ``lesson_count``).
- ``GET /api/courses/{id}`` -> the full course JSON with the top-level ``id``
  injected from the filename stem (overriding any id inside the file).

This string filename-stem id is intentionally independent of the integer PK used
by the existing ``/courses/`` management router, which is left untouched.
"""
import json

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import COURSES_DIR
from app.crud.course import get_visible_session_ids
from app.database import get_db
from app.models.course import Course
from app.services.course_files import stem_to_session

router = APIRouter(prefix="/api", tags=["frontend-courses"])


@router.get("/courses")
def list_courses(
    x_albus_role: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Learner catalog, filtered to what the signed-in role may see: published
    AND (Admin -> all; Technical/Sales -> matching department; no-department ->
    hidden). Role comes from the X-Albus-Role header (client-side stub auth)."""
    courses: list[dict] = []
    if not COURSES_DIR.exists():
        return courses
    visible = get_visible_session_ids(db, x_albus_role)
    duration_map = {
        r.session_id: r.duration_min
        for r in db.query(Course.session_id, Course.duration_min).all()
        if r.session_id
    }
    for path in sorted(COURSES_DIR.glob("*.json")):
        session_id = stem_to_session(path.stem)
        if session_id not in visible:
            continue  # not published or not visible to this role
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, json.JSONDecodeError):
            continue  # skip unreadable / partial files rather than 500 the list
        modules = data.get("modules", [])
        courses.append({
            "id": path.stem,
            "title": data.get("title"),
            "description": data.get("description"),
            "language": data.get("language"),
            "module_count": len(modules),
            "lesson_count": sum(len(m.get("lessons", [])) for m in modules),
            "duration_min": duration_map.get(session_id),
        })
    return courses


@router.get("/courses/{course_id}")
def get_course(course_id: str):
    path = COURSES_DIR / f"{course_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Course not found")
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    data["id"] = course_id  # id derived from the filename, overriding any in-file id
    return data
