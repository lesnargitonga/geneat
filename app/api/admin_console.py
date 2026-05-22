"""Phase 8 admin-console routes — live conversation operations.

Mounted at /admin. Everything here either expects a JWT bearer or the
legacy ADMIN_API_TOKEN. Per-tenant routes additionally check the user's
TenantMembership role (or accept superadmin / machine bypass).

Modules grouped in this file:
  * /admin/conversations/{id}/takeover|release|messages   (takeover + send)
  * /admin/conversations/{id}/full                        (rich detail w/ takeover meta)
  * /admin/businesses/{slug}/kb/items/{kb_id}             (inline edit / delete + re-embed)
  * /admin/businesses/{slug}/kb/re-embed                  (full re-embed)
  * /admin/businesses/{slug}/profile                      (Business.profile JSONB editor)
  * /admin/businesses/{slug}/prompt                       (brand_voice + greeting_template)
  * /admin/businesses/{slug}/webhooks                     (per-tenant outbound webhook CRUD)
  * /admin/businesses/{slug}/usage                        (daily-bucketed metrics + cost estimate)
  * /admin/businesses/{slug}/broadcasts                   (CRUD + send loop)
  * /admin/audit                                          (filtered AuditEvent search)
  * /admin/stream                                         (SSE live events for the UI)
"""
from __future__ import annotations

import json
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import (
    APIRouter, Body, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    Principal, db_session, require_principal, require_tenant_access, require_user,
)
from app.core.event_bus import (
    EVT_CONVERSATION_RELEASED, EVT_CONVERSATION_TAKEOVER, publish,
)
from app.core.logging import get_logger
from app.db.models import (
    AdminRole, AdminUser, AuditEvent, Broadcast, BroadcastStatus, Business,
    Channel, ConvStatus, Conversation, Customer, KnowledgeChunk, Message,
    Sender, TenantMembership, ToolInvocation, WebhookEndpoint,
)
from app.jobs.runner import enqueue_job
from app.services.staff_dispatch import (
    StaffDispatchError, release as do_release, send_staff_message,
    takeover as do_takeover,
)

log = get_logger("admin_console")
router = APIRouter(prefix="/admin", tags=["admin:console"])


# ── Helpers ──────────────────────────────────────────────────────────────

async def _audit(
    db: AsyncSession, *, actor: str, action: str, target: str | None = None,
    data: dict | None = None,
) -> None:
    db.add(AuditEvent(actor=actor[:64], action=action[:64], target=target, data=data or {}))


async def _conv_with_customer(
    db: AsyncSession, conv_id: uuid.UUID,
) -> tuple[Conversation, Customer]:
    row = (await db.execute(
        select(Conversation, Customer)
        .join(Customer, Customer.id == Conversation.customer_id)
        .where(Conversation.id == conv_id)
    )).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation not found")
    return row.Conversation, row.Customer


async def _enforce_conv_tenant_access(
    db: AsyncSession, p: Principal, conv: Conversation,
) -> None:
    """A user can act on a conversation only if they have at least staff
    access to its owning business (or superadmin / machine)."""
    if p.is_superadmin or p.is_machine:
        return
    if conv.business_id is None:
        # Orphan conversations are superadmin-only territory.
        raise HTTPException(status.HTTP_403_FORBIDDEN, "conversation has no business; superadmin required")
    assert p.user is not None
    from app.api.deps import tenant_membership_role
    role = await tenant_membership_role(db, user=p.user, business_id=conv.business_id)
    if role is None or role == AdminRole.viewer:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "you need staff-or-higher membership in this conversation's tenant",
        )


async def _enforce_conv_read_access(
    db: AsyncSession, p: Principal, conv: Conversation,
) -> None:
    if p.is_superadmin or p.is_machine:
        return
    if conv.business_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "conversation has no business; superadmin required")
    assert p.user is not None
    from app.api.deps import tenant_membership_role
    role = await tenant_membership_role(db, user=p.user, business_id=conv.business_id)
    if role is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "no access to this conversation's tenant")


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:64] or f"tenant-{uuid.uuid4().hex[:8]}"


def _sender_role(sender: Sender) -> str:
    return {
        Sender.user: "user",
        Sender.ai: "assistant",
        Sender.system: "system",
        Sender.agent: "staff",
    }.get(sender, str(sender.value if hasattr(sender, "value") else sender))


def _business_out(b: Business, kb_rows: int | None = None) -> dict:
    profile = b.profile or {}
    return {
        "id": str(b.id),
        "slug": b.slug,
        "name": b.name,
        "industry": b.industry,
        "location": b.location,
        "contact_phone": b.contact_phone,
        "contact_email": b.contact_email,
        "language_primary": b.language_primary,
        "language_secondary": b.language_secondary,
        "meta_wa_phone_number_id": b.meta_wa_phone_number_id,
        "active": b.active,
        "kb_rows": kb_rows or 0,
        "latitude": float(b.latitude) if b.latitude is not None else None,
        "longitude": float(b.longitude) if b.longitude is not None else None,
        "timezone": profile.get("timezone"),
        "currency": profile.get("currency"),
        "profile": profile,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


async def _kb_count(db: AsyncSession, business_id: uuid.UUID) -> int:
    return int((await db.execute(
        select(func.count(KnowledgeChunk.id)).where(KnowledgeChunk.business_id == business_id)
    )).scalar_one() or 0)


async def _conversation_summary(
    db: AsyncSession,
    conv: Conversation,
    customer: Customer,
    *,
    business_slug: str | None = None,
) -> dict:
    last = (await db.execute(
        select(Message.content)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.timestamp.desc())
        .limit(1)
    )).scalar_one_or_none()
    return {
        "id": str(conv.id),
        "business_id": str(conv.business_id) if conv.business_id else None,
        "business_slug": business_slug,
        "customer_id": str(conv.customer_id),
        "customer_phone": customer.phone_number,
        "customer_name": customer.name,
        "channel": conv.channel.value,
        "status": conv.status.value,
        "ai_paused": bool(conv.ai_paused),
        "taken_over_by": str(conv.taken_over_by) if conv.taken_over_by else None,
        "last_activity_at": conv.last_activity_at.isoformat() if conv.last_activity_at else None,
        "last_message_preview": (last or "")[:160],
    }


class BusinessConsoleIn(BaseModel):
    slug: Optional[str] = Field(None, max_length=64)
    name: str = Field(..., max_length=256)
    industry: str = Field("restaurant", max_length=64)
    location: Optional[str] = Field(None, max_length=256)
    contact_phone: Optional[str] = Field(None, max_length=20)
    contact_email: Optional[str] = Field(None, max_length=128)
    brand_voice: Optional[str] = None
    greeting_template: Optional[str] = None
    language_primary: str = "en"
    language_secondary: str = "sw"
    meta_wa_phone_number_id: Optional[str] = Field(None, max_length=32)
    profile: dict = Field(default_factory=dict)
    active: bool = True
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


