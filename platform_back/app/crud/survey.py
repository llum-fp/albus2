from sqlalchemy.orm import Session

from app.models.survey import Survey
from app.schemas.survey import SurveyCreate


def create_survey(db: Session, data: SurveyCreate) -> Survey:
    survey = Survey(**data.model_dump())
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return survey


def get_surveys(db: Session, skip: int = 0, limit: int = 1000) -> list[Survey]:
    return (
        db.query(Survey)
        .order_by(Survey.submitted_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
