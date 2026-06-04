# Albus · Training Platform

Turn a Confluence page into a structured course (modules → lessons → multiple-choice quiz),
then let people take it in a web UI with **Albus**, an AI tutor that gives live, source-grounded
quiz feedback. Built for OmniAccess internal training.

```
albusv2 frontend (:5174) ──▶ platform_back (:8001) ──▶ agents_back (:8000) ──▶ create-course skill
  React 19 + Vite             FastAPI + SQLite            headless `claude` agents
  (Vite proxy /api ─▶ :8001)  serves /api/* + manages     author courses from Confluence
                              courses, surveys, Albus chat
```

- **`albusv2/`** — the React learner frontend (what users open, on **:5174**).
- **`platform_back/`** — FastAPI + SQLite; the single `:8001` origin the frontend talks to.
- **`agents_back/`** — the course-generation engine (headless Claude agents).

The full backend/system documentation lives in **[`CLAUDE.md`](CLAUDE.md)**. This README focuses on
the **frontend** and the **API contract** it relies on.

> **Provenance.** `albusv2/` began as a self-contained export bundled with its own mock FastAPI
> backend, built while the real backend was in progress. That mock backend has since been
> **removed**: its Albus chat tutor (`chat.py`) and persona were **ported into `platform_back`**, and
> the frontend now talks to `platform_back`'s `/api/*` surface with no source changes.

---

## Run it

### Fresh server setup (first time on a new machine)

#### 1. Install Node.js 20+ and npm

```bash
# Using nvm (recommended — works on Linux/macOS/WSL)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc          # or restart your terminal
nvm install 20
nvm use 20
node -v && npm -v         # should print v20.x.x and 10.x.x
```

Alternatively on Debian/Ubuntu:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. Create the Python virtual environment and install dependencies

```bash
# From the repo root
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Optional: OpenAI TTS for podcast generation
.venv/bin/pip install openai
```

#### 3. Configure credentials

```bash
cp agents_back/.env.example agents_back/.env
# Edit agents_back/.env and fill in:
#   ATLASSIAN_EMAIL   — your Atlassian account email
#   ATLASSIAN_API_TOKEN — API token from id.atlassian.com
#   CONFLUENCE_URL    — e.g. https://yourorg.atlassian.net
#   ANTHROPIC_API_KEY — for the course-generation agents
#   OPENAI_API_KEY    — only needed for podcast TTS
```

#### 4. Initialize the database

The SQLite file is created automatically on first server start, but it starts empty.
Run the seed script once to create roles, default users, and register any existing
course JSON files:

```bash
cd platform_back && ../.venv/bin/python seed.py
```

This creates four users:

| Email | Name | Role |
|-------|------|------|
| `test1@example.com` | Severus | **Admin** |
| `test2@example.com` | Hermione | Technical |
| `admin@example.com` | Dobby | Sales |
| `enduser@example.com` | Luna | End-user |

`seed.py` is **idempotent** — safe to re-run; existing users are updated to match,
existing courses are skipped.

> **Existing database (upgrading).** If you pulled new code onto an existing install,
> run `migrate.py` before starting the server:
> ```bash
> cd platform_back && ../.venv/bin/python migrate.py
> ```
> It applies schema changes (new columns, FK migrations) without touching data and is
> safe to run on an already-up-to-date database.

Select **Severus** at login to access the Admin panel.

> If you already ran the backends and can't reach the Admin panel, clear
> `localStorage["albus_user"]` in your browser's DevTools (Application → Local Storage)
> and reload.

### Three processes (each in its own terminal), from the repo root

```bash
# 1. platform_back — FastAPI + SQLite, serves the frontend /api/* surface
cd platform_back && ../.venv/bin/python run.py            # :8001

# 2. albusv2 — the learner UI (open this one)
cd albusv2 && npm install && npm run dev                  # :5174  (Vite proxies /api → :8001)

# 3. agents_back — only needed to author/revise courses
cd agents_back && ../.venv/bin/python api.py              # :8000
```

Open **http://localhost:5174**. The Albus chat tutor needs the **`claude` CLI on PATH** (it streams
it for quiz feedback) and `platform_back` running as a single process — chat sessions are in-memory,
and `run.py`'s `reload=True` keeps it single-worker.

Production build: `cd albusv2 && npm run build` → outputs `dist/`; `npm run preview` to serve it.

### Toolchain / external deps
- **Node.js 20+** + npm, **Python 3.12** (shared `.venv` at the repo root).
- The frontend pins **React 19, Vite 8, TypeScript 6** — internally consistent. `node_modules/` and
  `dist/` are gitignored; run `npm install` (or `npm ci`) if the folder is missing.
