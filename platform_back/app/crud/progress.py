from sqlalchemy.orm import Session

from app.models.progress import UserCourseProgress
from app.schemas.progress import ProgressUpsert


def upsert_progress(db: Session, data: ProgressUpsert) -> UserCourseProgress:
    row = (
        db.query(UserCourseProgress)
        .filter_by(user_id=data.user_id, course_id=data.course_id)
        .first()
    )
    if row is None:
        row = UserCourseProgress(
            user_id=data.user_id,
            course_id=data.course_id,
            furthest=data.furthest,
            total=data.total,
            completed=data.completed,
        )
        db.add(row)
    else:
        row.furthest = max(row.furthest, data.furthest)
        row.total = data.total
        row.completed = row.completed or data.completed
    db.commit()
    db.refresh(row)
    return row


def get_user_progress(db: Session, user_id: int) -> list[UserCourseProgress]:
    return db.query(UserCourseProgress).filter_by(user_id=user_id).all()
