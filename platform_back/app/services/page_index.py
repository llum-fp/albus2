"""Local index of Confluence page ids, for prefix ("begins-with") search.

Confluence CQL has no prefix operator for page ids (only exact ``id =``), so
"type the first few digits → see matching pages" cannot be served by the search
API. This module builds a local index of ``{page_id, page_title, space}`` for
every page once, caches it in memory (TTL) and on disk, and prefix-filters the
ids server-side.

Used by ``/api/find-pages`` (step 1 of its cascade) and refreshed on demand via
``POST /api/page-index/refresh``.
"""
import json
import threading
import time

import requests
from fastapi import HTTPException

from app.config import REPO_ROOT

# Persist next to platform.db so a restart doesn't need to rebuild from Confluence.
INDEX_PATH = REPO_ROOT / "platform_back" / "page_index.json"

# Rebuild at most this often when serving from the in-memory cache.
TTL_S = 60 * 60  # 1 hour
# Safety caps for the build crawl.
PAGE_SIZE = 100          # Confluence search max per request
MAX_PAGES = 10_000       # stop crawling beyond this many pages
BUILD_TIMEOUT_S = 15     # per HTTP request

_lock = threading.Lock()
_cache: dict | None = None  # {"built_at": float, "pages": [ {page_id,page_title,space}, ... ]}


def _strip(text: str) -> str:
    return " ".join((text or "").split())


def _load_from_disk() -> dict | None:
    try:
        with open(INDEX_PATH, encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict) and isinstance(data.get("pages"), list):
            return data
    except (OSError, ValueError):
        pass
    return None


def _save_to_disk(data: dict) -> None:
    try:
        with open(INDEX_PATH, "w", encoding="utf-8") as fh:
            json.dump(data, fh)
    except OSError:
        pass  # cache-only fallback; not fatal


def _crawl(base: str, auth: tuple[str, str]) -> list[dict]:
    """Page through ``type = page`` and collect id/title/space for every page.

    Confluence Cloud ignores ``start`` on this endpoint and paginates by cursor:
    each response carries ``_links.next`` (relative to ``_links.base``). We follow
    that chain until it runs out, deduping ids defensively.
    """
    # First request; subsequent ones follow the cursor URL verbatim.
    next_url = f"{base.rstrip('/')}/wiki/rest/api/search"
    params = {"cql": "type = page order by id", "limit": PAGE_SIZE, "expand": "content.space"}

    pages: list[dict] = []
    seen: set[str] = set()
    while next_url and len(pages) < MAX_PAGES:
        try:
            r = requests.get(next_url, params=params, auth=auth, timeout=BUILD_TIMEOUT_S)
            r.raise_for_status()
        except requests.RequestException as exc:
            raise HTTPException(status_code=502, detail=f"Confluence index build failed: {exc}")

        body = r.json()
        results = body.get("results", [])
        for res in results:
            content = res.get("content") or {}
            pid = content.get("id")
            if not pid or str(pid) in seen:
                continue
            seen.add(str(pid))
            space = (content.get("space") or {}).get("name") or ""
            pages.append({
                "page_id": str(pid),
                "page_title": _strip(content.get("title") or res.get("title") or ""),
                "space": _strip(space),
            })

        links = body.get("_links") or {}
        nxt = links.get("next")
        # The cursor URL already encodes cql/limit/cursor, so drop our params for it.
        next_url = (links.get("base", "") + nxt) if nxt else None
        params = None
    return pages


def build_index(base: str, auth: tuple[str, str]) -> dict:
    """Force a fresh crawl, update the in-memory + on-disk cache, and return it."""
    global _cache
    pages = _crawl(base, auth)
    data = {"built_at": time.time(), "pages": pages}
    with _lock:
        _cache = data
        _save_to_disk(data)
    return data


def get_index(base: str, auth: tuple[str, str]) -> dict:
    """Return the cached index, rebuilding if missing or older than ``TTL_S``.

    On startup the in-memory cache is empty, so we hydrate from disk first; only
    if that is missing/stale do we crawl Confluence.
    """
    global _cache
    with _lock:
        cached = _cache or _load_from_disk()
        if cached is not None:
            _cache = cached
            if (time.time() - cached.get("built_at", 0)) < TTL_S:
                return cached
    # Stale or absent — rebuild outside the lock (the crawl is slow).
    return build_index(base, auth)


def prefix_search(base: str, auth: tuple[str, str], prefix: str, limit: int) -> list[dict]:
    """Pages whose id begins with ``prefix`` (digits only), in id order."""
    index = get_index(base, auth)
    hits = [p for p in index.get("pages", []) if p["page_id"].startswith(prefix)]
    hits.sort(key=lambda p: p["page_id"])
    out = []
    for p in hits[:limit]:
        space = p.get("space") or ""
        out.append({
            "page_id": int(p["page_id"]) if p["page_id"].isdigit() else p["page_id"],
            "page_title": p["page_title"],
            "brief_description": f"Space: {space}" if space else "",
        })
    return out