- **Atlassian/Confluence credentials** (`ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `CONFLUENCE_URL`) in
  `agents_back/.env` (gitignored): used for course generation and the chat tutor's optional Confluence
  reference retrieval. The tutor degrades to course-only answers if they're absent.

---

## API contract (what the frontend calls)

All frontend network access is centralized in `albusv2/src/api.ts` + `src/useChat.ts` — exactly five
endpoints, all under `/api/*`, which the Vite dev server proxies to `platform_back` on `:8001`. The
course `id` is the JSON filename stem (a string), injected by the backend.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/courses` | Course summaries: `{id, title, description, language, module_count, lesson_count}`. |
| `GET`  | `/api/courses/{id}` | Full course object (schema below); `id` injected from the filename. 404 if missing. |
| `POST` | `/api/surveys` | End-of-course feedback (`Survey` model below). Persisted in SQLite. Returns `{ok: true}`. |
| `GET`  | `/api/surveys` | All survey records (for a future admin view). |
| `POST` | `/api/chat/session` | Create a chat session; returns a numeric `session_id`. |
| `GET`  | `/api/chat/stream` | **SSE** Albus tutor. Query: `message, course_id, session_id, lesson_id, quiz_phase (correct\|wrong_ask\|wrong_explain), question_id, chosen_index`. Streams `event: token/done/error` frames from the `claude` CLI. In quiz phases `correct`/`wrong_ask`, `message` may be empty. |

`Survey` model: `course_id, user, rating_overall (1-5), rating_content (1-5), rating_albus (1-5),
rating_applicability (1-5), difficulty (muy_facil|facil|adecuada|dificil|muy_dificil),
duration (corta|adecuada|larga), comments?`.

> Course **authoring** (Confluence browse + generation) is handled by the admin surface
> (`POST /api/admin/courses` → agents_back → headless Claude). New courses land as JSON files that
> `GET /api/courses` then lists for learners. See [`CLAUDE.md`](CLAUDE.md).

---

## Course JSON schema

`platform_back` serves these files verbatim (from `agents_back/agents_directory/json/`), injecting the
top-level `id` from the filename:

```jsonc
{
  "title": "string",
  "description": "string",
  "source": "string",              // provenance, e.g. "Confluence page 1727332382, space AD"
  "language": "en" | "es" | ...,
  "modules": [
    {
      "id": "string",
      "title": "string",
      "summary": "string?",
      "lessons": [
        {
          "id": "string",
          "title": "string",
          "content": "string (markdown)",
          "images": [              // optional; carried but not rendered by the current UI
            { "path": "images/<session>/...png", "caption": "string" }
          ],
          "questions": [
            {
              "id": "string",
              "question": "string",
              "answers": ["string", "string", "string", "string"],
              "correctAnswerIndex": 0,
              "explanation": "string"
            }
          ]
        }
      ]
    }
  ]
}
```

The matching TypeScript types live in `albusv2/src/api.ts` (`Course`, `Module`, `Lesson`, `Question`,
`CourseSummary`). The UI renders `lesson.content` (markdown) and delegates quiz explanations to the
Albus chat — `question.explanation` and `lesson.images` are carried in the data but not shown directly.

---

## Frontend architecture

- **State-based routing, not URL-based.** `App.tsx` holds a `route` union
  (`{name:"home"} | {name:"course", courseId} | {name:"admin"}`) in `useState` — no react-router, the
  browser URL doesn't change.
- **Auth is a stub.** `Login.tsx` picks a role (`Admin | Technical | Sales`) stored in
  `localStorage["albus_user"]`. No real auth/token; the role only gates UI (e.g. the Admin panel)
  client-side and reaches the backend only as the survey `user` field.
- **Progress** (`progress.ts`) is persisted per course in `localStorage`.
- **Chat** (`useChat.ts`) consumes the `/api/chat/stream` SSE and renders partial tokens live;
  `ChatPanel.tsx` is the UI, `Markdown.tsx` renders messages.
- **Surveys**: `Survey.tsx` posts to `/api/surveys` at course completion.
- All network access is centralized in `src/api.ts` + `src/useChat.ts`, so re-pointing the backend is
  a one-file change.

---

## Notes

- **Language.** Course content and some UI strings mix Spanish/English; survey enum values are Spanish
  tokens (`muy_facil`, `adecuada`, …) sent literally — keep them stable.
- **Secrets.** Credentials live in `agents_back/.env` (gitignored). Rotate before sharing the repo.
