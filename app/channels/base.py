"""Channel-agnostic turn handler.

Every channel (mock, whatsapp, voice, sms) eventually calls `handle_inbound`
which: locks the MSISDN, persists the inbound message, runs the AI graph,
persists the AI reply, and returns the reply text to the caller (which is
responsible for delivering it back over the channel's transport).
"""
from __future__ import annotations

import asyncio
import ast
import json
import re
import uuid
from dataclasses import dataclass

from langchain_core.messages import AIMessage, HumanMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.graph import run_turn
from app.ai.quick_replies import maybe_build_quick_reply
from app.core.logging import business_id_ctx, conversation_id_ctx, get_logger, tenant_slug_ctx
from app.core.redis_client import claim_idempotency
from app.core.security import hash_msisdn, normalize_msisdn
from app.db.models import Channel, Sender, ToolInvocation
from app.services.business_service import (
    get_business_by_slug, get_business_for_turn,
)
from app.services.conversation_service import (
    append_message, bump_failed_turn, close_active_conversations, escalate,
    get_active_business_id, get_or_create_customer, get_or_open_conversation,
    recent_history, reset_failed_turns,
)
from app.services.language import detect_language
from app.services.session_manager import acquire_session
from app.services.slash_commands import parse_slash

log = get_logger("channel")

# WhatsApp users notice silence quickly. Give the model enough time to reason
# and call tools, then allow only a short retry window before deterministic
# rescue. This keeps model-first behavior without making customers wait nearly
# a minute for a fallback.
AI_TURN_TIMEOUT_SECONDS = 12.0
AI_TURN_RETRY_TIMEOUT_SECONDS = 4.0
PAYMENT_AUTO_RESEND_AFTER_SECONDS = 90.0
_DEGRADED_FALLBACK_MARKERS = (
    "pulling our team",
    "system took too long",
    "system got stuck",
    "system got stuck before",
    "niko pamoja na timu",
    "mfumo umechelewa",
    "mfumo umekwama",
)
_PAYMENT_CANCEL_RE = re.compile(
    r"\b(cancel|stop|abort|sitisha)\b.{0,50}\b(payment|pay|stk|order|malipo|oda)\b|"
    r"\b(payment|pay|stk|order|malipo|oda)\b.{0,50}\b(cancel|stop|abort|sitisha)\b",
    re.IGNORECASE,
)
_PAYMENT_RESEND_RE = re.compile(
    r"\b(resend|send again|retry|try again|tuma tena)\b.*\b(stk|payment|pay|malipo|mpesa|m-pesa)\b|"
    r"\b(send|tuma)\b.*\b(stk|mpesa|m-pesa)\b|"
    r"\b(stk|payment|pay|malipo|mpesa|m-pesa)\b.*\b(resend|send again|retry|try again|tuma tena)\b|"
    r"\b(stk|mpesa|m-pesa)\b.*\b(send|tuma)\b",
    re.IGNORECASE,
)
_ORDER_REPEAT_RE = re.compile(
    r"\b(i want|i need|i'?ll have|can i have|can i get|order|sort|get me)\b",
    re.IGNORECASE,
)
_DEMO_ESPRESSO_RE = re.compile(r"\b(demo espresso|demo order|10 bob|ten bob)\b", re.IGNORECASE)
_ORDER_INTENT_RE = re.compile(
    r"\b(i want|i need|i'?ll have|can i have|can i get|order|sort|get me|nipe|nataka|leta)\b",
    re.IGNORECASE,
)
_INLINE_NAME_RE = re.compile(
    r"\b(?:my name is|name is|i am|i'm|naitwa|jina langu ni)\s+([A-Za-z][A-Za-z' -]{0,60})",
    re.IGNORECASE,
)
_INTERNAL_KB_MARKERS = (
    "demo flow",
    "create_order",
    "trigger m-pesa",
    "trigger mpesa",
    "whatsapp -> ai",
    "whatsapp → ai",
    "context:",
    "tools",
    "system prompt",
    "playbook",
)


def _is_degraded_fallback_text(content: str | None) -> bool:
    lowered = (content or "").lower()
    return any(marker in lowered for marker in _DEGRADED_FALLBACK_MARKERS)


def _looks_like_payment_cancel(text: str) -> bool:
    return bool(_PAYMENT_CANCEL_RE.search(text or ""))


def _looks_like_payment_resend(text: str) -> bool:
    return bool(_PAYMENT_RESEND_RE.search(text or ""))


def _looks_like_order_repeat(text: str) -> bool:
    candidate = (text or "").strip().lower()
    if not candidate or _looks_like_payment_cancel(candidate):
        return False
    if "demo espresso" in candidate or "demo order" in candidate or "10 bob" in candidate or "ten bob" in candidate:
        return True
    return bool(_ORDER_REPEAT_RE.search(candidate))


def _looks_like_demo_espresso_order(text: str) -> bool:
    candidate = (text or "").strip()
    return bool(_DEMO_ESPRESSO_RE.search(candidate) and _ORDER_INTENT_RE.search(candidate))


def _extract_inline_customer_name(text: str) -> str | None:
    match = _INLINE_NAME_RE.search(text or "")
    if not match:
        return None
    raw = match.group(1).strip(" .,!?:;\"'")
    if not raw:
        return None
    first = re.split(r"\s+", raw, maxsplit=1)[0].strip(" .,!?:;\"'")
    if not first or first.lower() in {"lily", "pond", "cafe", "caf"}:
        return None
    return first[:40]


def _ai_timeout_seconds(attr: str, default: float) -> float:
    try:
        from app.core.config import get_settings
        value = float(getattr(get_settings(), attr, default) or default)
    except Exception:
        return default
    return max(1.0, value)


