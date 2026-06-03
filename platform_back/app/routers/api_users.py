"""Frontend-facing user list — the login picker.

``GET /api/users`` returns the real users so the (stub) login screen can let
someone sign in *as* an existing user instead of picking a generic role. Only
id/name/role are exposed (no email). Consistent with the client-side stub auth:
this is identity selection, not authentication.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.crud.user import get_users
from app.database import get_db
from app.schemas.user import PublicUser

router = APIRouter(prefix="/api", tags=["frontend-users"])


@router.get("/users", response_model=list[PublicUser])
def list_public_users(db: Session = Depends(get_db)):
    return get_users(db, limit=1000)
