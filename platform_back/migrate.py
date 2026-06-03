"""One-shot migration: introduce the `roles` table and replace `users.role`
(string) with `users.role_id` (FK → roles.id).

Run once before starting the server with the new code:
    cd platform_back && python migrate.py

Idempotent: if `role_id` already exists the script exits without changes.
"""
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "platform.db"
ROLES = ("Admin", "Technical", "Sales")
FALLBACK_ROLE = "Technical"


def column_exists(cur: sqlite3.Cursor, table: str, column: str) -> bool:
    cur.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def main() -> None:
    if not DB_PATH.exists():
        print("platform.db not found — nothing to migrate (fresh installs use seed.py).")
        sys.exit(0)

    backup = DB_PATH.with_suffix(f".pre-role-fk-{datetime.now().strftime('%Y%m%d%H%M%S')}.db")
    shutil.copy2(DB_PATH, backup)
    print(f"backup → {backup.name}")

    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA journal_mode=WAL")
    cur = con.cursor()

    if column_exists(cur, "users", "role_id"):
        print("Already migrated (role_id column exists). Nothing to do.")
        con.close()
        return

    print("Migrating…")
    con.execute("PRAGMA foreign_keys = OFF")
    con.execute("BEGIN")

    # 1. roles table
    con.execute("""
        CREATE TABLE IF NOT EXISTS roles (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(50) UNIQUE NOT NULL
        )
    """)
    for name in ROLES:
        con.execute("INSERT OR IGNORE INTO roles (name) VALUES (?)", (name,))

    # 2. add role_id (nullable) to existing users table
    con.execute("ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id)")

    # 3. populate role_id from the existing role string
    con.execute("""
        UPDATE users
        SET role_id = (SELECT id FROM roles WHERE name = users.role)
    """)

    # 4. fallback: any user whose role string didn't match a known role gets FALLBACK_ROLE
    con.execute("""
        UPDATE users
        SET role_id = (SELECT id FROM roles WHERE name = ?)
        WHERE role_id IS NULL
    """, (FALLBACK_ROLE,))

    # 5. recreate users without the role string column
    con.execute("""
        CREATE TABLE users_new (
            id         INTEGER PRIMARY KEY,
            email      VARCHAR(255) UNIQUE NOT NULL,
            name       VARCHAR(255) NOT NULL,
            role_id    INTEGER NOT NULL REFERENCES roles(id),
            created_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
        )
    """)
    con.execute("""
        INSERT INTO users_new (id, email, name, role_id, created_at)
        SELECT id, email, name, role_id, created_at FROM users
    """)
    con.execute("DROP TABLE users")
    con.execute("ALTER TABLE users_new RENAME TO users")

    # 6. restore indexes
    con.execute("CREATE INDEX IF NOT EXISTS ix_users_id ON users (id)")
    con.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)")

    con.execute("COMMIT")
    con.execute("PRAGMA foreign_keys = ON")
    con.close()

    print("Done. users.role (string) → users.role_id (FK).")
    print(f"Rollback if needed: cp {backup.name} platform.db")


if __name__ == "__main__":
    main()
