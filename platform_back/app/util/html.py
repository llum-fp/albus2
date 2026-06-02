"""HTML helpers. ``strip_html`` is lifted verbatim from the colleague backend's
minerva.py so the ported chat tutor keeps the same behavior without dragging in
the rest of minerva (which we do not use)."""
from bs4 import BeautifulSoup


def strip_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    return "\n".join(lines)
