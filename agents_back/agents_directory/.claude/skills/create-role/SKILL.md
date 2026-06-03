---
name: create-role
description: >-
  Author a brand-new profile course-creator agent on demand. Given a display
  name, a filesystem slug, and a free-text description of the audience (who they
  are, what to emphasize, tone/depth), it reads the two exemplar agents plus the
  shared schema/context as a template, then writes a new
  `<slug>-course-creator.md` agent file tuned to that audience. Invoke with
  key=value args, e.g. `/create-role name="Marketing" slug=marketing
  description="..." out_path=agents_staging/marketing-course-creator.md`.
  Use when asked to add a new course profile / role (beyond technical and sales).
---

# Create Role

This is the recipe for authoring ONE new profile course-creator agent. The new
agent must be a sibling of the existing `technical-course-creator` and
`sales-course-creator` — the **same contract**, a **different audience**.

Write the new agent file **yourself** (inline) — do NOT delegate to a subagent,
and do NOT build a course here. This skill only creates the agent definition.

## Arguments

Read them from the invocation as `key=value` pairs (values may be quoted if they
contain spaces):

- `name` — human-readable display name of the new profile, e.g. `"Marketing"`.
  **Required.**
- `slug` — filesystem-safe identifier: lowercase, words separated by hyphens, no
  spaces or punctuation, e.g. `marketing`. **Required.** The new agent's
  frontmatter `name` and the filename derive from this.
- `description` — free text describing the target audience: who they are, what
  the course should emphasize for them, and the tone/depth to use. **Required.**
  This is the only input that drives the audience-specific sections.
- `out_path` — exact path to write the new agent file, e.g.
  `agents_staging/<slug>-course-creator.md`. **Required.** This is a staging
  path the caller provides; the server relocates the finished file into
  `.claude/agents/` afterwards (the headless run can't write into `.claude/`
  directly). Write to exactly this path — nothing else.
- `overwrite` — passed through by the caller; the server enforces the
  "don't clobber an existing agent" rule. Just write to `out_path`.

## Required reading — in this order (the template + contract)

Read all four in full before writing anything:

1. `.claude/agents/technical-course-creator.md` — exemplar #1: the structural
   template (YAML frontmatter, then role description, Target audiences, Inputs,
   Required reading, Step 1 critical reading, Step 2 depth/translation rules,
   Course design, Finish).
2. `.claude/agents/sales-course-creator.md` — exemplar #2: the SAME structure
   re-tuned for a very different audience (translation rules, persona benefits,
   cheat-sheet lesson). Read both together to see what is **fixed** (the
   contract) versus what is **specialized** (audience/style).
3. `.claude/course-schema.md` — the output shape + quality bar the new agent
   points its readers at. Profile-independent: the new agent references it, it
   does not restate it.
4. `.claude/omniaccess-context.md` — company background every creator agent
   frames against. Profile-independent.

## What to keep fixed (the contract)

The new agent MUST match the exemplars' frontmatter + section skeleton:

- Frontmatter:
  - `name: <slug>-course-creator` (use the `slug` arg verbatim).
  - `description: >-` — a multi-line description in the same voice as the
    exemplars: says this agent builds a `<name>` course from a prepared source
    extract, lists its trigger phrases, and notes it expects an extract produced
    by the `source-extractor` agent (it does NOT fetch Confluence itself).
  - `tools: Read, Write, Edit, Bash, Glob, Grep` — copy verbatim.
  - `model: sonnet` — copy verbatim.
- Keep these sections essentially as-is (they are profile-independent):
  - **Inputs** — a source extract file path (read in full first; on a revision,
    edit the existing JSON in place keeping IDs stable) and the output JSON path.
  - **Required reading** — `.claude/course-schema.md` first, then
    `.claude/omniaccess-context.md`, with the same "schema owns shape, context
    owns framing, extract owns every product fact" guidance.
  - **Finish** — summarize the module/lesson structure and report what was
    included/excluded and any gaps.

## What to specialize (per the `description`)

Rewrite ONLY these sections so they fit the `name`/`description` audience:

- The opening role paragraph + the "goal of every course" line — frame the
  persona and what competence looks like for them.
- **Target audiences** — the specific sub-roles this profile serves.
- **Step 1 — critical reading of the extract** — the triage buckets that matter
  for this audience (what to keep, what to drop, how aggressively to translate).
- **Step 2 — depth/translation rules** — how technical the course should be,
  what to include or strip, the tone.
- **Course design** — module progression, question style and count, and any
  signature element (e.g. sales' cheat-sheet lesson) appropriate to this
  audience. Derive all of this from the `description`; do not copy the technical
  or sales specifics wholesale.

Keep the modules → lessons → exactly-4-answers-one-correct spine — that is owned
by the schema and is non-negotiable for every profile.

## Finish

After writing `out_path`, report:

- The path written and the frontmatter `name`.
- A one-line summary of how the audience/tone/depth was specialized from the
  `description`.
- Confirm `tools`, `model: sonnet`, and the Inputs / Required-reading / Finish
  sections match the exemplars.

Do not write the agent file anywhere other than `out_path`.
