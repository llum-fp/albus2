from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[str | None] = mapped_column(String(36), unique=True, index=True)
    page_id: Mapped[list | None] = mapped_column(JSON)
    topic: Mapped[str | None] = mapped_column(String(500))
    profile: Mapped[str | None] = mapped_column(String(100))
    duration_min: Mapped[int | None] = mapped_column()
    title: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(String(2000))
    language: Mapped[str | None] = mapped_column(String(10))
    json_path: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(50), default="pending")
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User | None"] = relationship("User", back_populates="courses")
