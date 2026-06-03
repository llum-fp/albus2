from sqlalchemy.orm import Session

from app.models.survey import Survey
from app.schemas.survey import SurveyCreate


def create_survey(db: Session, data: SurveyCreate) -> Survey:
    survey = Survey(**data.model_dump())
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return survey


def has_surveyed(db: Session, user_id: int, course_id: str) -> bool:
    return (
        db.query(Survey)
        .filter(Survey.user_id == user_id, Survey.course_id == course_id)
        .first()
    ) is not None


def get_surveys(db: Session, skip: int = 0, limit: int = 1000) -> list[Survey]:
    return (
        db.query(Survey)
        .order_by(Survey.submitted_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


_RATING_FIELDS = ("rating_overall", "rating_content", "rating_albus", "rating_applicability")


def survey_stats(db: Session) -> list[dict]:
    """Per-course aggregates: response count, mean of each rating, and the
    difficulty/duration distributions. Computed in Python (survey volume is low)."""
    surveys = db.query(Survey).all()
    by_course: dict[str, list[Survey]] = {}
    for s in surveys:
        by_course.setdefault(s.course_id, []).append(s)

    stats: list[dict] = []
    for course_id, rows in by_course.items():
        n = len(rows)
        averages = {
            field: round(sum(getattr(r, field) for r in rows) / n, 2)
            for field in _RATING_FIELDS
        }
        difficulty: dict[str, int] = {}
        duration: dict[str, int] = {}
        for r in rows:
            difficulty[r.difficulty] = difficulty.get(r.difficulty, 0) + 1
            duration[r.duration] = duration.get(r.duration, 0) + 1
        stats.append({
            "course_id": course_id,
            "count": n,
            "averages": averages,
            "difficulty": difficulty,
            "duration": duration,
        })
    stats.sort(key=lambda s: s["count"], reverse=True)
    return stats
