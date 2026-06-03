#!/usr/bin/env python3
"""FastAPI app that builds and revises courses. Two endpoints:

POST /create-course — build a NEW course. `page_id` is required (or `page_ids`, a
list, to combine multiple pages into one course); topic/profile/duration_min are
optional steering fields. (Set {"harcoded": true} to skip the build and get a
canned response.)
    {
      "page_id": "1548222468",
      "page_ids": ["1548222468", "1548222469"],
      "topic": "Captive Portal v4.0.6 Support Guide Scenic",
      "profile": "technical support",
      "duration_min": "60"
    }

POST /update-course — REVISE an existing course. Pass the `session_id` returned
by /create-course and the change request in `feedback`. It resumes that session
and edits the same course file in place:
    { "session_id": "<uuid>", "feedback": "make the quiz harder" }

Both return:
    { "session_id": "<uuid>", "json_path": "<abs path>", "json_exists": true }

Run (use the project venv that has FastAPI + uvicorn):
    ./.venv/bin/python api.py            # listens on 0.0.0.0:8000 (override with PORT)
    ./.venv/bin/uvicorn api:app --host 0.0.0.0 --port 8000   # or run uvicorn directly
Call:
    curl -s -X POST http://localhost:8000/create-course \
         -H 'Content-Type: application/json' --data @example.json
    curl -s -X POST http://localhost:8000/update-course \
         -H 'Content-Type: application/json' --data @example_feedback.json
"""
import logging
import os
import time
import uuid

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from create_course import (
    AGENTS_DIR,
    DEFAULT_MODEL,
    build_course_prompt,
    normalize_page_ids,
    run_claude,
)

PORT = int(os.environ.get("PORT", "8000"))

# Logging: level via LOG_LEVEL env (default INFO). Each line carries a timestamp
# and the session_id, so a single course build can be traced end to end.
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger("agents_back.api")

# Canned response returned when the payload sets "harcoded": true — skips the
# build entirely and points at the single pre-built course JSON.
HARDCODED_RESPONSE = {
    "json_exists": True,
    "json_path": "/home/lfuster/projects/hackathon20/agents_back/agents_directory/json/course_14a0494d-d694-4744-8b01-1272b4c99c4b.json",
    "session_id": "14a0494d-d694-4744-8b01-1272b4c99c4b",
}

app = FastAPI(title="agents_back course API")


class CreateCourseRequest(BaseModel):
    page_id: str | int | None = None
    page_ids: list[str | int] | None = None
    topic: str = ""
    profile: str = ""
    duration_min: str | int = ""
    harcoded: bool = False
    # Optional caller-supplied id. When given (e.g. platform_back), the build
    # uses it instead of generating one, so the caller knows it up front and can
    # track progress by watching the per-session files this build writes.
    session_id: str | None = None


class UpdateCourseRequest(BaseModel):
    session_id: str | None = None
    feedback: str = ""


class CourseResponse(BaseModel):
    session_id: str
    json_path: str
    json_exists: bool


def _run(session_id: str, prompt: str, resume: bool) -> dict:
    """Shared runner: invoke one headless claude turn for `session_id`, time it,
    log it, and return the standard {session_id, json_path, json_exists} reply."""
    rel_path = f"json/course_{session_id}.json"
    json_path = AGENTS_DIR / rel_path

    AGENTS_DIR.mkdir(parents=True, exist_ok=True)
    log.info("[%s] invoking claude (resume=%s) -> %s", session_id, resume, rel_path)
    log.info("[%s] model: %s", session_id, DEFAULT_MODEL)
    log.debug("[%s] prompt: %s", session_id, prompt)
    started = time.monotonic()
    rc = run_claude(prompt, AGENTS_DIR, session_id, resume=resume, model=DEFAULT_MODEL)
    elapsed = time.monotonic() - started
    if rc != 0:
        log.error("[%s] claude exited with code %s after %.1fs", session_id, rc, elapsed)
        raise RuntimeError(f"claude exited with code {rc}")

    exists = json_path.is_file()
    log.info(
        "[%s] done in %.1fs: json_exists=%s path=%s", session_id, elapsed, exists, json_path
    )
    if not exists:
        log.warning("[%s] claude exited 0 but no course file at %s", session_id, json_path)

    return {
        "session_id": session_id,
        "json_path": str(json_path),
        "json_exists": exists,
    }


def build_new_course(req: CreateCourseRequest) -> dict:
    """Build a brand-new course from a Confluence page via the create-course skill."""
    session_id = req.session_id or str(uuid.uuid4())
    ids = normalize_page_ids(req.page_id, req.page_ids)
    rel_path = f"json/course_{session_id}.json"
    extract_path = f"extract/source_{session_id}.md"
    log.info(
        "[%s] new course: page_ids=%s profile=%r topic=%r duration_min=%r",
        session_id, ids, req.profile, req.topic, req.duration_min,
    )
    # Delegate the whole procedure to the create-course skill (the "recipe");
    # api.py only supplies the per-request details. Invoked explicitly by slash
    # command for deterministic headless behavior.
    prompt = build_course_prompt(
        ids, req.profile, req.topic, req.duration_min, extract_path, rel_path
    )
    return _run(session_id, prompt, resume=False)


def revise_course(req: UpdateCourseRequest) -> dict:
    """Revise an existing course by resuming its session and applying feedback."""
    session_id = str(req.session_id)
    rel_path = f"json/course_{session_id}.json"
    log.info("[%s] revise: %s (feedback=%r)", session_id, rel_path, req.feedback)
    # The resumed session retains its context, so it already knows which profile
    # course-creator authored this file — just ask it to revise.
    change = req.feedback or "improve and refine the course"
    prompt = (
        "Use the same profile course-creator agent you used before to revise the "
        f"existing JSON course at {rel_path}, editing the file in place and keeping "
        "it valid JSON that matches the schema in .claude/course-schema.md, based on "
        f"this feedback: {change}"
    )
    return _run(session_id, prompt, resume=True)


# Endpoints are sync `def` so Starlette runs them in a threadpool — the blocking
# `claude` subprocess never stalls the event loop.
@app.post("/create-course", response_model=CourseResponse)
def create_course(req: CreateCourseRequest):
    log.info("POST /create-course: %s", req.model_dump())
    if req.harcoded:
        log.info("returning hardcoded response (build skipped)")
        return HARDCODED_RESPONSE
    if not (req.page_id or req.page_ids):
        log.warning("rejected request: missing 'page_id' or 'page_ids' (required for a new course)")
        raise HTTPException(status_code=400, detail="missing 'page_id' or 'page_ids' (required for a new course)")
    try:
        return build_new_course(req)
    except Exception as exc:  # noqa: BLE001 - surface any failure as JSON
        log.exception("build_new_course failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/update-course", response_model=CourseResponse)
def update_course(req: UpdateCourseRequest):
    log.info("POST /update-course: %s", req.model_dump())
    if not req.session_id:
        log.warning("rejected request: missing 'session_id' (required to update a course)")
        raise HTTPException(status_code=400, detail="missing 'session_id' (required to update a course)")
    if not req.feedback:
        log.warning("rejected request: missing 'feedback' (required to update a course)")
        raise HTTPException(status_code=400, detail="missing 'feedback' (required to update a course)")
    try:
        return revise_course(req)
    except Exception as exc:  # noqa: BLE001 - surface any failure as JSON
        log.exception("revise_course failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


if __name__ == "__main__":
    log.info("Listening on http://0.0.0.0:%s  (POST /create-course, /update-course)", PORT)
    uvicorn.run(app, host="0.0.0.0", port=PORT)
