"""Tiny client for the agents_back course API (stdlib only, no extra deps)."""
import json
import os
import urllib.error
import urllib.request

# Where agents_back is listening. Override with the AGENTS_BACK_URL env var.
AGENTS_BACK_URL = os.environ.get("AGENTS_BACK_URL", "http://localhost:8000")


def create_course(payload: dict, base_url: str = AGENTS_BACK_URL,
                  timeout: float = 1800) -> dict:
    """POST `payload` to agents_back /create-course and return its JSON reply.

    A build can take minutes, so the timeout is generous. Error responses from
    agents_back (4xx/5xx) are still parsed and returned as JSON.
    """
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/create-course",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
    return json.loads(body)
