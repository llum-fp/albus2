# Podcast Script JSON Schema & Quality Rules (shared)

This file is the single source of truth for the **output format** and the
**quality bar** of a podcast script — a two-host "deep dive" conversation about
an existing course (in the spirit of NotebookLM's Audio Overview). The
`podcast-scriptwriter` agent owns the *style* of the conversation; this file owns
the *shape* and the *rules*. Read it in full before writing a script, and conform
to it exactly.

The script is later fed, turn by turn, to a text-to-speech engine that gives each
speaker a distinct voice and stitches the turns into one audio file. So the
`text` of every turn is **spoken aloud verbatim** — write words to be *heard*, not
read.

## Output format (structured JSON)

Produce ONE `.json` file at exactly the path you are given (`out_path`, normally
under `podcast/`). It must be a single JSON object conforming exactly to this
schema:

```json
{
  "title": "Short, inviting episode title",
  "description": "One-sentence summary of what this episode covers.",
  "source": "Course course_<session_id> — <course title>",
  "language": "en",
  "speakers": [
    { "id": "host",   "name": "Alex", "voice_role": "host" },
    { "id": "cohost", "name": "Sam",  "voice_role": "cohost" }
  ],
  "turns": [
    { "speaker": "host",   "text": "Welcome in. Today we're getting into ..." },
    { "speaker": "cohost", "text": "And it's a good one — because ..." }
  ]
}
```

Schema rules — follow these precisely:

- Top level has `title`, `description`, `source`, `language`, a `speakers` array,
  and a non-empty `turns` array.
- **Exactly two `speakers`**, with `id` values `host` and `cohost`. Each has a
  `name` (a natural first name that fits the `language`) and a `voice_role` that
  is exactly `"host"` or `"cohost"` (this is what the TTS maps to a voice — do not
  invent other roles).
- Each **turn** has a `speaker` (matching one of the two speaker `id`s) and a
  `text` string. Turns generally alternate host ↔ cohost, but not rigidly — a
  speaker may take two short turns in a row when it sounds natural.
- `language` is a short code (`"en"`, `"es"`, …) and MUST match the course's
  language. Every `text` is written in that language.
- Output UTF-8, 2-space-indented, valid JSON — no comments, no trailing commas,
  no surrounding Markdown fences in the file itself.

## What goes in `text` (this is read aloud — critical)

- **Plain spoken prose only.** No Markdown, no headings, no bullet lists, no
  numbered lists, no code blocks, no URLs, no emoji.
- **No stage directions or annotations.** Never write `(laughs)`, `[pause]`,
  speaker labels, SSML tags, or emotion cues inside `text` — they would be read
  out loud. Convey tone through the words themselves.
- **Expand for the ear.** Spell out acronyms the first time (e.g. "VSAT — that's
  Very Small Aperture Terminal"). Write symbols and most numbers as words
  ("twenty-four seven", "version four point zero point six") so the TTS says them
  naturally. Avoid characters a voice can't speak (`/`, `→`, `*`, `#`).
- **Conversational length.** Keep most turns to one to four sentences so the
  back-and-forth feels alive; an occasional longer explanatory turn is fine. Keep
  any single turn well under ~3000 characters.
- **Faithful.** Every claim must trace to the course content — never invent facts,
  numbers, or product capabilities. Drop any course PII; keep operational terms.

## Conversation design (the NotebookLM feel)

The two hosts are knowledgeable, warm, and genuinely curious — one tends to drive
and frame, the other digs in with questions and analogies, and they trade off.
Structure the episode as:

1. **Hook + intro** — open with a one or two line hook, name the topic, and set
   up why a listener should care. Hosts need not state their own names.
2. **Why it matters** — the real-world stakes / the problem this knowledge solves.
3. **The walkthrough** — move through the course module by module as a
   *discussion*: one host explains a key idea in plain language, the other reacts,
   asks the clarifying question a listener would ask, offers an analogy or a
   concrete example, and they connect it to what came before. Cover every module's
   core ideas; you don't have to mirror lesson order or read quiz questions aloud
   — turn the material into talk.
4. **Recap / key takeaways** — the three to five things to remember.
5. **Sign-off** — a brief, friendly close.

Keep it neutral and accurate; light banter is good, filler is not. Don't quote the
course's quiz answer keys; teach the concepts behind them instead.

## Length calibration

Target spoken length ≈ the `target_min` argument (default ~8 minutes). Spoken pace
is roughly **150 words per minute**, so total `text` across all turns should be
about `target_min × 150` words.

| `target_min`  | Approx. words | Feel                                  |
|---------------|---------------|---------------------------------------|
| unspecified   | ~1200         | ~8 min default                        |
| ≤ 5           | ~600–750      | tight summary                         |
| 6–10          | ~900–1500     | standard deep dive                    |
| 11–15         | ~1650–2250    | thorough, multi-module                |

If the course is short, don't pad to hit the target — a crisp shorter episode is
better than filler. If it's very large, prioritize the most important modules and
note nothing critical was dropped.
