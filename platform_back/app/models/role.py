from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

VALID_ROLES = ("Admin", "Technical", "Sales")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
