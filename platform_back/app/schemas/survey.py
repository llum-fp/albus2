from datetime import datetime

from pydantic import BaseModel


class SurveyCreate(BaseModel):
    course_id: str
    user: str
    rating_overall: int
    rating_content: int
    rating_albus: int
    rating_applicability: int
    difficulty: str   # muy_facil | facil | adecuada | dificil | muy_dificil
    duration: str     # corta | adecuada | larga
    comments: str | None = ""


class SurveyRead(SurveyCreate):
    id: int
    submitted_at: datetime

    model_config = {"from_attributes": True}
