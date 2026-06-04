"""Shared config for the frontend-facing /api surface (the albusv2 contract).

- ``COURSES_DIR`` is the single source of truth for course JSON files: the exact
  directory the agents pipeline writes to (``agents_back/agents_directory/json``).
  The /api/courses read endpoints and the ported Albus chat tutor both read from
  here, so the learner UI sees the courses our pipeline generates.
- ``EXTRACTS_DIR`` holds the source-extractor's faithful Markdown extracts
  (``agents_back/agents_directory/extract``). The chat tutor reads the extract for
  a course (``source_<sid>.md``, paired with ``course_<sid>.json`` by session id)
  as its reference "source of truth" instead of re-fetching Confluence at runtime.
- We load ``agents_back/.env`` (Atlassian credentials + CLAUDE_MODEL) into the
  process so the chat tutor and its optional Confluence retrieval have creds.
- The ported chat tutor reads ``CONFLUENCE_EMAIL`` / ``CONFLUENCE_API_TOKEN`` /
  ``CONFLUENCE_URL``; our stack stores the same Atlassian credential under the
  ``ATLASSIAN_*`` names. We back-fill the ``CONFLUENCE_*`` names from them so the
  tutor works without duplicating secrets. If ``CONFLUENCE_URL`` is unset the
  tutor simply degrades to course-only answers (no crash).
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# platform_back/app/config.py -> parents[2] is the repo root.
REPO_ROOT = Path(__file__).resolve().parents[2]
COURSES_DIR = REPO_ROOT / "agents_back" / "agents_directory" / "json"
EXTRACTS_DIR = REPO_ROOT / "agents_back" / "agents_directory" / "extract"
# Course screenshots downloaded by the source-extractor. Course JSONs reference
# them by the relative path "images/<session>/<file>.png"; we serve this dir over
# HTTP so the learner UI can load them (see main.py mount + frontend mediaUrl()).
IMAGES_DIR = REPO_ROOT / "agents_back" / "agents_directory" / "images"
# Podcast artifacts: the agents pipeline writes the dialogue script
# (script_<sid>.json) here, and platform_back's TTS service writes the synthesized
# audio (podcast_<sid>.wav) alongside it. Served over HTTP via the /api/podcasts
# mount in main.py (mirrors the IMAGES_DIR / /api/media setup).
PODCASTS_DIR = REPO_ROOT / "agents_back" / "agents_directory" / "podcast"
LOGS_DIR = REPO_ROOT / ".logs"

# Load the agents_back .env (Atlassian creds, CONFLUENCE_URL, CLAUDE_MODEL).
load_dotenv(REPO_ROOT / "agents_back" / ".env")

# Back-fill the CONFLUENCE_* names the ported chat tutor expects from our
# ATLASSIAN_* names (same Atlassian credential), without overriding an explicit
# CONFLUENCE_* value if one is already set.
if os.environ.get("ATLASSIAN_EMAIL") and not os.environ.get("CONFLUENCE_EMAIL"):
    os.environ["CONFLUENCE_EMAIL"] = os.environ["ATLASSIAN_EMAIL"]
if os.environ.get("ATLASSIAN_API_TOKEN") and not os.environ.get("CONFLUENCE_API_TOKEN"):
    os.environ["CONFLUENCE_API_TOKEN"] = os.environ["ATLASSIAN_API_TOKEN"]
