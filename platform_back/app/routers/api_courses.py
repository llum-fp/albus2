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

from fastapi import APIRouter, HTTPException

from app.config import COURSES_DIR

router = APIRouter(prefix="/api", tags=["frontend-courses"])


@router.get("/courses")
def list_courses():
    courses: list[dict] = []
    if not COURSES_DIR.exists():
        return courses
    for path in sorted(COURSES_DIR.glob("*.json")):
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, json.JSONDecodeError):
            continue  # skip unreadable / partial files rather than 500 the list
        modules = data.get("modules", [])
        courses.append({
            "id": path.stem,  # filename minus .json — the id the frontend passes back
            "title": data.get("title"),
            "description": data.get("description"),
            "language": data.get("language"),
            "module_count": len(modules),
            "lesson_count": sum(len(m.get("lessons", [])) for m in modules),
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
