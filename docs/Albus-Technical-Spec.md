# Albus — Technical Specification

*Internal training platform · OmniAccess · Hackathon submission*

> *Named for a headmaster who held that help is always given to those who ask for it,
> Albus is, at heart, a patient teacher — it just happens to run on FastAPI instead of magic.*

---

## 1. What was built

**Albus turns a Confluence page into a complete, structured training course — and then teaches it.**

We chose Confluence as the knowledge source for its scalability — it is where operational
material naturally lives and grows: NOC runbooks, product notes, captive-portal guides,
onboarding material. That knowledge is accurate but inert — it is written for reference,
not for learning, and turning a page into real training (modules, lessons, a graded quiz,
an instructor who answers questions) is many hours of manual work per topic.

Albus closes that gap end to end. An admin points it at a Confluence page (or several);
minutes later there is a published course in the web app: **modules → lessons →
multiple-choice quiz**, written for a specific audience (sales,
technical, and so on). Learners take the course in the browser, and while they answer the quiz they
talk to **Albus**, an AI tutor that gives live, source-grounded feedback — it explains
*why* an answer is right or wrong using the original page content, not generic knowledge.
Any finished course can also be turned into a **two-host audio "deep dive"** podcast for
passive review.

The result is a working internal product, not a prototype: a full end-to-end pipeline with
role-based users, persisted courses and surveys, and a set of example courses already built.
The unit of value is concrete — *grounded in existing Confluence documentation, as many
courses as you want, each focused for a different user role* — which is exactly the
repetitive, high-volume authoring work it is designed to absorb.

```
albusv2 (React 19, :5174) ──▶ platform_back (FastAPI + SQLite, :8001) ──▶ agents_back (:8000)
   learner UI + admin            single API origin, course/chat/survey      headless Claude agents
   (Vite proxy /api → :8001)     persistence, Albus tutor (SSE)             author courses from Confluence
```

---

## 2. Technical explanation of functionality

### Course generation — a two-stage agent pipeline

Course authoring is not a single prompt; it is an orchestrated pipeline of specialised
agents, each scoped to one job and run on the model that job warrants:

1. **`source-extractor` (Opus).** Fetches *100%* of every page through the Atlassian MCP
   tools, reading each page twice (Markdown for prose, HTML for image metadata). It
   downloads page screenshots itself and *describes their real content*, so diagrams and UI
   captures survive into the course instead of being lost. It writes one faithful Markdown
   extract and **strips PII** in the process. Reading is the expensive, high-fidelity step,
   so it gets the strong model.
2. **`<profile>-course-creator` (Sonnet).** Reads the extract and authors the course JSON
   against a fixed schema (modules → lessons → questions, each with exactly four options and
   one correct answer). Writing to a known structure is the cheaper step, so it runs on the
   faster, lighter model.

The pipeline is **profile-driven and self-extending**. The course-creator is resolved from
the requested audience *by convention* — `profile=sales` → `sales-course-creator` — with no
central table to maintain. New audiences are added by the `/create-role` skill, which writes
a brand-new `<slug>-course-creator` agent to disk; the next build picks it up automatically.
The system grows new capabilities without code changes.

Generation runs as a background job. The admin triggers a build, gets an id back
immediately, and can revise the result conversationally — "make the quiz harder" — which
resumes the *same* Claude session (`--resume`) rather than rebuilding from scratch.

### The Albus tutor — grounded, isolated, streaming

The quiz tutor streams the local `claude` CLI to the browser over Server-Sent Events. Two
properties matter:

- **It is grounded, cheaply.** For each question, Albus reads the *local* source extract the
  pipeline already produced (`source_<id>.md`) — faithful, image-aware, multi-page, **zero
  network calls** — and only falls back to a live Confluence fetch when no extract exists.
  Grounding reuses work already on disk instead of re-fetching.
- **It is sandboxed.** The tutor subprocess runs in an isolated working directory with
  `--tools ""`, `--strict-mcp-config` and an empty MCP config — **no tools, no MCP servers,
  no project `CLAUDE.md`, no user memory**. It can produce text and nothing else. The
  generation agents are likewise confined to `agents_directory/`, scoped so Claude cannot
  reach the rest of the repository.

### Lightweight Confluence search — no LLM where none is needed

