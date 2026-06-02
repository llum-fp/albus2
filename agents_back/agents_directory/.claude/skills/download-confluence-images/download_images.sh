#!/usr/bin/env bash
# Download every image attachment of ONE Confluence Cloud page to local files.
#
# Usage: download_images.sh <site_url> <cloud_id> <page_id> <dest_dir>
#   e.g. download_images.sh https://acme.atlassian.net 2f20...327e 1570865158 images/<sid>/
#
# Auth: reads ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN from the environment
# (the engine loads them from agents_back/.env). The page body returned by the
# Atlassian MCP tools has no image bytes; this pulls them from the media API.
#
# Why two different URLs: the REST attachment LIST accepts API-token Basic auth
# on the site host, but the attachment DOWNLOAD path on that host is CDN-fronted
# and 401s Basic auth. The working download route is the api.atlassian.com
# gateway with the cloudId in the path. See SKILL.md.
#
# Output: one TSV line per attachment on stdout:
#   <page_id>\t<index>\t<filename>\t<OK|FAILED>
# Exits non-zero only on hard failure (bad args, missing creds, unreadable page).
set -euo pipefail

if [ "$#" -ne 4 ]; then
  echo "usage: $0 <site_url> <cloud_id> <page_id> <dest_dir>" >&2
  exit 2
fi
SITE="${1%/}"; CLOUD="$2"; PID="$3"; DEST="${4%/}"

: "${ATLASSIAN_EMAIL:?set ATLASSIAN_EMAIL (e.g. in agents_back/.env)}"
: "${ATLASSIAN_API_TOKEN:?set ATLASSIAN_API_TOKEN (e.g. in agents_back/.env)}"

# Locate a python interpreter (prefer the project venv, fall back to python3).
PY=""
for cand in \
  "$(dirname "$0")/../../../../.venv/bin/python" \
  "$(dirname "$0")/../../../../../.venv/bin/python" \
  python3 python; do
  if command -v "$cand" >/dev/null 2>&1 || [ -x "$cand" ]; then PY="$cand"; break; fi
done
[ -n "$PY" ] || { echo "no python interpreter found" >&2; exit 3; }

GW="https://api.atlassian.com/ex/confluence/$CLOUD"
AUTH=(-u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN")
mkdir -p "$DEST"

# 1) List attachments via the REST API (Basic auth OK here).
LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT
code="$(curl -sS "${AUTH[@]}" -o "$LIST" -w '%{http_code}' \
  "$SITE/wiki/rest/api/content/$PID/child/attachment?limit=100")"
if [ "$code" != "200" ]; then
  echo "attachment list for page $PID failed: HTTP $code" >&2
  exit 4
fi

# 2) Emit "index<TAB>filename<TAB>downloadLink" for image attachments only.
ROWS="$("$PY" - "$LIST" <<'PYEOF'
import json, sys
d = json.load(open(sys.argv[1]))
i = 0
for a in d.get("results", []):
    mt = (a.get("metadata", {}) or {}).get("mediaType", "") or ""
    if not mt.startswith("image/"):
        continue
    dl = (a.get("_links", {}) or {}).get("download") or a.get("downloadLink")
    if not dl:
        continue
    i += 1
    print(f"{i}\t{a.get('title','')}\t{dl}")
PYEOF
)"

if [ -z "$ROWS" ]; then
  echo "no image attachments on page $PID" >&2
  exit 0
fi

# 3) Download each image through the gateway and verify it is really an image.
printf '%s\n' "$ROWS" | while IFS=$'\t' read -r IDX TITLE DL; do
  OUT="$DEST/${PID}-${IDX}-${TITLE}"
  if curl -sS "${AUTH[@]}" -L -o "$OUT" "${GW}/wiki${DL}" \
     && file -b "$OUT" | grep -qiE 'image|bitmap'; then
    printf '%s\t%s\t%s\tOK\n' "$PID" "$IDX" "$TITLE"
  else
    printf '%s\t%s\t%s\tFAILED\n' "$PID" "$IDX" "$TITLE" >&2
  fi
done
