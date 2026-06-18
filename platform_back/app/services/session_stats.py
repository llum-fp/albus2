"""Read build stats (token consumption + wall-clock duration) from a Claude
session JSONL file.

Each course build runs as a headless ``claude`` subprocess scoped to
``agents_back/agents_directory/``. The CLI writes a JSONL file for every session
under ``~/.claude/projects/<slug>/<session_id>.jsonl``.  We find the file by
globbing for the session UUID across all project slugs (the slug encodes the
working-directory path and varies by host username, so we avoid hard-coding it).

Token totals: every ``assistant`` entry carries a ``message.usage`` dict with
``input_tokens``, ``output_tokens``, ``cache_creation_input_tokens``, and
``cache_read_input_tokens``.  We sum all four across the session to get the
total tokens consumed.

Duration: taken as the span between the first and last ``timestamp`` fields
found across all entries in the file.

Returns None if the JSONL file cannot be found or parsed.
"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger("platform_back.session_stats")


def _find_jsonl(session_id: str) -> Path | None:
    projects = Path.home() / ".claude" / "projects"
    if not projects.exists():
        return None
    for path in projects.rglob(f"{session_id}.jsonl"):
        return path
    return None


def read_session_stats(session_id: str) -> dict | None:
    """Return ``{"duration_sec": int, "tokens_total": int}`` for *session_id*.

    ``tokens_total`` is the sum of input, output, cache-creation, and
    cache-read tokens across all assistant turns.  ``duration_sec`` is the
    wall-clock span from the first to the last timestamped entry.

    Returns None if the file is missing or unparseable.
    """
    path = _find_jsonl(session_id)
    if not path:
        return None
    try:
        entries = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    except Exception:
        log.debug("session_stats: could not read %s", path)
        return None

    tokens_total = 0
    timestamps: list[datetime] = []

    for entry in entries:
        ts = entry.get("timestamp")
        if ts:
            try:
                timestamps.append(datetime.fromisoformat(ts.replace("Z", "+00:00")))
            except ValueError:
                pass
        if entry.get("type") == "assistant":
            usage = entry.get("message", {}).get("usage", {})
            tokens_total += (
                usage.get("input_tokens", 0)
                + usage.get("output_tokens", 0)
                + usage.get("cache_creation_input_tokens", 0)
                + usage.get("cache_read_input_tokens", 0)
            )

    duration_sec: int | None = None
    if len(timestamps) >= 2:
        timestamps.sort()
        duration_sec = int((timestamps[-1] - timestamps[0]).total_seconds())

    return {
        "duration_sec": duration_sec,
        "tokens_total": tokens_total if tokens_total > 0 else None,
    }
