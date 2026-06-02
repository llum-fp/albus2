import json
import os
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.course import CourseRequest, CourseRead, CourseDetail, CourseUpdateRequest
from app.crud.course import create_course_record, get_course, get_courses, update_course_record
from app.services.agents_back import create_course, update_course

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("/", response_model=list[CourseRead])
def list_courses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_courses(db, skip=skip, limit=limit)


def _read_course_meta(path: str | None) -> dict:
    if not path or not os.path.exists(path):
        return {}
    with open(path) as f:
        data = json.load(f)
    return {k: data.get(k) for k in ("title", "description", "language")}


def _trim_modules(modules: list) -> list:
    return [{"id": m.get("id"), "title": m.get("title"), "summary": m.get("summary")} for m in modules]


@router.get("/{course_id}", response_model=CourseDetail)
def read_course(
    course_id: int,
    max_modules: int | None = Query(default=None, description="Limit number of modules returned"),
    preview: bool = Query(default=False, description="Return only module id/title/summary, no lessons"),
    db: Session = Depends(get_db),
):
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    content = None
    if course.json_path and os.path.exists(course.json_path):
        with open(course.json_path) as f:
            content = json.load(f)
        modules = content.get("modules", [])
        if max_modules is not None:
            modules = modules[:max_modules]
        if preview:
            modules = _trim_modules(modules)
        content = {**content, "modules": modules}

    return CourseDetail.model_validate({**course.__dict__, "content": content})


@router.post("/", status_code=201)
def create(body: CourseRequest, db: Session = Depends(get_db)):
    payload = body.model_dump(exclude_none=True)
    # agents_back expects a list of page ids under `page_ids`; `page_id` must be
    # a scalar. body.page_id is always normalized to a list, so remap it.
    page_ids = payload.pop("page_id", None)
    if page_ids:
        payload["page_ids"] = page_ids
    try:
        result = create_course(payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"agents_back call failed: {exc}")

    _json_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "agents_back", "agents_directory", "json"))
    json_path = os.path.join(_json_dir, os.path.basename(result.get("json_path", ""))) if result.get("json_path") else None

    meta = _read_course_meta(json_path)
    record = create_course_record(
        db,
        session_id=result.get("session_id"),
        page_id=body.page_id,
        json_path=json_path,
        topic=body.topic,
        profile=body.profile,
        duration_min=body.duration_min,
        status="completed" if result.get("json_exists") else "failed",
        **meta,
    )
    return {**result, "json_path": json_path, "db_id": record.id}


@router.patch("/{course_id}", response_model=CourseDetail)
def revise(course_id: int, body: CourseUpdateRequest, db: Session = Depends(get_db)):
    course = get_course(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not course.session_id:
        raise HTTPException(status_code=400, detail="Course has no session_id — cannot revise")

    try:
        result = update_course(session_id=course.session_id, feedback=body.feedback)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"agents_back call failed: {exc}")

    new_path = result.get("json_path")
    meta = _read_course_meta(new_path)
    updated = update_course_record(
        db,
        course_id=course_id,
        json_path=new_path,
        status="completed" if result.get("json_exists") else "failed",
        **meta,
    )
    return CourseDetail.model_validate({**updated.__dict__, "content": None})