Picking a page to build from uses a **three-step, LLM-free cascade** that stops at the first
hit: (1) a local page-id prefix index, (2) Confluence title search, (3) full-text search.
Credentials stay server-side, so the UI calls it directly. Browsing source pages costs zero
tokens; the model is spent only on the work that actually needs a model.

### Podcast — craftsmanship over dependencies

A finished course becomes a NotebookLM-style two-host audio overview: a `podcast-scriptwriter`
agent writes the dialogue, then OpenAI TTS synthesises each turn in one of two voices and the
turns are stitched into a single WAV using the Python **standard-library `wave` module — no
ffmpeg, no media toolchain**. State lives on the course row; the learner player only appears
once the audio exists.

### Platform & persistence

`platform_back` is the single API origin the frontend talks to (five `/api/*` endpoints
plus the chat SSE). Courses are JSON files served verbatim with their filename as id;
users, roles, surveys and podcast state live in SQLite via the SQLAlchemy ORM (bound
parameters throughout). The frontend is React 19 + Vite with a hand-written, safe Markdown
renderer (no `dangerouslySetInnerHTML`). Secrets live in a single gitignored `.env`.

---

## 3. Self-assessment

Honest scores, with the reasoning and the known gaps.

| Dimension | Score | Basis |
|---|:---:|---|
| **Business value** | 9 / 10 | Solves a real, recurring OmniAccess problem — turning inert Confluence knowledge into actual training — with an end-to-end working pipeline, not a slide deck. The bottleneck it removes is manual course authoring: work that scales badly with people and well with agents. |
| **Security** | 7 / 10 | Strong where it counts most for an agentic system: the LLM surface is tightly contained. Soft on the network perimeter today. |
| **Resource efficiency** | 9 / 10 | Deliberate model tiering and aggressive avoidance of unnecessary inference. |
| **Autonomy** | 9 / 10 | Multi-agent delegation that authors, revises and extends itself with minimal human input. |
| **Creativity** | 9 / 10 | An elegant pipeline with a few genuinely original touches. |

**Business value.** The design choice that drives the score is scope discipline: Albus does
one valuable thing — *page → course → taught* — and does it for distinct audiences
(sales, technical, and so on). The magnitude scales with the Confluence space itself: every
page is a potential course at near-zero marginal effort.

**Security.** The agent architecture is the part most likely to be attacked in an LLM
product, and it is the part we hardened: every model invocation runs in an isolated sandbox
with tools and MCP explicitly stripped, generation agents are confined to their own
directory, the tutor is grounded from local files rather than open network access, and the
extractor drops PII at the source. Data hygiene is sound (ORM bind parameters, secrets in a
single gitignored `.env`, a safe custom renderer with no raw HTML injection). The honest gap
is the *network* perimeter: the platform currently assumes the internal network for trust
and the admin role is asserted by header rather than a signed token. That is a deliberate
scoping decision for an internal-network hackathon build, and the path to close it —
session-scoped tokens and binding `agents_back` to localhost — is short and already mapped.

**Resource efficiency.** Tokens are spent only where a model adds value. Reading (high
fidelity) runs on Opus; writing-to-schema (mechanical) runs on Sonnet; *choosing a source
page uses no model at all*. The tutor reuses the extract already on disk instead of
re-querying Confluence, revisions resume the existing session instead of rebuilding, and the
podcast ships audio with nothing heavier than the Python standard library. The system
consistently does more with less inference.

**Autonomy.** Once pointed at a page, the pipeline runs unattended: it fetches, reads,
extracts, profiles the audience, authors to schema, and publishes — a human only chooses the
page and optionally gives one line of feedback. It is genuinely *agentic* rather than
scripted: agents delegate to sub-agents, pick their own models, and the `/create-role` skill
lets the system **author new agents for itself**, gaining audiences it was never explicitly
programmed for.

**Creativity.** The elegance is in the seams: a two-model pipeline that matches model
strength to task cost; a self-extending profile system with no lookup table; image-aware
extraction that preserves diagrams; grounding the tutor from reused local extracts; and a
podcast feature that stitches multi-voice audio with the standard library alone. Each is a
small, deliberate piece of craftsmanship rather than a feature bolted on.

---

*Three backends, one product: a React learner UI, a FastAPI platform, and a headless Claude
agent engine — turning what OmniAccess already knows into training people actually take.
A bit of everyday magic; no wand required.*
