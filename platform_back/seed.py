"""Seed the database with one user per access role.

Roles must match what the app uses for gating and the login picker:
`Admin` | `Technical` | `Sales` (NOT the old lowercase user/admin). Idempotent
and self-healing: if a user already exists, its name/role are updated to match,
so running this also fixes databases seeded with the old roles.

Courses are NOT seeded here — they are reconciled from the JSON files in
agents_back/agents_directory/json on app startup (see services/course_sync.py).
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
import app.models  # noqa: F401
from app.crud.user import create_user, get_user_by_email, update_user
from app.schemas.user import UserCreate, UserUpdate

Base.metadata.create_all(bind=engine)

USERS = [
    UserCreate(email="test1@example.com", name="Severus", role="Admin"),
    UserCreate(email="test2@example.com", name="Hermione", role="Technical"),
    UserCreate(email="admin@example.com", name="Dobby", role="Sales"),
]

db = SessionLocal()
try:
    for data in USERS:
        existing = get_user_by_email(db, data.email)
        if existing:
            update_user(db, existing.id, UserUpdate(name=data.name, role=data.role))
            print(f"updated  [{data.role}] {data.name} <{data.email}> (id={existing.id})")
        else:
            user = create_user(db, data)
            print(f"created  [{user.role}] {user.name} <{user.email}> (id={user.id})")
finally:
    db.close()
