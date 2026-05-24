from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models import Outbox, WebhookEndpoint
from app.jobs import outbox_runner
from app.services import outbox as outbox_svc


@pytest_asyncio.fixture
async def outbox_session(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Outbox.__table__.create)
        await conn.run_sync(WebhookEndpoint.__table__.create)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    monkeypatch.setattr(outbox_svc, "SessionLocal", Session)
    monkeypatch.setattr(outbox_runner, "SessionLocal", Session)
    yield Session
    await engine.dispose()


@pytest.mark.asyncio
async def test_enqueue_and_fetch(outbox_session):
    async with outbox_session() as db:
        # create a dummy endpoint so the payload refers to something realistic
        ep = WebhookEndpoint(url="http://example.local/hook", secret="s", events=["test.event"]) 
        db.add(ep)
        await db.commit()
        await db.refresh(ep)

    # enqueue a row and ensure it can be fetched
    oid = await outbox_svc.enqueue(kind="webhook", payload={"endpoint_id": str(ep.id), "body": "{}", "sig": "s", "event_type": "test.event"})
    rows = await outbox_svc.fetch_pending(limit=10)
    assert len(rows) == 1
    assert int(rows[0].id) == int(oid)
