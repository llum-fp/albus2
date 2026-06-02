"""Seed the database with test users and one admin."""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
import app.models  # noqa: F401
from app.crud.user import get_user_by_email, create_user
from app.schemas.user import UserCreate

Base.metadata.create_all(bind=engine)

USERS = [
    UserCreate(email="test1@example.com", name="Test User 1", role="user"),
    UserCreate(email="test2@example.com", name="Test User 2", role="user"),
    UserCreate(email="admin@example.com", name="Admin User", role="admin"),
]

db = SessionLocal()
try:
    for data in USERS:
        if get_user_by_email(db, data.email):
            print(f"already exists: {data.email}")
        else:
            user = create_user(db, data)
            print(f"created [{user.role}] {user.name} <{user.email}> (id={user.id})")
finally:
    db.close()
