from datetime import datetime
from pydantic import BaseModel


class ProgressUpsert(BaseModel):
    user_id: int
    course_id: str
    furthest: int
    total: int
    completed: bool


class ProgressRead(BaseModel):
    course_id: str
    furthest: int
    total: int
    completed: bool
    updated_at: datetime

    model_config = {"from_attributes": True}
