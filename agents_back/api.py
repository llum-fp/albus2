#!/usr/bin/env python3
"""Very simple Flask API that builds a course and returns its session_id and
json_path.

POST any JSON shaped like example.json, e.g.:
    {
      "page_id": "1548222468",
      "topic": "Captive Portal v4.0.6 Support Guide Scenic",
      "profile": "technical support",
      "duration_min": "60"
    }
`page_id` is required for a NEW course; the rest steer it and are optional.

To CONTINUE a conversation, pass the `session_id` returned by a previous call
(and put the change request in `feedback`). It resumes that session and edits
the same course file in place:
    { "session_id": "<uuid>", "feedback": "make the quiz harder" }

Response:
    { "session_id": "<uuid>", "json_path": "<absolute path to the .json>" }

Run (use the project venv that has Flask):
    ./.venv/bin/python api.py      # listens on 0.0.0.0:8000 (override with PORT env var)
Call:
    curl -s -X POST http://localhost:8000/create-course \
         -H 'Content-Type: application/json' --data @example.json
"""
import os
import uuid

from flask import Flask, jsonify, request

from create_course import AGENTS_DIR, run_claude

PORT = int(os.environ.get("PORT", "8000"))

# Canned response returned when the payload sets "harcoded": true — skips the
# build entirely and points at the single pre-built course JSON.
HARDCODED_RESPONSE = {
    "json_exists": True,
    "json_path": "/home/lfuster/projects/hackathon20/agents_directory/json/course_14a0494d-d694-4744-8b01-1272b4c99c4b.json",
    "session_id": "14a0494d-d694-4744-8b01-1272b4c99c4b",
}

app = Flask(__name__)


def build_course(payload: dict) -> dict:
    topic = payload.get("topic", "")
    profile = payload.get("profile", "")
    duration_min = payload.get("duration_min", "")
    feedback = payload.get("feedback", "")

    # Optional session_id: when given, resume that conversation and revise the
    # course it already produced; otherwise start a fresh session.
    given_session = payload.get("session_id")
    resume = bool(given_session)
    session_id = str(given_session) if resume else str(uuid.uuid4())
    rel_path = f"json/course_{session_id}.json"
    json_path = AGENTS_DIR / rel_path

    if resume:
        change = feedback or topic or "improve and refine the course"
        prompt = (
            "Use the course-creator agent (subagent_type: course-creator) to revise "
            f"the existing JSON course at {rel_path}, editing the file in place and "
            "keeping it valid JSON that matches the agent's modules -> lessons -> "
            f"multiple-choice-questions schema, based on this feedback: {change}"
        )
    else:
        page_id = str(payload["page_id"])
        prompt = (
            "Use the course-creator agent (subagent_type: course-creator) to create a "
            f"structured JSON course from Confluence page id {page_id}, following the "
            "agent's modules -> lessons -> multiple-choice-questions schema (each "
            "question has exactly 4 options and one correct answer). "
            f"Audience/profile: {profile or 'general'}. "
            f"Target duration: {duration_min or 'unspecified'} minutes. "
            f"Topic focus: {topic or 'the whole page'}. "
            "Save it as a single valid .json file at exactly this path: "
            f"{rel_path} (create the json/ directory if needed). Do not save it anywhere else."
        )

    AGENTS_DIR.mkdir(parents=True, exist_ok=True)
    rc = run_claude(prompt, AGENTS_DIR, session_id, resume=resume)
    if rc != 0:
        raise RuntimeError(f"claude exited with code {rc}")

    return {
        "session_id": session_id,
        "json_path": str(json_path),
        "json_exists": json_path.is_file(),
    }


@app.post("/create-course")
def create_course():
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify(error="invalid or missing JSON body"), 400
    if payload.get("harcoded") is True:
        return jsonify(HARDCODED_RESPONSE)
    if not payload.get("session_id") and not payload.get("page_id"):
        return jsonify(error="missing 'page_id' (required for a new course)"), 400
    try:
        return jsonify(build_course(payload))
    except Exception as exc:  # noqa: BLE001 - return any failure as JSON
        return jsonify(error=str(exc)), 500


if __name__ == "__main__":
    print(f"Listening on http://0.0.0.0:{PORT}  (POST /create-course)")
    app.run(host="0.0.0.0", port=PORT)
