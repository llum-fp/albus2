from sqlalchemy.orm import Session
from app.models.role import Role


def get_role_by_name(db: Session, name: str) -> Role | None:
    return db.query(Role).filter(Role.name == name).first()


def get_roles(db: Session) -> list[Role]:
    return db.query(Role).order_by(Role.id).all()


def get_or_create_role(db: Session, name: str) -> Role:
    role = get_role_by_name(db, name)
    if not role:
        role = Role(name=name)
        db.add(role)
        db.commit()
        db.refresh(role)
    return role
