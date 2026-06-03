from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, default="")
    profile: Mapped[str | None] = mapped_column(String(50), nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    courses: Mapped[list["LearningPathCourse"]] = relationship(
        "LearningPathCourse",
        back_populates="path",
        cascade="all, delete-orphan",
        order_by="LearningPathCourse.position",
    )


class LearningPathCourse(Base):
    __tablename__ = "learning_path_courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    path_id: Mapped[int] = mapped_column(
        ForeignKey("learning_paths.id", ondelete="CASCADE"), nullable=False
    )
    course_session_id: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    path: Mapped["LearningPath"] = relationship("LearningPath", back_populates="courses")

    __table_args__ = (
        UniqueConstraint("path_id", "position", name="uq_path_position"),
        UniqueConstraint("path_id", "course_session_id", name="uq_path_course"),
    )
