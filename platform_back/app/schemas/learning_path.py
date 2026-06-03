from datetime import datetime
from pydantic import BaseModel


class LearningPathCreate(BaseModel):
    title: str
    description: str | None = ""
    profile: str | None = None


class LearningPathUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    profile: str | None = None


class PathCourseItem(BaseModel):
    course_session_id: str
    position: int


class LearningPathCoursesUpdate(BaseModel):
    courses: list[PathCourseItem]


class PathCourseRead(BaseModel):
    course_session_id: str
    position: int

    model_config = {"from_attributes": True}


class LearningPathRead(BaseModel):
    id: int
    title: str
    description: str | None
    profile: str | None
    published: bool
    course_count: int
    created_at: datetime
    updated_at: datetime
    courses: list[PathCourseRead]

    model_config = {"from_attributes": True}