def _customer_prefers_swahili(language: str | None) -> bool:
    return (language or "").lower().startswith(("sw", "she"))


def _order_items_summary_from_details(details: object) -> str:
    if not isinstance(details, dict):
        return "your order"
    items = details.get("items")
    if not isinstance(items, list) or not items:
        return "your order"
    pieces: list[str] = []
    for row in items:
        if not isinstance(row, dict):
            continue
        name = str(row.get("sku_or_name") or row.get("name") or "item").strip() or "item"
        qty = int(row.get("qty") or 1)
        pieces.append(f"{qty} x {name}")
    return ", ".join(pieces) or "your order"


def _order_matches_text(order: object, text: str) -> bool:
    candidate = (text or "").lower()
    try:
        from app.ai.safety import extract_kes_amounts
        amounts = extract_kes_amounts(candidate)
    except Exception:
        amounts = set()
    try:
        order_amount = int(float(getattr(order, "amount", 0) or 0))
    except Exception:
        order_amount = 0
    if amounts and order_amount in amounts:
        return True
    details = getattr(order, "details", None)
    summary = _order_items_summary_from_details(details).lower()
    if "demo espresso" in candidate and "demo espresso" in summary:
        return True
    tokens = {
        token[:-1] if token.endswith("s") and len(token) > 4 else token
        for token in re.findall(r"[a-z0-9]+", candidate)
        if len(token) >= 4 and token not in {"please", "order", "want", "need", "have", "sort"}
    }
    return any(token in summary for token in tokens)


def _customer_safe_kb_snippet(content: str | None) -> str | None:
    snippet = (content or "").strip()
    if not snippet:
        return None
    lowered = snippet.lower()
    if any(marker in lowered for marker in _INTERNAL_KB_MARKERS):
        return None
    if len(snippet) > 700:
        snippet = snippet[:700].rsplit(" ", 1)[0] + "..."
    return snippet


def _parse_tool_payload(content: object) -> dict:
    if isinstance(content, dict):
        return content
    if not isinstance(content, str) or not content.strip():
        return {}
    text = content.strip()
    for parser in (json.loads, ast.literal_eval):
        try:
            parsed = parser(text)
        except Exception:
            continue
        if isinstance(parsed, dict):
            return parsed
    return {}


def _latest_tool_result(result: dict, name: str) -> dict:
    for call in reversed(result.get("tool_calls") or []):
        if call.get("name") == name:
            return _parse_tool_payload(call.get("content"))
    return {}


def _payment_tool_recovery_reply(result: dict, *, msisdn: str) -> str | None:
    payment = _latest_tool_result(result, "request_mpesa_payment")
    order = _latest_tool_result(result, "create_order")
    if not payment and not order:
        return None
    amount = payment.get("amount_kes") or order.get("amount_kes")
    amount_text = ""
    if amount is not None:
        try:
            value = float(amount)
            amount_text = f" for KES {value:.0f}" if value.is_integer() else f" for KES {value:.2f}"
        except Exception:
            amount_text = f" for KES {amount}"
    phone_tail = msisdn[-4:] if msisdn else "your phone"

    if payment.get("ok"):
        return (
            f"Order received{amount_text}. I sent the M-Pesa STK prompt to the phone ending "
            f"{phone_tail}. Enter your PIN to pay; I'll send the receipt once it lands."
        )

    if payment.get("error") == "in_flight":
        return (
            "I already sent the M-Pesa STK prompt for this order. Check your phone and enter "
            "your PIN; I'll confirm once payment lands."
        )

    if payment:
        reason = str(payment.get("message") or payment.get("error") or "the payment provider did not accept it")
        return (
            f"I recorded the order{amount_text}, but the STK push did not start: "
            f"{reason}. Please try again in a moment."
        )

    if order.get("ok"):
        return (
            f"I recorded the order{amount_text}, but I could not start payment yet. "
            "Tell me to send the STK prompt and I'll try again."
        )
    return None


def _looks_like_sanitizer_fallback(reply: str) -> bool:
    lowered = (reply or "").lower()
    return "formatting hiccup" in lowered or ("one moment" in lowered and "right answer" in lowered)


def _promises_ready_before_payment(reply: str) -> bool:
    lowered = (reply or "").lower()
    if "ready by" not in lowered and "pickup ready" not in lowered:
        return False
    return not any(
        guard in lowered
        for guard in ("after payment", "once payment", "payment lands", "payment is confirmed")
    )


async def _latest_pending_order_for_turn(
    db: AsyncSession,
    *,
    customer_id: uuid.UUID,
    business_id: uuid.UUID | None,
    conversation_id: uuid.UUID,
    text: str,
):
    from app.db.models import Order, PaymentStatus

    stmt = (
        select(Order)
        .where(Order.customer_id == customer_id)
        .where(Order.conversation_id == conversation_id)
        .where(Order.payment_status == PaymentStatus.pending)
        .where(Order.business_id == business_id if business_id is not None else Order.business_id.is_(None))
        .order_by(Order.created_at.desc())
        .limit(10)
    )
    orders = (await db.execute(stmt)).scalars().all()
    if not orders:
        return None
    for order in orders:
        if _order_matches_text(order, text):
            return order
    return orders[0]


def _payment_prompt_age_seconds(order: object) -> float | None:
    from datetime import datetime, timezone

    stamp = getattr(order, "updated_at", None) or getattr(order, "created_at", None)
    if stamp is None:
        return None
    try:
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=timezone.utc)
        return max(0.0, (datetime.now(timezone.utc) - stamp).total_seconds())
    except Exception:
        return None


