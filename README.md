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

Three processes (each in its own terminal), from the repo root:

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
  `dist/` are gitignored; if you re-copy the package, run `rm -rf node_modules && npm ci` (the
  original export shipped `node_modules` with broken, non-symlink `.bin` shims).
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

> Course **authoring** (Confluence browse + generation) is **not** part of this `/api/*` surface and
> the UI has no authoring screen. New courses are produced by the agents pipeline (`POST /courses/` on
> platform_back → agents_back → headless Claude) and land as JSON files that `GET /api/courses` then
> lists. See [`CLAUDE.md`](CLAUDE.md).

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
