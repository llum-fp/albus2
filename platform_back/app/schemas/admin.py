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
    profile: str | None = None  # department slug, e.g. "technical" | "sales" | "marketing"
    duration_min: int | None = None


class ProfileCreate(BaseModel):
    """Admin request to create a new learner profile (department/role): a roles
    row + a Claude course-creator agent authored by agents_back."""
    name: str                 # display name, e.g. "Marketing"
    description: str = ""      # audience + emphasis, forwarded to agents_back


class ProfileCreateResult(BaseModel):
    role_id: int
    name: str                 # "Marketing"
    slug: str                 # "marketing"
    profile: str              # "marketing" (the value to tag courses with == slug)
    agent_status: str         # "pending" right after creation (build runs in background)


class ProfileRead(BaseModel):
    """A learner profile for dropdowns/lists: the role name, its slug, and the
    state of its course-creator agent build (ready | pending | failed | none)."""
    id: int
    name: str
    slug: str
    agent_status: str = "none"


class SurveyStatsItem(BaseModel):
    course_id: str
    count: int
    averages: dict[str, float]
    difficulty: dict[str, int]
    duration: dict[str, int]