async def _auto_resend_stale_payment_reply(
    db: AsyncSession,
    *,
    customer,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    text: str,
    language: str | None,
) -> str | None:
    if not _looks_like_order_repeat(text):
        return None
    order = await _latest_pending_order_for_turn(
        db,
        customer_id=customer.id,
        business_id=business_id,
        conversation_id=conversation_id,
        text=text,
    )
    if order is None or not getattr(order, "mpesa_checkout_id", None):
        return None
    if not _order_matches_text(order, text):
        return None
    age_seconds = _payment_prompt_age_seconds(order)
    if age_seconds is None or age_seconds < PAYMENT_AUTO_RESEND_AFTER_SECONDS:
        return None
    log.info(
        "auto_resending_stale_stk",
        order=str(getattr(order, "id", "")),
        age_seconds=round(age_seconds, 1),
    )
    return await _resend_pending_payment_reply(
        db,
        customer=customer,
        conversation_id=conversation_id,
        business_id=business_id,
        text=text,
        language=language,
    )


async def _demo_espresso_fast_order_reply(
    db: AsyncSession,
    *,
    customer,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    text: str,
    language: str | None,
) -> str | None:
    if not _looks_like_demo_espresso_order(text):
        return None

    from app.db.models import Order, PaymentStatus

    is_sw = _customer_prefers_swahili(language or getattr(customer, "preferred_language", None))
    name = _extract_inline_customer_name(text) or getattr(customer, "name", None)
    if not name:
        return (
            "Sawa - niandikie jina la kuweka kwa oda ya Demo Espresso ya KES 10."
            if is_sw else
            "Sure - what name should I put on the KES 10 Demo Espresso order?"
        )
    if getattr(customer, "name", None) != name:
        customer.name = name

    existing = await _latest_pending_order_for_turn(
        db,
        customer_id=customer.id,
        business_id=business_id,
        conversation_id=conversation_id,
        text="Demo Espresso KES 10",
    )
    if existing is not None and not _order_matches_text(existing, "Demo Espresso KES 10"):
        existing = None
    if existing is not None:
        if getattr(existing, "mpesa_checkout_id", None):
            age_seconds = _payment_prompt_age_seconds(existing)
            if age_seconds is None or age_seconds < PAYMENT_AUTO_RESEND_AFTER_SECONDS:
                amount = int(float(existing.amount or 0))
                summary = _order_items_summary_from_details(existing.details)
                return (
                    f"Tayari nina {summary} ya KES {amount} ikisubiri malipo. Angalia STK kwa simu; ikiisha muda, andika 'resend STK'."
                    if is_sw else
                    f"I already have {summary} for KES {amount} waiting on payment. Check your phone for the STK; if it expired, type 'resend STK'."
                )
        return await _resend_pending_payment_reply(
            db,
            customer=customer,
            conversation_id=conversation_id,
            business_id=business_id,
            text="Demo Espresso KES 10",
            language=language,
        )

    order = Order(
        customer_id=customer.id,
        business_id=business_id,
        conversation_id=conversation_id,
        details={
            "items": [{"sku_or_name": "Demo Espresso", "qty": 1, "unit_price": 10.0}],
            "delivery_notes": "Live Lily Pond demo order",
            "fast_path": "demo_espresso",
        },
        amount=10.0,
        payment_status=PaymentStatus.pending,
    )
    db.add(order)
    await db.flush()

    payment_reply = await _resend_pending_payment_reply(
        db,
        customer=customer,
        conversation_id=conversation_id,
        business_id=business_id,
        text="Demo Espresso KES 10",
        language=language,
    )
    if is_sw:
        return payment_reply
    if payment_reply.startswith("Sent a fresh STK"):
        return f"Nailed it, {name} - {payment_reply[0].lower()}{payment_reply[1:]}"
    return payment_reply


async def _cancel_jobs_for_order(db: AsyncSession, *, order_id: uuid.UUID, business_id: uuid.UUID | None) -> int:
    from app.db.models import BackgroundJob, JobStatus

    stmt = (
        select(BackgroundJob)
        .where(BackgroundJob.kind.in_(("order.ready", "payment.unpaid_followup", "payment.intasend_poll")))
        .where(BackgroundJob.status == JobStatus.queued)
        .order_by(BackgroundJob.created_at.desc())
        .limit(100)
    )
    if business_id is not None:
        stmt = stmt.where(BackgroundJob.business_id == business_id)
    jobs = (await db.execute(stmt)).scalars().all()
    cancelled = 0
    for job in jobs:
        payload = job.payload if isinstance(job.payload, dict) else {}
        if str(payload.get("order_id") or "") != str(order_id):
            continue
        job.status = JobStatus.cancelled
        cancelled += 1
    return cancelled


async def _cancel_pending_order_reply(
    db: AsyncSession,
    *,
    customer,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    text: str,
    language: str | None,
) -> str:
    from datetime import datetime, timezone
    from app.db.models import PaymentStatus

    order = await _latest_pending_order_for_turn(
        db,
        customer_id=customer.id,
        business_id=business_id,
        conversation_id=conversation_id,
        text=text,
    )
    is_sw = _customer_prefers_swahili(language or getattr(customer, "preferred_language", None))
    if order is None:
        return (
            "Sioni oda au STK ambayo bado inasubiri malipo. Ukiwa unataka kuagiza upya, niambie item unayotaka."
            if is_sw else
            "I do not see an unpaid order or STK prompt waiting right now. If you want to order again, tell me the item."
        )

    details = dict(order.details or {})
    details["customer_cancelled_at"] = datetime.now(timezone.utc).isoformat()
    order.details = details
    order.payment_status = PaymentStatus.cancelled
    cancelled_jobs = await _cancel_jobs_for_order(db, order_id=order.id, business_id=business_id)
    log.info("customer_cancelled_pending_order", order=str(order.id), cancelled_jobs=cancelled_jobs)
    amount = int(float(order.amount or 0))
    summary = _order_items_summary_from_details(order.details)
    return (
        f"Nimecancel oda ya {summary} ya KES {amount}. Ukiona STK ya zamani kwa simu, ipuuze; hakuna oda imethibitishwa bila PIN na risiti."
        if is_sw else
        f"Cancelled the pending {summary} order for KES {amount}. If an old STK prompt is still on your phone, ignore it; nothing is confirmed unless you enter your PIN and payment lands."
    )


