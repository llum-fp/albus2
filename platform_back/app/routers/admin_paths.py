"""Admin learning-path surface — ``/api/admin/paths/*``."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.admin import require_admin
from app.crud.learning_path import (
    get_paths, get_path, create_path, update_path,
    set_path_published, delete_path, set_path_courses,
)
from app.schemas.learning_path import (
    LearningPathCreate, LearningPathUpdate, LearningPathCoursesUpdate, LearningPathRead,
)

router = APIRouter(
    prefix="/api/admin/paths",
    tags=["admin-paths"],
    dependencies=[Depends(require_admin)],
)


def _read(path) -> dict:
    return {
        "id": path.id,
        "title": path.title,
        "description": path.description,
        "profile": path.profile,
        "published": path.published,
        "course_count": len(path.courses),
        "created_at": path.created_at,
        "updated_at": path.updated_at,
        "courses": [
            {"course_session_id": c.course_session_id, "position": c.position}
            for c in path.courses
        ],
    }


@router.get("", response_model=list[LearningPathRead])
def list_paths(db: Session = Depends(get_db)):
    return [_read(p) for p in get_paths(db)]


@router.post("", response_model=LearningPathRead)
def create_new_path(data: LearningPathCreate, db: Session = Depends(get_db)):
    return _read(create_path(db, data))


@router.patch("/{path_id}", response_model=LearningPathRead)
def edit_path(path_id: int, data: LearningPathUpdate, db: Session = Depends(get_db)):
    path = update_path(db, path_id, data)
    if not path:
        raise HTTPException(404, "Path not found")
    return _read(path)


@router.post("/{path_id}/publish", response_model=LearningPathRead)
def publish(path_id: int, db: Session = Depends(get_db)):
    path = set_path_published(db, path_id, True)
    if not path:
        raise HTTPException(404)
    return _read(path)


@router.post("/{path_id}/unpublish", response_model=LearningPathRead)
def unpublish(path_id: int, db: Session = Depends(get_db)):
    path = set_path_published(db, path_id, False)
    if not path:
        raise HTTPException(404)
    return _read(path)


@router.put("/{path_id}/courses", response_model=LearningPathRead)
def update_courses(path_id: int, data: LearningPathCoursesUpdate, db: Session = Depends(get_db)):
    path = set_path_courses(db, path_id, data)
    if not path:
        raise HTTPException(404)
    return _read(path)


@router.delete("/{path_id}")
def remove_path(path_id: int, db: Session = Depends(get_db)):
    if not delete_path(db, path_id):
        raise HTTPException(404)
    return {"ok": True}