@router.get("/businesses")
async def console_list_businesses(
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
) -> list[dict]:
    if p.is_superadmin or p.is_machine:
        rows = (await db.execute(select(Business).order_by(Business.created_at.desc()))).scalars().all()
    else:
        assert p.user is not None
        rows = (await db.execute(
            select(Business)
            .join(TenantMembership, TenantMembership.business_id == Business.id)
            .where(TenantMembership.admin_user_id == p.user.id)
            .order_by(Business.name.asc())
        )).scalars().all()
    return [_business_out(b, await _kb_count(db, b.id)) for b in rows]


@router.post("/businesses", status_code=status.HTTP_201_CREATED)
async def console_create_business(
    payload: BusinessConsoleIn,
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
) -> dict:
    if not (p.is_superadmin or p.is_machine):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "superadmin required")
    slug = payload.slug or _slugify(payload.name)
    exists = (await db.execute(select(Business).where(Business.slug == slug))).scalar_one_or_none()
    if exists is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Business '{slug}' already exists")
    b = Business(
        slug=slug,
        name=payload.name,
        industry=payload.industry,
        location=payload.location,
        contact_phone=payload.contact_phone,
        contact_email=payload.contact_email,
        brand_voice=payload.brand_voice,
        greeting_template=payload.greeting_template,
        language_primary=payload.language_primary,
        language_secondary=payload.language_secondary,
        meta_wa_phone_number_id=payload.meta_wa_phone_number_id,
        profile=payload.profile,
        active=payload.active,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(b)
    await _audit(db, actor=p.actor_label, action="business_create", target=slug)
    await db.commit()
    await db.refresh(b)
    return _business_out(b)


@router.get("/businesses/{slug}")
async def console_get_business(
    slug: str,
    ctx=Depends(require_tenant_access(AdminRole.viewer)),
) -> dict:
    return _business_out(ctx.business)


@router.get("/businesses/{slug}/conversations")
async def console_list_conversations(
    slug: str,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.viewer)),
    limit: int = Query(50, ge=1, le=500),
    status_filter: Optional[str] = None,
) -> list[dict]:
    q = (
        select(Conversation, Customer)
        .join(Customer, Customer.id == Conversation.customer_id)
        .where(Conversation.business_id == ctx.business.id)
        .order_by(Conversation.last_activity_at.desc())
        .limit(limit)
    )
    if status_filter == "pending":
        return []
    if status_filter and status_filter != "all":
        try:
            q = q.where(Conversation.status == ConvStatus(status_filter))
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid status: {status_filter}")
    rows = (await db.execute(q)).all()
    return [
        await _conversation_summary(db, r.Conversation, r.Customer, business_slug=ctx.business.slug)
        for r in rows
    ]


@router.get("/conversations/{conv_id}")
async def console_get_conversation(
    conv_id: uuid.UUID,
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
) -> dict:
    conv, customer = await _conv_with_customer(db, conv_id)
    await _enforce_conv_read_access(db, p, conv)
    biz_slug = None
    if conv.business_id:
        biz_slug = (await db.execute(
            select(Business.slug).where(Business.id == conv.business_id)
        )).scalar_one_or_none()
    messages = (await db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.timestamp.asc())
    )).scalars().all()
    tools = (await db.execute(
        select(ToolInvocation).where(ToolInvocation.conversation_id == conv.id)
        .order_by(ToolInvocation.created_at.asc())
    )).scalars().all()
    return {
        "conversation": await _conversation_summary(db, conv, customer, business_slug=biz_slug),
        "messages": [
            {
                "id": str(m.id),
                "conversation_id": str(m.conversation_id),
                "role": _sender_role(m.sender),
                "content": m.content,
                "created_at": m.timestamp.isoformat() if m.timestamp else None,
                "channel": conv.channel.value,
                "meta": {
                    "language": m.language,
                    "media_url": m.media_url,
                    "provider_message_id": m.provider_message_id,
                    "safety_flags": m.safety_flags,
                },
            }
            for m in messages
        ],
        "tool_invocations": [
            {
                "tool_name": t.tool_name,
                "arguments": t.arguments,
                "result": t.result,
                "success": t.success,
                "latency_ms": t.latency_ms,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tools
        ],
    }


@router.post("/conversations/{conv_id}/resolve")
async def console_resolve_conversation(
    conv_id: uuid.UUID,
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
) -> dict:
    conv, _ = await _conv_with_customer(db, conv_id)
    await _enforce_conv_tenant_access(db, p, conv)
    conv.status = ConvStatus.resolved
    conv.ai_paused = False
    conv.taken_over_by = None
    await _audit(db, actor=p.actor_label, action="conv_resolve", target=str(conv.id))
    await db.commit()
    return {"status": conv.status.value, "conversation_id": str(conv.id)}


@router.get("/escalations")
async def console_list_escalations(
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
    slug: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
) -> list[dict]:
    q = (
        select(Conversation, Customer, Business.slug)
        .join(Customer, Customer.id == Conversation.customer_id)
        .outerjoin(Business, Business.id == Conversation.business_id)
        .where(Conversation.status == ConvStatus.human_escalated)
        .order_by(Conversation.last_activity_at.desc())
        .limit(limit)
    )
    if slug:
        q = q.where(Business.slug == slug)
    if not (p.is_superadmin or p.is_machine):
        assert p.user is not None
        allowed = (await db.execute(
            select(TenantMembership.business_id)
            .where(TenantMembership.admin_user_id == p.user.id)
        )).scalars().all()
        q = q.where(Conversation.business_id.in_(allowed))
    rows = (await db.execute(q)).all()
    return [
        await _conversation_summary(db, r.Conversation, r.Customer, business_slug=r.slug)
        for r in rows
    ]


# ════════════════════════════════════════════════════════════════════════
# 1) Conversation takeover + staff send
# ════════════════════════════════════════════════════════════════════════

class TakeoverOut(BaseModel):
    conversation_id: uuid.UUID
    ai_paused: bool
    taken_over_by: Optional[uuid.UUID]
    taken_over_by_email: Optional[str]


class StaffMessageIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    media_url: Optional[str] = Field(None, max_length=1024)


class StaffMessageOut(BaseModel):
    message_id: uuid.UUID
    delivery: dict


@router.post("/conversations/{conv_id}/takeover", response_model=TakeoverOut)
async def conversation_takeover(
    conv_id: uuid.UUID,
    db: AsyncSession = Depends(db_session),
    user: AdminUser = Depends(require_user),
    p: Principal = Depends(require_principal),
) -> TakeoverOut:
    conv, _ = await _conv_with_customer(db, conv_id)
    await _enforce_conv_tenant_access(db, p, conv)
    await do_takeover(db, conv=conv, actor=user)
    await _audit(
        db, actor=p.actor_label, action="conv_takeover", target=str(conv.id),
        data={"business_id": str(conv.business_id) if conv.business_id else None},
    )
    await db.commit()
    try:
        await publish(
            EVT_CONVERSATION_TAKEOVER, target=str(conv.id),
            payload={
                "conversation_id": str(conv.id),
                "business_id": str(conv.business_id) if conv.business_id else None,
                "by_user_id": str(user.id), "by_email": user.email,
            },
        )
    except Exception:
        pass
    return TakeoverOut(
        conversation_id=conv.id, ai_paused=conv.ai_paused,
        taken_over_by=conv.taken_over_by, taken_over_by_email=user.email,
    )


@router.post("/conversations/{conv_id}/release", response_model=TakeoverOut)
async def conversation_release(
    conv_id: uuid.UUID,
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
    user: AdminUser = Depends(require_user),
) -> TakeoverOut:
    conv, _ = await _conv_with_customer(db, conv_id)
    await _enforce_conv_tenant_access(db, p, conv)
    await do_release(db, conv=conv)
    await _audit(
        db, actor=p.actor_label, action="conv_release", target=str(conv.id),
    )
    await db.commit()
    try:
        await publish(
            EVT_CONVERSATION_RELEASED, target=str(conv.id),
            payload={
                "conversation_id": str(conv.id),
                "business_id": str(conv.business_id) if conv.business_id else None,
            },
        )
    except Exception:
        pass
    return TakeoverOut(
        conversation_id=conv.id, ai_paused=conv.ai_paused,
        taken_over_by=None, taken_over_by_email=None,
    )


@router.post("/conversations/{conv_id}/messages", response_model=StaffMessageOut)
async def staff_send(
    conv_id: uuid.UUID,
    payload: StaffMessageIn,
    db: AsyncSession = Depends(db_session),
    user: AdminUser = Depends(require_user),
    p: Principal = Depends(require_principal),
) -> StaffMessageOut:
    conv, customer = await _conv_with_customer(db, conv_id)
    await _enforce_conv_tenant_access(db, p, conv)
    # Auto-takeover on first send if not already paused — saves a click.
    if not conv.ai_paused:
        await do_takeover(db, conv=conv, actor=user)
    try:
        result = await send_staff_message(
            db, conv=conv, customer=customer, actor=user,
            content=payload.content, media_url=payload.media_url,
        )
    except StaffDispatchError as e:
        await db.rollback()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"dispatch_failed:{e}")
    await _audit(
        db, actor=p.actor_label, action="staff_send", target=str(conv.id),
        data={"ok": result["delivery"].get("ok"), "channel": conv.channel.value},
    )
    await db.commit()
    return StaffMessageOut(message_id=uuid.UUID(result["message_id"]), delivery=result["delivery"])


