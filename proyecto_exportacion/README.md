# Albus · Training Platform — Export Package

This package contains a **self-contained, runnable export** of the Albus training platform:
a **React 19 + Vite** frontend (`albusv2/`, served on port **5174**) and a **FastAPI**
backend (`backend/`, served on port **8001**). The frontend proxies all `/api/*` calls to
the backend, so both processes must run together.

> **Audience note:** This README is written so that both a human developer **and an AI coding
> agent** can understand the system and **integrate it into a pre-existing project that may
> have conflicting conventions** (different ports, build tooling, auth, persistence, routing,
> etc.). See the **"Integration guide"** section at the end for how to reconcile discrepancies.

---

## 1. Repository layout

```
proyecto_exportacion/
├── README.md
├── albusv2/                  # FRONTEND — the web app running on :5174
│   ├── index.html            # Vite entry; loads Google Fonts (IBM Plex Sans/Mono)
│   ├── package.json          # React 19, Vite 8, TypeScript 6 (see "Version caveats")
│   ├── vite.config.ts        # dev server :5174, strictPort, proxy /api -> :8001
│   ├── tsconfig.json         # standalone (only "include": ["src"])
│   ├── public/               # static SVGs (Albus icon + OmniAccess logos)
│   └── src/
│       ├── main.tsx          # React root
│       ├── App.tsx           # top-level view router (state-based, NOT react-router)
│       ├── api.ts            # all backend calls + shared TypeScript types
│       ├── useChat.ts        # SSE hook for the Albus chat stream
│       ├── progress.ts       # per-course progress persisted in localStorage
│       ├── app.css / theme.css
│       └── components/        # Home, CourseViewer, ChatPanel, QuizQuestion,
│                              # Survey, AdminPanel, Login, Markdown, UserMenu, etc.
└── backend/                  # API — FastAPI on :8001
    ├── main.py               # course/survey/Confluence endpoints + app wiring
    ├── chat.py               # APIRouter(prefix="/api/chat") — Albus chat (SSE)
    ├── minerva.py            # course generation from Confluence via Anthropic
    ├── albus_persona.md      # system-persona text loaded by chat.py
    ├── requirements.txt
    ├── .env                  # REAL credentials (see "Security" below)
    ├── .env.example          # template
    └── data/
        └── courses/          # one JSON file per course; filename (minus .json) = course id
```

There is **no database**. State lives in:
- `backend/data/courses/*.json` — course content (read-only at runtime).
- `backend/data/surveys.jsonl` — survey submissions, appended one JSON object per line.
  Created automatically on first submission.
- Browser `localStorage` — current user role (`albus_user`) and per-course progress.

---

## 2. How to run

### Backend (`:8001`)
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
# If the venv has no pip (some distros ship venv without ensurepip), bootstrap it:
#   python -m ensurepip --upgrade   ||   sudo apt install python3-venv
pip install -r requirements.txt
# .env is already included with working credentials; otherwise: cp .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend (`:5174`)
```bash
cd albusv2
npm install
npm run dev        # http://localhost:5174  (Vite proxies /api -> http://localhost:8001)
```

Production build: `npm run build` → outputs `dist/`; `npm run preview` to serve it.

### External dependencies
- **Node.js 20+** and **npm**, **Python 3.8+**.
- **Anthropic API key** (`ANTHROPIC_API_KEY`) — used by `minerva.py` for course generation.
- **Confluence credentials** (`CONFLUENCE_URL`, `CONFLUENCE_EMAIL`, `CONFLUENCE_API_TOKEN`) —
  used by `main.py` (browse spaces/pages) and `minerva.py` (source content). Only needed for
  the course-generation flow; serving existing courses + chat does not require Confluence.
- **Claude CLI** — `chat.py` shells out to `claude -p --output-format stream-json
  --include-partial-messages` inside an isolated sandbox dir (`backend/claude-sandbox/`,
  auto-created). The `claude` binary **must be on PATH** for the Albus chat to work. The chat
  intentionally runs without CLAUDE.md / MCP / user memory.

---

## 3. Backend API reference

Base URL `http://localhost:8001`. CORS is wide open (`allow_origins=["*"]`).

### Courses
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/courses` | List course summaries: `{id, title, description, language, module_count, lesson_count}`. `id` = filename without `.json`. |
| `GET`  | `/api/courses/{course_id}` | Full course object (see schema below). 404 if missing. |

### Surveys (end-of-course feedback)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/surveys` | Body = `Survey` model (below). Appends a line to `data/surveys.jsonl` with a `submitted_at` UTC timestamp. Returns `{ok: true}`. |
| `GET`  | `/api/surveys` | Returns all survey records (used by the Admin panel). |

`Survey` model: `course_id, user, rating_overall (1-5), rating_content (1-5),
rating_albus (1-5), rating_applicability (1-5), difficulty
(muy_facil|facil|adecuada|dificil|muy_dificil), duration (corta|adecuada|larga),
comments?`.

### Confluence + Minerva (course authoring)
| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/spaces` | Global Confluence spaces (personal `~` spaces excluded). |
| `GET`  | `/api/spaces/{space_key}/pages?limit=` | Pages in a space. |
| `GET`  | `/api/pages/{page_id}` | Page text (HTML stripped) + source URL. |
| `POST` | `/api/minerva/generate/{page_id}` | Generate a course JSON from a Confluence page via Anthropic. **Note:** returns the generated course; it does not auto-persist to `data/courses/` — saving is a separate/manual step. |

### Chat (Albus) — `APIRouter(prefix="/api/chat")`
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat/session` | Create a chat session, returns a numeric `session_id`. |
| `GET`  | `/api/chat/stream` | **Server-Sent Events** stream. Query params: `message`, `course_id`, `session_id`, `lesson_id`, `quiz_phase` (`correct`\|`wrong_ask`\|`wrong_explain`), `question_id`, `chosen_index`. In quiz phases `correct`/`wrong_ask` the user `message` may be empty (the UI triggers it from the answer selection). Streams SSE `event:`/`data:` frames produced by the Claude CLI. |

