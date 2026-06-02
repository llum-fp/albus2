from sqlalchemy.orm import Session
from app.models.course import Course


def get_course(db: Session, course_id: int) -> Course | None:
    return db.get(Course, course_id)


def get_courses(db: Session, skip: int = 0, limit: int = 100) -> list[Course]:
    return db.query(Course).offset(skip).limit(limit).all()


def create_course_record(
    db: Session,
    session_id: str | None,
    page_id: str | None,
    json_path: str | None,
    status: str = "completed",
    user_id: int | None = None,
) -> Course:
    course = Course(
        session_id=session_id,
        page_id=page_id,
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
