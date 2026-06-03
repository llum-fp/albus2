from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

# Base roles seeded on startup (see app/services/course_sync.ensure_base_roles).
# Admin is the access role; the others are course departments/profiles. New
# profiles are added at runtime via POST /api/admin/profiles — this tuple is just
# the built-in set. "End-user" pairs with the existing end-user-course-creator agent.
VALID_ROLES = ("Admin", "Technical", "Sales", "End-user")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
