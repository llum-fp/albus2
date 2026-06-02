from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Survey(Base):
    """End-of-course feedback submitted by the learner UI (POST /api/surveys).

    ``course_id`` is the string filename-stem id the frontend uses (NOT an int FK
    to courses.id). ``difficulty`` / ``duration`` store the literal Spanish enum
    tokens the frontend sends verbatim.
    """

    __tablename__ = "surveys"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    course_id: Mapped[str] = mapped_column(String(255), index=True)
    user: Mapped[str] = mapped_column(String(50))  # Admin | Technical | Sales
    rating_overall: Mapped[int] = mapped_column(Integer)
    rating_content: Mapped[int] = mapped_column(Integer)
    rating_albus: Mapped[int] = mapped_column(Integer)
    rating_applicability: Mapped[int] = mapped_column(Integer)
    difficulty: Mapped[str] = mapped_column(String(20))  # muy_facil|facil|adecuada|dificil|muy_dificil
    duration: Mapped[str] = mapped_column(String(20))    # corta|adecuada|larga
    comments: Mapped[str | None] = mapped_column(Text, default="")
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), server_default=func.now()
    )