# ════════════════════════════════════════════════════════════════════════
# 2) KB inline edit / delete / re-embed
# ════════════════════════════════════════════════════════════════════════

class KBPatchIn(BaseModel):
    source: Optional[str] = Field(None, max_length=256)
    content: Optional[str] = Field(None, min_length=4, max_length=4000)
    meta: Optional[dict] = None


class KBItemIn(BaseModel):
    source: str = Field("manual", max_length=256)
    content: str = Field(..., min_length=4, max_length=4000)


class KBItemsIn(BaseModel):
    items: list[KBItemIn] = Field(..., min_length=1, max_length=500)


async def _embed_one(text_in: str) -> list[float]:
    from app.ai.rag import embed_texts  # lazy: avoid import-time model load
    vecs = await embed_texts([text_in])
    return list(vecs[0])


def _kb_out(chunk: KnowledgeChunk) -> dict:
    return {
        "id": str(chunk.id),
        "business_id": str(chunk.business_id) if chunk.business_id else None,
        "source": chunk.source or "",
        "content": chunk.content,
        "metadata": chunk.meta or {},
        "created_at": chunk.created_at.isoformat() if chunk.created_at else None,
    }


@router.get("/businesses/{slug}/kb")
async def kb_list(
    slug: str,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.viewer)),
    limit: int = Query(200, ge=1, le=1000),
) -> list[dict]:
    rows = (await db.execute(
        select(KnowledgeChunk)
        .where(KnowledgeChunk.business_id == ctx.business.id)
        .order_by(KnowledgeChunk.created_at.desc())
        .limit(limit)
    )).scalars().all()
    return [_kb_out(c) for c in rows]


@router.post("/businesses/{slug}/kb/items", status_code=status.HTTP_201_CREATED)
async def kb_add_items(
    slug: str,
    payload: KBItemsIn,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.staff)),
) -> dict:
    from app.ai.rag import ingest_text
    inserted = 0
    by_source: dict[str, list[str]] = {}
    for item in payload.items:
        by_source.setdefault(item.source or "manual", []).append(item.content)
    for source, chunks in by_source.items():
        inserted += await ingest_text(db, business_id=ctx.business.id, source=source, chunks=chunks)
    await _audit(
        db,
        actor=ctx.principal.actor_label,
        action="kb_add",
        target=slug,
        data={"inserted": inserted},
    )
    await db.commit()
    return {"inserted": inserted, "business_slug": slug}


@router.patch("/businesses/{slug}/kb/items/{kb_id}")
async def kb_item_edit(
    slug: str, kb_id: uuid.UUID,
    payload: KBPatchIn,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.staff)),
) -> dict:
    chunk = (await db.execute(
        select(KnowledgeChunk).where(
            KnowledgeChunk.id == kb_id,
            KnowledgeChunk.business_id == ctx.business.id,
        )
    )).scalar_one_or_none()
    if chunk is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "KB row not found in this tenant")
    data = payload.model_dump(exclude_unset=True)
    re_embedded = False
    if "content" in data and data["content"] != chunk.content:
        chunk.content = data["content"]
        chunk.embedding = await _embed_one(chunk.content)
        re_embedded = True
    if "source" in data:
        chunk.source = data["source"]
    if "meta" in data and isinstance(data["meta"], dict):
        chunk.meta = data["meta"]
    await _audit(
        db, actor=ctx.principal.actor_label, action="kb_edit",
        target=str(chunk.id),
        data={"slug": slug, "re_embedded": re_embedded},
    )
    await db.commit()
    return {"id": str(chunk.id), "re_embedded": re_embedded, "source": chunk.source}


