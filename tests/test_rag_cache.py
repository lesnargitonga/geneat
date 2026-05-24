from __future__ import annotations

import pytest

from app.ai import rag


@pytest.fixture(autouse=True)
def _clear_embedding_cache():
    rag.clear_embed_query_cache()
    yield
    rag.clear_embed_query_cache()


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
