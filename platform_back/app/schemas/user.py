from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: str
    name: str
    role: str = "user"


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    role: str | None = None


class UserRead(BaseModel):
    id: int
    email: str
    name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PublicUser(BaseModel):
    """Minimal user identity for the login picker (no email exposed)."""
    id: int
    name: str
    role: str

    model_config = {"from_attributes": True}
