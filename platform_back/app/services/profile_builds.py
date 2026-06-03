"""Track the state of background profile-agent builds (POST /api/admin/profiles).

A profile's course-creator agent is authored by a headless `claude` run in
agents_back (~minutes). We kick that off in a background thread and report status
without blocking the request. Status is:

  - ``ready``    — the agent file exists on disk (derived, survives restarts);
  - ``pending``  — a build is in flight (tracked in-memory; single worker);
  - ``failed``   — the last build finished without producing the file;
  - ``none``     — no build tracked and no file (e.g. a role with no agent yet).

In-memory tracking is fine because platform_back runs as a single process
(run.py keeps one worker); ``ready`` is derived from the file so it is correct
even after a reload that clears the in-memory map.
"""
from pathlib import Path

from app.config import COURSES_DIR

# COURSES_DIR == agents_back/agents_directory/json -> its parent is agents_directory.
_AGENTS_DIR = COURSES_DIR.parent / ".claude" / "agents"

# slug -> "pending" | "failed" (transient; "ready" is derived from the file).
_builds: dict[str, str] = {}


def agent_file(slug: str) -> Path:
    return _AGENTS_DIR / f"{slug}-course-creator.md"


def mark_pending(slug: str) -> None:
    _builds[slug] = "pending"


def mark_failed(slug: str) -> None:
    _builds[slug] = "failed"


def clear(slug: str) -> None:
    """Drop transient state (e.g. on success — status then derives ``ready``)."""
    _builds.pop(slug, None)


def agent_status(slug: str) -> str:
    if agent_file(slug).is_file():
        return "ready"
    return _builds.get(slug, "none")
