"""Frontend-facing progress API — the albusv2 contract.

- ``POST /api/progress`` upserts a user's progress for a course (furthest lesson,
  total lessons, completion flag). ``furthest`` only advances — the backend never
  decrements it.
- ``GET /api/progress/{user_id}`` returns all progress records for that user as a
  dict keyed by ``course_id``, matching the ``ProgressMap`` shape the frontend
  expects.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.progress import ProgressRead, ProgressUpsert
from app.crud.progress import upsert_progress, get_user_progress

router = APIRouter(prefix="/api", tags=["frontend-progress"])


@router.post("/progress", response_model=ProgressRead)
def save_progress(data: ProgressUpsert, db: Session = Depends(get_db)):
    return upsert_progress(db, data)


@router.get("/progress/{user_id}")
def load_progress(user_id: int, db: Session = Depends(get_db)):
    rows = get_user_progress(db, user_id)
    return {r.course_id: ProgressRead.model_validate(r).model_dump(mode="json") for r in rows}
