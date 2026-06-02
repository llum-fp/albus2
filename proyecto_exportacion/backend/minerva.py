import os
import json
import anthropic
from bs4 import BeautifulSoup

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """You are Minerva, an expert in corporate technical training. Your mission is to turn technical Confluence documentation into didactic courses for people who have just joined the company in a technical role.

Rules:
- Clear, direct and human language. No unnecessary jargon.
- Explain the "why" of each concept, not just the "what".
- Use analogies when they help understanding.
- Split the content into logical, well-ordered lessons.
- Write EVERYTHING in English.
- Each lesson ends with exactly 2 multiple-choice questions (4 options, only 1 correct).

Return ONLY a valid JSON with this exact structure:
{
  "course_title": "string",
  "course_description": "string (2-3 sentences summarizing the course)",
  "lessons": [
    {
      "title": "string",
      "content": "string (human-language explanation, with paragraphs separated by \\n\\n)",
      "quiz": [
        {
          "question": "string",
          "options": ["A", "B", "C", "D"],
          "correct": 0
        },
        {
          "question": "string",
          "options": ["A", "B", "C", "D"],
          "correct": 2
        }
      ]
    }
  ]
}

The "correct" field is the index (0-3) of the correct option in the "options" array."""


def strip_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    return "\n".join(lines)


def generate_course(page_title: str, page_content: str) -> dict:
    prompt = f"""Here is the technical Confluence documentation about "{page_title}":

---
{page_content[:12000]}
---

Generate a complete course with between 3 and 6 lessons based on this content."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Extraer JSON aunque venga con markdown
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    return json.loads(raw)
