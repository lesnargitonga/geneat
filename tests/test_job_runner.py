from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models import BackgroundJob, JobStatus
from app.jobs import runner


@pytest_asyncio.fixture
async def job_session(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(BackgroundJob.__table__.create)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    monkeypatch.setattr(runner, "SessionLocal", Session)
    yield Session
    await engine.dispose()


@pytest.mark.asyncio
async def test_runner_claims_due_job_and_marks_done(job_session):
    seen: list[dict] = []
    kind = "unit.done"

    @runner.job_handler(kind)
    async def _handle(job):
        seen.append(job.payload)

    async with job_session() as db:
        job = await runner.enqueue_job(
            db,
            kind=kind,
            payload={"ok": True},
            run_at=datetime.now(timezone.utc) - timedelta(seconds=1),
        )
        job_id = job.id
        await db.commit()

    assert await runner.run_due_jobs_once() == 1
    assert seen == [{"ok": True}]

    async with job_session() as db:
        row = await db.get(BackgroundJob, job_id)
        assert row is not None
        assert row.status == JobStatus.done
        assert row.attempts == 1
        assert row.finished_at is not None


@pytest.mark.asyncio
async def test_runner_retries_then_marks_failed(job_session):
    kind = "unit.fail"

    @runner.job_handler(kind)
    async def _handle(_job):
        raise RuntimeError("nope")

    async with job_session() as db:
        job = await runner.enqueue_job(
            db,
            kind=kind,
            payload={},
            run_at=datetime.now(timezone.utc) - timedelta(seconds=1),
            max_attempts=1,
        )
        job_id = job.id
        await db.commit()

    assert await runner.run_due_jobs_once() == 1

    async with job_session() as db:
        row = await db.get(BackgroundJob, job_id)
        assert row is not None
        assert row.status == JobStatus.failed
        assert row.attempts == 1
        assert "RuntimeError: nope" in (row.last_error or "")


@pytest.mark.asyncio
async def test_runner_expires_stale_jobs_without_running_handler(job_session):
    seen: list[dict] = []
    kind = "unit.expired"

    @runner.job_handler(kind)
    async def _handle(job):
        seen.append(job.payload)

    async with job_session() as db:
        job = await runner.enqueue_job(
            db,
            kind=kind,
            payload={"too_late": True},
            run_at=datetime.now(timezone.utc) - timedelta(seconds=10),
            ttl_seconds=1,
        )
        job_id = job.id
        await db.commit()

    assert await runner.run_due_jobs_once() == 0
    assert seen == []

    async with job_session() as db:
        row = await db.get(BackgroundJob, job_id)
        assert row is not None
        assert row.status == JobStatus.failed
        assert row.finished_at is not None
        assert row.last_error == "job expired before completion"
