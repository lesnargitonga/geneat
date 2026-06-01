"""Hazina Nomads knowledge-base sync — keeps RAG aligned with the live catalog."""
from __future__ import annotations

import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.rag import ingest_text
from app.catalog.hazina_catalog import (
    HAZINA_KB_POLICIES,
    build_hazina_kb_catalog,
)
from app.core.logging import get_logger
from app.db.models import KnowledgeChunk

log = get_logger("hazina_kb")

KB_CATALOG = build_hazina_kb_catalog()


async def hazina_kb_treasure_chunk_count(
    db: AsyncSession, business_id: uuid.UUID
) -> int:
    return int(
        (
            await db.execute(
                select(func.count(KnowledgeChunk.id)).where(
                    KnowledgeChunk.business_id == business_id,
                    KnowledgeChunk.content.ilike("TREASURE:%"),
                )
            )
        ).scalar_one()
    )


async def hazina_kb_needs_sync(db: AsyncSession, business_id: uuid.UUID) -> bool:
    from app.catalog.hazina_catalog import HAZINA_TREASURES

    treasure_chunks = await hazina_kb_treasure_chunk_count(db, business_id)
    if treasure_chunks < len(HAZINA_TREASURES):
        return True
    catalog_chunks = int(
        (
            await db.execute(
                select(func.count(KnowledgeChunk.id)).where(
                    KnowledgeChunk.business_id == business_id,
                    KnowledgeChunk.source == "catalog",
                )
            )
        ).scalar_one()
    )
    return catalog_chunks < len(KB_CATALOG)


async def sync_hazina_knowledge_base(
    db: AsyncSession,
    business_id: uuid.UUID,
    *,
    force: bool = False,
) -> int:
    """Re-embed Hazina catalog + policy chunks when the KB is missing or stale."""
    if not force and not await hazina_kb_needs_sync(db, business_id):
        return 0

    await db.execute(
        delete(KnowledgeChunk).where(KnowledgeChunk.business_id == business_id)
    )
    n = 0
    n += await ingest_text(db, business_id=business_id, source="catalog", chunks=KB_CATALOG)
    n += await ingest_text(db, business_id=business_id, source="policies", chunks=HAZINA_KB_POLICIES)
    log.warning(
        "hazina_kb_synced",
        business_id=str(business_id),
        chunks=n,
        catalog=len(KB_CATALOG),
        policies=len(HAZINA_KB_POLICIES),
    )
    return n
