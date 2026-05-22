"""Nightly database backup → Cloudflare R2.

Runs `pg_dump` against `DATABASE_URL_SYNC` (or `DATABASE_URL` with asyncpg
stripped), gzip-compresses the stream, and uploads to the R2 bucket under
`backups/omni-YYYYMMDD_HHMMSS.sql.gz`. Prunes objects older than
`BACKUP_RETENTION_DAYS` (default 30).

Designed to run from cron / systemd timer / Kubernetes CronJob:

    0 2 * * *  cd /app && python -m scripts.backup_to_r2 >> /var/log/omni-backup.log 2>&1

Exit codes:
    0 — backup uploaded
    1 — pg_dump failed
    2 — upload failed
    3 — bad config
"""
from __future__ import annotations

import asyncio
import gzip
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import aioboto3

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("backup")


def _resolve_pg_url() -> str:
    s = get_settings()
    url = getattr(s, "database_url_sync", "") or s.database_url
    # pg_dump understands postgresql:// — strip the +asyncpg driver suffix.
    return url.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+psycopg://", "postgresql://")


def _pg_dump_to(path: Path, pg_url: str) -> None:
    if not shutil.which("pg_dump"):
        log.error("pg_dump_missing")
        sys.exit(1)
    cmd = ["pg_dump", "--no-owner", "--no-privileges", "--format=plain", pg_url]
    log.info("pg_dump_start", out=str(path))
    with gzip.open(path, "wb", compresslevel=6) as gz:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        assert proc.stdout is not None
        for chunk in iter(lambda: proc.stdout.read(64 * 1024), b""):
            gz.write(chunk)
        _, err = proc.communicate()
        if proc.returncode != 0:
            log.error("pg_dump_failed", code=proc.returncode, stderr=err.decode("utf-8", "replace")[:2000])
            sys.exit(1)
    log.info("pg_dump_ok", size_bytes=path.stat().st_size)


async def _upload_and_prune(local_path: Path, key: str, retention_days: int) -> None:
    s = get_settings()
    if not (s.r2_account_id and s.r2_bucket and s.r2_access_key_id.get_secret_value()):
        log.error("r2_not_configured")
        sys.exit(3)
    endpoint = f"https://{s.r2_account_id}.r2.cloudflarestorage.com"
    session = aioboto3.Session()
    async with session.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=s.r2_access_key_id.get_secret_value(),
        aws_secret_access_key=s.r2_secret_access_key.get_secret_value(),
        region_name="auto",
    ) as s3:
        try:
            with local_path.open("rb") as fp:
                await s3.put_object(
                    Bucket=s.r2_bucket, Key=key, Body=fp,
                    ContentType="application/gzip",
                    Metadata={"backup_ts": datetime.now(timezone.utc).isoformat()},
                )
            log.info("r2_upload_ok", key=key, bucket=s.r2_bucket)
        except Exception as e:
            log.error("r2_upload_failed", err=str(e))
            sys.exit(2)

        # Prune old backups.
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        try:
            paginator = s3.get_paginator("list_objects_v2")
            async for page in paginator.paginate(Bucket=s.r2_bucket, Prefix="backups/"):
                for obj in page.get("Contents") or []:
                    last_mod = obj.get("LastModified")
                    if last_mod and last_mod < cutoff:
                        await s3.delete_object(Bucket=s.r2_bucket, Key=obj["Key"])
                        log.info("r2_prune", key=obj["Key"])
        except Exception as e:
            log.warning("r2_prune_failed", err=str(e))


async def _main() -> None:
    retention_days = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    key = f"backups/omni-{ts}.sql.gz"
    with tempfile.TemporaryDirectory() as tmp:
        local = Path(tmp) / f"omni-{ts}.sql.gz"
        _pg_dump_to(local, _resolve_pg_url())
        await _upload_and_prune(local, key, retention_days)


if __name__ == "__main__":
    asyncio.run(_main())