async def _resend_pending_payment_reply(
    db: AsyncSession,
    *,
    customer,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    text: str,
    language: str | None,
) -> str:
    from datetime import datetime, timedelta, timezone
    from app.core.exceptions import RateLimited, UpstreamError
    from app.integrations.payments import get_payment_service
    from app.jobs.runner import enqueue_job

    order = await _latest_pending_order_for_turn(
        db,
        customer_id=customer.id,
        business_id=business_id,
        conversation_id=conversation_id,
        text=text,
    )
    is_sw = _customer_prefers_swahili(language or getattr(customer, "preferred_language", None))
    if order is None:
        return (
            "Sioni oda inayosubiri malipo ya kutumiwa STK upya. Niambie item unayotaka kuagiza."
            if is_sw else
            "I do not see an unpaid order to resend an STK for. Tell me the item you want to order."
        )

    try:
        await _cancel_jobs_for_order(db, order_id=order.id, business_id=business_id)
        svc = get_payment_service()
        result = await svc.request_payment(
            msisdn=customer.phone_number,
            amount=float(order.amount or 0),
            reference=str(order.id)[:8],
            description="Order Payment",
        )
        order.mpesa_checkout_id = result.reference
        if svc.name == "intasend":
            await enqueue_job(
                db,
                kind="payment.intasend_poll",
                business_id=business_id,
                run_at=datetime.now(timezone.utc) + timedelta(seconds=20),
                max_attempts=1,
                payload={
                    "order_id": str(order.id),
                    "checkout_id": result.reference,
                    "poll_count": 1,
                },
            )
    except RateLimited as exc:
        reason = exc.message
    except UpstreamError as exc:
        reason = exc.message
    except Exception as exc:  # noqa: BLE001
        reason = str(exc)
    else:
        amount = int(float(order.amount or 0))
        summary = _order_items_summary_from_details(order.details)
        return (
            f"Nimetuma STK mpya ya {summary} ya KES {amount}. Weka PIN; nitathibitisha malipo yakifika."
            if is_sw else
            f"Sent a fresh STK for {summary} at KES {amount}. Enter your PIN; I will confirm once payment lands."
        )

    return (
        f"Sijaweza kutuma STK mpya bado: {reason}. Jaribu tena baada ya muda mfupi."
        if is_sw else
        f"I could not resend the STK yet: {reason}. Please try again in a moment."
    )


async def _pending_order_repeat_reply(
    db: AsyncSession,
    *,
    customer,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    text: str,
    language: str | None,
) -> str | None:
    if not _looks_like_order_repeat(text) and not _looks_like_payment_resend(text):
        return None
    order = await _latest_pending_order_for_turn(
        db,
        customer_id=customer.id,
        business_id=business_id,
        conversation_id=conversation_id,
        text=text,
    )
    if order is None:
        return None
    if not _order_matches_text(order, text) and not _looks_like_payment_resend(text):
        return None

    is_sw = _customer_prefers_swahili(language or getattr(customer, "preferred_language", None))
    amount = int(float(order.amount or 0))
    summary = _order_items_summary_from_details(order.details)
    if order.mpesa_checkout_id:
        return (
            f"Tayari nina {summary} ya KES {amount} ikisubiri malipo. Angalia STK kwa simu na uweke PIN; nitathibitisha ikifika. Ikiisha muda, andika 'resend STK'."
            if is_sw else
            f"I already have {summary} for KES {amount} waiting on payment. Check the STK prompt on your phone and enter your PIN; I will confirm once it lands. If it expired, type 'resend STK'."
        )
    return (
        f"Nimehifadhi {summary} ya KES {amount}, lakini STK haijatumwa bado. Andika 'send STK' na nitajaribu tena."
        if is_sw else
        f"I have {summary} for KES {amount} saved, but no STK prompt is active yet. Type 'send STK' and I will try again."
    )


@dataclass
class InboundTurn:
    msisdn_raw: str
    text: str
    channel: Channel
    customer_name: str | None = None
    media_url: str | None = None
    provider_message_id: str | None = None
    language: str | None = None
    business_id: uuid.UUID | None = None
    business_slug: str | None = None
    meta_phone_number_id: str | None = None


@dataclass
class TurnResult:
    reply: str
    conversation_id: uuid.UUID
    escalated: bool
    duplicate: bool = False
    image_url: str | None = None
    photo_item: str | None = None


