"""Pytest fixtures: SQLite in-memory DB, fake Redis, stubbed LLM."""
from __future__ import annotations

import asyncio
from typing import AsyncIterator
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Force test settings BEFORE app imports
import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("OPENAI_API_KEY", "sk-test")
os.environ.setdefault("META_WA_APP_SECRET", "secret-shh")
os.environ.setdefault("META_WA_VERIFY_TOKEN", "verify-me")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_engine():
    """SQLite engine. Note: pgvector / JSONB are PG-only; tests that touch
    those tables should be marked `@pytest.mark.pg` and skipped in CI without
    a Postgres service. The pure-AI tests below don't need them."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db(db_engine) -> AsyncIterator[AsyncSession]:
    Session = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as s:
        yield s


@pytest.fixture
def fake_redis(monkeypatch):
    """Replace redis_client.get_redis() with an AsyncMock that fakes the
    handful of commands we use (set/get/eval/ping/aclose)."""
    store: dict = {}

    class FakeRedis:
        async def set(self, k, v, nx=False, ex=None, px=None):
            if nx and k in store: return False
            store[k] = v
            return True
        async def get(self, k): return store.get(k)
        async def delete(self, *ks):
            for k in ks: store.pop(k, None)
            return 0
        async def ping(self): return True
        async def aclose(self): pass
        async def eval(self, script, numkeys, *args):
            # token bucket fake: always allow
            if "tokens" in script: return 1
            # compare-and-delete lock release: succeed
            return 1

    fake = FakeRedis()
    async def _get(): return fake
    monkeypatch.setattr("app.core.redis_client.get_redis", _get)
    return fake


@pytest.fixture
def stub_llm(monkeypatch):
    """Replace ChatOpenAI with a deterministic stub so tests run offline."""
    from langchain_core.messages import AIMessage

    class StubLLM:
        def bind_tools(self, tools): return self
        def with_fallbacks(self, fallbacks): return self
        async def ainvoke(self, messages):
            # Find last HumanMessage and echo a deterministic reply.
            from langchain_core.messages import HumanMessage
            last = next((m for m in reversed(messages) if isinstance(m, HumanMessage)), None)
            text = (last.content if last else "").lower()
            if "human" in text or "agent" in text or "mtu halisi" in text:
                # Trigger escalate_to_human tool call
                return AIMessage(content="", tool_calls=[{
                    "name": "escalate_to_human", "id": "call_1",
                    "args": {"reason": "user_requested"},
                }])
            if "habari" in text or "swahili" in text:
                return AIMessage(content="Habari! Karibu, naweza kukusaidiaje leo?")
            return AIMessage(content=f"You said: {last.content if last else ''}")

    stub = StubLLM()
    # Patch get_chat_chain (what graph.py actually calls) to return the stub directly.
    monkeypatch.setattr("app.ai.llm.get_chat_chain", lambda *a, **kw: stub)
    monkeypatch.setattr("app.ai.graph.get_chat_chain", lambda *a, **kw: stub)
    # Also patch get_chat_llm for any legacy callers.
    monkeypatch.setattr("app.ai.llm.get_chat_llm", lambda *a, **kw: stub)


@pytest.fixture
def stub_rag(monkeypatch):
    """Skip pgvector retrieval in tests."""
    async def _retrieve(*a, **kw): return []
    monkeypatch.setattr("app.ai.graph.retrieve", _retrieve)
    monkeypatch.setattr("app.ai.rag.retrieve", _retrieve)

    # Also stub business lookup — SQLite test DB has no businesses table.
    async def _no_biz(*a, **kw): return None
    monkeypatch.setattr("app.ai.graph.get_business_for_turn", _no_biz)
    monkeypatch.setattr("app.services.business_service.get_business_for_turn", _no_biz, raising=False)

    # Stub kb_known_prices (used by output safety in channels/base.py)
    async def _no_prices(*a, **kw): return None
    monkeypatch.setattr("app.ai.rag.kb_known_prices", _no_prices, raising=False)
