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
- `profile` — audience: `technical` / `technical support`, or `sales`. Defaults
  to technical if missing or unrecognized.
- `out_path` — exact path to write the final course JSON (e.g.
  `json/course_<id>.json`). **Required.**
- `extract_path` — exact path to write the intermediate Markdown extract (e.g.
  `extract/source_<id>.md`). **Required.**
- `topic` — optional focus for the course (default: the whole page).
- `duration_min` — optional target duration in minutes (default: unspecified).

## Profile → course-creator agent

Pick the authoring agent from `profile`:

| profile                         | agent                       |
|---------------------------------|-----------------------------|
| `sales`                         | `sales-course-creator`      |
| `technical`, `technical support`| `technical-course-creator`  |
| anything else / missing         | `technical-course-creator`  |

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
Use the profile's course-creator agent (from the table above) to read the
extract at `extract_path` and write the course to exactly `out_path` (create the
`json/` directory if needed). The agent must follow the schema and quality rules
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
