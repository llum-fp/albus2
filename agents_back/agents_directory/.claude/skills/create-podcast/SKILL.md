---
name: create-podcast
description: >-
  Turn an already-built JSON course into a two-host "deep dive" podcast script (a
  natural conversation between two speakers, in the spirit of NotebookLM's Audio
  Overview). A podcast-scriptwriter agent reads the course (and its source extract
  when available) and writes a dialogue-script JSON that a text-to-speech engine
  later voices. Invoke with key=value args, e.g.
  `/create-podcast course_path=json/course_<id>.json out_path=podcast/script_<id>.json
  language=en target_min=8`. Use when asked to create/generate a podcast or audio
  overview from a course.
---

# Create Podcast

This is the recipe for turning ONE existing course into a two-host podcast
**script** (the audio itself is synthesized downstream from this script — your job
ends at a valid script JSON). Delegate the writing to the `podcast-scriptwriter`
subagent so it runs on its intended model; do not write the script in the main
agent.

## Arguments

Read them from the invocation as `key=value` pairs (values may be quoted if they
contain spaces):

- `course_path` — path to the source course JSON to adapt (e.g.
  `json/course_<session_id>.json`). **Required.**
- `out_path` — exact path to write the podcast script JSON (e.g.
  `podcast/script_<session_id>.json`). **Required.**
- `language` — language code for the conversation (e.g. `en`, `es`). Optional;
  default to the course's own `language` field.
- `target_min` — target spoken length in minutes. Optional; default `8`.

`<session_id>` is the part of the course filename between `course_` and `.json`;
the script is conventionally written to `podcast/script_<session_id>.json`.

## Steps

**STEP 1 — Read the course.**
Read the course JSON at `course_path` in full: its `title`, `description`,
`language`, and every module → lesson → `content`. This is the material the
episode is about. If a paired source extract exists at
`extract/source_<session_id>.md` (same session id as the course file), you MAY
skim it for extra color and concrete detail — but the course is the spine, and
nothing in the script may contradict or go beyond the course's facts.

**STEP 2 — Write the script.**
Use the `podcast-scriptwriter` agent (subagent_type: `podcast-scriptwriter`).
Hand it: the `course_path`, the `out_path`, the resolved `language` (the explicit
arg, else the course's `language`), and `target_min`. Instruct it to write a
two-host dialogue script to exactly `out_path` (create the `podcast/` directory if
needed), following the schema and quality rules in `.claude/podcast-schema.md`
(exactly two speakers `host`/`cohost`; spoken-aloud `text` with no Markdown or
stage directions; faithful to the course; in the course's language).

## Finish

Confirm the JSON at `out_path` is valid (`python3 -m json.tool <out_path>`) and
matches the schema, then briefly report the episode title, the speaker names, the
turn count, and the approximate word count. Do not write the script anywhere other
than `out_path`, and do not attempt to synthesize audio — that happens downstream.
