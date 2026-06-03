"""Response schemas for the admin console surface (/api/admin/*)."""
from datetime import datetime

from pydantic import BaseModel


class AdminCourseRead(BaseModel):
    """A course row for the admin courses table. ``id`` is the string filename
    stem the frontend uses; ``db_id`` is the integer PK for management calls."""
    id: str
    db_id: int
    session_id: str | None
    title: str | None
    description: str | None
    language: str | None
    profile: str | None
    status: str          # build state: pending | completed | failed
    published: bool
    module_count: int
    lesson_count: int
    created_at: datetime
    updated_at: datetime


class AdminCourseDetail(AdminCourseRead):
    content: dict | None = None


class BuildJobRead(BaseModel):
    """A course build/revision, surfaced in the Activity panel. Persisted in the
    DB (it is a Course row), so it survives reloads. ``running`` == pending."""
    db_id: int
    session_id: str | None
    title: str | None
    page_id: list[str] | None
    profile: str | None
    status: str
    running: bool
    stage: str | None = None
    created_at: datetime
    updated_at: datetime


class CourseDetailsUpdate(BaseModel):
    """Admin edit of a course's editable metadata (any subset)."""
    title: str | None = None
    description: str | None = None
    profile: str | None = None  # department: "technical" | "sales"


class SurveyStatsItem(BaseModel):
    course_id: str
    count: int
    averages: dict[str, float]
    difficulty: dict[str, int]
    duration: dict[str, int]
