"""Frontend-facing survey API — the albusv2 contract.

``POST /api/surveys`` persists an end-of-course survey to SQLite; the frontend
only checks that the response is 2xx, so we return ``{ok: true}``.
``GET /api/surveys`` returns all records for the (currently placeholder) admin
view. ``difficulty`` / ``duration`` accept the literal Spanish enum tokens the
frontend sends; ``course_id`` is the string filename-stem id.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.survey import SurveyCreate, SurveyRead
from app.crud.survey import create_survey, get_surveys

router = APIRouter(prefix="/api", tags=["frontend-surveys"])


@router.post("/surveys")
def submit_survey(data: SurveyCreate, db: Session = Depends(get_db)):
    create_survey(db, data)
    return {"ok": True}


@router.get("/surveys", response_model=list[SurveyRead])
def list_surveys(db: Session = Depends(get_db)):
    return get_surveys(db)
