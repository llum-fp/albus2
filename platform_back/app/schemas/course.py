from datetime import datetime
from pydantic import BaseModel, field_validator


class CourseRequest(BaseModel):
    page_id: list[str] | str | None = None

    @field_validator("page_id", mode="before")
    @classmethod
    def normalize_page_id(cls, v):
        if v is None:
            return None
        return [str(v)] if isinstance(v, (str, int)) else [str(i) for i in v]
    topic: str | None = None
    profile: str | None = None
    duration_min: int | None = None
    session_id: str | None = None
    feedback: str | None = None
    harcoded: bool = False


class CourseRead(BaseModel):
    id: int
    session_id: str | None
    page_id: list[str] | None
    topic: str | None
    profile: str | None
    duration_min: int | None
    title: str | None
    description: str | None
    language: str | None
    json_path: str | None
    status: str
    published: bool = False
    user_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CourseUpdateRequest(BaseModel):
    feedback: str


class CourseDetail(CourseRead):
    content: dict | None = None
