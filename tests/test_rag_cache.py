from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.ai import rag


@pytest.fixture(autouse=True)
def _clear_embedding_cache():
    rag.clear_embed_query_cache()
    rag.clear_menu_chunk_cache()
    yield
    rag.clear_embed_query_cache()
    rag.clear_menu_chunk_cache()


@pytest.mark.asyncio
async def test_embed_query_caches_repeated_normalized_queries(monkeypatch) -> None:
    class CountingEmbedder:
        def __init__(self) -> None:
            self.calls = 0

        async def aembed_query(self, query: str) -> list[float]:
            self.calls += 1
            return [float(self.calls), float(len(query))]

    embedder = CountingEmbedder()
    monkeypatch.setattr(rag, "get_embedder", lambda: embedder)

    first = await rag.embed_query("  Flat   White  ")
    second = await rag.embed_query("flat white")

    assert first == second
    assert embedder.calls == 1


@pytest.mark.asyncio
async def test_embed_query_cache_expires(monkeypatch) -> None:
    class CountingEmbedder:
        def __init__(self) -> None:
            self.calls = 0

        async def aembed_query(self, query: str) -> list[float]:
            self.calls += 1
            return [float(self.calls)]

    now = 1_000.0
    embedder = CountingEmbedder()
    monkeypatch.setattr(rag, "get_embedder", lambda: embedder)
    monkeypatch.setattr(rag.time, "monotonic", lambda: now)

    assert await rag.embed_query("croissant") == [1.0]
    assert await rag.embed_query("croissant") == [1.0]
    now += 301.0
    assert await rag.embed_query("croissant") == [2.0]
    assert embedder.calls == 2


@pytest.mark.asyncio
async def test_fetch_menu_chunks_caches_repeated_tenant_lookup(monkeypatch) -> None:
    class Rows:
        def all(self):
            return [
                SimpleNamespace(content="COFFEE - Espresso KES 120.", source="menu"),
            ]

    class CountingDb:
        def __init__(self) -> None:
            self.calls = 0

        async def execute(self, *_args, **_kwargs):
            self.calls += 1
            return Rows()

    now = 2_000.0
    db = CountingDb()
    monkeypatch.setattr(rag.time, "monotonic", lambda: now)

    first = await rag.fetch_menu_chunks(db, business_id=None, k=8)
    second = await rag.fetch_menu_chunks(db, business_id=None, k=8)

    assert first == second
    assert db.calls == 1


@pytest.mark.asyncio
async def test_fetch_menu_chunks_cache_expires(monkeypatch) -> None:
    class Rows:
        def __init__(self, value: int) -> None:
            self.value = value

        def all(self):
            return [
                SimpleNamespace(content=f"COFFEE - Espresso KES {100 + self.value}.", source="menu"),
            ]

    class CountingDb:
        def __init__(self) -> None:
            self.calls = 0

        async def execute(self, *_args, **_kwargs):
            self.calls += 1
            return Rows(self.calls)

    now = 2_000.0
    db = CountingDb()
    monkeypatch.setattr(rag.time, "monotonic", lambda: now)

    assert "KES 101" in (await rag.fetch_menu_chunks(db, business_id=None, k=8))[0].content
    assert "KES 101" in (await rag.fetch_menu_chunks(db, business_id=None, k=8))[0].content
    now += 61.0
    assert "KES 102" in (await rag.fetch_menu_chunks(db, business_id=None, k=8))[0].content
    assert db.calls == 2
