#!/usr/bin/env python3
"""
Check that `knowledge_base.embedding` column is `vector(N)` and that N matches
the `OPENAI_EMBED_DIMENSIONS` environment variable (default 768).

Exit codes:
  0 - OK
  2 - column not found
  3 - column not a vector
  4 - dimension mismatch
"""
import os
import re
import sys

from psycopg import connect


def normalize_db_url(db_url: str) -> str:
    if not db_url:
        raise RuntimeError("DATABASE_URL not set")
    # allow SQLAlchemy-style driver strings in env and normalize for psycopg
    return db_url.replace("+asyncpg", "").replace("+psycopg", "")


def get_embedding_type(db_url: str) -> str | None:
    db_url = normalize_db_url(db_url)
    conn = connect(db_url)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT format_type(a.atttypid, a.atttypmod) AS type_str
        FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        WHERE c.relname = 'knowledge_base' AND a.attname = 'embedding'
        """
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return None
    return row[0]


def main() -> int:
    db_url = os.getenv("DATABASE_URL")
    expected = int(os.getenv("OPENAI_EMBED_DIMENSIONS", "768"))
    type_str = get_embedding_type(db_url)
    if not type_str:
        print("ERROR: Couldn't find `knowledge_base.embedding` column type", file=sys.stderr)
        return 2
    m = re.search(r"vector\((\d+)\)", type_str)
    if not m:
        print(f"ERROR: embedding column is not vector type: {type_str}", file=sys.stderr)
        return 3
    actual = int(m.group(1))
    if actual != expected:
        print(f"ERROR: Embedding dimension mismatch: expected {expected}, got {actual}", file=sys.stderr)
        return 4
    print(f"OK: Embedding dimension matches expected {expected} (found {actual})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