@router.delete(
    "/businesses/{slug}/kb/items/{kb_id}",
    status_code=status.HTTP_204_NO_CONTENT, response_class=Response,
)
async def kb_item_delete(
    slug: str, kb_id: uuid.UUID,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.staff)),
) -> Response:
    res = await db.execute(
        delete(KnowledgeChunk).where(
            KnowledgeChunk.id == kb_id,
            KnowledgeChunk.business_id == ctx.business.id,
        )
    )
    if not res.rowcount:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "KB row not found")
    await _audit(
        db, actor=ctx.principal.actor_label, action="kb_delete",
        target=str(kb_id), data={"slug": slug},
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/businesses/{slug}/kb/re-embed")
async def kb_reembed(
    slug: str,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
    batch_size: int = Query(64, ge=1, le=256),
) -> dict:
    """Re-embed every chunk for the tenant. Useful after swapping the
    embedding model or recovering from a corrupted index."""
    rows = (await db.execute(
        select(KnowledgeChunk).where(KnowledgeChunk.business_id == ctx.business.id)
    )).scalars().all()
    total = len(rows)
    if total == 0:
        return {"slug": slug, "re_embedded": 0}
    from app.ai.rag import embed_texts
    done = 0
    for i in range(0, total, batch_size):
        batch = rows[i : i + batch_size]
        vecs = await embed_texts([c.content for c in batch])
        for c, v in zip(batch, vecs):
            c.embedding = list(v)
        done += len(batch)
        await db.flush()
    await _audit(
        db, actor=ctx.principal.actor_label, action="kb_reembed",
        target=slug, data={"count": done},
    )
    await db.commit()
    log.info("kb_reembedded", slug=slug, count=done)
    return {"slug": slug, "re_embedded": done}


# ════════════════════════════════════════════════════════════════════════
# 3) Profile + prompt editors
# ════════════════════════════════════════════════════════════════════════

class ProfileOut(BaseModel):
    slug: str
    profile: dict
    brand_voice: Optional[str]
    greeting_template: Optional[str]
    language_primary: str
    language_secondary: str


class ProfilePatchIn(BaseModel):
    profile: Optional[dict] = None
    model_config = {"extra": "allow"}


class PromptPatchIn(BaseModel):
    brand_voice: Optional[str] = Field(None, max_length=8000)
    greeting_template: Optional[str] = Field(None, max_length=2000)


class MenuPhotoEntryIn(BaseModel):
    item: str = Field(..., min_length=1, max_length=120)
    url: HttpUrl


class MenuPhotoCatalogOut(BaseModel):
    slug: str
    photos: dict[str, str]


class MenuPhotoCatalogIn(BaseModel):
    photos: dict[str, HttpUrl]


class MenuPhotoUploadOut(BaseModel):
    slug: str
    item: str
    url: str
    photos: dict[str, str]


def _menu_photo_map(profile: dict | None) -> dict[str, str]:
    raw = (profile or {}).get("menu_photos")
    if not isinstance(raw, dict):
        return {}
    cleaned: dict[str, str] = {}
    for key, value in raw.items():
        key_text = str(key or "").strip()
        url = str(value or "").strip()
        if key_text and url:
            cleaned[key_text] = url
    return cleaned


@router.get("/businesses/{slug}/profile", response_model=ProfileOut)
async def get_profile(
    slug: str,
    ctx=Depends(require_tenant_access(AdminRole.viewer)),
) -> ProfileOut:
    b = ctx.business
    return ProfileOut(
        slug=b.slug, profile=b.profile or {},
        brand_voice=b.brand_voice, greeting_template=b.greeting_template,
        language_primary=b.language_primary, language_secondary=b.language_secondary,
    )


@router.put("/businesses/{slug}/profile", response_model=ProfileOut)
async def replace_profile(
    slug: str, payload: ProfilePatchIn,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
) -> ProfileOut:
    ctx.business.profile = payload.profile if payload.profile is not None else dict(payload.model_extra or {})
    await _audit(
        db, actor=ctx.principal.actor_label, action="profile_update",
        target=slug, data={"keys": list((ctx.business.profile or {}).keys())},
    )
    await db.commit()
    await db.refresh(ctx.business)
    return ProfileOut(
        slug=ctx.business.slug, profile=ctx.business.profile,
        brand_voice=ctx.business.brand_voice,
        greeting_template=ctx.business.greeting_template,
        language_primary=ctx.business.language_primary,
        language_secondary=ctx.business.language_secondary,
    )


@router.patch("/businesses/{slug}/prompt", response_model=ProfileOut)
async def patch_prompt(
    slug: str, payload: PromptPatchIn,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
) -> ProfileOut:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(ctx.business, k, v)
    await _audit(
        db, actor=ctx.principal.actor_label, action="prompt_update",
        target=slug, data={"fields": list(data.keys())},
    )
    await db.commit()
    await db.refresh(ctx.business)
    return ProfileOut(
        slug=ctx.business.slug, profile=ctx.business.profile or {},
        brand_voice=ctx.business.brand_voice,
        greeting_template=ctx.business.greeting_template,
        language_primary=ctx.business.language_primary,
        language_secondary=ctx.business.language_secondary,
    )


@router.get("/businesses/{slug}/menu-photos", response_model=MenuPhotoCatalogOut)
async def get_menu_photos(
    slug: str,
    ctx=Depends(require_tenant_access(AdminRole.viewer)),
) -> MenuPhotoCatalogOut:
    return MenuPhotoCatalogOut(
        slug=ctx.business.slug,
        photos=_menu_photo_map(ctx.business.profile),
    )


@router.put("/businesses/{slug}/menu-photos", response_model=MenuPhotoCatalogOut)
async def replace_menu_photos(
    slug: str,
    payload: MenuPhotoCatalogIn,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
) -> MenuPhotoCatalogOut:
    profile = dict(ctx.business.profile or {})
    photos = {
        str(key).strip().lower(): str(value)
        for key, value in payload.photos.items()
        if str(key).strip() and str(value).strip()
    }
    profile["menu_photos"] = photos
    ctx.business.profile = profile
    await _audit(
        db,
        actor=ctx.principal.actor_label,
        action="menu_photo_replace_all",
        target=slug,
        data={"count": len(photos)},
    )
    await db.commit()
    await db.refresh(ctx.business)
    return MenuPhotoCatalogOut(
        slug=ctx.business.slug,
        photos=_menu_photo_map(ctx.business.profile),
    )


@router.post("/businesses/{slug}/menu-photos", response_model=MenuPhotoUploadOut)
async def register_menu_photo(
    slug: str,
    payload: MenuPhotoEntryIn,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
) -> MenuPhotoUploadOut:
    profile = dict(ctx.business.profile or {})
    photos = _menu_photo_map(profile)
    item_key = payload.item.strip().lower()
    photos[item_key] = str(payload.url)
    profile["menu_photos"] = photos
    ctx.business.profile = profile
    await _audit(
        db,
        actor=ctx.principal.actor_label,
        action="menu_photo_register",
        target=slug,
        data={"item": item_key},
    )
    await db.commit()
    await db.refresh(ctx.business)
    return MenuPhotoUploadOut(
        slug=ctx.business.slug,
        item=item_key,
        url=str(payload.url),
        photos=_menu_photo_map(ctx.business.profile),
    )


@router.post("/businesses/{slug}/menu-photos/upload", response_model=MenuPhotoUploadOut)
async def upload_menu_photo(
    slug: str,
    item: str = Form(..., min_length=1, max_length=120),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
) -> MenuPhotoUploadOut:
    mime = (file.content_type or "").strip().lower()
    if not mime.startswith("image/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "file must be an image")

    binary = await file.read()
    if not binary:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "empty file")
    if len(binary) > 8 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "image must be <= 8MB")

    from app.services import media as media_svc

    item_key = item.strip().lower()
    prefix = f"menu-photos/{ctx.business.slug}"
    uploaded = await media_svc.upload_to_r2(binary, mime, prefix=prefix, presign_seconds=7 * 24 * 3600)
    if not uploaded or not uploaded.startswith(("http://", "https://")):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "photo upload unavailable — configure R2 or use the URL registration endpoint",
        )

    profile = dict(ctx.business.profile or {})
    photos = _menu_photo_map(profile)
    photos[item_key] = uploaded
    profile["menu_photos"] = photos
    ctx.business.profile = profile
    await _audit(
        db,
        actor=ctx.principal.actor_label,
        action="menu_photo_upload",
        target=slug,
        data={"item": item_key, "filename": file.filename},
    )
    await db.commit()
    await db.refresh(ctx.business)
    return MenuPhotoUploadOut(
        slug=ctx.business.slug,
        item=item_key,
        url=uploaded,
        photos=_menu_photo_map(ctx.business.profile),
    )


