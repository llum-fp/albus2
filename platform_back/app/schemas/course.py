from datetime import datetime
from pydantic import BaseModel


class CourseRequest(BaseModel):
    page_id: str | None = None
    topic: str | None = None
    profile: str | None = None
    duration_min: int | None = None
    session_id: str | None = None
    feedback: str | None = None
    harcoded: bool = False


class CourseRead(BaseModel):
    id: int
    session_id: str | None
    page_id: str | None
    title: str | None
    json_path: str | None
    status: str
    user_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CourseDetail(CourseRead):
    content: dict | None = None
