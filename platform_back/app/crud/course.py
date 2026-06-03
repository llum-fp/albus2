from datetime import datetime, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.course import Course
from app.util.slug import slugify


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
    published: bool = False,
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
        published=published,
        user_id=user_id,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def set_course_published(db: Session, course_id: int, published: bool) -> Course | None:
    course = db.get(Course, course_id)
    if course:
        course.published = published
        db.commit()
        db.refresh(course)
    return course


def get_published_session_ids(db: Session) -> set[str]:
    """session_ids of all published courses (for the learner catalog filter)."""
    rows = db.query(Course.session_id).filter(Course.published.is_(True)).all()
    return {r[0] for r in rows if r[0]}


def get_visible_session_ids(db: Session, role: str | None) -> set[str]:
    """Published session_ids a learner role may see in the catalog:
    - ``Admin``        -> every published course;
    - any other role   -> published courses whose department (profile) matches
      the role's slug (``slugify(role)``), so any profile created at runtime
      works without code changes (and multi-word roles slug correctly);
    - no role / a course with no department -> not shown (hidden until an admin
      assigns a department)."""
    q = db.query(Course.session_id).filter(Course.published.is_(True))
    if role == "Admin":
        pass  # sees everything published
    elif role:
        q = q.filter(func.lower(Course.profile) == slugify(role))
    else:
        return set()  # no role / not signed in
    return {r[0] for r in q.all() if r[0]}


def update_course_details(
    db: Session,
    course_id: int,
    *,
    title: str | None = None,
    description: str | None = None,
    profile: str | None = None,
    duration_min: int | None = None,
) -> Course | None:
    """Admin edit of a course's metadata (title/description/department). Only the
    provided fields are changed. The JSON file is updated separately by the router."""
    course = db.get(Course, course_id)
    if not course:
        return None
    if title is not None:
        course.title = title
    if description is not None:
        course.description = description
    if profile is not None:
        course.profile = profile
    if duration_min is not None:
        course.duration_min = duration_min
    course.updated_at = datetime.now(timezone.utc)
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
