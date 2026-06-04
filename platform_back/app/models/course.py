from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, func
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
    # Publication state for the learner-facing catalog. Distinct from `status`
    # (which is the build state: pending|completed|failed). False = Draft.
    published: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)
    # Podcast (NotebookLM-style audio overview) generation state, independent of
    # `status` (the course build state). podcast_status: none|pending|completed|
    # failed; podcast_path is the synthesized audio file once completed.
    podcast_status: Mapped[str] = mapped_column(String(20), default="none", server_default="none", nullable=False)
    podcast_path: Mapped[str | None] = mapped_column(String(1000))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now(), server_default=func.now())

    user: Mapped["User | None"] = relationship("User", back_populates="courses")
