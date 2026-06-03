#!/usr/bin/env python3
"""Quick terminal viewer for platform.db.

Usage:
  python dbview.py              # show all tables
  python dbview.py users        # show a specific table
  python dbview.py courses -n5  # limit rows
"""
import argparse
import sqlite3
import sys
from pathlib import Path
from textwrap import shorten

DB = Path(__file__).parent / "platform.db"

TABLES = ["users", "courses", "surveys"]

# Columns to truncate to keep rows readable
TRUNCATE = {
    "description": 60,
    "json_path": 50,
    "comments": 50,
    "session_id": 12,
}


def _col_width(rows: list[dict], col: str) -> int:
    max_data = max((len(str(r.get(col, "") or "")) for r in rows), default=0)
    return max(len(col), min(max_data, TRUNCATE.get(col, max_data)))


def _fmt(value, col: str, width: int) -> str:
    s = str(value) if value is not None else ""
    limit = TRUNCATE.get(col, width)
    s = shorten(s, width=limit, placeholder="…") if len(s) > limit else s
    return s.ljust(width)


def show_table(conn: sqlite3.Connection, table: str, limit: int) -> None:
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(f"SELECT COUNT(*) FROM {table}")
    total = cur.fetchone()[0]

    cur.execute(f"SELECT * FROM {table} ORDER BY id DESC LIMIT {limit}")
    rows = [dict(r) for r in cur.fetchall()]

    if not rows:
        print(f"\n  {table}: (vacía)\n")
        return

    cols = list(rows[0].keys())
    widths = {c: _col_width(rows, c) for c in cols}

    sep = "  ".join("─" * widths[c] for c in cols)
    header = "  ".join(c.upper().ljust(widths[c]) for c in cols)

    showing = f"mostrando {len(rows)} de {total}" if total > limit else f"{total} fila(s)"
    print(f"\n\033[1;36m▸ {table.upper()}\033[0m  \033[90m({showing})\033[0m")
    print(f"\033[90m{sep}\033[0m")
    print(f"\033[1m{header}\033[0m")
    print(f"\033[90m{sep}\033[0m")

    for row in rows:
        line = "  ".join(_fmt(row[c], c, widths[c]) for c in cols)
        print(line)

    print(f"\033[90m{sep}\033[0m")


def main() -> None:
    parser = argparse.ArgumentParser(description="Visor de platform.db")
    parser.add_argument("table", nargs="?", choices=TABLES + ["all"], default="all",
                        help="Tabla a mostrar (por defecto: all)")
    parser.add_argument("-n", "--limit", type=int, default=20,
                        help="Máximo de filas por tabla (por defecto: 20)")
    args = parser.parse_args()

    if not DB.exists():
        print(f"Error: no se encontró {DB}", file=sys.stderr)
        sys.exit(1)

    target = TABLES if args.table == "all" else [args.table]

    with sqlite3.connect(DB) as conn:
        for t in target:
            show_table(conn, t, args.limit)

    print()


if __name__ == "__main__":
    main()
