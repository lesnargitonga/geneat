"""Admin API — merchant onboarding & knowledge-base management.

Endpoints:
    POST   /admin/businesses              — create a new tenant
    GET    /admin/businesses              — list all tenants
    GET    /admin/businesses/{slug}       — fetch one
    PATCH  /admin/businesses/{slug}       — update brand voice / contact / etc.
    POST   /admin/businesses/{slug}/kb/items   — bulk add KB rows (JSON)
    POST   /admin/businesses/{slug}/kb/csv     — bulk add KB rows from CSV
    DELETE /admin/businesses/{slug}/kb         — wipe a tenant's KB
    GET    /admin/businesses/{slug}/kb         — list KB rows (no embeddings)

Auth: bearer token via `ADMIN_API_TOKEN` env var. If unset the API refuses
all requests — there is no insecure default.
"""
from __future__ import annotations

import csv
import io
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.rag import ingest_text
from app.api.deps import db_session
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models import Business, KnowledgeChunk

log = get_logger("admin_api")
router = APIRouter(prefix="/admin", tags=["admin"])


# ── Auth ─────────────────────────────────────────────────────────────────
async def require_admin(authorization: Optional[str] = Header(None)) -> None:
    s = get_settings()
    expected = s.admin_api_token.get_secret_value()
    if not expected:
        # Refuse — no token configured means admin API is disabled.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API disabled — set ADMIN_API_TOKEN to enable.",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if token != expected:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid bearer token")


# ── Schemas ──────────────────────────────────────────────────────────────
_SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$")


