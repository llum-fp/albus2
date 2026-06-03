# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this directory is

This is the **scoped working directory** where Claude runs (headless from
`agents_back/api.py` / `create_course.py`, or interactively) to author courses.
It is deliberately isolated: the rest of the project lives one level up in
`agents_back/`, and the wider system (platform_back, albusv2 frontend) is
documented in the repo-root `CLAUDE.md`. Operate as if this is the project root —
all paths here are relative to this directory.

The job done here is always the same: **turn one or more Confluence pages into a
structured JSON course** (modules → lessons → multiple-choice questions).

## How a course gets built (the orchestration)

Driven by the `/create-course` skill (`.claude/skills/create-course/SKILL.md`).
Two stages, run **in order**, each delegated to a subagent so it runs on its
intended model — **do not author the course in the main agent**:

1. **`source-extractor`** (model: opus, `.claude/agents/source-extractor.md`) —
   fetches 100% of every Confluence page via the Atlassian MCP tools (granted to
   it directly), downloads + reads page images, and writes ONE faithful Markdown
   extract to `extract/source_<session_id>.md`. It does **not** design lessons or
   questions.
2. **A profile course-creator** (model: sonnet) reads that extract and writes the
   course JSON to `json/course_<session_id>.json`:
   - `technical-course-creator` — default; for engineers/support/ops. Style:
     concepts→architecture→flows→config→monitoring→troubleshooting, depth over
     gloss, scenario/troubleshooting-weighted questions.
   - `sales-course-creator` — for `profile=sales`; value/positioning/
     customer-conversation framing.

The skill is invoked with `key=value` args. `page_id` (or `page_ids=123,456` to
combine pages), `extract_path`, and `out_path` are required; `profile`, `topic`,
`duration_min` are optional. `<session_id>` is the part of the extract/course
filename between `source_`/`course_` and the extension — image dirs key off it.

## The schema is the single source of truth

`.claude/course-schema.md` owns the **output shape and quality bar** for every
course; the profile agents own only *style*. Read it in full before writing or
revising any course. Non-negotiables:

- One UTF-8, 2-space-indented, valid JSON object: top-level `title`,
  `description`, `source`, `language`, non-empty `modules[]` → `lessons[]` →
  `questions[]`.
- Every question has **exactly 4 answers** and one integer `correctAnswerIndex`
  (0–3); distractors must be plausible and grounded in the source.
- IDs unique and **stable** within scope — a revision edits the existing JSON in
  place so IDs don't churn.
- Accuracy over volume: never invent facts beyond the extract. Strip PII, but
  preserve every WARNING/IMPORTANT note.
- Validate before reporting done: `python3 -m json.tool json/<file>` or
  `jq . json/<file>`.

## Confluence images (the one gotcha that wastes time)

MCP tools return page **text only** — never image bytes. The obvious
`<site>/wiki/download/...` path is CDN-fronted and **401s** API-token Basic auth.
The route that works is the gateway with cloudId in the path:
`https://api.atlassian.com/ex/confluence/<cloudId>/wiki<downloadLink>`. **Don't
hand-roll the curl** — use the `download-confluence-images` skill / its
`download_images.sh <site_url> <cloud_id> <page_id> images/<session_id>/`. It
needs `ATLASSIAN_EMAIL` + `ATLASSIAN_API_TOKEN` (inherited from `agents_back/.env`).
After downloading, **Read each image** so descriptions reflect actual content,
not a guess. If creds are missing or a download fails, fall back to image
metadata + a text description marked `*(image not downloaded: <reason>)*` — never
fail the extract over images.

## Outputs & layout

- `extract/` — intermediate Markdown extracts (source-extractor output).
- `json/` — final course JSON files (course-creator output). Write courses
  **only** here, at exactly the given `out_path`.
- `images/<session_id>/` — downloaded page screenshots, referenced from both the
  extract (inline, `../images/...`) and optionally the course JSON (`images[]`).
- `.claude/settings.local.json` — `acceptEdits` mode; allowlists the read-only
  Atlassian MCP tools, project-tree Read/Write/Edit, and the curl/image-download
  Bash commands used by the extractor.
