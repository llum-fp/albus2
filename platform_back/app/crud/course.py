from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.course import Course


def get_course(db: Session, course_id: int) -> Course | None:
    return db.get(Course, course_id)


def get_courses(db: Session, skip: int = 0, limit: int = 100) -> list[Course]:
    return db.query(Course).offset(skip).limit(limit).all()


def create_course_record(
    db: Session,
    session_id: str | None,
    page_id: list[str] | None,
    json_path: str | None,
    topic: str | None = None,
    profile: str | None = None,
    duration_min: int | None = None,
    title: str | None = None,
    description: str | None = None,
    language: str | None = None,
    status: str = "completed",
    user_id: int | None = None,
) -> Course:
    course = Course(
        session_id=session_id,
        page_id=page_id,
        topic=topic,
        profile=profile,
        duration_min=duration_min,
        title=title,
        description=description,
        language=language,
        json_path=json_path,
        status=status,
        user_id=user_id,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def update_course_status(db: Session, course_id: int, status: str) -> Course | None:
    course = db.get(Course, course_id)
    if course:
        course.status = status
        db.commit()
        db.refresh(course)
    return course


def update_course_record(
    db: Session,
    course_id: int,
    json_path: str | None = None,
    title: str | None = None,
    description: str | None = None,
    language: str | None = None,
    status: str | None = None,
) -> Course | None:
    course = db.get(Course, course_id)
    if not course:
        return None
    if json_path is not None:
        course.json_path = json_path
    if title is not None:
        course.title = title
    if description is not None:
        course.description = description
    if language is not None:
        course.language = language
    if status is not None:
        course.status = status
    course.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(course)
    return course
