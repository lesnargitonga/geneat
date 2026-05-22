"""Retrieval-Augmented Generation over pgvector.

Phase 2 ships the query path + an `ingest_text` helper for tests / scripts.
Document loaders (PDF, DOCX) and a chunking pipeline land in Phase 3.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Sequence

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import get_embedder
from app.core.logging import get_logger
from app.db.models import KnowledgeChunk

log = get_logger("rag")


@dataclass
class RetrievedChunk:
    content: str
    source: str | None
    score: float


async def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    if not texts:
        return []
    emb = get_embedder()
    return await emb.aembed_documents(list(texts))


async def embed_query(q: str) -> list[float]:
    return await get_embedder().aembed_query(q)


async def ingest_text(
    db: AsyncSession, *, business_id: uuid.UUID | None, source: str, chunks: Sequence[str]
) -> int:
    vectors = await embed_texts(chunks)
    for content, vec in zip(chunks, vectors):
        db.add(KnowledgeChunk(
            business_id=business_id, source=source, content=content, embedding=vec,
        ))
    await db.flush()
    return len(chunks)


async def retrieve(
    db: AsyncSession,
    query: str,
    *,
    business_id: uuid.UUID | None = None,
    k: int = 5,
    min_score: float = 0.20,
) -> list[RetrievedChunk]:
    """Cosine-similarity search via pgvector. Returns [] gracefully on any error
    so the agent can still respond."""
    try:
        vec = await embed_query(query)
    except Exception as e:
        log.warning("rag_embed_failed", error=str(e))
        return []

    # `<=>` is cosine distance in pgvector; similarity = 1 - distance.
    sql = text(
        """
        SELECT content, source, 1 - (embedding <=> CAST(:vec AS vector)) AS score
        FROM knowledge_base
        WHERE (CAST(:bid AS uuid) IS NULL OR business_id = CAST(:bid AS uuid))
        ORDER BY embedding <=> CAST(:vec AS vector)
        LIMIT :k
        """
    )
    try:
        rows = (await db.execute(sql, {"vec": str(vec), "bid": str(business_id) if business_id else None, "k": k})).all()
    except Exception as e:
        log.warning("rag_query_failed", error=str(e))
        return []
    return [
        RetrievedChunk(content=r.content, source=r.source, score=float(r.score))
        for r in rows if float(r.score) >= min_score
    ]


def format_context(chunks: Sequence[RetrievedChunk]) -> str:
    if not chunks:
        return "(no relevant business knowledge found)"
    return "\n\n".join(
        f"[{i+1}] (source: {c.source or 'kb'}, score={c.score:.2f})\n{c.content}"
        for i, c in enumerate(chunks)
    )


async def keyword_search(
    db: AsyncSession,
    query: str,
    *,
    business_id: uuid.UUID | None = None,
    k: int = 3,
) -> list[RetrievedChunk]:
    """LLM-free fallback search using Postgres full-text + ILIKE.

    Used when ALL LLM providers are down so the customer still gets the most
    relevant KB snippet instead of a generic "team will follow up" message.
    Ranks by ts_rank_cd, falls back to substring match if FTS yields nothing.
    Returns at most `k` chunks; never raises.
    """
    if not query or not query.strip():
        return []
    cleaned = query.strip()[:300]
    # First attempt: full-text. websearch_to_tsquery handles natural language ('how to', etc).
    fts_sql = text(
        """
        SELECT content, source,
               ts_rank_cd(
                   to_tsvector('english', content),
                   websearch_to_tsquery('english', :q)
               ) AS rank
        FROM knowledge_base
        WHERE (CAST(:bid AS uuid) IS NULL OR business_id = CAST(:bid AS uuid))
          AND to_tsvector('english', content) @@ websearch_to_tsquery('english', :q)
        ORDER BY rank DESC
        LIMIT :k
        """
    )
    try:
        rows = (await db.execute(
            fts_sql, {"q": cleaned, "bid": str(business_id) if business_id else None, "k": k}
        )).all()
        if rows:
            return [
                RetrievedChunk(content=r.content, source=r.source, score=float(r.rank))
                for r in rows
            ]
    except Exception as e:
        log.warning("rag_keyword_fts_failed", error=str(e))

    # Fallback: simple ILIKE on the largest token in the query.
    tokens = [t for t in cleaned.split() if len(t) >= 4]
    if not tokens:
        return []
    needle = max(tokens, key=len)
    like_sql = text(
        """
        SELECT content, source
        FROM knowledge_base
        WHERE (CAST(:bid AS uuid) IS NULL OR business_id = CAST(:bid AS uuid))
          AND content ILIKE :pat
        LIMIT :k
        """
    )
    try:
        rows = (await db.execute(
            like_sql,
            {"pat": f"%{needle}%", "bid": str(business_id) if business_id else None, "k": k},
        )).all()
        return [
            RetrievedChunk(content=r.content, source=r.source, score=0.1)
            for r in rows
        ]
    except Exception as e:
        log.warning("rag_keyword_like_failed", error=str(e))
        return []


# ── Price discovery (used by output safety filter) ─────────────────────

_PRICE_SCAN_RE = re.compile(
    r"(?:KES|KSh|Ksh|ksh|kes)\s?(\d[\d,]{1,7})|"
    r"(\d[\d,]{1,7})\s?(?:KES|KSh|Ksh|/=|/-|bob|shillings?)",
    re.IGNORECASE,
)


async def kb_known_prices(
    db: AsyncSession, *, business_id: uuid.UUID | None,
) -> set[int]:
    """Return the set of integer KES amounts that appear anywhere in this
    tenant's knowledge base. Used by `app.ai.safety.evaluate_outbound` to
    redact any AI-emitted price that isn't anchored to a real menu item.

    Cached for 60s per tenant — KBs rarely change mid-shift, and this is
    called on every outbound message.
    """
    if business_id is None:
        return set()
    cache_key = str(business_id)
    now_ts = __import__("time").time()
    cached = _PRICE_CACHE.get(cache_key)
    if cached and cached[0] > now_ts:
        return cached[1]

    rows = (await db.execute(
        text("SELECT content FROM knowledge_base WHERE business_id = CAST(:bid AS uuid)"),
        {"bid": str(business_id)},
    )).all()
    prices: set[int] = set()
    for (content,) in rows:
        for m in _PRICE_SCAN_RE.finditer(content or ""):
            raw = (m.group(1) or m.group(2) or "").replace(",", "")
            try:
                v = int(raw)
            except ValueError:
                continue
            if 5 <= v <= 1_000_000:  # sane KES range
                prices.add(v)
    _PRICE_CACHE[cache_key] = (now_ts + 60.0, prices)
    return prices


_PRICE_CACHE: dict[str, tuple[float, set[int]]] = {}
