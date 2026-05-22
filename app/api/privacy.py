"""GDPR / data-subject-rights endpoints.

Required for production use under EU GDPR (Art. 15 access, Art. 17 erasure)
and Kenya's Data Protection Act 2019 (s. 26 access, s. 40 deletion).

All endpoints are admin-token protected — customers do NOT call these
directly. The merchant's support agent submits a request on the customer's
behalf after identity verification (out-of-band).

Endpoints:
    GET  /privacy/customers/{phone}/export   → JSON dump of all data
    POST /privacy/customers/{phone}/forget   → cascade-delete + hash retention proof
    GET  /privacy                            → public-facing privacy policy
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import require_admin
from app.api.deps import db_session
from app.core.logging import get_logger
from app.core.security import hash_msisdn, normalize_msisdn
from app.db.models import (
    AuditEvent, Conversation, Customer, Message, Order, ToolInvocation,
)

log = get_logger("privacy")
router = APIRouter(prefix="/privacy", tags=["privacy"])


@router.get(
    "/customers/{phone}/export",
    dependencies=[Depends(require_admin)],
)
async def export_customer_data(phone: str, db: AsyncSession = Depends(db_session)) -> dict:
    """GDPR Art. 15 — Right of access. Return every record linked to a phone number."""
    try:
        msisdn = normalize_msisdn(phone)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid phone format")
    cust = (await db.execute(
        select(Customer).where(Customer.phone_number == msisdn)
    )).scalar_one_or_none()
    if cust is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")

    convs = (await db.execute(
        select(Conversation).where(Conversation.customer_id == cust.id)
    )).scalars().all()
    conv_ids = [c.id for c in convs]

    msgs = []
    tools = []
    if conv_ids:
        msgs = (await db.execute(
            select(Message).where(Message.conversation_id.in_(conv_ids))
            .order_by(Message.timestamp.asc())
        )).scalars().all()
        tools = (await db.execute(
            select(ToolInvocation).where(ToolInvocation.conversation_id.in_(conv_ids))
        )).scalars().all()

    orders = (await db.execute(
        select(Order).where(Order.customer_id == cust.id)
    )).scalars().all()

    log.info("gdpr_export", customer_id=str(cust.id), msgs=len(msgs))

    return {
        "exported_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "customer": {
            "id": str(cust.id),
            "phone_number": cust.phone_number,
            "name": cust.name,
            "preferred_language": cust.preferred_language,
            "meta": cust.meta,
            "created_at": cust.created_at.isoformat() if cust.created_at else None,
        },
        "conversations": [
            {
                "id": str(c.id),
                "channel": getattr(c.channel, "value", str(c.channel)),
                "status": getattr(c.status, "value", str(c.status)),
                "business_id": str(c.business_id) if c.business_id else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in convs
        ],
        "messages": [
            {
                "id": str(m.id),
                "conversation_id": str(m.conversation_id),
                "sender": getattr(m.sender, "value", str(m.sender)),
                "content": m.content,
                "language": m.language,
                "media_url": m.media_url,
                "created_at": m.timestamp.isoformat() if m.timestamp else None,
            }
            for m in msgs
        ],
        "orders": [
            {
                "id": str(o.id),
                "amount": float(o.amount) if o.amount is not None else None,
                "payment_status": getattr(o.payment_status, "value", str(o.payment_status)),
                "details": o.details,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ],
        "tool_invocations": [
            {
                "id": str(t.id),
                "conversation_id": str(t.conversation_id) if t.conversation_id else None,
                "tool_name": t.tool_name,
                "arguments": t.arguments,
                "result": t.result,
                "success": t.success,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tools
        ],
    }


@router.post(
    "/customers/{phone}/forget",
    dependencies=[Depends(require_admin)],
)
async def forget_customer(phone: str, db: AsyncSession = Depends(db_session)) -> dict:
    """GDPR Art. 17 — Right to erasure. Cascade-delete all customer data.

    We keep an AuditEvent row recording the hashed phone + deletion timestamp
    so we can prove the request was honoured without retaining the PII itself.
    """
    try:
        msisdn = normalize_msisdn(phone)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid phone format")

    cust = (await db.execute(
        select(Customer).where(Customer.phone_number == msisdn)
    )).scalar_one_or_none()
    if cust is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")

    cust_id = cust.id
    convs = (await db.execute(
        select(Conversation.id).where(Conversation.customer_id == cust_id)
    )).scalars().all()

    counts: dict[str, int] = {}
    if convs:
        r = await db.execute(delete(ToolInvocation).where(ToolInvocation.conversation_id.in_(convs)))
        counts["tool_invocations"] = r.rowcount or 0
        r = await db.execute(delete(Message).where(Message.conversation_id.in_(convs)))
        counts["messages"] = r.rowcount or 0
    r = await db.execute(delete(Order).where(Order.customer_id == cust_id))
    counts["orders"] = r.rowcount or 0
    r = await db.execute(delete(Conversation).where(Conversation.customer_id == cust_id))
    counts["conversations"] = r.rowcount or 0
    r = await db.execute(delete(Customer).where(Customer.id == cust_id))
    counts["customers"] = r.rowcount or 0

    # Retention proof — phone hashed, not stored plaintext.
    db.add(AuditEvent(
        actor="admin", action="gdpr_forget",
        target=str(cust_id),
        data={"phone_hash": hash_msisdn(msisdn), "deleted": counts},
    ))
    await db.commit()
    log.info("gdpr_forget", customer_id=str(cust_id), deleted=counts)
    return {"status": "deleted", "customer_id": str(cust_id), "deleted": counts}


_PRIVACY_HTML = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Privacy Policy</title>
<style>body{max-width:760px;margin:2rem auto;padding:0 1rem;font:16px/1.55 system-ui,sans-serif;color:#111}h1,h2{color:#0a3}code{background:#f3f3f3;padding:1px 4px;border-radius:3px}</style>
</head><body>
<h1>Privacy Policy</h1>
<p><strong>Last updated:</strong> 2025</p>
<h2>Data we collect</h2>
<ul>
<li><strong>Phone number</strong> — to deliver replies on WhatsApp / SMS / voice.</li>
<li><strong>Message content</strong> — to provide assistance and quality-control conversations.</li>
<li><strong>Order &amp; payment metadata</strong> — to fulfil bookings and payments.</li>
<li><strong>Preferred language</strong> — to reply in your language of choice.</li>
</ul>
<h2>How we use it</h2>
<p>Solely to provide the conversation service for the business you contacted.
We do <em>not</em> sell data, do <em>not</em> share with advertisers, and do
<em>not</em> use your messages to train AI models.</p>
<h2>Your rights</h2>
<p>You may request <strong>access</strong> to your data, or full
<strong>deletion</strong>, by replying with <code>DELETE MY DATA</code> in
any conversation, or by emailing the business directly. We respond within
30 days, as required by Kenya's Data Protection Act 2019 and the EU GDPR.</p>
<h2>Retention</h2>
<p>Conversation history is retained for up to 24 months for service quality.
Order records are retained for 7 years (tax compliance). Phone numbers in
operational logs are stored as one-way HMAC hashes, never plaintext.</p>
<h2>Security</h2>
<p>All data is encrypted in transit (TLS 1.2+) and at rest. Access is
restricted to authorised personnel of the business you contacted.</p>
<h2>Contact</h2>
<p>For any data-protection question, contact the business you messaged.</p>
</body></html>"""


@router.get("", response_class=HTMLResponse, include_in_schema=False)
@router.get("/", response_class=HTMLResponse, include_in_schema=False)
async def privacy_page() -> HTMLResponse:
    return HTMLResponse(_PRIVACY_HTML)
