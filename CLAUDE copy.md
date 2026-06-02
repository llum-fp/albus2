# Course Generator

Turns a Confluence page into a structured JSON course (modules → lessons →
multiple-choice questions), built by the `course-creator` agent.

Two backends:

```
frontend ─▶ platform_back (:8001) ─▶ agents_back (:8000) ─▶ course-creator agent
```

## Layout

- **`agents_back/`** — the engine.
  - `create_course.py` — CLI: builds a course, then lets you give feedback to
    revise it in the same session.
  - `api.py` — Flask API (`POST /create-course`) wrapping the same logic.
  - `agents_directory/` — Claude runs here, scoped so it can't touch the rest of
    the project. Agent lives in `agents_directory/.claude/agents/course-creator.md`;
    courses are written to `agents_directory/json/`.
- **`platform_back/`** — FastAPI backend (`POST /courses`) that forwards requests
  to agents_back and persists results in SQLite (`platform.db`). Entry point: `app.py`.
- **`.venv/`** — shared virtualenv (FastAPI, uvicorn, SQLAlchemy, pydantic). `example.json` — sample payload.

## Run the backends

```bash
# agents_back (engine) — terminal 1
cd agents_back && ../.venv/bin/python api.py            # :8000

# platform_back (forwarder) — terminal 2
cd platform_back && ../.venv/bin/python app.py          # :8001
```

## Call the API

```bash
# New course (page_id required; topic/profile/duration_min optional)
curl -s -X POST http://localhost:8001/courses \
     -H 'Content-Type: application/json' --data @example.json

# Continue / revise a course (reuse the returned session_id)
curl -s -X POST http://localhost:8001/courses -H 'Content-Type: application/json' \
     -d '{"session_id":"<uuid>","feedback":"make the quiz harder"}'

# Instant canned response, no build
curl -s -X POST http://localhost:8001/courses -H 'Content-Type: application/json' \
     -d '{"harcoded": true}'
```

Response: `{ "session_id": "...", "json_path": "...", "json_exists": true }`
(call agents_back directly on `:8000/create-course` to skip platform_back.)

## CLI instead of API

```bash
cd agents_back
./create_course.py 1727332382     # any Confluence page id; default 1727332382
# after it builds, type feedback ('exit' to quit) to revise the same file
```

## Review past Claude sessions

```bash
ls -lt ~/.claude/projects/-home-lfuster-projects-hackathon20/*.jsonl   # newest first
/resume          # resume a session inside Claude (or: claude --resume)
```

## Notes

- The Atlassian (Confluence) connection only works reliably in an interactive
  Claude session, not always in headless runs — the engine fetches the page
  itself and hands the content to the agent.
- The `harcoded` shortcut returns one fixed pre-built course JSON path.