class BusinessIn(BaseModel):
    slug: str = Field(..., examples=["palm-cafe"])
    name: str = Field(..., max_length=256)
    industry: str = Field(..., max_length=64, examples=["restaurant"])
    location: Optional[str] = Field(None, max_length=256)
    contact_phone: Optional[str] = Field(None, max_length=20)
    contact_email: Optional[EmailStr] = None
    brand_voice: Optional[str] = None
    greeting_template: Optional[str] = None
    language_primary: str = "en"
    language_secondary: str = "sw"
    meta_wa_phone_number_id: Optional[str] = Field(None, max_length=32)
    profile: dict = Field(default_factory=dict)
    active: bool = True
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class BusinessPatch(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    brand_voice: Optional[str] = None
    greeting_template: Optional[str] = None
    language_primary: Optional[str] = None
    language_secondary: Optional[str] = None
    meta_wa_phone_number_id: Optional[str] = None
    profile: Optional[dict] = None
    active: Optional[bool] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class BusinessOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    industry: str
    location: Optional[str]
    contact_phone: Optional[str]
    contact_email: Optional[str]
    language_primary: str
    language_secondary: str
    meta_wa_phone_number_id: Optional[str]
    active: bool
    kb_rows: int = 0
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @classmethod
    def from_orm_row(cls, b: Business, kb_rows: int = 0) -> "BusinessOut":
        return cls(
            id=b.id, slug=b.slug, name=b.name, industry=b.industry,
            location=b.location, contact_phone=b.contact_phone,
            contact_email=b.contact_email,
            language_primary=b.language_primary,
            language_secondary=b.language_secondary,
            meta_wa_phone_number_id=b.meta_wa_phone_number_id,
            active=b.active, kb_rows=kb_rows,
            latitude=float(b.latitude) if b.latitude is not None else None,
            longitude=float(b.longitude) if b.longitude is not None else None,
        )


class KBItem(BaseModel):
    source: str = Field(..., max_length=256, examples=["pricing"])
    content: str = Field(..., min_length=4, max_length=4000)


class KBItemsIn(BaseModel):
    items: list[KBItem] = Field(..., min_length=1, max_length=500)


class KBIngestResult(BaseModel):
    inserted: int
    business_slug: str


class DemoSeedResult(BaseModel):
    businesses: int
    kb_chunks: dict[str, int]
    conversations: dict[str, int]


# ── Helpers ──────────────────────────────────────────────────────────────
async def _get_business_or_404(db: AsyncSession, slug: str) -> Business:
    res = await db.execute(select(Business).where(Business.slug == slug))
    b = res.scalar_one_or_none()
    if b is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Business '{slug}' not found")
    return b


async def _kb_row_count(db: AsyncSession, business_id: uuid.UUID) -> int:
    res = await db.execute(
        text("SELECT COUNT(*) FROM knowledge_base WHERE business_id = :bid"),
        {"bid": str(business_id)},
    )
    return int(res.scalar() or 0)


# ── Endpoints ────────────────────────────────────────────────────────────
@router.post(
    "/businesses",
    response_model=BusinessOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_business(
    payload: BusinessIn, db: AsyncSession = Depends(db_session),
) -> BusinessOut:
    if not _SLUG_RE.match(payload.slug):
        raise HTTPException(422, "slug must be lowercase alphanumeric with dashes (3-64 chars)")

    existing = (await db.execute(select(Business).where(Business.slug == payload.slug))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(409, f"Business '{payload.slug}' already exists")

    if payload.meta_wa_phone_number_id:
        clash = (await db.execute(
            select(Business).where(Business.meta_wa_phone_number_id == payload.meta_wa_phone_number_id)
        )).scalar_one_or_none()
        if clash is not None:
            raise HTTPException(409, f"meta_wa_phone_number_id already claimed by '{clash.slug}'")

    b = Business(
        slug=payload.slug, name=payload.name, industry=payload.industry,
        location=payload.location, contact_phone=payload.contact_phone,
        contact_email=payload.contact_email, brand_voice=payload.brand_voice,
        greeting_template=payload.greeting_template,
        language_primary=payload.language_primary,
        language_secondary=payload.language_secondary,
        meta_wa_phone_number_id=payload.meta_wa_phone_number_id,
        profile=payload.profile, active=payload.active,
    )
    db.add(b)
    await db.commit()
    await db.refresh(b)
    log.info("business_created", slug=b.slug, id=str(b.id))
    return BusinessOut.from_orm_row(b)


@router.get(
    "/businesses",
    response_model=list[BusinessOut],
    dependencies=[Depends(require_admin)],
)
async def list_businesses(db: AsyncSession = Depends(db_session)) -> list[BusinessOut]:
    rows = (await db.execute(select(Business).order_by(Business.created_at.desc()))).scalars().all()
    out: list[BusinessOut] = []
    for b in rows:
        out.append(BusinessOut.from_orm_row(b, await _kb_row_count(db, b.id)))
    return out


@router.post(
    "/bootstrap/geneat-demo",
    response_model=DemoSeedResult,
    dependencies=[Depends(require_admin)],
)
async def bootstrap_geneat_demo(
    db: AsyncSession = Depends(db_session),
) -> DemoSeedResult:
    """Seed the hosted demo tenants and KB without needing shell access.

    This mirrors `scripts/seed_geneat_demo.py` but is callable over HTTPS
    using the existing ADMIN_API_TOKEN bearer auth.
    """
    from scripts.seed_geneat_demo import (
        CAFES,
        DEMO_CONVERSATIONS,
        reset_kb,
        seed_conversation,
        upsert_business,
    )

    slug_to_id: dict[str, uuid.UUID] = {}
    kb_chunks: dict[str, int] = {}
    conversations: dict[str, int] = {spec["slug"]: 0 for spec in CAFES}

    for spec in CAFES:
        biz = await upsert_business(db, spec)
        await db.commit()
        await db.refresh(biz)
        slug_to_id[spec["slug"]] = biz.id

    for slug, business_id in slug_to_id.items():
        kb_chunks[slug] = await reset_kb(db, business_id, slug)
        await db.commit()

    for spec in DEMO_CONVERSATIONS:
        await seed_conversation(db, slug_to_id[spec["cafe"]], spec)
        conversations[spec["cafe"]] += 1
    await db.commit()

    log.info(
        "demo_bootstrap_completed",
        businesses=len(slug_to_id),
        kb_chunks=kb_chunks,
        conversations=conversations,
    )
    return DemoSeedResult(
        businesses=len(slug_to_id),
        kb_chunks=kb_chunks,
        conversations=conversations,
    )


@router.get(
    "/businesses/{slug}",
    response_model=BusinessOut,
    dependencies=[Depends(require_admin)],
)
async def get_business(slug: str, db: AsyncSession = Depends(db_session)) -> BusinessOut:
    b = await _get_business_or_404(db, slug)
    return BusinessOut.from_orm_row(b, await _kb_row_count(db, b.id))


@router.patch(
    "/businesses/{slug}",
    response_model=BusinessOut,
    dependencies=[Depends(require_admin)],
)
async def update_business(
    slug: str, patch: BusinessPatch, db: AsyncSession = Depends(db_session),
) -> BusinessOut:
    b = await _get_business_or_404(db, slug)
    data = patch.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(b, k, v)
    await db.commit()
    await db.refresh(b)
    log.info("business_updated", slug=b.slug, fields=list(data.keys()))
    return BusinessOut.from_orm_row(b, await _kb_row_count(db, b.id))


@router.post(
    "/businesses/{slug}/kb/items",
    response_model=KBIngestResult,
    dependencies=[Depends(require_admin)],
)
async def add_kb_items(
    slug: str, payload: KBItemsIn, db: AsyncSession = Depends(db_session),
) -> KBIngestResult:
    """Bulk-add KB rows. Each item is embedded immediately via nomic-embed-text."""
    b = await _get_business_or_404(db, slug)
    inserted = 0
    # Group by source so a single ingest_text call shares one embedder batch.
    by_source: dict[str, list[str]] = {}
    for it in payload.items:
        by_source.setdefault(it.source, []).append(it.content)
    for src, contents in by_source.items():
        n = await ingest_text(db, business_id=b.id, source=src, chunks=contents)
        inserted += n
    await db.commit()
    log.info("kb_items_added", slug=slug, count=inserted)
    return KBIngestResult(inserted=inserted, business_slug=slug)


@router.post(
    "/businesses/{slug}/kb/csv",
    response_model=KBIngestResult,
    dependencies=[Depends(require_admin)],
)
async def add_kb_csv(
    slug: str,
    file: UploadFile = File(..., description="CSV with header row: source,content"),
    db: AsyncSession = Depends(db_session),
) -> KBIngestResult:
    """Upload a CSV with two columns: `source` and `content`. Both required.
    Empty lines and rows missing either column are skipped silently."""
    b = await _get_business_or_404(db, slug)
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(raw))
    if not reader.fieldnames or "content" not in reader.fieldnames:
        raise HTTPException(422, "CSV must have a header row containing at least 'content' (optionally 'source')")

    by_source: dict[str, list[str]] = {}
    for row in reader:
        content = (row.get("content") or "").strip()
        if len(content) < 4:
            continue
        source = (row.get("source") or file.filename or "upload").strip()[:256]
        by_source.setdefault(source, []).append(content[:4000])

    if not by_source:
        raise HTTPException(422, "No usable rows found in CSV")

    inserted = 0
    for src, contents in by_source.items():
        n = await ingest_text(db, business_id=b.id, source=src, chunks=contents)
        inserted += n
    await db.commit()
    log.info("kb_csv_uploaded", slug=slug, filename=file.filename, count=inserted)
    return KBIngestResult(inserted=inserted, business_slug=slug)


@router.delete(
    "/businesses/{slug}/kb",
    dependencies=[Depends(require_admin)],
)
async def delete_kb(slug: str, db: AsyncSession = Depends(db_session)) -> dict:
    b = await _get_business_or_404(db, slug)
    res = await db.execute(
        text("DELETE FROM knowledge_base WHERE business_id = :bid"),
        {"bid": str(b.id)},
    )
    await db.commit()
    deleted = res.rowcount or 0
    log.info("kb_wiped", slug=slug, deleted=deleted)
    return {"deleted": deleted, "business_slug": slug}


@router.get(
    "/businesses/{slug}/kb",
    dependencies=[Depends(require_admin)],
)
async def list_kb(slug: str, db: AsyncSession = Depends(db_session), limit: int = 200) -> dict:
    b = await _get_business_or_404(db, slug)
    res = await db.execute(
        select(KnowledgeChunk.id, KnowledgeChunk.source, KnowledgeChunk.content, KnowledgeChunk.created_at)
        .where(KnowledgeChunk.business_id == b.id)
        .order_by(KnowledgeChunk.created_at.desc())
        .limit(limit)
    )
    rows = res.all()
    return {
        "business_slug": slug,
        "count": len(rows),
        "items": [
            {"id": str(r.id), "source": r.source, "content": r.content, "created_at": r.created_at.isoformat()}
            for r in rows
        ],
    }


# ── Conversation + escalation viewers ───────────────────────────────────

@router.get(
    "/businesses/{slug}/conversations",
    dependencies=[Depends(require_admin)],
)
async def list_conversations(
    slug: str,
    db: AsyncSession = Depends(db_session),
    limit: int = 50,
    status_filter: str | None = None,
) -> dict:
    """Most recent conversations for a tenant. `status_filter` ∈ {active,closed,human_escalated}."""
    from app.db.models import Conversation, ConvStatus, Customer, Message, Sender
    b = await _get_business_or_404(db, slug)
    q = (
        select(Conversation, Customer.phone_number, Customer.name)
        .join(Customer, Customer.id == Conversation.customer_id)
        .where(Conversation.business_id == b.id)
        .order_by(Conversation.last_activity_at.desc())
        .limit(limit)
    )
    if status_filter:
        try:
            q = q.where(Conversation.status == ConvStatus(status_filter))
        except ValueError:
            raise HTTPException(400, f"Invalid status: {status_filter}")
    rows = (await db.execute(q)).all()
    conv_ids = [c.Conversation.id for c in rows]
    last_msgs: dict[uuid.UUID, str] = {}
    if conv_ids:
        # Get the most recent message per conversation in a single query.
        msg_rows = (await db.execute(
            select(Message.conversation_id, Message.content, Message.timestamp, Message.sender)
            .where(Message.conversation_id.in_(conv_ids))
            .order_by(Message.timestamp.desc())
        )).all()
        for mr in msg_rows:
            if mr.conversation_id not in last_msgs:
                last_msgs[mr.conversation_id] = (mr.content or "")[:160]
    return {
        "business_slug": slug,
        "count": len(rows),
        "items": [
            {
                "id": str(r.Conversation.id),
                "phone": r.phone_number,
                "customer_name": r.name,
                "channel": r.Conversation.channel.value,
                "status": r.Conversation.status.value,
                "failed_turns": r.Conversation.failed_turns,
                "last_activity_at": r.Conversation.last_activity_at.isoformat(),
                "created_at": r.Conversation.created_at.isoformat(),
                "last_message_preview": last_msgs.get(r.Conversation.id, ""),
            }
            for r in rows
        ],
    }


@router.get(
    "/conversations/{conv_id}",
    dependencies=[Depends(require_admin)],
)
async def get_conversation(conv_id: str, db: AsyncSession = Depends(db_session)) -> dict:
    """Full message history for one conversation."""
    from app.db.models import Conversation, Customer, Message, ToolInvocation
    try:
        cid = uuid.UUID(conv_id)
    except ValueError:
        raise HTTPException(400, "Invalid conversation id")
    row = (await db.execute(
        select(Conversation, Customer.phone_number, Customer.name)
        .join(Customer, Customer.id == Conversation.customer_id)
        .where(Conversation.id == cid)
    )).first()
    if not row:
        raise HTTPException(404, "Conversation not found")
    msgs = (await db.execute(
        select(Message).where(Message.conversation_id == cid)
        .order_by(Message.timestamp.asc())
    )).scalars().all()
    tools = (await db.execute(
        select(ToolInvocation).where(ToolInvocation.conversation_id == cid)
        .order_by(ToolInvocation.created_at.asc())
    )).scalars().all()
    return {
        "id": str(row.Conversation.id),
        "phone": row.phone_number,
        "customer_name": row.name,
        "channel": row.Conversation.channel.value,
        "status": row.Conversation.status.value,
        "business_id": str(row.Conversation.business_id) if row.Conversation.business_id else None,
        "messages": [
            {
                "sender": m.sender.value, "content": m.content,
                "language": m.language, "media_url": m.media_url,
                "timestamp": m.timestamp.isoformat(),
            }
            for m in msgs
        ],
        "tool_invocations": [
            {
                "tool_name": t.tool_name, "arguments": t.arguments,
                "result": t.result, "success": t.success,
                "latency_ms": t.latency_ms,
                "created_at": t.created_at.isoformat(),
            }
            for t in tools
        ],
    }


@router.get(
    "/escalations",
    dependencies=[Depends(require_admin)],
)
async def list_escalations(
    db: AsyncSession = Depends(db_session),
    slug: str | None = None,
    limit: int = 100,
) -> dict:
    """All conversations currently in `human_escalated` state, across tenants (or one)."""
    from app.db.models import Business, Conversation, ConvStatus, Customer
    q = (
        select(
            Conversation, Customer.phone_number, Customer.name,
            Business.slug, Business.name.label("biz_name"),
        )
        .join(Customer, Customer.id == Conversation.customer_id)
        .outerjoin(Business, Business.id == Conversation.business_id)
        .where(Conversation.status == ConvStatus.human_escalated)
        .order_by(Conversation.last_activity_at.desc())
        .limit(limit)
    )
    if slug:
        q = q.where(Business.slug == slug)
    rows = (await db.execute(q)).all()
    return {
        "count": len(rows),
        "items": [
            {
                "conversation_id": str(r.Conversation.id),
                "phone": r.phone_number,
                "customer_name": r.name,
                "business_slug": r.slug,
                "business_name": r.biz_name,
                "channel": r.Conversation.channel.value,
                "failed_turns": r.Conversation.failed_turns,
                "last_activity_at": r.Conversation.last_activity_at.isoformat(),
            }
            for r in rows
        ],
    }


@router.post(
    "/conversations/{conv_id}/resolve",
    dependencies=[Depends(require_admin)],
)
async def resolve_escalation(conv_id: str, db: AsyncSession = Depends(db_session)) -> dict:
    """Move a conversation out of escalated state back to active so the AI can resume."""
    from app.db.models import Conversation, ConvStatus
    try:
        cid = uuid.UUID(conv_id)
    except ValueError:
        raise HTTPException(400, "Invalid conversation id")
    conv = (await db.execute(
        select(Conversation).where(Conversation.id == cid)
    )).scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    conv.status = ConvStatus.active
    conv.failed_turns = 0
    await db.commit()
    log.info("escalation_resolved", conv_id=str(cid))
    return {"status": "active", "conversation_id": str(cid)}


@router.get(
    "/businesses/{slug}/analytics",
    dependencies=[Depends(require_admin)],
)
async def business_analytics(slug: str, db: AsyncSession = Depends(db_session), days: int = 7) -> dict:
    """Lightweight per-tenant metrics: messages, conversations, escalations, orders."""
    from datetime import datetime, timedelta, timezone
    from app.db.models import (
        Conversation, ConvStatus, Customer, Message, Order, PaymentStatus, ToolInvocation,
    )
    b = await _get_business_or_404(db, slug)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    msg_count = (await db.execute(
        text("""
            SELECT COUNT(*) FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE c.business_id = :bid AND m.timestamp >= :since
        """),
        {"bid": str(b.id), "since": since},
    )).scalar_one()
    conv_count = (await db.execute(
        select(func.count(Conversation.id))
        .where(Conversation.business_id == b.id, Conversation.created_at >= since)
    )).scalar_one()
    escalation_count = (await db.execute(
        select(func.count(Conversation.id))
        .where(
            Conversation.business_id == b.id,
            Conversation.status == ConvStatus.human_escalated,
            Conversation.last_activity_at >= since,
        )
    )).scalar_one()
    order_total = (await db.execute(
        text("""
            SELECT COALESCE(SUM(amount), 0) FROM orders o
            JOIN conversations c ON c.id = o.conversation_id
            WHERE c.business_id = :bid AND o.payment_status = 'paid' AND o.created_at >= :since
        """),
        {"bid": str(b.id), "since": since},
    )).scalar_one()
    tool_failures = (await db.execute(
        text("""
            SELECT COUNT(*) FROM tool_invocations ti
            JOIN conversations c ON c.id = ti.conversation_id
            WHERE c.business_id = :bid AND ti.success = false AND ti.created_at >= :since
        """),
        {"bid": str(b.id), "since": since},
    )).scalar_one()
    return {
        "business_slug": slug,
        "window_days": days,
        "messages": int(msg_count or 0),
        "conversations_started": int(conv_count or 0),
        "escalations": int(escalation_count or 0),
        "orders_paid_total": float(order_total or 0),
        "tool_failures": int(tool_failures or 0),
    }
