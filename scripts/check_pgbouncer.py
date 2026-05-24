#!/usr/bin/env python3
"""
Health check for pgbouncer or direct DB connections.

Tries PGB_URL, then DATABASE_URL, then a sane default. Runs a lightweight
`SELECT 1` and attempts `SHOW POOLS` (pgbouncer admin) if available. Exits
non-zero on failure so CI/monitoring can use it.
"""
import os
import sys

from psycopg import connect


def normalize_db_url(db_url: str) -> str:
    return (db_url or "").replace("+asyncpg", "").replace("+psycopg", "")


def main() -> int:
    db_url = os.getenv("PGB_URL") or os.getenv("DATABASE_URL") or os.getenv("DATABASE_URL_SYNC")
    if not db_url:
        db_url = "postgresql://omni:omni@127.0.0.1:5432/omni"
    db_url = normalize_db_url(db_url)

    try:
        conn = connect(db_url)
        cur = conn.cursor()
        cur.execute("SELECT 1;")
        cur.fetchone()
        # Try a pgbouncer admin command; it's OK if this fails when talking
        # directly to Postgres.
        try:
            cur.execute("SHOW POOLS;")
            rows = cur.fetchall()
            print(f"OK: SHOW POOLS returned {len(rows)} rows")
        except Exception as exc:  # pragma: no cover - environment dependent
            print("INFO: SHOW POOLS unavailable or not pgbouncer admin:", str(exc))
        cur.close()
        conn.close()
        print("OK: DB connection successful")
        return 0
    except Exception as exc:
        print("ERROR: DB/pgbouncer connection failed:", str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
