# Course JSON Schema & Quality Rules (shared)

This file is the single source of truth for the **output format** and the
**quality bar** of every course. Profile agents (technical, sales, …) own the
*style* of a course; this file owns the *shape* and the *rules*. Read this file
in full before writing or revising any course, and conform to it exactly.

## Output format (structured JSON)

Produce ONE `.json` file at exactly the path you are given. **Always write course
files into the `json/` directory** (relative to the working directory), creating
it if it doesn't exist.

The file must be a single JSON object that conforms exactly to this schema:

```json
{
  "title": "Course title",
  "description": "One- or two-sentence summary of what the course covers.",
  "source": "Where the material came from — e.g. Confluence page 1727332382, space AD",
  "language": "en",
  "modules": [
    {
      "id": "module-1",
      "title": "Module title",
      "summary": "Short description of this module.",
      "lessons": [
        {
          "id": "lesson-1-1",
          "title": "Lesson title",
          "content": "The lesson body. Plain text or lightweight Markdown.",
          "images": [
            { "path": "images/<session_id>/123-1-topology.png", "caption": "Network topology diagram" }
          ],
          "questions": [
            {
              "id": "q1",
              "question": "The question text?",
              "answers": ["Option A", "Option B", "Option C", "Option D"],
              "correctAnswerIndex": 0,
              "explanation": "Why the correct answer is correct, grounded in the source."
            }
          ]
        }
      ]
    }
  ]
}
```

Schema rules — follow these precisely:

- Top level has `title`, `description`, `source`, `language`, and a non-empty
  `modules` array.
- Each **module** has a unique `id` (kebab-case, e.g. `module-1`), a `title`, an
  optional `summary`, and a non-empty `lessons` array.
- Each **lesson** has a unique `id`, a `title`, a `content` string, and a
  non-empty `questions` array.
- Each **lesson** MAY include an optional `images` array (omit it entirely if the
  lesson has none — it is fully back-compatible). Each entry has a `path`
  (relative, pointing into `images/<session_id>/`) and a `caption`. Only
  reference images the extractor actually saved — never invent paths. If the
  extract only had a text description of an image, fold that into `content` as
  today instead of adding an `images` entry.
- Each **question** has an `id`, a `question` string, an `answers` array of
  **exactly 4 strings**, a `correctAnswerIndex` (an integer 0–3 pointing at the
  correct entry in `answers`), and an `explanation` string.
- IDs must be unique within their scope and stable (so a later revision can edit
  in place). Output UTF-8, 2-space-indented, valid JSON — no comments, no
  trailing commas, no surrounding Markdown fences in the file itself.

If the user asks for a different shape (extra fields, flat lesson list, a
separate file per module, HTML, Markdown, SCORM, Anki), adapt — but keep the
modules → lessons → multiple-choice-questions spine and the one-correct-answer
rule.

## Quality rules (apply to every profile)

- **Accuracy over volume.** Every fact, IP, command, and answer must trace back
  to the source extract. If the source is ambiguous, say so rather than guessing.
  Never invent facts that aren't in the extract.
- **Exactly 4 answers, one correct.** Every question has 4 plausible options and
  a valid `correctAnswerIndex` (0–3). Distractors must be plausible, not
  obviously wrong, and grounded in the source.
- **Exclude sensitive data.** Do NOT copy personal data (guest/crew names, DOBs,
  booking IDs, passwords beyond what's operationally necessary) or large raw data
  dumps into the course. Note in `description` (or report) that PII was excluded.
- **Preserve warnings.** Source "WARNING"/"IMPORTANT" notes are high-value — fold
  them into the relevant lesson `content` (e.g. a "⚠️ Important:" line), never
  drop them.
- **Screenshots:** when the extractor saved an image file, prefer embedding it
  via the optional lesson `images` field (using the saved `path` and a
  `caption`). Otherwise — when only a text description exists — keep the
  text-description behavior and fold it into `content`.
- **Valid JSON.** Verify the file parses cleanly (`python3 -m json.tool <file>`
  or `jq . <file>`) and matches the schema before reporting done.
- **Match the language** of the source material / the user's request.
