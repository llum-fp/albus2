---
name: download-confluence-images
description: >-
  Download all image attachments of one or more Confluence Cloud pages to local
  PNG/JPEG files so they can be read and embedded. Use this when extracting a
  Confluence page that contains screenshots (the source-extractor agent calls
  it). Needs ATLASSIAN_EMAIL + ATLASSIAN_API_TOKEN in the environment. Invoke the
  bundled script: `download_images.sh <site_url> <cloud_id> <page_id> <dest_dir>`.
---

# Download Confluence Images

Confluence Cloud page bodies returned by the Atlassian MCP tools contain only
**text** — image bytes are never included. The blob/media URLs in the body are
client-side placeholders, not downloadable links. This skill explains the one
route that actually works headlessly and ships a script that does it.

## The key gotcha

The obvious download path is **CDN-fronted and rejects API-token Basic auth**:

```
GET https://<site>.atlassian.net/wiki/download/attachments/<pageId>/<file>
  → HTTP 401  (www-authenticate: OAuth)
```

The route that **does** accept email + API token Basic auth is the Atlassian
API **gateway**, with the cloudId in the path:

```
GET https://api.atlassian.com/ex/confluence/<cloudId>/wiki/<downloadLink>
  → HTTP 200, image/png
```

where `<downloadLink>` is the relative `_links.download` (or v2 `downloadLink`)
value returned by the attachments REST API — it already carries the required
`?version=…&modificationDate=…&api=v2` query string.

## Prerequisites

- `ATLASSIAN_EMAIL` — Atlassian account email.
- `ATLASSIAN_API_TOKEN` — token from
  id.atlassian.com/manage-profile/security/api-tokens.
  (The engine loads both from `agents_back/.env`; see `.env.example`.)
- `cloudId` and the site `url` — both come from
  `mcp__claude_ai_Atlassian__getAccessibleAtlassianResources` (call it once).

## Usage

```bash
# one page
.claude/skills/download-confluence-images/download_images.sh \
  https://yoursite.atlassian.net  <cloudId>  <pageId>  images/<session_id>/

# several pages → same dest dir, just call it once per page id
```

The script:
1. Lists the page's attachments via the REST API (Basic auth) —
   `GET <site>/wiki/rest/api/content/<pageId>/child/attachment?limit=100`.
2. For each image attachment, downloads the bytes through the **gateway** URL
   above into `<dest_dir>/<pageId>-<index>-<filename>`.
3. Verifies each file is a real image (not the login/error HTML) and prints a
   `TSV` summary line per file: `pageId<TAB>index<TAB>filename<TAB>OK|FAILED`.

It exits non-zero only on a hard failure (missing creds / unreadable page); a
single image that can't be fetched is reported `FAILED` and skipped so the rest
still download.

## After downloading

- **Read** each saved image (the `Read` tool renders images) and describe its
  real content — exact GUI screen, menu path, graph values, error text, log
  lines — not a guess from surrounding prose.
- Reference each image at its source position in the extract as
  `![caption](../images/<session_id>/<file>)` plus a 1–3 line description.
- If credentials are missing or every download fails, fall back to recording
  image metadata + a text description (mark `*(image not downloaded: <reason>)*`)
  — never fail the extract over images.

## Manual equivalent (no script)

```bash
SITE=https://yoursite.atlassian.net ; CLOUD=<cloudId> ; PID=<pageId>
# 1) list attachments (Basic auth works on the REST API):
curl -s -u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN" \
  "$SITE/wiki/rest/api/content/$PID/child/attachment?limit=100"
# 2) for each result, take _links.download and fetch via the gateway:
curl -s -u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN" -L \
  -o out.png "https://api.atlassian.com/ex/confluence/$CLOUD/wiki<downloadLink>"
file out.png   # must say "PNG image data", not "HTML document"
```
