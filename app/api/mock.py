"""Mock channel HTTP interface — Phase 2 testable surface.

POST /mock/message  { "phone": "+254...", "text": "...", "language": "sw" }
→ runs the full pipeline (lock → persist → AI graph → persist → reply).
"""
from typing import Optional
import uuid as _uuid

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.channels.mock import Channel, InboundTurn, handle_inbound
from app.core.rate_limit import limiter
from app.db.models import ToolInvocation

router = APIRouter(prefix="/mock", tags=["mock"])


class MockMessageIn(BaseModel):
    phone: str = Field(..., examples=["+254700000001"])
    text: str = Field(..., min_length=1, max_length=4000)
    name: Optional[str] = None
    language: Optional[str] = None
    business_id: Optional[str] = None
    business_slug: Optional[str] = Field(
        None,
        description="Alternative to business_id — resolve tenant by slug "
                    "(e.g. 'sovereign-suites'). Useful for manual testing.",
    )


class MockMessageOut(BaseModel):
    reply: str
    conversation_id: str
    escalated: bool
    image_url: Optional[str] = None
    photo_item: Optional[str] = None


async def _latest_photo_result(db: AsyncSession, conversation_id: str) -> tuple[str | None, str | None]:
    try:
        stmt = (
            select(ToolInvocation)
            .where(ToolInvocation.conversation_id == _uuid.UUID(conversation_id))
            .where(ToolInvocation.tool_name == "send_menu_photo")
            .where(ToolInvocation.success.is_(True))
            .order_by(ToolInvocation.created_at.desc())
            .limit(1)
        )
        inv = (await db.execute(stmt)).scalar_one_or_none()
        if inv is None:
            return None, None
        result = inv.result if isinstance(inv.result, dict) else {}
        return result.get("image_url"), result.get("item")
    except Exception:
        return None, None


def _clean_reply(reply: str, image_url: str | None, photo_item: str | None) -> str:
    if not image_url:
        return reply
    cleaned = (reply or "").replace(image_url, "").strip()
    if cleaned == reply:
        if cleaned.lower().startswith("photo ready for") and cleaned.endswith(":"):
            return f"Here you go for {photo_item}." if photo_item else "Here you go."
        return reply
    cleaned = " ".join(cleaned.split())
    return cleaned or (f"Here you go for {photo_item}." if photo_item else "Here you go.")


@router.post("/message", response_model=MockMessageOut)
@limiter.limit("60/minute")
async def post_message(
    request: Request,
    payload: MockMessageIn,
    db: AsyncSession = Depends(db_session),
) -> MockMessageOut:
    turn = InboundTurn(
        msisdn_raw=payload.phone,
        text=payload.text,
        channel=Channel.mock,
        customer_name=payload.name,
        language=payload.language,
        business_id=_uuid.UUID(payload.business_id) if payload.business_id else None,
        business_slug=payload.business_slug,
    )
    res = await handle_inbound(db, turn)
    image_url, photo_item = await _latest_photo_result(db, str(res.conversation_id))
    return MockMessageOut(
        reply=_clean_reply(res.reply, image_url, photo_item),
        conversation_id=str(res.conversation_id),
        escalated=res.escalated,
        image_url=image_url,
        photo_item=photo_item,
    )


class MockImageIn(BaseModel):
    phone: str = Field(..., examples=["+254700000001"])
    image_url: str = Field(..., description="Public HTTPS URL of the image to send.")
    caption: Optional[str] = None
    business_slug: Optional[str] = None


@router.post("/image", response_model=MockMessageOut)
@limiter.limit("30/minute")
async def post_image(
    request: Request,
    payload: MockImageIn,
    db: AsyncSession = Depends(db_session),
) -> MockMessageOut:
    """Simulate a WhatsApp image: download the URL, mirror to R2 (presigned
    URL → publicly fetchable by Groq), vision-describe, then run the normal
    turn pipeline. Lets us test the full vision path end-to-end without WA."""
    import httpx
    from app.services import media as media_svc

    media_url = payload.image_url
    description: str | None = None
    # Mirror to R2 so Groq vision has a guaranteed-fetchable URL (Unsplash
    # etc. often 403 the Groq fetcher).
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as c:
            r = await c.get(payload.image_url)
            r.raise_for_status()
            binary = r.content
            mime = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        uploaded = await media_svc.upload_to_r2(binary, mime, prefix="mock-inbound")
        if uploaded and uploaded.startswith(("http://", "https://")):
            media_url = uploaded
    except Exception:
        pass  # fall back to original URL

    description = await media_svc.describe_image(
        media_url, caption=payload.caption or None,
    )
    parts: list[str] = []
    if payload.caption:
        parts.append(f'Customer caption: "{payload.caption}"')
    if description:
        parts.append(f"Image description: {description}")
    if not parts:
        parts.append("[image received — vision unavailable]")
    text = "\n".join(parts)

    turn = InboundTurn(
        msisdn_raw=payload.phone,
        text=text,
        channel=Channel.mock,
        media_url=media_url,
        business_slug=payload.business_slug,
    )
    res = await handle_inbound(db, turn)
    image_url, photo_item = await _latest_photo_result(db, str(res.conversation_id))
    return MockMessageOut(
        reply=_clean_reply(res.reply, image_url, photo_item),
        conversation_id=str(res.conversation_id),
        escalated=res.escalated,
        image_url=image_url,
        photo_item=photo_item,
    )
