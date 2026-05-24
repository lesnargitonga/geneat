"""Tiny durable background-job runner.

This is deliberately modest: jobs are rows in Postgres, API workers claim due
rows with ``FOR UPDATE SKIP LOCKED``, and registered async handlers do the
work. It covers the reliability gap left by ``asyncio.create_task`` without
requiring a separate queue service for the beta deployment.
"""
from __future__ import annotations

import asyncio
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable

from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.db.models import BackgroundJob, JobStatus
from app.db.session import SessionLocal

log = get_logger("jobs.runner")

Handler = Callable[["JobSnapshot"], Awaitable[None]]

_handlers: dict[str, Handler] = {}
_runner_task: asyncio.Task | None = None
_worker_id = f"job-pid-{os.getpid()}"
_poll_interval = 2.0
_lease_seconds = 10 * 60
_default_job_ttl_seconds = 24 * 60 * 60


@dataclass(frozen=True)
class JobSnapshot:
    id: uuid.UUID
    kind: str
    payload: dict
    business_id: uuid.UUID | None
    attempts: int
    max_attempts: int
    expires_at: datetime | None = None


def register_job_handler(kind: str, fn: Handler) -> Handler:
    _handlers[kind] = fn
    return fn


def job_handler(kind: str) -> Callable[[Handler], Handler]:
    def _wrap(fn: Handler) -> Handler:
        register_job_handler(kind, fn)
        return fn
    return _wrap


async def enqueue_job(
    db: AsyncSession,
    *,
    kind: str,
    payload: dict | None = None,
    business_id: uuid.UUID | None = None,
    run_at: datetime | None = None,
    max_attempts: int = 3,
    ttl_seconds: int | None = _default_job_ttl_seconds,
) -> BackgroundJob:
    scheduled_at = run_at or datetime.now(timezone.utc)
    expires_at = None
    if ttl_seconds is not None:
        expires_at = scheduled_at + timedelta(seconds=max(1, int(ttl_seconds or 1)))
    job = BackgroundJob(
        business_id=business_id,
        kind=kind,
        payload=payload or {},
        status=JobStatus.queued,
        run_at=scheduled_at,
        expires_at=expires_at,
        max_attempts=max(1, int(max_attempts or 1)),
    )
    db.add(job)
    await db.flush()
    return job


def _snapshot(job: BackgroundJob) -> JobSnapshot:
    return JobSnapshot(
        id=job.id,
        kind=job.kind,
        payload=dict(job.payload or {}),
        business_id=job.business_id,
        attempts=job.attempts,
        max_attempts=job.max_attempts,
        expires_at=job.expires_at,
    )


async def _claim_due_jobs(limit: int) -> list[JobSnapshot]:
    now = datetime.now(timezone.utc)
    locked_until = now + timedelta(seconds=_lease_seconds)
    async with SessionLocal() as db:
        expired = await db.execute(
            update(BackgroundJob)
            .where(BackgroundJob.status.in_([JobStatus.queued, JobStatus.running]))
            .where(BackgroundJob.expires_at.is_not(None))
            .where(BackgroundJob.expires_at <= now)
            .values(
                status=JobStatus.failed,
                locked_by=None,
                locked_until=None,
                last_error="job expired before completion",
                finished_at=now,
            )
        )
        expired_count = int(expired.rowcount or 0)
        if expired_count:
            log.warning("jobs_expired", count=expired_count)
        stmt = (
            select(BackgroundJob)
            .where(
                or_(
                    and_(
                        BackgroundJob.status == JobStatus.queued,
                        BackgroundJob.run_at <= now,
                    ),
                    and_(
                        BackgroundJob.status == JobStatus.running,
                        BackgroundJob.locked_until.is_not(None),
                        BackgroundJob.locked_until <= now,
                    ),
                )
            )
            .where(or_(BackgroundJob.expires_at.is_(None), BackgroundJob.expires_at > now))
            .order_by(BackgroundJob.run_at.asc(), BackgroundJob.created_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        jobs = (await db.execute(stmt)).scalars().all()
        snapshots: list[JobSnapshot] = []
        for job in jobs:
            job.status = JobStatus.running
            job.locked_by = _worker_id
            job.locked_until = locked_until
            job.attempts = (job.attempts or 0) + 1
            job.last_error = None
            snapshots.append(_snapshot(job))
        if snapshots or expired_count:
            await db.commit()
        return snapshots


async def _mark_done(job_id: uuid.UUID) -> None:
    async with SessionLocal() as db:
        job = await db.get(BackgroundJob, job_id)
        if job is None:
            return
        job.status = JobStatus.done
        job.locked_by = None
        job.locked_until = None
        job.finished_at = datetime.now(timezone.utc)
        await db.commit()


async def _mark_failed_or_retry(job: JobSnapshot, error: Exception) -> None:
    now = datetime.now(timezone.utc)
    delay = min(300, 2 ** max(0, job.attempts - 1) * 15)
    async with SessionLocal() as db:
        row = await db.get(BackgroundJob, job.id)
        if row is None:
            return
        row.locked_by = None
        row.locked_until = None
        row.last_error = f"{type(error).__name__}: {error}"[:1000]
        expires_at = row.expires_at
        if expires_at is not None and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        expired = expires_at is not None and expires_at <= now
        would_expire_before_retry = expires_at is not None and now + timedelta(seconds=delay) >= expires_at
        if row.attempts >= row.max_attempts or expired or would_expire_before_retry:
            row.status = JobStatus.failed
            row.finished_at = now
        else:
            row.status = JobStatus.queued
            row.run_at = now + timedelta(seconds=delay)
        await db.commit()


async def _run_one(job: JobSnapshot) -> None:
    handler = _handlers.get(job.kind)
    if handler is None:
        await _mark_failed_or_retry(job, RuntimeError(f"no handler for job kind {job.kind!r}"))
        return
    try:
        await handler(job)
    except Exception as e:  # noqa: BLE001
        log.exception("job_failed", job_id=str(job.id), kind=job.kind, error=str(e))
        await _mark_failed_or_retry(job, e)
        return
    await _mark_done(job.id)


async def run_due_jobs_once(*, limit: int = 10) -> int:
    jobs = await _claim_due_jobs(limit)
    for job in jobs:
        await _run_one(job)
    return len(jobs)


async def _runner_loop() -> None:
    log.info("job_runner_started", worker=_worker_id)
    while True:
        try:
            n = await run_due_jobs_once(limit=10)
            await asyncio.sleep(0 if n else _poll_interval)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # pragma: no cover
            log.warning("job_runner_error", error=str(e))
            await asyncio.sleep(_poll_interval)


async def start_job_runner() -> asyncio.Task:
    global _runner_task
    if _runner_task is None or _runner_task.done():
        _runner_task = asyncio.create_task(_runner_loop(), name="background-job-runner")
    return _runner_task


async def stop_job_runner() -> None:
    global _runner_task
    if _runner_task and not _runner_task.done():
        _runner_task.cancel()
        try:
            await _runner_task
        except (asyncio.CancelledError, Exception):
            pass
    _runner_task = None
