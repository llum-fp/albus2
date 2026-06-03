---
name: create-course
description: >-
  Build a structured JSON course from a Confluence page in two stages: a
  source-extractor agent reads the page, then a profile-specific course-creator
  agent authors the course. Invoke with key=value args, e.g.
  `/create-course page_id=1548 profile=sales topic="Captive Portal"
  duration_min=60 extract_path=extract/source_<id>.md out_path=json/course_<id>.json`.
  To combine several pages into one course, pass the multi-page form
  `page_ids=123,456` instead of `page_id`.
  Use when asked to create/build a course or training from a Confluence page.
---

# Create Course

This is the recipe for building one course. Run the two stages **in order**,
using the subagents below. Do not author the course yourself — delegate to the
agents so each runs on its intended model.

## Arguments

Read them from the invocation as `key=value` pairs (values may be quoted if they
contain spaces):

- `page_id` — Confluence page id to build from. **Required** for a new course.
- `page_ids` — comma-separated list of Confluence page ids to combine into one
  course (e.g. `page_ids=123,456`). Either `page_id` (single) **or** `page_ids`
  (multiple) is required; if both appear, use the union of all ids.
- `profile` — audience profile, e.g. `technical` / `technical support`, `sales`,
  or any profile created via `/create-role` (e.g. `marketing`). Resolved to
  `<slug>-course-creator` (see below); falls back to `technical-course-creator`
  if missing or no matching agent exists.
- `out_path` — exact path to write the final course JSON (e.g.
  `json/course_<id>.json`). **Required.**
- `extract_path` — exact path to write the intermediate Markdown extract (e.g.
  `extract/source_<id>.md`). **Required.**
- `topic` — optional focus for the course (default: the whole page).
- `duration_min` — optional target duration in minutes (default: unspecified).

## Profile → course-creator agent (by convention)

Derive the authoring agent from `profile` by convention — there is no fixed table
to maintain as new profiles are added (they are created with the `/create-role`
skill, which writes `.claude/agents/<slug>-course-creator.md`):

1. **Slugify** `profile`: lowercase it, replace spaces with hyphens, drop any
   other punctuation (e.g. `Technical Support` → `technical-support`,
   `Marketing` → `marketing`).
2. Use the agent named `<slug>-course-creator` — its file is
   `.claude/agents/<slug>-course-creator.md`.
3. **Aliases:** treat `technical support` / `technical-support` as `technical`,
   so both map to `technical-course-creator`.
4. **Fallback:** if `profile` is missing/empty, **or** no agent file exists at
   `.claude/agents/<slug>-course-creator.md`, use `technical-course-creator`.

So `profile=sales` → `sales-course-creator`, `profile=technical` (or
`technical support`) → `technical-course-creator`, `profile=marketing` →
`marketing-course-creator` if that agent has been created, otherwise
`technical-course-creator`.

## Steps

**STEP 1 — Extract the source.**
Collect the page ids from `page_id` and/or `page_ids` (split `page_ids` on
commas, then take the union with `page_id`). Use the `source-extractor` agent
(subagent_type: `source-extractor`), passing it the FULL list of ids, and
instruct it to fetch EVERY page and write a complete, faithful Markdown extract
to exactly `extract_path` (create the `extract/` directory if needed). All pages
go into ONE combined extract — with a clear section per page plus a combined
table of contents. This agent runs on the stronger model and is responsible for
reading 100% of every page.

**STEP 2 — Author the course.**
Resolve the profile's course-creator agent by the convention above
(`<slug>-course-creator`, with the `technical` alias and the
`technical-course-creator` fallback when the agent file is absent). Use that
agent to read the extract at `extract_path` and write the course to exactly
`out_path` (create the `json/` directory if needed). The agent must follow the schema and quality rules
in `.claude/course-schema.md` (modules → lessons → multiple-choice questions,
each question with exactly 4 options and one correct answer). Steer it with:
- Audience/profile: `profile`
- Target duration: `duration_min` minutes
- Topic focus: `topic`

The extract may cover multiple source pages. In that case author ONE cohesive
course that integrates them (not concatenated per-page courses), and cite all
source pages in the JSON `source` field.

## Finish

Confirm the JSON at `out_path` is valid and matches the schema, then briefly
report the module/lesson structure and anything excluded. Do not save the course
anywhere other than `out_path`.
