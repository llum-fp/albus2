"""Frontend-facing Confluence page search — fast, no LLM.

`GET /api/find-pages?topic=...&limit=...` queries Confluence's own search index
via the REST API (CQL `text ~`) and returns candidate pages in the shape
`{"pages": [{"page_id", "page_title", "brief_description"}, ...]}`. The
`brief_description` is Confluence's own relevance excerpt for the page.

Credentials stay server-side (CONFLUENCE_URL + ATLASSIAN_*/CONFLUENCE_* from
agents_back/.env, loaded by app.config). Typical latency ~0.5s — one HTTP
round-trip, no model and no MCP, so it is safe to call straight from the UI.
"""
import html
import os
import re

import requests
from fastapi import APIRouter, HTTPException, Query

import app.config  # noqa: F401 — ensures agents_back/.env is loaded + CONFLUENCE_* back-filled

router = APIRouter(prefix="/api", tags=["confluence-pages"])

CONFLUENCE_TIMEOUT_S = 15


def _clean(text: str) -> str:
    """Confluence search titles/excerpts can carry @@@hl@@@ highlight markers,
    HTML tags, and entities — normalize to plain text."""
    s = (text or "").replace("@@@hl@@@", "").replace("@@@endhl@@@", "")
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def _creds() -> tuple[str, str, str]:
    """(base, email, token) for the Confluence REST API, or 500 if unconfigured."""
    base = os.environ.get("CONFLUENCE_URL")
    email = os.environ.get("CONFLUENCE_EMAIL") or os.environ.get("ATLASSIAN_EMAIL")
    token = os.environ.get("CONFLUENCE_API_TOKEN") or os.environ.get("ATLASSIAN_API_TOKEN")
    if not (base and email and token):
        raise HTTPException(
            status_code=500,
            detail="Confluence credentials not configured (need CONFLUENCE_URL + "
                   "ATLASSIAN_EMAIL/ATLASSIAN_API_TOKEN in agents_back/.env)",
        )
    return base, email, token


def _coerce_id(pid):
    try:
        return int(pid)
    except (TypeError, ValueError):
        return pid  # keep as a string if a future id is non-numeric


@router.get("/find-pages")
def find_pages(
    topic: str = Query(..., min_length=1, description="Topic to search Confluence for"),
    limit: int = Query(8, ge=1, le=50, description="Max pages to return"),
):
    base, email, token = _creds()

    # Relevance text match restricted to pages. Double-quotes would break the CQL
    # string literal, so neutralize them.
    safe_topic = topic.replace('"', " ").strip()
    cql = f'type = page AND text ~ "{safe_topic}"'
    try:
        r = requests.get(
            f"{base.rstrip('/')}/wiki/rest/api/search",
            params={"cql": cql, "limit": limit, "excerpt": "highlight"},
            auth=(email, token),
            timeout=CONFLUENCE_TIMEOUT_S,
        )
        r.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Confluence search failed: {exc}")

    pages = []
    for res in r.json().get("results", []):
        content = res.get("content") or {}
        pid = content.get("id")
        if not pid:
            continue
        pages.append({
            "page_id": _coerce_id(pid),
            "page_title": _clean(content.get("title") or res.get("title") or ""),
            "brief_description": _clean(res.get("excerpt") or ""),
        })
    return {"pages": pages}


@router.get("/page/{page_id}")
def get_page(page_id: str):
    """Look up a single Confluence page by its id (for the manual-id entry in the
    course picker). Returns the same shape as /find-pages items so the UI can
    reuse it; ``brief_description`` carries the space name. 404 if it doesn't
    exist (or isn't a page)."""
    base, email, token = _creds()
    try:
        r = requests.get(
            f"{base.rstrip('/')}/wiki/rest/api/content/{page_id}",
            params={"expand": "space"},
            auth=(email, token),
            timeout=CONFLUENCE_TIMEOUT_S,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Confluence lookup failed: {exc}")

    if r.status_code == 404:
        raise HTTPException(status_code=404, detail=f"Page {page_id} not found")
    try:
        r.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Confluence lookup failed: {exc}")

    data = r.json()
    if data.get("type") != "page":
        raise HTTPException(status_code=404, detail=f"{page_id} is not a page")
    space = (data.get("space") or {}).get("name") or ""
    return {
        "page_id": _coerce_id(data.get("id") or page_id),
        "page_title": _clean(data.get("title") or ""),
        "brief_description": _clean(f"Space: {space}" if space else ""),
    }
