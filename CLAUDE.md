# Course Generator

Turns a Confluence page into a structured JSON course (modules → lessons →
multiple-choice questions) via the `create-course` skill: a `source-extractor`
agent reads the page, then a profile-specific course-creator agent
(`technical-course-creator` / `sales-course-creator`) authors the course.

Two backends + a learner frontend:

```
albusv2 frontend (:5174) ─▶ platform_back (:8001) ─▶ agents_back (:8000) ─▶ create-course skill
   (Vite proxy /api ─▶ :8001)      │                                        ├─ source-extractor (reads)
                                   │                                        └─ <profile>-course-creator (writes)
                                   └─ /api/* surface (courses, surveys, Albus chat tutor)
```

The React learner UI (`albusv2/`) talks only to platform_back's
`/api/*` routes; platform_back is the single `:8001` origin. The colleague's original
mock backend (`proyecto_exportacion/backend/`) has been **removed** — its chat tutor
(`chat.py`) and persona were ported into platform_back.

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
- **`platform_back/`** — FastAPI backend with SQLite persistence. Entry point: `run.py`.
  - `app/main.py` — FastAPI app + CORS, mounts routers, runs `create_all` on startup.
  - `app/config.py` — `COURSES_DIR` (= `agents_back/agents_directory/json`, the shared
    course-file source of truth) and `EXTRACTS_DIR` (= `agents_back/agents_directory/extract`,
    the source-extractor's Markdown extracts, used by the chat tutor for reference grounding);
    loads `agents_back/.env`, back-fills `CONFLUENCE_*` env names from `ATLASSIAN_*` (now only
    needed for the chat's Confluence *fallback*).
  - `app/models/` — SQLAlchemy models: `Course`, `User`, `Survey`.
  - `app/schemas/` — Pydantic v2 schemas (course, user, survey).
  - `app/crud/` — DB operations for courses, users, surveys.
  - **Internal/management surface (integer course ids):**
    - `app/routers/courses.py` — `GET/POST /courses/`, `GET/PATCH /courses/{id}`.
    - `app/routers/users.py` — `GET/POST /users/`, `GET /users/{id}`.
    - `app/services/agents_back.py` — httpx client → agents_back `/create-course`, `/update-course`.
  - **Frontend-facing `/api/*` surface (the albusv2 contract; string filename-stem ids):**
    - `app/routers/api_courses.py` — `GET /api/courses` (summaries), `GET /api/courses/{id}`
      (full course JSON served verbatim from `COURSES_DIR` with `id` injected from the filename).
    - `app/routers/api_surveys.py` — `POST/GET /api/surveys` (persisted in SQLite).
    - `app/routers/api_pages.py` — `GET /api/find-pages?topic=&limit=` — fast Confluence page
      search (no LLM). Returns `{ "pages": [ { "page_id", "page_title", "brief_description" } ] }`.
      Runs a 3-step cascade, stopping at the first hit: (1) **page-id prefix** — if `topic` is all
      digits, returns pages whose id *begins with* those digits via a local id index
      (`app/services/page_index.py`; Confluence CQL has no id-prefix operator, so it's served
      locally); (2) **title** (CQL `title ~`); (3) **full text** (CQL `text ~`, the original path).
      `GET /api/page/{id}` does an exact id lookup. `POST /api/page-index/refresh` rebuilds the
      local id index by crawling every page (cursor pagination via `_links.next`, cached in memory
      + `platform_back/page_index.json`, 1h TTL). Creds (CONFLUENCE_URL + ATLASSIAN_*) stay
      server-side, so the UI can call it directly.
    - `app/routers/chat.py` — Albus quiz-tutor: `POST /api/chat/session`, `GET /api/chat/stream`
      (SSE). Ported from the colleague backend; streams the local `claude` CLI and reads
      courses from `COURSES_DIR`. For per-question reference grounding it reads the
      source-extractor's local extract (`load_extract` → `EXTRACTS_DIR/source_<sid>.md`, paired
      with the course by session id) — faithful, image-aware, multi-page, no network — and only
      falls back to a live Confluence fetch when a course has no extract. `app/albus_persona.md`
      is its persona; `app/util/html.py` holds `strip_html`. Sandbox: `platform_back/claude-sandbox/`
      (gitignored).
  - `platform.db` — SQLite database (auto-created on first run).
- **`albusv2/`** — React 19 + Vite learner frontend (dev `:5174`). All
  backend calls go through `src/api.ts` + `src/useChat.ts` (5 `/api/*` endpoints); the Vite
  proxy forwards `/api` → `:8001`. No source changes were needed to target platform_back.
- **`.venv/`** — shared virtualenv (FastAPI, uvicorn, SQLAlchemy 2.x, pydantic v2, httpx,
  requests, beautifulsoup4, anthropic). `example.json` — sample payload.

## Run the backends

```bash
# agents_back (engine) — terminal 1  (only needed to author/revise courses)
cd agents_back && ../.venv/bin/python api.py            # :8000

# platform_back (FastAPI + SQLite, also serves the frontend /api/*) — terminal 2
cd platform_back && ../.venv/bin/python run.py          # :8001

# albusv2 learner frontend — terminal 3
cd albusv2 && npm install && npm run dev   # :5174 (proxies /api → :8001)
```

Open the UI at `http://localhost:5174`. The Albus chat tutor needs the `claude` CLI on
PATH (it streams it for quiz feedback) and runs platform_back as a single process
(chat sessions are in-memory) — `run.py`'s `reload=True` keeps it single-worker.

## Call the API

```bash
# New course (page_id required; topic/profile/duration_min optional)
curl -s -X POST http://localhost:8001/courses/ \
     -H 'Content-Type: application/json' --data @example.json

# Revise an existing course (use the db id returned at creation)
curl -s -X PATCH http://localhost:8001/courses/<db_id> \
     -H 'Content-Type: application/json' \
     -d '{"feedback": "make the quiz harder"}'

# Get course detail (full content)
curl -s http://localhost:8001/courses/<db_id>

# Get course detail (compact preview, first 2 modules only)
curl -s 'http://localhost:8001/courses/<db_id>?preview=true&max_modules=2'

# Instant canned response, no build
curl -s -X POST http://localhost:8001/courses/ -H 'Content-Type: application/json' \
     -d '{"harcoded": true}'
```

Response (POST): `{ "session_id": "...", "json_path": "...", "json_exists": true, "db_id": 1 }`

Docs interactivas: `http://localhost:8001/docs`

Call agents_back directly on `:8000` to skip platform_back:
- `POST /create-course` (needs `page_id`) — new course
- `POST /update-course` (needs `session_id` + `feedback`) — revise

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

## Podcast (audio overview)

Turn a finished course into a NotebookLM-style **two-host audio "deep dive"**. The
generate button lives in the **admin** course panel (`albusv2` `AdminCourses`);
learners get a read-only player in the course viewer when a podcast exists.

Flow (mirrors course creation): admin `POST /api/admin/courses/{db_id}/podcast`
→ platform_back background worker → agents_back `POST /create-podcast` (the
`create-podcast` skill delegates to the `podcast-scriptwriter` agent, which writes
`agents_directory/podcast/script_<sid>.json`) → platform_back's TTS service
(`platform_back/app/services/tts.py`, **OpenAI TTS**: each turn synthesized with
one of two voices, stitched into one WAV via the stdlib `wave` module — no ffmpeg)
writes `agents_directory/podcast/podcast_<sid>.wav` → served at
`/api/podcasts/podcast_<sid>.wav` (a `StaticFiles` mount, like `/api/media`).
State lives on the `Course` row (`podcast_status` none|pending|completed|failed,
`podcast_path`); `GET /api/courses/{id}` injects `podcast_url` when the audio file
exists, which is what gates the learner player.

- **agents_back:** `agents_directory/.claude/skills/create-podcast/`,
  `.claude/agents/podcast-scriptwriter.md`, `.claude/podcast-schema.md` (the script
  JSON contract); `POST /create-podcast` (needs `session_id` or `course_path`;
  optional `language`, `target_min`) writes `podcast/script_<sid>.json`.
- **platform_back:** `app/services/tts.py`; `PODCASTS_DIR` in `app/config.py`; the
  `/api/podcasts` mount + `ensure_podcast_columns` migration in `app/main.py`;
  `_podcast_worker` + `POST /api/admin/courses/{id}/podcast` in `app/routers/admin.py`.
- **Setup:** put `OPENAI_API_KEY` in `agents_back/.env` (see `.env.example`); course
  build + chat work without it. Optional `PODCAST_TTS_MODEL` (default
  `gpt-4o-mini-tts`), `PODCAST_VOICE_HOST` (`onyx`), `PODCAST_VOICE_COHOST` (`nova`).
  Install the SDK once: `.venv/bin/pip install openai`.

Generate just the script (skip audio) for quick testing:

```bash
curl -s -X POST http://localhost:8000/create-podcast \
     -H 'Content-Type: application/json' -d '{"session_id": "<course session id>"}'
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