The chat does lightweight **RAG**: `chat.py` chunks the course content and optionally a linked
Confluence page (`retrieve_relevant_chunks`, `build_reference_block`) and injects the most
relevant chunks into the system prompt alongside `albus_persona.md`.

---

## 4. Course JSON schema

Each file in `data/courses/<id>.json`:
```jsonc
{
  "title": "string",
  "description": "string",
  "source": "string|object",     // provenance (e.g. Confluence page); free-form
  "language": "es" | "en" | ...,
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
          "questions": [
            {
              "id": "string",
              "question": "string",
              "answers": ["string", ...],
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
The `id` returned by the API is always **derived from the filename**, overriding any `id`
inside the JSON. The matching TypeScript types live in `albusv2/src/api.ts`
(`Course`, `Module`, `Lesson`, `Question`, `CourseSummary`).

---

## 5. Frontend architecture

- **Routing is state-based, not URL-based.** `App.tsx` holds a `route` union
  (`{name:"home"} | {name:"course", courseId} | {name:"admin"}`) in `useState` — there is **no
  react-router**, and navigation does not change the browser URL.
- **Auth is a stub.** `Login.tsx` only asks for a role: `"Admin" | "Technical" | "Sales"`,
  stored in `localStorage["albus_user"]`. There is **no real authentication or session token**;
  the role gates UI (e.g. the Admin panel) only on the client.
- **Progress** (`progress.ts`) is persisted per course in `localStorage`.
- **Chat** (`useChat.ts`) consumes the SSE stream from `/api/chat/stream` and renders partial
  tokens live; `ChatPanel.tsx` is the UI. Markdown is rendered by `Markdown.tsx`.
- **Surveys**: `Survey.tsx` posts to `/api/surveys`; `AdminPanel.tsx` reads `/api/surveys`.
- All network access is centralized in `src/api.ts` and `src/useChat.ts` — these are the only
  two files that reference `/api/...`, which makes re-pointing the backend trivial.

---

## 6. Security

⚠️ **`backend/.env` contains live secrets** (`ANTHROPIC_API_KEY` and a Confluence API token).
This was included at the owner's explicit request. Before sharing further or committing to any
repo: **rotate these keys**, move them to the target project's secret store, and ensure `.env`
is git-ignored. `.env.example` documents the required variable names.

---

## 7. Integration guide (for an AI agent merging this into an existing project)

When grafting this onto a codebase that already exists, expect and resolve these discrepancies
**before** copying files blindly:

1. **Ports.** Frontend dev server is hard-pinned to `5174` with `strictPort: true`, and the
   proxy target is hard-coded to `http://localhost:8001` in `albusv2/vite.config.ts`. If the
   host project uses different ports, edit both there. In production there is no proxy — the
   frontend just calls relative `/api/*`, so the backend must be reverse-proxied under the same
   origin (or set up CORS, which the backend already allows for `*`).

2. **Backend mounting.** The API has **no path prefix beyond `/api`** and assumes it owns the
   root FastAPI app. To embed in an existing FastAPI app, import the routes from `main.py` and
   `chat.py` (`chat.router`) and `include_router` them, rather than running this `app` directly.
   Watch for duplicate `CORSMiddleware` / `load_dotenv()` setup.

3. **No router / no real auth.** If the host app uses react-router and a real auth system,
   replace `App.tsx`'s state router and `Login.tsx`'s role stub. The role string
   (`Admin`/`Technical`/`Sales`) is referenced where the UI gates features — search for
   `albus_user` and `UserRole` and wire them to the real identity instead.

4. **Persistence.** Courses are flat JSON files and surveys are an append-only `.jsonl`. If the
   host project has a database, replace: course reads in `main.py` (`list_courses`/`get_course`,
   keyed by filename) and `save_survey`/`submit_survey` (the code comments explicitly mark this
   as a "bridge solution until there is a DB"). Keep the **same response shapes** so the
   frontend types in `api.ts` keep working, or update both sides together.

5. **Course id contract.** The course `id` is the JSON **filename** without extension and always
   overrides any `id` field inside the file. Preserve this or change both backend endpoints and
   any stored references.

6. **Claude CLI dependency.** `chat.py` requires the `claude` binary on PATH and writes temp
   system prompts to `backend/claude-sandbox/`. If the host environment can't provide the CLI,
   swap `stream_claude()` for a direct Anthropic SDK streaming call (the SDK is already a
   dependency via `anthropic` in requirements). Keep the SSE frame format
   (`sse(event, data)` in `chat.py`) so `useChat.ts` keeps parsing it.

7. **Version caveats.** `package.json` pins forward-looking versions (React ^19, Vite ^8,
   TypeScript ~6). If the host toolchain is older, reconcile these (downgrade or upgrade) before
   `npm install` to avoid peer-dependency conflicts. `node_modules` and `dist` are intentionally
   excluded from this package.

8. **Language.** Course content and some UI/error strings are in Spanish; survey enum values are
   Spanish tokens (`muy_facil`, `adecuada`, …). Keep these tokens stable if you migrate the
   persistence layer, since the frontend sends them literally.