# ════════════════════════════════════════════════════════════════════════
# 4) Webhook endpoints (per-tenant outbound)
# ════════════════════════════════════════════════════════════════════════

class WebhookIn(BaseModel):
    url: HttpUrl
    events: list[str] = Field(default_factory=list)
    active: bool = True


class WebhookOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    url: str
    events: list[str]
    active: bool
    last_status: Optional[int]
    last_error: Optional[str]
    last_delivery_at: Optional[datetime]
    failure_count: int
    created_at: datetime
    secret_preview: str  # last 6 chars only
    secret: Optional[str] = None


def _secret_preview(secret: str) -> str:
    return f"…{secret[-6:]}" if secret else ""


@router.post(
    "/businesses/{slug}/webhooks",
    response_model=WebhookOut, status_code=status.HTTP_201_CREATED,
)
async def webhook_create(
    slug: str, payload: WebhookIn,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
) -> WebhookOut:
    secret = secrets.token_urlsafe(48)
    hook = WebhookEndpoint(
        business_id=ctx.business.id, url=str(payload.url),
        secret=secret, events=payload.events, active=payload.active,
    )
    db.add(hook)
    await _audit(
        db, actor=ctx.principal.actor_label, action="webhook_create",
        target=slug, data={"url": str(payload.url), "events": payload.events},
    )
    await db.commit()
    await db.refresh(hook)
    # Show secret in full **only** on initial create so the operator can
    # copy it; subsequent fetches return only the preview.
    return WebhookOut(
        id=hook.id, business_id=hook.business_id, url=hook.url, events=hook.events or [],
        active=hook.active, last_status=hook.last_status, last_error=hook.last_error,
        last_delivery_at=hook.last_delivery_at,
        failure_count=hook.failure_count, created_at=hook.created_at,
        secret_preview=secret, secret=secret,
    )


@router.get("/businesses/{slug}/webhooks", response_model=list[WebhookOut])
async def webhook_list(
    slug: str,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.viewer)),
) -> list[WebhookOut]:
    rows = (await db.execute(
        select(WebhookEndpoint)
        .where(WebhookEndpoint.business_id == ctx.business.id)
        .order_by(WebhookEndpoint.created_at.desc())
    )).scalars().all()
    return [
        WebhookOut(
            id=h.id, business_id=h.business_id, url=h.url, events=h.events or [], active=h.active,
            last_status=h.last_status, last_error=h.last_error, last_delivery_at=h.last_delivery_at,
            failure_count=h.failure_count, created_at=h.created_at,
            secret_preview=_secret_preview(h.secret),
        )
        for h in rows
    ]


@router.delete(
    "/businesses/{slug}/webhooks/{hook_id}",
    status_code=status.HTTP_204_NO_CONTENT, response_class=Response,
)
async def webhook_delete(
    slug: str, hook_id: uuid.UUID,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
) -> Response:
    res = await db.execute(
        delete(WebhookEndpoint).where(
            WebhookEndpoint.id == hook_id,
            WebhookEndpoint.business_id == ctx.business.id,
        )
    )
    if not res.rowcount:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "webhook not found")
    await _audit(
        db, actor=ctx.principal.actor_label, action="webhook_delete",
        target=slug, data={"hook_id": str(hook_id)},
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/businesses/{slug}/webhooks/{hook_id}/rotate", response_model=WebhookOut)
async def webhook_rotate_secret(
    slug: str, hook_id: uuid.UUID,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
) -> WebhookOut:
    hook = (await db.execute(
        select(WebhookEndpoint).where(
            WebhookEndpoint.id == hook_id,
            WebhookEndpoint.business_id == ctx.business.id,
        )
    )).scalar_one_or_none()
    if hook is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "webhook not found")
    new_secret = secrets.token_urlsafe(48)
    hook.secret = new_secret
    await _audit(
        db, actor=ctx.principal.actor_label, action="webhook_rotate",
        target=str(hook.id), data={"slug": slug},
    )
    await db.commit()
    return WebhookOut(
        id=hook.id, business_id=hook.business_id, url=hook.url, events=hook.events or [], active=hook.active,
        last_status=hook.last_status, last_error=hook.last_error,
        last_delivery_at=hook.last_delivery_at,
        failure_count=hook.failure_count, created_at=hook.created_at,
        secret_preview=new_secret, secret=new_secret,
    )


# ════════════════════════════════════════════════════════════════════════
# 5) Usage + billing dashboard
# ════════════════════════════════════════════════════════════════════════

