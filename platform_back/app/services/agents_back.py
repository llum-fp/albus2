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