async def handle_inbound(db: AsyncSession, turn: InboundTurn) -> TurnResult:
    msisdn = normalize_msisdn(turn.msisdn_raw)

    # Idempotency: if the provider gave us a message id we've already processed,
    # short-circuit without re-running the LLM.
    if turn.provider_message_id:
        fresh = await claim_idempotency(f"msg:{turn.provider_message_id}", ttl_seconds=86_400)
        if not fresh:
            log.info("duplicate_webhook_ignored", provider_id=turn.provider_message_id)
            return TurnResult(reply="", conversation_id=uuid.uuid4(), escalated=False, duplicate=True)

    # Cross-channel interleaving guard: if the caller is mid-voice-call,
    # deflect text messages with a brief acknowledgement rather than
    # racing the same conversation row. The voice session refreshes its
    # presence marker every ~30s; it expires within PRESENCE_TTL_SEC if
    # the WebSocket dies unclean.
    incoming_channel = turn.channel.value if turn.channel else ""
    if incoming_channel and incoming_channel != "voice":
        try:
            from app.services.session_manager import should_defer
            active = await should_defer(msisdn, incoming_channel)
        except Exception:
            active = None
        if active:
            log.info(
                "channel_deferred",
                incoming=incoming_channel, active=active,
                msisdn_hash=__import__("hashlib").sha256(msisdn.encode()).hexdigest()[:10],
            )
            try:
                from app.core.event_bus import EVT_CONVERSATION_INTERLEAVED, publish
                msisdn_hash = hash_msisdn(msisdn)
                await publish(EVT_CONVERSATION_INTERLEAVED, target=msisdn_hash, payload={
                    "msisdn_hash": msisdn_hash,
                    "active_channel": active,
                    "incoming_channel": incoming_channel,
                })
            except Exception:
                pass
            return TurnResult(
                reply=(
                    "Niko nawe kwa simu sasa hivi — nitakujibu hapa "
                    "tukimaliza. (I'll reply here right after our call.)"
                ),
                conversation_id=uuid.uuid4(),
                escalated=False,
                duplicate=False,
            )

    async with acquire_session(msisdn, db):
        # ── Resolve which business this turn belongs to ───────────────
        # Resolution order: explicit business_id → mock-payload slug →
        # Meta phone_number_id → customer's existing active tenant (sticky
        # after /biz) → default-active business.
        business_id = turn.business_id
        if business_id is None and turn.business_slug:
            bp = await get_business_by_slug(db, turn.business_slug)
            if bp:
                business_id = bp.id
        if business_id is None and turn.meta_phone_number_id:
            bp = await get_business_for_turn(
                db,
                phone_number_id=turn.meta_phone_number_id,
                business_id=None,
            )
            if bp:
                business_id = bp.id

        # ── Detect customer's language for THIS turn (overrides hint) ─
        detected_lang = detect_language(turn.text)
        effective_lang = turn.language or detected_lang

        customer = await get_or_create_customer(
            db, phone=msisdn, name=turn.customer_name, language=effective_lang,
        )

        # ── Hard block: this MSISDN was banned by an admin (or auto-banned
        # by repeated abuse). Skip everything — no conversation row, no LLM.
        if getattr(customer, "blocked", False):
            log.info(
                "blocked_customer_ignored",
                msisdn_hash=hash_msisdn(msisdn),
                reason=(customer.blocked_reason or "unspecified")[:80],
            )
            await db.commit()
            return TurnResult(
                reply=(
                    "I'm not able to keep chatting right now. If you "
                    "believe this is a mistake, contact the café directly."
                ),
                conversation_id=uuid.uuid4(),
                escalated=False,
            )

        # ── Per-MSISDN rate limit (Redis token bucket): protects
        # against single-actor cost-bleed even when the source IP rotates.
        # 12 msgs / minute average, burst up to 20.
        try:
            from app.core.rate_limit import try_consume
            allowed = await try_consume(
                f"chat:msisdn:{hash_msisdn(msisdn)[:16]}",
                capacity=20, refill_per_sec=12.0 / 60.0,
            )
        except Exception:
            allowed = True  # never block on Redis hiccups
        if not allowed:
            log.info("chat_msisdn_rate_limited", msisdn_hash=hash_msisdn(msisdn))
            await db.commit()
            return TurnResult(
                reply=(
                    "Whoa, slow down a moment — I'm catching up. "
                    "Please send your message again in a few seconds."
                ),
                conversation_id=uuid.uuid4(),
                escalated=False,
            )

        # If still unresolved, prefer this customer's existing active tenant
        # (makes /biz sticky across turns). Otherwise fall back to global
        # default-active business.
        if business_id is None:
            business_id = await get_active_business_id(db, customer)
        if business_id is None:
            bp = await get_business_for_turn(
                db, phone_number_id=None, business_id=None,
            )
            if bp:
                business_id = bp.id

        # Propagate tenant context into every log line for this turn.
        if business_id is not None:
            business_id_ctx.set(str(business_id))
            try:
                _bp = await get_business_for_turn(db, business_id=business_id)
                if _bp:
                    tenant_slug_ctx.set(_bp.slug)
            except Exception:
                pass

        # ── Slash-command short-circuit (testing / admin) ────────────
        cmd = parse_slash(turn.text)
        if cmd is not None:
            ack = await _handle_slash(db, cmd, customer, turn.channel)
            await db.commit()
            return TurnResult(
                reply=ack.reply, conversation_id=ack.conversation_id,
                escalated=False,
            )

        conv = await get_or_open_conversation(db, customer, turn.channel, business_id)
        conversation_id_ctx.set(str(conv.id))

        # ── Content safety: deterministic pre-LLM filter ────────────
        # Catches prompt-injection, off-topic abuse, PII fishing, and
        # token-bleed before we ever pay for an LLM call.
        from app.ai.safety import (
            ABUSE_SCORE_BLOCK_THRESHOLD, ABUSE_SCORE_HARD_BLOCK,
            Verdict, evaluate_inbound,
        )
        # Count prior user turns in this conversation for the turn-cap rule.
        try:
            from sqlalchemy import func as _func, select as _select
            from app.db.models import Message as _Msg
            _cnt = await db.execute(
                _select(_func.count(_Msg.id)).where(
                    _Msg.conversation_id == conv.id, _Msg.sender == Sender.user,
                )
            )
            _prior_turns = int(_cnt.scalar() or 0)
        except Exception:
            _prior_turns = 0

        # Lookup business name for canned-reply personalisation
        _biz_name = None
        if business_id is not None:
            try:
                _bp2 = await get_business_for_turn(db, business_id=business_id)
                _biz_name = _bp2.name if _bp2 else None
            except Exception:
                _biz_name = None

        verdict = evaluate_inbound(
            turn.text,
            business_name=_biz_name,
            conv_turn_count=_prior_turns,
            abuse_score=int(getattr(customer, "abuse_score", 0) or 0),
        )
        try:
            from app.api.metrics import record_safety
            record_safety("inbound", verdict.verdict.value if hasattr(verdict.verdict, "value") else str(verdict.verdict))
        except Exception:
            pass

        # Persist the inbound user message with safety flags either way.
        _user_flags = [verdict.reason] if verdict.verdict != Verdict.ALLOW else None
        user_msg = await append_message(
            db, conversation=conv, sender=Sender.user, content=turn.text,
            language=effective_lang, media_url=turn.media_url,
            provider_message_id=turn.provider_message_id,
            safety_flags=_user_flags,
        )

        if verdict.verdict != Verdict.ALLOW:
            # Update abuse score + auto-actions
            from datetime import datetime as _dt, timezone as _tz
            new_score = int(getattr(customer, "abuse_score", 0) or 0) + verdict.abuse_delta
            customer.abuse_score = new_score
            if verdict.abuse_delta > 0:
                customer.last_flag_at = _dt.now(_tz.utc)
            auto_blocked = False
            if new_score >= ABUSE_SCORE_HARD_BLOCK and not customer.blocked:
                customer.blocked = True
                customer.blocked_at = _dt.now(_tz.utc)
                customer.blocked_reason = f"auto:abuse_score={new_score}"
                auto_blocked = True
            await db.flush()

            canned = verdict.canned_reply or ""
            await append_message(
                db, conversation=conv, sender=Sender.ai, content=canned,
                safety_flags=[f"canned:{verdict.reason}"],
            )

            if verdict.verdict == Verdict.ESCALATE:
                await escalate(db, conv, reason=f"safety:{verdict.reason}")
                _escalated = True
            elif new_score >= ABUSE_SCORE_BLOCK_THRESHOLD:
                # Flag for review without blocking yet
                await escalate(db, conv, reason=f"safety_review:{verdict.reason}")
                _escalated = True
            else:
                _escalated = False

            await db.commit()
            log.info(
                "safety_short_circuit",
                msisdn_hash=hash_msisdn(msisdn),
                verdict=verdict.verdict.value,
                reason=verdict.reason,
                abuse_score=new_score,
                auto_blocked=auto_blocked,
            )
            return TurnResult(
                reply=canned, conversation_id=conv.id, escalated=_escalated,
            )

        # ── Deterministic order/payment controls ─────────────────────
        # These are customer operations, not creative chat. Handle them
        # before the model so "cancel payment" never leaks raw KB policy text
        # and repeated order messages do not create duplicate STK pushes.
        control_reply: str | None = None
        control_flag: str | None = None
        if _looks_like_payment_resend(turn.text):
            control_reply = await _resend_pending_payment_reply(
                db,
                customer=customer,
                conversation_id=conv.id,
                business_id=business_id,
                text=turn.text,
                language=effective_lang,
            )
            control_flag = "deterministic:resend_payment"
        elif _looks_like_payment_cancel(turn.text):
            control_reply = await _cancel_pending_order_reply(
                db,
                customer=customer,
                conversation_id=conv.id,
                business_id=business_id,
                text=turn.text,
                language=effective_lang,
            )
            control_flag = "deterministic:cancel_payment"
        else:
            control_reply = await _demo_espresso_fast_order_reply(
                db,
                customer=customer,
                conversation_id=conv.id,
                business_id=business_id,
                text=turn.text,
                language=effective_lang,
            )
            if control_reply:
                control_flag = "deterministic:demo_espresso_fast_order"
            else:
                control_reply = await _auto_resend_stale_payment_reply(
                    db,
                    customer=customer,
                    conversation_id=conv.id,
                    business_id=business_id,
                    text=turn.text,
                    language=effective_lang,
                )
                if control_reply:
                    control_flag = "deterministic:auto_resend_payment"
                else:
                    control_reply = await _pending_order_repeat_reply(
                        db,
                        customer=customer,
                        conversation_id=conv.id,
                        business_id=business_id,
                        text=turn.text,
                        language=effective_lang,
                    )
                    control_flag = "deterministic:pending_order_status" if control_reply else None

        if control_reply:
            await append_message(
                db,
                conversation=conv,
                sender=Sender.ai,
                content=control_reply,
                safety_flags=[control_flag] if control_flag else None,
            )
            await db.commit()
            return TurnResult(reply=control_reply, conversation_id=conv.id, escalated=False)

        # ── If conversation is already human-escalated, do nothing.
        if conv.status.value == "human_escalated":
            await db.commit()
            log.info("turn_skipped_escalated", msisdn_hash=hash_msisdn(msisdn))
            return TurnResult(reply="", conversation_id=conv.id, escalated=True)

        # Staff has taken over via admin console — AI stays out of the way.
        # The inbound message is persisted; replies will be sent by a human
        # operator from the admin UI. We still publish a message-created
        # event so any connected dashboards refresh in real time.
        if getattr(conv, "ai_paused", False):
            await db.commit()
            try:
                from app.core.event_bus import EVT_MESSAGE_CREATED, publish
                await publish(
                    EVT_MESSAGE_CREATED,
                    target=str(conv.id),
                    payload={
                        "conversation_id": str(conv.id),
                        "business_id": str(conv.business_id) if conv.business_id else None,
                        "sender": "user",
                        "preview": (turn.text or "")[:160],
                        "ai_paused": True,
                    },
                )
            except Exception:
                pass
            log.info("turn_skipped_ai_paused", conv=str(conv.id))
            return TurnResult(reply="", conversation_id=conv.id, escalated=False)

        # Load short history (last 20 msgs) → LangChain BaseMessage list.
        history_rows = await recent_history(db, conv.id, limit=20)
        history = [
            (HumanMessage if r.sender == Sender.user else AIMessage)(content=r.content)
            for r in history_rows[:-1]  # exclude the just-saved user msg (graph adds it)
            if not (r.sender == Sender.ai and _is_degraded_fallback_text(r.content))
        ]

        turn_timeout = _ai_timeout_seconds("ai_turn_timeout_seconds", AI_TURN_TIMEOUT_SECONDS)
        turn_retry_timeout = _ai_timeout_seconds("ai_turn_retry_timeout_seconds", AI_TURN_RETRY_TIMEOUT_SECONDS)

        async def _run_ai_once(timeout_seconds: float = turn_timeout) -> dict:
            return await asyncio.wait_for(
                run_turn(
                    db,
                    msisdn=msisdn,
                    user_text=turn.text,
                    channel=turn.channel.value,
                    conversation_id=conv.id,
                    customer_id=customer.id,
                    customer_name=customer.name,
                    business_id=business_id,
                    history=history,
                    customer_language=effective_lang,
                ),
                timeout=timeout_seconds,
            )

        try:
            result = await _run_ai_once()
        except Exception as e:
            if isinstance(e, asyncio.TimeoutError):
                retry_timeout = turn_retry_timeout
                log.warning(
                    "ai_turn_timed_out_retrying",
                    timeout_seconds=turn_timeout,
                    retry_timeout_seconds=retry_timeout,
                )
            else:
                retry_timeout = turn_timeout
                log.warning("ai_turn_failed_retrying", error=str(e), error_type=type(e).__name__)
            # One quiet retry — covers transient Ollama/DB hiccups before we
            # ever show the customer a fallback string.
            try:
                result = await _run_ai_once(retry_timeout)
            except Exception as e2:
                if isinstance(e2, asyncio.TimeoutError):
                    log.exception(
                        "ai_turn_timed_out_final",
                        timeout_seconds=retry_timeout,
                    )
                else:
                    log.exception("ai_turn_failed_final", error=str(e2), error_type=type(e2).__name__)
                escalated = await bump_failed_turn(db, conv)

                fallback_profile = None
                try:
                    fallback_profile = await get_business_for_turn(db, business_id=business_id)
                except Exception:
                    fallback_profile = None

                quick_reply = None
                try:
                    quick_reply = await maybe_build_quick_reply(
                        db,
                        business_id=business_id,
                        profile=fallback_profile,
                        text=turn.text,
                    )
                except Exception as qr_err:
                    log.warning("quick_reply_fallback_failed", error=str(qr_err))

                # Before showing the generic fallback, try a KB keyword search.
                # If all LLMs are down but the KB has a literal match for the
                # customer's question, deliver THAT instead of a useless ack.
                kb_reply: str | None = None
                if (
                    quick_reply is None
                    and not _looks_like_payment_cancel(turn.text)
                    and not _looks_like_payment_resend(turn.text)
                ):
                    try:
                        from app.ai.rag import keyword_search
                        hits = await keyword_search(db, turn.text, business_id=business_id, k=3)
                        if hits:
                            for hit in hits:
                                snippet = _customer_safe_kb_snippet(hit.content)
                                if snippet:
                                    kb_reply = snippet
                                    log.info("kb_keyword_fallback_used", source=hit.source)
                                    break
                    except Exception as kb_err:
                        log.warning("kb_keyword_fallback_failed", error=str(kb_err))

                is_sw = (effective_lang or "").startswith(("sw", "she")) or \
                        (customer.preferred_language or "").startswith(("sw", "she"))
                if quick_reply:
                    reply = quick_reply
                elif kb_reply:
                    prefix = "Kutoka kwa menu:\n\n" if is_sw else "From the menu:\n\n"
                    reply = prefix + kb_reply
                elif escalated:
                    reply = (
                        "Samahani, mfumo umekwama kabla sijamaliza hilo. "
                        "Nimeweka mazungumzo haya yakaguliwe na mtu. "
                        "Kama ni ya haraka, piga simu +254 715 540 653."
                        if is_sw else
                        "Sorry, the system got stuck before I could finish that. "
                        "I've flagged this chat for a person to check. "
                        "If it's urgent, call +254 715 540 653."
                    )
                else:
                    reply = (
                        "Samahani, mfumo umechelewa kabla sijamaliza hilo. "
                        "Tafadhali tuma tena ujumbe huo mara moja; nitajaribu tena."
                        if is_sw else
                        "Sorry, the system took too long before I could finish that. "
                        "Please send that message once more and I'll try again."
                    )
                # Persist the fallback so conversation history stays complete
                await append_message(
                    db,
                    conversation=conv,
                    sender=Sender.ai,
                    content=reply,
                    safety_flags=["degraded_ai_fallback"],
                )
                await db.commit()
                return TurnResult(reply=reply, conversation_id=conv.id, escalated=escalated)

        image_url = None
        photo_item = None
        if isinstance(result.get("photo_result"), dict):
            image_url = result["photo_result"].get("image_url")
            photo_item = result["photo_result"].get("item")
        if image_url is None and getattr(user_msg, "timestamp", None) is not None:
            try:
                photo_inv = (await db.execute(
                    select(ToolInvocation)
                    .where(ToolInvocation.conversation_id == conv.id)
                    .where(ToolInvocation.tool_name == "send_menu_photo")
                    .where(ToolInvocation.success.is_(True))
                    .where(ToolInvocation.created_at >= user_msg.timestamp)
                    .order_by(ToolInvocation.created_at.desc())
                    .limit(1)
                )).scalar_one_or_none()
                if photo_inv is not None and isinstance(photo_inv.result, dict):
                    image_url = photo_inv.result.get("image_url")
                    photo_item = photo_inv.result.get("item")
            except Exception as photo_err:
                log.warning("photo_turn_result_lookup_failed", error=str(photo_err))

        # Final sanitiser: strip CoT/tool-call/markdown leakage. Voice channel
        # gets a plain-prose variant (no asterisks, no URLs).
        from app.services.output_sanitizer import sanitize_reply
        sanitiser_channel = "voice" if turn.channel == Channel.voice else "whatsapp"
        reply = sanitize_reply(result["reply"], channel=sanitiser_channel)
        recovered = _payment_tool_recovery_reply(result, msisdn=msisdn)
        if recovered and (_looks_like_sanitizer_fallback(reply) or _promises_ready_before_payment(reply)):
            log.info("payment_tool_reply_recovered", reason="fallback_or_premature_ready")
            reply = recovered

        # ── Output safety: redact unauthorised prices, strip forbidden
        # phrases ("order confirmed" without payment proof, identity claims).
        try:
            from app.ai.safety import extract_kes_amounts
            from app.ai.rag import kb_known_prices
            _allowed_prices = await kb_known_prices(db, business_id=business_id) \
                if business_id is not None else None
            _contextual_prices = extract_kes_amounts(turn.text)
            for _row in history_rows[-6:]:
                if _row.sender == Sender.user:
                    _contextual_prices.update(extract_kes_amounts(_row.content or ""))
        except Exception:
            _allowed_prices = None
            _contextual_prices = set()
        try:
            from app.ai.safety import evaluate_outbound as _eval_out
            reply, out_flags = _eval_out(
                reply,
                allowed_prices=_allowed_prices,
                contextual_prices=_contextual_prices,
            )
        except Exception:
            out_flags = []
        if out_flags:
            log.info("output_safety_redacted", flags=out_flags[:6])

        await append_message(
            db, conversation=conv, sender=Sender.ai, content=reply,
            safety_flags=out_flags or None,
        )
        if result["escalated"]:
            await escalate(db, conv, reason="tool_escalate_to_human")
        else:
            await reset_failed_turns(db, conv)
        await db.commit()

        log.info(
            "turn_completed",
            msisdn_hash=hash_msisdn(msisdn),
            channel=turn.channel.value,
            rag_hits=result.get("rag_hits", 0),
            tool_calls=[t["name"] for t in result["tool_calls"]],
            escalated=result["escalated"],
        )
        return TurnResult(
            reply=reply,
            conversation_id=conv.id,
            escalated=result["escalated"],
            image_url=image_url,
            photo_item=photo_item,
        )