@router.get("/businesses/{slug}/usage")
async def tenant_usage(
    slug: str,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.viewer)),
    days: int = Query(30, ge=1, le=365),
) -> dict:
    """Daily-bucketed usage rollup + a simple cost estimate.

    Cost model is intentionally rough — it's a first-cut so the dashboard
    can show *something* meaningful before per-tenant billing is wired:
      msgs × $0.005 + tool_calls × $0.001 + paid_orders × 0
    Override in `Business.profile["pricing"]` to customise per-tenant.
    """
    b = ctx.business
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Per-day message counts split by sender (one query, grouped client-side).
    msg_rows = (await db.execute(
        text("""
            SELECT date_trunc('day', m.timestamp) AS day,
                   m.sender, COUNT(*) AS n
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE c.business_id = :bid AND m.timestamp >= :since
            GROUP BY day, m.sender
            ORDER BY day ASC
        """),
        {"bid": str(b.id), "since": since},
    )).all()
    by_day: dict[str, dict[str, int]] = {}
    for r in msg_rows:
        d = r.day.date().isoformat()
        by_day.setdefault(d, {"user": 0, "ai": 0, "agent": 0, "system": 0})
        by_day[d][str(r.sender) if not hasattr(r.sender, "value") else r.sender.value] = int(r.n)

    # Tool calls per day.
    tool_rows = (await db.execute(
        text("""
            SELECT date_trunc('day', ti.created_at) AS day, COUNT(*) AS n,
                   SUM(CASE WHEN ti.success THEN 0 ELSE 1 END) AS failures
            FROM tool_invocations ti
            JOIN conversations c ON c.id = ti.conversation_id
            WHERE c.business_id = :bid AND ti.created_at >= :since
            GROUP BY day ORDER BY day ASC
        """),
        {"bid": str(b.id), "since": since},
    )).all()
    tools_by_day = {r.day.date().isoformat(): {"total": int(r.n), "failures": int(r.failures or 0)} for r in tool_rows}

    # Paid orders per day + amount (gross merchandise volume).
    order_rows = (await db.execute(
        text("""
            SELECT date_trunc('day', o.created_at) AS day,
                   COUNT(*) AS n, COALESCE(SUM(amount), 0) AS gmv
            FROM orders o
            JOIN conversations c ON c.id = o.conversation_id
            WHERE c.business_id = :bid AND o.payment_status = 'paid'
                  AND o.created_at >= :since
            GROUP BY day ORDER BY day ASC
        """),
        {"bid": str(b.id), "since": since},
    )).all()
    orders_by_day = {r.day.date().isoformat(): {"count": int(r.n), "gmv": float(r.gmv)} for r in order_rows}

    # Conversations + escalations + voice minutes (rough: 1 voice convo ~ 3 min).
    new_convs = (await db.execute(
        select(func.count(Conversation.id))
        .where(Conversation.business_id == b.id, Conversation.created_at >= since)
    )).scalar_one()
    escalations = (await db.execute(
        select(func.count(Conversation.id))
        .where(
            Conversation.business_id == b.id,
            Conversation.status == ConvStatus.human_escalated,
            Conversation.last_activity_at >= since,
        )
    )).scalar_one()
    voice_convs = (await db.execute(
        select(func.count(Conversation.id))
        .where(
            Conversation.business_id == b.id,
            Conversation.channel == Channel.voice,
            Conversation.created_at >= since,
        )
    )).scalar_one()

    # Cost estimate.
    pricing = (b.profile or {}).get("pricing") or {}
    msg_rate = float(pricing.get("usd_per_message", 0.005))
    tool_rate = float(pricing.get("usd_per_tool_call", 0.001))
    voice_min_rate = float(pricing.get("usd_per_voice_min", 0.03))
    total_msgs = sum(sum(v.values()) for v in by_day.values())
    total_tools = sum(v["total"] for v in tools_by_day.values())
    est_voice_min = int(voice_convs) * 3
    cost_est = total_msgs * msg_rate + total_tools * tool_rate + est_voice_min * voice_min_rate
    currency = str((b.profile or {}).get("currency") or "USD")
    buckets = []
    for i in range(days):
        day = (since.date() + timedelta(days=i + 1)).isoformat()
        msg = by_day.get(day, {})
        tools = tools_by_day.get(day, {})
        orders = orders_by_day.get(day, {})
        messages_in = int(msg.get("user", 0))
        messages_out = int(msg.get("ai", 0)) + int(msg.get("agent", 0)) + int(msg.get("system", 0))
        tool_calls = int(tools.get("total", 0))
        day_cost = (messages_in + messages_out) * msg_rate + tool_calls * tool_rate
        buckets.append({
            "day": day,
            "messages_in": messages_in,
            "messages_out": messages_out,
            "voice_minutes": 0.0,
            "tokens_in": 0,
            "tokens_out": 0,
            "orders_paid": int(orders.get("count", 0)),
            "gmv": float(orders.get("gmv", 0.0)),
            "cost_estimate": round(day_cost, 4),
        })

    return {
        "business_slug": slug,
        "window_days": days,
        "buckets": buckets,
        "total_cost": round(cost_est, 4),
        "currency": currency,
        "totals": {
            "messages": total_msgs,
            "tool_calls": total_tools,
            "tool_failures": sum(v["failures"] for v in tools_by_day.values()),
            "new_conversations": int(new_convs or 0),
            "escalations": int(escalations or 0),
            "voice_conversations": int(voice_convs or 0),
            "voice_minutes_estimate": est_voice_min,
            "paid_orders": sum(v["count"] for v in orders_by_day.values()),
            "gmv_total": sum(v["gmv"] for v in orders_by_day.values()),
            "estimated_cost_usd": round(cost_est, 4),
        },
        "by_day": {
            "messages": by_day,
            "tools": tools_by_day,
            "orders": orders_by_day,
        },
        "pricing_used": {
            "usd_per_message": msg_rate,
            "usd_per_tool_call": tool_rate,
            "usd_per_voice_min": voice_min_rate,
        },
    }


# ════════════════════════════════════════════════════════════════════════
# 6) Broadcasts (campaign blasts)
# ════════════════════════════════════════════════════════════════════════

class BroadcastIn(BaseModel):
    name: Optional[str] = Field(None, max_length=180)
    title: Optional[str] = Field(None, max_length=180)
    channel: Channel = Channel.whatsapp
    template_name: Optional[str] = Field(None, max_length=120)
    language: str = "en"
    body: Optional[str] = Field(None, max_length=4000)
    # Recipient filter — keys are best-effort; unknown ones are ignored:
    #   language: str          → match Customer.preferred_language
    #   channel: str           → match the Conversation channel they've used
    #   last_active_within_days: int → cutoff on last_activity_at
    #   include_phones: [str]  → explicit allow-list
    #   exclude_phones: [str]  → explicit deny-list
    segment: dict = Field(default_factory=dict)
    recipients: list[str] = Field(default_factory=list)
    scheduled_at: Optional[datetime] = None


class BroadcastOut(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    name: str
    title: str
    body: Optional[str]
    channel: Channel
    status: str
    template_name: Optional[str]
    language: str
    recipients_total: int
    sent_count: int
    failed_count: int
    total: int
    sent: int
    failed: int
    scheduled_at: Optional[datetime]
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime


def _broadcast_out(b: Broadcast) -> BroadcastOut:
    status_map = {
        BroadcastStatus.sending: "running",
        BroadcastStatus.done: "completed",
    }
    ui_status = status_map.get(b.status, b.status.value)
    return BroadcastOut(
        id=b.id, business_id=b.business_id, name=b.name, title=b.name,
        body=b.body, channel=b.channel, status=ui_status,
        template_name=b.template_name, language=b.language,
        recipients_total=b.recipients_total, sent_count=b.sent_count,
        failed_count=b.failed_count, total=b.recipients_total,
        sent=b.sent_count, failed=b.failed_count, scheduled_at=b.scheduled_at,
        started_at=b.started_at, finished_at=b.finished_at,
        completed_at=b.finished_at, created_at=b.created_at,
    )


async def _resolve_recipients(
    db: AsyncSession, business_id: uuid.UUID, segment: dict,
) -> list[Customer]:
    q = (
        select(Customer)
        .join(Conversation, Conversation.customer_id == Customer.id)
        .where(Conversation.business_id == business_id)
        .distinct()
    )
    if seg_lang := segment.get("language"):
        q = q.where(Customer.preferred_language == seg_lang)
    if seg_chan := segment.get("channel"):
        try:
            q = q.where(Conversation.channel == Channel(seg_chan))
        except ValueError:
            pass
    if days := segment.get("last_active_within_days"):
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=int(days))
            q = q.where(Conversation.last_activity_at >= cutoff)
        except (TypeError, ValueError):
            pass
    include = set(segment.get("include_phones") or [])
    exclude = set(segment.get("exclude_phones") or [])
    rows = (await db.execute(q)).scalars().all()
    if include:
        rows = [c for c in rows if c.phone_number in include]
    if exclude:
        rows = [c for c in rows if c.phone_number not in exclude]
    return list(rows)


