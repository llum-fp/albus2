#!/usr/bin/env python3
"""Very simple platform backend. It forwards course requests to agents_back.

The frontend talks to THIS service; this service calls agents_back (which runs
the course-creator agent). Same JSON payload shape as agents_back's
/create-course (see example.json) — page_id + optional topic/profile/
duration_min, or session_id+feedback to continue, or {"harcoded": true}.

Run (uses the project venv that has Flask):
    cd platform_back && ../.venv/bin/python api.py     # 0.0.0.0:8001
    # point it at a non-default agents_back with: AGENTS_BACK_URL=http://host:8000
Call:
    curl -s -X POST http://localhost:8001/courses \
         -H 'Content-Type: application/json' --data @../example.json
"""
import os
import sys
from pathlib import Path

# Make `helpers` importable no matter where the script is launched from.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from flask import Flask, jsonify, request

from helpers.call_agents_back import create_course

PORT = int(os.environ.get("PORT", "8001"))

app = Flask(__name__)


@app.post("/courses")
def courses():
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify(error="invalid or missing JSON body"), 400
    try:
        return jsonify(create_course(payload))
    except Exception as exc:  # noqa: BLE001 - surface upstream failure as JSON
        return jsonify(error=f"agents_back call failed: {exc}"), 502


if __name__ == "__main__":
    print(f"platform_back listening on http://0.0.0.0:{PORT}  (POST /courses -> agents_back)")
    app.run(host="0.0.0.0", port=PORT)
