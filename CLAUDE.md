# Course Generator

Turns a Confluence page into a structured JSON course (modules → lessons →
multiple-choice questions) via the `create-course` skill: a `source-extractor`
agent reads the page, then a profile-specific course-creator agent
(`technical-course-creator` / `sales-course-creator`) authors the course.

Two backends:

```
frontend ─▶ platform_back (:8001) ─▶ agents_back (:8000) ─▶ create-course skill
                                                            ├─ source-extractor (reads)
                                                            └─ <profile>-course-creator (writes)
```

## Layout

- **`agents_back/`** — the engine.
  - `create_course.py` — CLI: builds a course, then lets you give feedback to
    revise it in the same session.
  - `api.py` — Flask API (`POST /create-course`) wrapping the same logic.
  - `agents_directory/` — Claude runs here, scoped so it can't touch the rest of
    the project. The `create-course` skill lives in
    `agents_directory/.claude/skills/create-course/`, the agents in
    `agents_directory/.claude/agents/` (`source-extractor`,
    `technical-course-creator`, `sales-course-creator`), and the shared JSON
    schema in `agents_directory/.claude/course-schema.md`. Source extracts are
    written to `agents_directory/extract/`, courses to `agents_directory/json/`.
- **`platform_back/`** — thin Flask backend (`POST /courses`) that just forwards
  the request to agents_back (`helpers/call_agents_back.py`).
- **`.venv/`** — shared virtualenv with Flask. `example.json` — sample payload.

## Run the backends

```bash
# agents_back (engine) — terminal 1
cd agents_back && ../.venv/bin/python api.py            # :8000

# platform_back (forwarder) — terminal 2
cd platform_back && ../.venv/bin/python api.py          # :8001
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

platform_back keeps a single `POST /courses` endpoint and routes by payload:
a `session_id` forwards to agents_back `POST /update-course`, otherwise to
`POST /create-course`. Call agents_back directly on `:8000` to skip
platform_back — `/create-course` (needs `page_id`) for new courses,
`/update-course` (needs `session_id` + `feedback`) to revise.

## CLI instead of API

```bash
cd agents_back
./create_course.py 1727332382                   # any page id; default 1727332382
./create_course.py 1727332382 --profile sales   # technical (default) or sales
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
- **Confluence images.** The `source-extractor` agent downloads page screenshots
  itself (not the main agent) and reads them to describe their real content, via
  the `download-confluence-images` skill
  (`agents_directory/.claude/skills/download-confluence-images/`, which bundles
  `download_images.sh`). The MCP tools only return page text, so image binaries
  are pulled from the media API with HTTP Basic auth via the Atlassian gateway:
  `https://api.atlassian.com/ex/confluence/<cloudId>/wiki<downloadLink>` (the
  plain `<site>/wiki/download/...` path is CDN-fronted and rejects Basic auth).
  Credentials come from `ATLASSIAN_EMAIL` + `ATLASSIAN_API_TOKEN`, read from
  `agents_back/.env` (gitignored; see `.env.example`) by `create_course.load_env()`
  and inherited by the headless `claude` subprocess. Images are saved to
  `agents_directory/images/<session_id>/` and referenced by both the extract
  (inline) and the course JSON (optional per-lesson `images` array). Without the
  token the extractor falls back to image metadata + text descriptions.
