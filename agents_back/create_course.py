#!/usr/bin/env python3
"""Build a structured JSON course from a Confluence page via the create-course
skill (source-extractor reads the page, a profile course-creator authors it),
then refine it interactively.

Claude is launched with its working directory set to AGENTS_DIR, so its
workspace is scoped to that subdirectory (it can't read/edit the surrounding
project, e.g. a frontend/ or backend/). The generated .json is written into
AGENTS_DIR/json/.

The first run builds the course in a fresh session with a known session id.
After it finishes, you can type follow-up feedback; each message RESUMES the
same session, so the agent keeps full context and edits the existing course.
Type 'exit', 'quit', or send EOF (Ctrl-D) / empty line to stop.

Usage:
    ./create_course.py                          # default page id below
    ./create_course.py 1727332382               # any Confluence page id
    ./create_course.py 1727332382 --profile sales   # technical (default) or sales
"""
import os
import re
import subprocess
import sys
import uuid
from pathlib import Path


def load_env() -> None:
    """Load KEY=VALUE lines from a local .env into os.environ (without
    overriding values already set in the environment). Looked up next to this
    script (agents_back/.env) and at the project root. Used so the headless
    `claude` subprocess inherits credentials like ATLASSIAN_EMAIL /
    ATLASSIAN_API_TOKEN, which the source-extractor needs to download
    Confluence images via the media API."""
    here = Path(__file__).resolve().parent
    for env_path in (here / ".env", here.parent / ".env"):
        if not env_path.is_file():
            continue
        for raw in env_path.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_env()

DEFAULT_PAGE_ID = "1727332382"

# Model passed to `claude --model`. Override with --model on the CLI or the
# CLAUDE_MODEL env var. None means use claude's configured default.
DEFAULT_MODEL = os.environ.get("CLAUDE_MODEL")

# Claude runs here. Resolved relative to this script so it works no matter where
# you invoke the script from. Override with the AGENTS_DIR env var if needed.
AGENTS_DIR = Path(__file__).resolve().parent / "agents_directory"


def run_claude(prompt: str, agents_dir: Path, session_id: str, resume: bool,
               model: str | None = None) -> int:
    """Run one headless claude turn. First turn starts the session with
    --session-id; later turns continue it with --resume. Pass `model` to
    select the claude model (--model)."""
    cmd = ["claude", "-p", prompt]
    cmd += ["--resume", session_id] if resume else ["--session-id", session_id]
    if model:
        cmd += ["--model", model]
    return subprocess.run(cmd, cwd=str(agents_dir), check=False).returncode


def normalize_page_ids(page_id, page_ids) -> list[str]:
    """Return an ordered, de-duplicated list[str] of page ids built from
    `page_ids` (a list or None) plus the scalar `page_id` (or None). Empty/None
    entries are dropped; order is preserved; duplicates removed."""
    ids: list[str] = []
    for entry in (page_ids or []):
        if entry:
            s = str(entry)
            if s and s not in ids:
                ids.append(s)
    if page_id:
        s = str(page_id)
        if s and s not in ids:
            ids.append(s)
    return ids


def build_course_prompt(ids, profile, topic, duration_min, extract_path,
                        out_path) -> str:
    """Build the /create-course skill invocation string. For a single id this is
    byte-identical to the original prompt (page_id=...); for multiple ids it
    emits page_ids=<comma-joined> in place of the page_id token."""
    if len(ids) == 1:
        id_token = f"page_id={ids[0]}"
    else:
        id_token = f"page_ids={','.join(ids)}"
    return (
        f"/create-course {id_token} profile=\"{profile or 'technical'}\" "
        f'topic="{topic or "the whole page"}" '
        f"duration_min={duration_min or 'unspecified'} "
        f"extract_path={extract_path} out_path={out_path}"
    )


def slugify(name: str) -> str:
    """Turn a profile display name into a filesystem-safe slug: lowercase,
    whitespace/underscores -> hyphens, drop anything else, collapse repeats.
    e.g. 'Marketing & Comms' -> 'marketing-comms', 'End-user' -> 'end-user'."""
    s = re.sub(r"[\s_]+", "-", name.strip().lower())
    s = re.sub(r"[^a-z0-9-]", "", s)
    return re.sub(r"-{2,}", "-", s).strip("-")


def build_role_prompt(name: str, slug: str, description: str, out_path: str,
                      overwrite: bool) -> str:
    """Build the /create-role skill invocation string. Mirrors
    build_course_prompt: one deterministic slash-command line with quoted
    free-text args (quotes in name/description are downgraded so they don't
    break the args)."""
    safe_name = name.replace('"', "'")
    safe_desc = description.replace('"', "'")
    return (
        f'/create-role name="{safe_name}" slug={slug} '
        f'description="{safe_desc}" '
        f"out_path={out_path} overwrite={'true' if overwrite else 'false'}"
    )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("page_ids", nargs="*", default=[DEFAULT_PAGE_ID],
                        help="one or more Confluence page ids")
    parser.add_argument("--profile", default="technical")
    parser.add_argument("--topic", default="")
    parser.add_argument("--duration-min", default="")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    args = parser.parse_args()

    ids = normalize_page_ids(None, args.page_ids)
    session_id = str(uuid.uuid4())
    extract_path = f"extract/source_{session_id}.md"
    out_path = f"json/course_{session_id}.json"
    prompt = build_course_prompt(
        ids, args.profile, args.topic, args.duration_min, extract_path, out_path
    )
    run_claude(prompt, AGENTS_DIR, session_id, resume=False, model=args.model)
    print(f"session_id: {session_id}")
    print(f"out_path: {out_path}")