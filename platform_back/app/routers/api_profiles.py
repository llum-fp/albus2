"""Frontend-facing profile list — ``GET /api/profiles`` (public, no admin gate).

Lets the learner/admin UI populate department dropdowns dynamically instead of a
hardcoded ``technical | sales`` list. A "profile" is a non-Admin role row; the
slug (== the value tagged onto a course's ``profile``) is derived from its name.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.crud.role import get_roles
from app.schemas.admin import ProfileRead
from app.services import profile_builds
from app.util.slug import slugify

router = APIRouter(prefix="/api", tags=["profiles"])


@router.get("/profiles", response_model=list[ProfileRead])
def list_profiles(db: Session = Depends(get_db)):
    out = []
    for r in get_roles(db):
        if r.name == "Admin":
            continue
        slug = slugify(r.name)
        out.append({"id": r.id, "name": r.name, "slug": slug,
                    "agent_status": profile_builds.agent_status(slug)})
    return out
