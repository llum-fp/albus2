#!/usr/bin/env python3
"""Ask the course-creator agent to build a structured JSON course from a
Confluence page, then refine it interactively.

Claude is launched with its working directory set to AGENTS_DIR, so its
workspace is scoped to that subdirectory (it can't read/edit the surrounding
project, e.g. a frontend/ or backend/). The generated .json is written into
AGENTS_DIR/json/.

The first run builds the course in a fresh session with a known session id.
After it finishes, you can type follow-up feedback; each message RESUMES the
same session, so the agent keeps full context and edits the existing course.
Type 'exit', 'quit', or send EOF (Ctrl-D) / empty line to stop.

Usage:
    ./create_course.py             # uses the default page id below
    ./create_course.py 1727332382  # or pass any Confluence page id
"""
import os
import subprocess
import sys
import uuid
from pathlib import Path

DEFAULT_PAGE_ID = "1727332382"

# Claude runs here. Resolved relative to this script so it works no matter where
# you invoke the script from. Override with the AGENTS_DIR env var if needed.
AGENTS_DIR = Path(__file__).resolve().parent / "agents_directory"


def run_claude(prompt: str, agents_dir: Path, session_id: str, resume: bool) -> int:
    """Run one headless claude turn. First turn starts the session with
    --session-id; later turns continue it with --resume."""
    cmd = ["claude", "-p", prompt]
    cmd += ["--resume", session_id] if resume else ["--session-id", session_id]
    return subprocess.run(cmd, cwd=str(agents_dir), check=False).returncode
