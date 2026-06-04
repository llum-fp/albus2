import os
import httpx

AGENTS_BACK_URL = os.environ.get("AGENTS_BACK_URL", "http://localhost:8000")
TIMEOUT = 1800.0


def create_course(payload: dict, base_url: str = AGENTS_BACK_URL) -> dict:
    url = f"{base_url.rstrip('/')}/create-course"
    with httpx.Client(timeout=TIMEOUT) as client:
        response = client.post(url, json=payload)
    response.raise_for_status()
    return response.json()


def update_course(session_id: str, feedback: str, base_url: str = AGENTS_BACK_URL) -> dict:
    url = f"{base_url.rstrip('/')}/update-course"
    with httpx.Client(timeout=TIMEOUT) as client:
        response = client.post(url, json={"session_id": session_id, "feedback": feedback})
    response.raise_for_status()
    return response.json()


def create_podcast(payload: dict, base_url: str = AGENTS_BACK_URL) -> dict:
    """Ask agents_back to generate a two-host podcast script from an existing course.
    payload: {"session_id": str} (or {"course_path": str}); optional language/target_min.
    returns: {"session_id": str, "script_path": str, "script_exists": bool}
    """
    url = f"{base_url.rstrip('/')}/create-podcast"
    with httpx.Client(timeout=TIMEOUT) as client:
        response = client.post(url, json=payload)
    response.raise_for_status()
    return response.json()


def create_role(payload: dict, base_url: str = AGENTS_BACK_URL) -> dict:
    """Ask agents_back to author a new <slug>-course-creator.md agent.
    payload: {"name": str, "slug": str, "description": str}
    returns: {"session_id": str, "agent_path": str, "agent_exists": bool}
    """
    url = f"{base_url.rstrip('/')}/create-role"
    with httpx.Client(timeout=TIMEOUT) as client:
        response = client.post(url, json=payload)
    response.raise_for_status()
    return response.json()