@router.post(
    "/businesses/{slug}/broadcasts",
    response_model=BroadcastOut, status_code=status.HTTP_201_CREATED,
)
async def broadcast_create(
    slug: str, payload: BroadcastIn,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
    user: AdminUser = Depends(require_user),
) -> BroadcastOut:
    if not payload.template_name and not payload.body:
        raise HTTPException(422, "either template_name or body is required")
    name = payload.name or payload.title
    if not name:
        raise HTTPException(422, "name/title is required")
    segment = dict(payload.segment or {})
    if payload.recipients:
        segment["include_phones"] = payload.recipients
    bc = Broadcast(
        business_id=ctx.business.id, created_by=user.id,
        name=name, channel=payload.channel,
        template_name=payload.template_name, language=payload.language,
        body=payload.body, segment=segment,
        scheduled_at=payload.scheduled_at, status=BroadcastStatus.draft,
    )
    db.add(bc)
    await _audit(
        db, actor=ctx.principal.actor_label, action="broadcast_create",
        target=slug, data={"name": name, "channel": payload.channel.value},
    )
    await db.commit()
    await db.refresh(bc)
    return _broadcast_out(bc)


@router.get("/businesses/{slug}/broadcasts", response_model=list[BroadcastOut])
async def broadcast_list(
    slug: str,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.viewer)),
    limit: int = 100,
) -> list[BroadcastOut]:
    rows = (await db.execute(
        select(Broadcast)
        .where(Broadcast.business_id == ctx.business.id)
        .order_by(Broadcast.created_at.desc()).limit(limit)
    )).scalars().all()
    return [_broadcast_out(b) for b in rows]


@router.post("/businesses/{slug}/broadcasts/{bid}/send", response_model=BroadcastOut)
async def broadcast_send(
    slug: str, bid: uuid.UUID,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
) -> BroadcastOut:
    bc = (await db.execute(
        select(Broadcast).where(
            Broadcast.id == bid, Broadcast.business_id == ctx.business.id,
        )
    )).scalar_one_or_none()
    if bc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "broadcast not found")
    if bc.status not in (BroadcastStatus.draft, BroadcastStatus.failed):
        raise HTTPException(409, f"cannot send broadcast in status {bc.status.value}")
    recipients = await _resolve_recipients(db, ctx.business.id, bc.segment or {})
    bc.recipients_total = len(recipients)
    bc.status = BroadcastStatus.sending
    now = datetime.now(timezone.utc)
    run_at = bc.scheduled_at if bc.scheduled_at and bc.scheduled_at > now else now
    bc.started_at = None if run_at > now else now
    bc.sent_count = 0
    bc.failed_count = 0
    await enqueue_job(
        db,
        kind="broadcast.send",
        business_id=ctx.business.id,
        run_at=run_at,
        max_attempts=3,
        payload={
            "broadcast_id": str(bc.id),
            "business_id": str(ctx.business.id),
            "phones": [c.phone_number for c in recipients],
        },
    )
    await db.commit()
    await db.refresh(bc)
    return _broadcast_out(bc)


@router.post(
    "/businesses/{slug}/broadcasts/{bid}/cancel",
    response_model=BroadcastOut,
)
async def broadcast_cancel(
    slug: str, bid: uuid.UUID,
    db: AsyncSession = Depends(db_session),
    ctx=Depends(require_tenant_access(AdminRole.owner)),
) -> BroadcastOut:
    bc = (await db.execute(
        select(Broadcast).where(
            Broadcast.id == bid, Broadcast.business_id == ctx.business.id,
        )
    )).scalar_one_or_none()
    if bc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "broadcast not found")
    if bc.status in (BroadcastStatus.done, BroadcastStatus.cancelled):
        return _broadcast_out(bc)
    bc.status = BroadcastStatus.cancelled
    bc.finished_at = datetime.now(timezone.utc)
    await _audit(
        db, actor=ctx.principal.actor_label, action="broadcast_cancel",
        target=str(bc.id),
    )
    await db.commit()
    await db.refresh(bc)
    return _broadcast_out(bc)


# ════════════════════════════════════════════════════════════════════════
# 6.5) Customer safety: block / unblock / flagged queue
# ════════════════════════════════════════════════════════════════════════


class CustomerSafetyOut(BaseModel):
    id: str
    phone_number: str
    phone_hash: str
    name: str | None
    blocked: bool
    blocked_reason: str | None
    blocked_at: datetime | None
    abuse_score: int
    last_flag_at: datetime | None


def _cust_safety(c: Customer) -> CustomerSafetyOut:
    from app.core.security import hash_msisdn

    def _mask(phone: str) -> str:
        if len(phone) <= 7:
            return "***"
        return f"{phone[:4]}***{phone[-4:]}"

    return CustomerSafetyOut(
        id=str(c.id),
        phone_number=_mask(c.phone_number),
        phone_hash=hash_msisdn(c.phone_number),
        name=c.name,
        blocked=bool(c.blocked),
        blocked_reason=c.blocked_reason,
        blocked_at=c.blocked_at,
        abuse_score=int(c.abuse_score or 0),
        last_flag_at=c.last_flag_at,
    )


def _require_safety_admin(p: Principal) -> None:
    if not (p.is_superadmin or p.is_machine):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "superadmin required for platform-wide safety actions")