@dataclass
class _SlashAck:
    reply: str
    conversation_id: uuid.UUID


async def _handle_slash(
    db: AsyncSession, cmd, customer, channel: Channel
) -> _SlashAck:
    """Apply a /biz, /reset, /help slash-command. Persists nothing on the AI
    side — we don't want test commands cluttering conversation history. We
    DO record the user's slash message + our ack so the audit trail is
    complete."""
    from app.services.business_service import get_business_by_slug

    if cmd.name == "biz":
        slug = (cmd.arg or "").strip().lower().replace(" ", "-")
        if not slug:
            ack = "Usage: /biz <business-slug>. Example: /biz sovereign-suites"
            conv = await get_or_open_conversation(db, customer, channel, None)
            await append_message(db, conversation=conv, sender=Sender.user, content="/biz")
            await append_message(db, conversation=conv, sender=Sender.ai, content=ack)
            return _SlashAck(reply=ack, conversation_id=conv.id)

        bp = await get_business_by_slug(db, slug)
        if bp is None:
            ack = f"No business found with slug '{slug}'. Check the slug and try again."
            conv = await get_or_open_conversation(db, customer, channel, None)
            await append_message(db, conversation=conv, sender=Sender.user, content=f"/biz {slug}")
            await append_message(db, conversation=conv, sender=Sender.ai, content=ack)
            return _SlashAck(reply=ack, conversation_id=conv.id)

        # Close any active conversations against other tenants.
        closed = await close_active_conversations(db, customer, business_id=bp.id)
        # Open (or reuse) a conversation against the new tenant.
        conv = await get_or_open_conversation(db, customer, channel, bp.id)
        await append_message(db, conversation=conv, sender=Sender.user, content=f"/biz {slug}")
        ack = (
            f"✓ Switched to {bp.name} ({slug}). "
            f"{closed} prior conversation(s) closed. Send your next message normally."
        )
        await append_message(db, conversation=conv, sender=Sender.ai, content=ack)
        return _SlashAck(reply=ack, conversation_id=conv.id)

    if cmd.name == "reset":
        closed = await close_active_conversations(db, customer, business_id=None)
        ack = f"✓ Reset. Closed {closed} conversation(s). Next message starts fresh."
        # Open a fresh placeholder so we have a conv id to log against.
        conv = await get_or_open_conversation(db, customer, channel, None)
        await append_message(db, conversation=conv, sender=Sender.user, content="/reset")
        await append_message(db, conversation=conv, sender=Sender.ai, content=ack)
        return _SlashAck(reply=ack, conversation_id=conv.id)

    # /help
    ack = (
        "Commands:\n"
        "  /biz <slug>  — switch to another business (e.g. /biz sovereign-suites)\n"
        "  /reset       — close current conversation, start fresh\n"
        "  /help        — show this message"
    )
    conv = await get_or_open_conversation(db, customer, channel, None)
    await append_message(db, conversation=conv, sender=Sender.user, content="/help")
    await append_message(db, conversation=conv, sender=Sender.ai, content=ack)
    return _SlashAck(reply=ack, conversation_id=conv.id)
