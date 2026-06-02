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
import subprocess
import sys
import uuid
from pathlib import Path

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