@router.get("/safety/flagged", response_model=list[CustomerSafetyOut])
async def list_flagged_customers(
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
    min_score: int = Query(1, ge=0, le=100),
    include_blocked: bool = Query(True),
    limit: int = Query(100, ge=1, le=500),
) -> list[CustomerSafetyOut]:
    """Customers with non-zero abuse_score or an active block."""
    _require_safety_admin(p)
    conds = [Customer.abuse_score >= min_score]
    if include_blocked:
        conds.append(Customer.blocked.is_(True))
    q = (
        select(Customer)
        .where(or_(*conds))
        .order_by(
            Customer.blocked.desc(),
            Customer.abuse_score.desc(),
            Customer.last_flag_at.desc().nulls_last(),
        )
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    return [_cust_safety(c) for c in rows]


class BlockCustomerIn(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


@router.post("/safety/customers/{phone}/block", response_model=CustomerSafetyOut)
async def block_customer(
    phone: str,
    payload: BlockCustomerIn,
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
) -> CustomerSafetyOut:
    """Block a phone number platform-wide. Idempotent."""
    from app.core.security import hash_msisdn, normalize_msisdn
    _require_safety_admin(p)
    msisdn = normalize_msisdn(phone)
    res = await db.execute(select(Customer).where(Customer.phone_number == msisdn))
    cust = res.scalar_one_or_none()
    if cust is None:
        # Pre-emptive block: stub Customer so the first inbound short-circuits.
        cust = Customer(phone_number=msisdn)
        db.add(cust)
        await db.flush()
    cust.blocked = True
    cust.blocked_reason = payload.reason
    cust.blocked_at = datetime.now(timezone.utc)
    await _audit(
        db, actor=p.actor_label, action="customer_block",
        target=str(cust.id), data={"phone_hash": hash_msisdn(msisdn), "reason": payload.reason},
    )
    await db.commit()
    await db.refresh(cust)
    return _cust_safety(cust)


@router.post("/safety/customers/{phone}/unblock", response_model=CustomerSafetyOut)
async def unblock_customer(
    phone: str,
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
) -> CustomerSafetyOut:
    """Lift a block. Resets abuse_score to 0."""
    from app.core.security import hash_msisdn, normalize_msisdn
    _require_safety_admin(p)
    msisdn = normalize_msisdn(phone)
    res = await db.execute(select(Customer).where(Customer.phone_number == msisdn))
    cust = res.scalar_one_or_none()
    if cust is None:
        raise HTTPException(status_code=404, detail="customer not found")
    cust.blocked = False
    cust.blocked_reason = None
    cust.blocked_at = None
    cust.abuse_score = 0
    cust.last_flag_at = None
    await _audit(
        db, actor=p.actor_label, action="customer_unblock",
        target=str(cust.id), data={"phone_hash": hash_msisdn(msisdn)},
    )
    await db.commit()
    await db.refresh(cust)
    return _cust_safety(cust)


# ════════════════════════════════════════════════════════════════════════
# 7) Audit log search
# ════════════════════════════════════════════════════════════════════════

@router.get("/audit")
async def audit_search(
    db: AsyncSession = Depends(db_session),
    p: Principal = Depends(require_principal),
    actor: Optional[str] = None,
    action: Optional[str] = None,
    target: Optional[str] = None,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=1000),
    cursor: Optional[int] = Query(None, description="last seen id (for pagination)"),
) -> dict:
    # Only superadmins / machine token can see the full audit log.
    # Tenant-scoped audit will be a follow-up (need actor→tenant mapping).
    if not (p.is_superadmin or p.is_machine):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "superadmin required for global audit view")
    q = select(AuditEvent)
    if actor:
        q = q.where(AuditEvent.actor.ilike(f"%{actor}%"))
    if action:
        q = q.where(AuditEvent.action == action)
    if target:
        q = q.where(AuditEvent.target == target)
    if since:
        q = q.where(AuditEvent.created_at >= since)
    if until:
        q = q.where(AuditEvent.created_at <= until)
    if cursor:
        q = q.where(AuditEvent.id < cursor)
    q = q.order_by(AuditEvent.id.desc()).limit(limit)
    rows = (await db.execute(q)).scalars().all()
    return {
        "count": len(rows),
        "next_cursor": rows[-1].id if rows and len(rows) == limit else None,
        "items": [
            {
                "id": e.id, "actor": e.actor, "action": e.action,
                "target": e.target, "data": e.data,
                "actor_email": e.actor.removeprefix("user:") if e.actor.startswith("user:") else None,
                "business_slug": (e.data or {}).get("business_slug") or (e.data or {}).get("slug"),
                "resource": e.target,
                "details": e.data,
                "created_at": e.created_at.isoformat(),
            }
            for e in rows
        ],
    }


# ════════════════════════════════════════════════════════════════════════
# 8) SSE live event stream
# ════════════════════════════════════════════════════════════════════════

# What event types the SSE stream forwards. Keep small to avoid leaking
# bus internals; UI subscribes to these by name.
_SSE_EVENTS = {
    "message.created",
    "conversation.takeover",
    "conversation.released",
    "conversation.interleaved",
    "escalation.opened",
    "payment.completed",
    "broadcast.progress",
}


async def _sse_authenticate(token: str, db: AsyncSession) -> Principal:
    """SSE clients can't easily set Authorization headers in EventSource;
    they pass the access token as ?token=… instead."""
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing token query param")
    # Reuse the standard principal resolver.
    from app.api.deps import _principal_from_token
    return await _principal_from_token(token, db)


@router.get("/stream")
async def admin_stream(
    request: Request,
    token: str = Query(..., description="access JWT (or legacy machine token)"),
    business_slug: Optional[str] = Query(None, description="filter to one tenant"),
    db: AsyncSession = Depends(db_session),
) -> StreamingResponse:
    """Server-Sent Events stream of live admin events.

    The stream filters by what the principal is allowed to see:
      * superadmin / machine token  → everything
      * staff/owner of a tenant     → events whose payload.business_id
                                      matches one of their memberships
      * viewer                      → same as staff/owner (read-only events
                                      are already safe)
    """
    p = await _sse_authenticate(token, db)
    allowed_business_ids: Optional[set[str]]
    if p.is_superadmin or p.is_machine:
        allowed_business_ids = None  # no filter
    else:
        assert p.user is not None
        memberships = (await db.execute(
            select(Business.id).join(
                __import__("app.db.models", fromlist=["TenantMembership"]).TenantMembership,
                __import__("app.db.models", fromlist=["TenantMembership"]).TenantMembership.business_id == Business.id,
            ).where(
                __import__("app.db.models", fromlist=["TenantMembership"]).TenantMembership.admin_user_id == p.user.id,
            )
        )).scalars().all()
        allowed_business_ids = {str(b) for b in memberships}
        if business_slug:
            b = (await db.execute(
                select(Business).where(Business.slug == business_slug)
            )).scalar_one_or_none()
            if b is None or str(b.id) not in allowed_business_ids:
                raise HTTPException(403, "no access to that business")
            allowed_business_ids = {str(b.id)}

    async def _gen():
        from app.core.event_bus import CHANNEL
        from app.core.redis_client import get_redis
        r = await get_redis()
        pubsub = r.pubsub(ignore_subscribe_messages=True)
        await pubsub.subscribe(CHANNEL)
        slug_cache: dict[str, str | None] = {}
        # Initial comment so the client knows the stream is alive.
        yield ": connected\n\n"
        try:
            heartbeat = 0
            while True:
                if await request.is_disconnected():
                    break
                msg = await pubsub.get_message(timeout=15.0, ignore_subscribe_messages=True)
                heartbeat += 1
                if msg is None:
                    # SSE keepalive comment every 15s
                    yield ": ping\n\n"
                    continue
                if msg.get("type") != "message":
                    continue
                try:
                    data = msg.get("data")
                    if isinstance(data, bytes):
                        data = data.decode("utf-8", errors="replace")
                    evt = json.loads(data)
                except Exception:
                    continue
                etype = evt.get("type") or ""
                if etype not in _SSE_EVENTS:
                    continue
                if allowed_business_ids is not None:
                    bid = (evt.get("payload") or {}).get("business_id")
                    if not bid or str(bid) not in allowed_business_ids:
                        continue
                payload = evt.get("payload") or {}
                bid = payload.get("business_id")
                if bid and "business_slug" not in evt:
                    bid_s = str(bid)
                    if bid_s not in slug_cache:
                        try:
                            bid_uuid = uuid.UUID(bid_s)
                        except ValueError:
                            slug_cache[bid_s] = None
                        else:
                            slug_cache[bid_s] = (await db.execute(
                                select(Business.slug).where(Business.id == bid_uuid)
                            )).scalar_one_or_none()
                    evt["business_slug"] = slug_cache[bid_s]
                if payload.get("conversation_id") and "conversation_id" not in evt:
                    evt["conversation_id"] = payload.get("conversation_id")
                yield f"event: {etype}\n"
                yield f"data: {json.dumps(evt, default=str)}\n\n"
        finally:
            try:
                await pubsub.unsubscribe(CHANNEL)
                await pubsub.close()
            except Exception:
                pass

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",   # nginx — don't buffer the stream
            "Connection": "keep-alive",
        },
    )
