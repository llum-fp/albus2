# Course Pedagogy & Content Construction Rules (shared)

This file is the single source of truth for **how course content teaches**.
`course-schema.md` owns the output *shape*; the profile agents (technical,
sales, end-user) own the *audience and style*; this file owns the
*instructional quality* — how to construct modules, lessons, and questions so
the learner actually absorbs and retains the material. Read it in full before
writing or revising any course, and apply it within your profile's constraints.

Precedence on conflict: `course-schema.md` (shape/quality) > your profile agent
(audience/style/scope) > this file. In practice they rarely conflict — this
file governs construction, not content selection.

## Course and module construction

- **Outcome first.** Before writing anything, decide what the learner must be
  able to DO after the course (in your profile's terms: operate, sell, or use).
  Every module, lesson, and question must serve one of those outcomes.
- **One theme per module.** A module is a coherent stage of the learning
  journey, named for what it enables; its `summary` states what the learner
  gains from it.
- **Simple → complex.** Order modules and lessons so each one builds only on
  what was already taught. Never rely on a concept introduced later; if you
  must mention it early, give a one-line plain explanation on the spot.
- **Need-to-know filter.** If a fact from the extract does not serve a learner
  outcome, leave it out — completeness belongs to the extract, not the course.
  Your profile defines how deep "need to know" goes.
- **Fit the duration.** If a target duration is given, scale the NUMBER of
  modules and lessons to fit it. Never compress by making individual lessons
  denser — a short course covers less, equally well.

## Lesson construction

- **One core idea per lesson.** The title names the outcome or task
  ("Create users by voucher"), not the topic ("Vouchers").
- **Chunk it.** Introduce at most 3–5 new concepts per lesson before the
  questions. If the material needs more, split the lesson.
- **Concrete before abstract.** Open with a realistic situation, task, or
  example the learner recognizes; introduce the general concept after. A
  definition lands only when the learner already sees why it matters.
- **Why before how.** One or two lines of motivation (what this enables, what
  goes wrong without it) before any procedure or detail.
- **Procedures are numbered steps.** Each step states the action AND the
  visible result the learner should expect. End the procedure with what
  overall success looks like.
- **Scannable.** Short paragraphs (≤ 4 lines), Markdown tables for mappings,
  bold for a key term at the point where it is defined — and only there.
- **Close the loop.** End substantial lessons with 1–3 "Key points" lines —
  the things the learner must remember even if they forget the rest.
- **Self-contained.** The learner sees ONLY the course. Every lesson must be
  understandable, and every question answerable, from the course content alone
  — never assume access to the source page.

## Language

- Use the learner's vocabulary, not the source's. Define every necessary term
  at first use; expand acronyms the first time they appear.
- **One term per thing.** Pick one name for each concept and use it
  consistently across the whole course — never alternate synonyms.
- Short sentences, active voice, address the learner as "you".
- Plain language is a floor, not a ceiling on accuracy: keep the source's
  exact wording where precision matters (commands, values, option labels,
  warnings). Simplify the explanation, never the fact.

## Assessment construction (on top of the schema rules)

- **Test application, not recognition.** A question the learner can answer by
  matching words back to the lesson teaches nothing. Put the learner in a
  situation and make them apply the idea: choose the action, interpret the
  result, pick the right option for a goal.
- **Cover the key points.** Spread each lesson's questions across its main
  ideas; don't cluster them on one paragraph and leave the rest untested.
- **Ramp difficulty.** Within a lesson, start with one easier confidence
  question, then move to apply/decide scenarios.
- **Distractors are realistic mistakes** — the wrong moves someone in your
  profile's audience would actually make (each profile defines these). Never
  pad with absurd options.
- **Explanations teach.** The `explanation` says why the correct answer is
  correct and, when one distractor is especially tempting, why that one is
  wrong. It is the last teaching moment of the lesson — use it.

## Warnings and emphasis

- Fold warnings in at the point of decision — inside the step or option where
  the learner could go wrong — never as an appendix at the end.
- Emphasis is a scarce resource: if everything is bold or marked important,
  nothing is.
