#!/usr/bin/env python3
from __future__ import annotations

import os

import psycopg


def main() -> int:
    url = os.environ.get("DATABASE_URL_SYNC") or os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("Set DATABASE_URL_SYNC or DATABASE_URL before running this script.")
    if url.startswith("postgresql+psycopg://"):
        url = "postgresql://" + url.split("://", 1)[1]
    if url.startswith("postgresql+asyncpg://"):
        url = "postgresql://" + url.split("://", 1)[1]
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT tablename FROM pg_catalog.pg_tables "
                "WHERE schemaname='public' ORDER BY tablename"
            )
            print("\n".join(row[0] for row in cur.fetchall()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
