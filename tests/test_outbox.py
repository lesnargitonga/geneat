from __future__ import annotations

import os
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models import Outbox, WebhookEndpoint, Business
from app.jobs import outbox_runner
from app.services import outbox as outbox_svc


@pytest_asyncio.fixture
async def outbox_session(monkeypatch):
    # These tests require a Postgres-compatible DB (JSONB / UUID types).
    # Skip when DATABASE_URL is not configured or points to sqlite so local
    # fast runs or sqlite-only CI jobs do not fail.
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url or db_url.startswith("sqlite"):
        pytest.skip("DATABASE_URL not configured to a Postgres DB; skipping outbox DB tests")
    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Outbox.__table__.create(c, checkfirst=True))
        await conn.run_sync(lambda c: WebhookEndpoint.__table__.create(c, checkfirst=True))
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    monkeypatch.setattr(outbox_svc, "SessionLocal", Session)
    monkeypatch.setattr(outbox_runner, "SessionLocal", Session)
    yield Session
    await engine.dispose()


@pytest.mark.asyncio
async def test_enqueue_and_fetch(outbox_session):
    async with outbox_session() as db:
        # create a dummy business + endpoint so the payload refers to something realistic
        biz = Business(slug="testbiz", name="Test Biz", industry="test")
        db.add(biz)
        await db.commit()
        await db.refresh(biz)

        ep = WebhookEndpoint(business_id=biz.id, url="http://example.local/hook", secret="s", events=["test.event"])
        db.add(ep)
        await db.commit()
        await db.refresh(ep)

    # enqueue a row and ensure it can be fetched
    oid = await outbox_svc.enqueue(kind="webhook", payload={"endpoint_id": str(ep.id), "body": "{}", "sig": "s", "event_type": "test.event"})
    rows = await outbox_svc.fetch_pending(limit=10)
    assert len(rows) == 1
    assert int(rows[0].id) == int(oid)
