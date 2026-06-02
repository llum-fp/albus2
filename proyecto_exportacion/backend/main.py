from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from requests.auth import HTTPBasicAuth
from bs4 import BeautifulSoup
import os
import json
from datetime import datetime, timezone
from typing import Optional
from dotenv import load_dotenv
from minerva import generate_course, strip_html
from chat import router as chat_router

load_dotenv()

CONFLUENCE_URL = os.getenv("CONFLUENCE_URL")
EMAIL = os.getenv("CONFLUENCE_EMAIL")
TOKEN = os.getenv("CONFLUENCE_API_TOKEN")
AUTH = HTTPBasicAuth(EMAIL, TOKEN)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)


def confluence_get(path: str, params: dict = None):
    url = f"{CONFLUENCE_URL}/wiki/rest/api/{path}"
    r = requests.get(url, auth=AUTH, params=params, timeout=15)
    r.raise_for_status()
    return r.json()


def strip_html(html: str) -> str:
    return BeautifulSoup(html, "html.parser").get_text(separator="\n").strip()


@app.get("/api/spaces")
def list_spaces():
    data = confluence_get("space", {"limit": 100, "type": "global"})
    return [
        {"key": s["key"], "name": s["name"]}
        for s in data.get("results", [])
        if not s["key"].startswith("~")  # exclude personal spaces
    ]


@app.get("/api/spaces/{space_key}/pages")
def list_pages(space_key: str, limit: int = Query(50)):
    data = confluence_get(
        "content",
        {"spaceKey": space_key, "type": "page", "limit": limit, "expand": "history"}
    )
    return [
        {"id": p["id"], "title": p["title"]}
        for p in data.get("results", [])
    ]


@app.get("/api/pages/{page_id}")
def get_page(page_id: str):
    data = confluence_get(f"content/{page_id}", {"expand": "body.storage,history,space"})
    body_html = data.get("body", {}).get("storage", {}).get("value", "")
    return {
        "id": data["id"],
        "title": data["title"],
        "space": data.get("space", {}).get("name", ""),
        "content": strip_html(body_html),
        "url": f"{CONFLUENCE_URL}/wiki{data['_links']['webui']}",
    }


@app.post("/api/minerva/generate/{page_id}")
def minerva_generate(page_id: str):
    data = confluence_get(f"content/{page_id}", {"expand": "body.storage,space"})
    body_html = data.get("body", {}).get("storage", {}).get("value", "")
    content = strip_html(body_html)
    title = data["title"]
    try:
        course = generate_course(title, content)
        return course
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


COURSES_DIR = os.path.join(os.path.dirname(__file__), "data", "courses")


@app.get("/api/courses")
def list_courses():
    import json
    courses = []
    for f in sorted(os.listdir(COURSES_DIR)):
        if not f.endswith(".json"):
            continue
        with open(os.path.join(COURSES_DIR, f), encoding="utf-8") as fh:
            data = json.load(fh)
        course_id = f[:-len(".json")]  # el id es el nombre del fichero sin extensión
        modules = data.get("modules", [])
        lesson_count = sum(len(m.get("lessons", [])) for m in modules)
        courses.append({
            "id": course_id,
            "title": data.get("title"),
            "description": data.get("description"),
            "language": data.get("language"),
            "module_count": len(modules),
            "lesson_count": lesson_count,
        })
    return courses


# ---------------------------------------------------------------------------
# Surveys de fin de curso
# Solución puente sin BD: cada respuesta se añade como una línea JSON a
# data/surveys.jsonl. Cuando exista la BD, basta con cambiar save_survey().
# ---------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
SURVEYS_PATH = os.path.join(DATA_DIR, "surveys.jsonl")


class Survey(BaseModel):
    course_id: str
    user: str
    rating_overall: int          # 1-5
    rating_content: int          # 1-5
    rating_albus: int            # 1-5
    rating_applicability: int    # 1-5
    difficulty: str              # muy_facil | facil | adecuada | dificil | muy_dificil
    duration: str                # corta | adecuada | larga
    comments: Optional[str] = ""


@app.post("/api/surveys")
def submit_survey(survey: Survey):
    record = survey.dict()
    record["submitted_at"] = datetime.now(timezone.utc).isoformat()
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(SURVEYS_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return {"ok": True}


@app.get("/api/surveys")
def list_surveys():
    """Lectura para el futuro Panel de administración."""
    if not os.path.exists(SURVEYS_PATH):
        return []
    out = []
    with open(SURVEYS_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return out


@app.get("/api/courses/{course_id}")
def get_course(course_id: str):
    import json
    course_path = os.path.join(COURSES_DIR, f"{course_id}.json")
    if not os.path.exists(course_path):
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    with open(course_path, encoding="utf-8") as f:
        data = json.load(f)
    data["id"] = course_id  # garantizamos el id derivado del fichero
    return data
