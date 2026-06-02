from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate


def get_user(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return db.query(User).offset(skip).limit(limit).all()


def create_user(db: Session, data: UserCreate) -> User:
    user = User(email=data.email, name=data.name, role=data.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
