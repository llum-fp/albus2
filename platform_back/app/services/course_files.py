"""Helpers for the course JSON files in ``COURSES_DIR``.

Two ids refer to the same course:
- the **filename stem** ``course_<uuid>`` — the string id the frontend uses;
- the **session_id** ``<uuid>`` — what the DB ``Course`` row and the agents
  pipeline use.

These helpers convert between them and read metadata/counts from a course JSON,
shared by the management router and the admin router so the logic lives once.
"""
import json
import os

from app.config import COURSES_DIR

_PREFIX = "course_"


def session_to_stem(session_id: str) -> str:
    """``<uuid>`` -> ``course_<uuid>`` (idempotent if already prefixed)."""
    return session_id if session_id.startswith(_PREFIX) else f"{_PREFIX}{session_id}"


def stem_to_session(stem: str) -> str:
    """``course_<uuid>`` -> ``<uuid>`` (idempotent if no prefix)."""
    return stem[len(_PREFIX):] if stem.startswith(_PREFIX) else stem


def json_path_for_session(session_id: str) -> str:
    return str(COURSES_DIR / f"{session_to_stem(session_id)}.json")


def read_course_meta(path: str | None) -> dict:
    """Title/description/language from a course JSON, or {} if missing/unreadable."""
    if not path or not os.path.exists(path):
        return {}
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return {}
    return {k: data.get(k) for k in ("title", "description", "language")}


def course_counts(path: str | None) -> tuple[int, int]:
    """(module_count, lesson_count) from a course JSON, or (0, 0) if unavailable."""
    if not path or not os.path.exists(path):
        return (0, 0)
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return (0, 0)
    modules = data.get("modules", [])
    return (len(modules), sum(len(m.get("lessons", [])) for m in modules))
