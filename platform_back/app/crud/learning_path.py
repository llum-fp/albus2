from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.learning_path import LearningPath, LearningPathCourse
from app.schemas.learning_path import LearningPathCreate, LearningPathUpdate, LearningPathCoursesUpdate
from app.util.slug import slugify


def get_paths(db: Session) -> list[LearningPath]:
    return db.query(LearningPath).order_by(LearningPath.created_at.desc()).all()


def get_path(db: Session, path_id: int) -> LearningPath | None:
    return db.get(LearningPath, path_id)


def get_visible_paths(db: Session, role: str | None) -> list[LearningPath]:
    q = db.query(LearningPath).filter(LearningPath.published.is_(True))
    if role == "Admin":
        pass
    elif role:
        q = q.filter(
            (LearningPath.profile.is_(None)) |
            (func.lower(LearningPath.profile) == slugify(role))
        )
    else:
        return []
    return q.order_by(LearningPath.created_at.desc()).all()


def create_path(db: Session, data: LearningPathCreate) -> LearningPath:
    path = LearningPath(
        title=data.title,
        description=data.description,
        profile=data.profile or None,
    )
    db.add(path)
    db.commit()
    db.refresh(path)
    return path


def update_path(db: Session, path_id: int, data: LearningPathUpdate) -> LearningPath | None:
    path = db.get(LearningPath, path_id)
    if not path:
        return None
    if data.title is not None:
        path.title = data.title
    if data.description is not None:
        path.description = data.description
    if "profile" in data.model_fields_set:
        path.profile = data.profile or None
    db.commit()
    db.refresh(path)
    return path


def set_path_published(db: Session, path_id: int, published: bool) -> LearningPath | None:
    path = db.get(LearningPath, path_id)
    if not path:
        return None
    path.published = published
    db.commit()
    db.refresh(path)
    return path


def delete_path(db: Session, path_id: int) -> bool:
    path = db.get(LearningPath, path_id)
    if not path:
        return False
    db.delete(path)
    db.commit()
    return True


def set_path_courses(db: Session, path_id: int, data: LearningPathCoursesUpdate) -> LearningPath | None:
    path = db.get(LearningPath, path_id)
    if not path:
        return None
    db.query(LearningPathCourse).filter(LearningPathCourse.path_id == path_id).delete()
    for item in data.courses:
        db.add(LearningPathCourse(
            path_id=path_id,
            course_session_id=item.course_session_id,
            position=item.position,
        ))
    db.commit()
    db.refresh(path)
    return path
