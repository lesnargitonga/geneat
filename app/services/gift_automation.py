"""Deterministic gift-concierge automation for Hazina Nomads.

Mirrors cafe_automation.py: fast menu taps, checkout capture, STK, and
delivery tracking without an LLM round-trip. Free-form questions still go
to the AI graph; when the model calls create_order / request_mpesa_payment,
use ``finalize_checkout_from_ai`` to push payment on the same path.
"""
from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.cafe_automation import (
    CafeOrderItem,
    create_order_and_request_payment,
    order_items_summary,
)
from app.services.whatsapp_menus import HAZINA_NOMADS_SLUG, ID_PRODUCT_PREFIX

HAZINA_SLUG = HAZINA_NOMADS_SLUG

# Catalog mirrors scripts/seed_hazina_nomads.py PRODUCTS (id → row).
HAZINA_PRODUCTS: dict[str, dict[str, Any]] = {
    "kenya-edit": {
        "name": "The Kenya Edit",
        "sku": "HN-KE-001",
        "price_kes": 11500,
        "price_usd": 89,
        "lead_time_hours": 24,
        "jkia_only": False,
        "blurb": (
            "Premium Kenyan coffee (250g), Maasai beadwork, soapstone carving, "
            "and a brand story card."
        ),
    },
    "highland-treasure": {
        "name": "The Highland Treasure",
        "sku": "HN-HT-002",
        "price_kes": 7600,
        "price_usd": 59,
        "lead_time_hours": 24,
        "jkia_only": False,
        "blurb": "Export-grade coffee, Kenyan tea, raw honey, and a carved tasting spoon.",
    },
    "nomad-leather-set": {
        "name": "The Nomad Leather Set",
        "sku": "HN-NL-003",
        "price_kes": 16600,
        "price_usd": 129,
        "lead_time_hours": 24,
        "jkia_only": False,
        "blurb": "Handmade leather passport holder, luggage tag, and travel notebook.",
        "personalization_note": "Engraving needs 24-hour notice.",
    },
    "safari-romance-box": {
        "name": "The Safari Romance Box",
        "sku": "HN-SR-004",
        "price_kes": 25600,
        "price_usd": 199,
        "lead_time_hours": 48,
        "jkia_only": False,
        "blurb": "Couple's beadwork, premium treats, safari route map, and leather luggage tags.",
    },
    "departure-drop": {
        "name": "The Departure Drop",
        "sku": "HN-DD-005",
        "price_kes": 19200,
        "price_usd": 149,
        "lead_time_hours": 4,
        "jkia_only": True,
        "blurb": "Pre-packed coffee, tea, leather, and beadwork — optimised for JKIA (4h window).",
    },
}

_CHECKOUT_TTL = 3600
_CHECKOUT_KEY = "gift_checkout:{conv_id}"

_ORDER_RE = re.compile(
    r"\b(?:order|buy|get|i want|i'?d like|i need|book)\b.{0,40}\b("
    + "|".join(re.escape(p.replace("-", " ")) for p in HAZINA_PRODUCTS)
    + r"|kenya edit|highland treasure|nomad leather|safari romance|departure drop)\b",
    re.IGNORECASE,
)
_PRODUCT_NAME_RE = re.compile(
    r"\b(kenya edit|highland treasure|nomad leather(?: set)?|safari romance(?: box)?|departure drop)\b",
    re.IGNORECASE,
)
_TRACK_RE = re.compile(
    r"\b(track|where is|delivery status|status of my|fuata|uwasilishaji)\b",
    re.IGNORECASE,
)
_CORPORATE_RE = re.compile(
    r"\b(corporate|bulk|team gift|company gift|event gift|zawadi za kampuni)\b",
    re.IGNORECASE,
)
_JKIA_RE = re.compile(r"\bjkia\b|terminal\s*\d", re.IGNORECASE)
_DEPARTURE_RE = re.compile(
    r"\b(?:depart|departure|flight|leave|fly)\b.{0,30}\b(\d{1,2}[:\.]\d{2}|\d{1,2}\s*(?:am|pm)|today|tomorrow)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class GiftAutomationResult:
    reply: str
    interactive: dict | None = None
    escalated: bool = False
    safety_flag: str = "deterministic:gift_automation"


def is_hazina_slug(slug: str | None) -> bool:
    return (slug or "").strip().lower() == HAZINA_SLUG


def product_id_from_interactive_id(interactive_id: str | None) -> str | None:
    if not interactive_id:
        return None
    lid = interactive_id.lower()
    if not lid.startswith(ID_PRODUCT_PREFIX):
        return None
    pid = lid[len(ID_PRODUCT_PREFIX):].strip()
    return pid if pid in HAZINA_PRODUCTS else None


def resolve_product_id(text: str, *, interactive_id: str | None = None) -> str | None:
    pid = product_id_from_interactive_id(interactive_id)
    if pid:
        return pid
    lowered = (text or "").lower()
    for key in HAZINA_PRODUCTS:
        name = key.replace("-", " ")
        if name in lowered or key in lowered:
            return key
    match = _PRODUCT_NAME_RE.search(text or "")
    if not match:
        return None
    token = match.group(1).lower()
    mapping = {
        "kenya edit": "kenya-edit",
        "highland treasure": "highland-treasure",
        "nomad leather": "nomad-leather-set",
        "nomad leather set": "nomad-leather-set",
        "safari romance": "safari-romance-box",
        "safari romance box": "safari-romance-box",
        "departure drop": "departure-drop",
    }
    return mapping.get(token)


def looks_like_hazina_order_intent(text: str) -> bool:
    return bool(_ORDER_RE.search(text or "")) or resolve_product_id(text) is not None


def looks_like_hazina_track(text: str) -> bool:
    return bool(_TRACK_RE.search(text or ""))


def looks_like_hazina_corporate(text: str) -> bool:
    return bool(_CORPORATE_RE.search(text or ""))


async def _get_checkout(conv_id: uuid.UUID) -> dict | None:
    try:
        from app.core.redis_client import get_redis

        raw = await (await get_redis()).get(_CHECKOUT_KEY.format(conv_id=str(conv_id)))
        if not raw:
            return None
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


async def _set_checkout(conv_id: uuid.UUID, data: dict) -> None:
    try:
        from app.core.redis_client import get_redis

        await (await get_redis()).set(
            _CHECKOUT_KEY.format(conv_id=str(conv_id)),
            json.dumps(data),
            ex=_CHECKOUT_TTL,
        )
    except Exception:
        pass


async def _clear_checkout(conv_id: uuid.UUID) -> None:
    try:
        from app.core.redis_client import get_redis

        await (await get_redis()).delete(_CHECKOUT_KEY.format(conv_id=str(conv_id)))
    except Exception:
        pass


def _product_detail_reply(product_id: str, *, is_sw: bool) -> str:
    row = HAZINA_PRODUCTS[product_id]
    name = row["name"]
    kes = int(row["price_kes"])
    usd = int(row["price_usd"])
    blurb = row["blurb"]
    extra = ""
    if row.get("personalization_note"):
        extra = f" {row['personalization_note']}"
    if is_sw:
        return (
            f"*{name}* — KES {kes:,} (USD {usd}). {blurb}{extra} "
            f"Wakati wa kuandaa: saa {row['lead_time_hours']}. "
            "Niambie mahali pa kufikishia (hotel + chumba, au JKIA + terminal) ili tuendelee."
        )
    return (
        f"*{name}* — KES {kes:,} (USD {usd}). {blurb}{extra} "
        f"Lead time: {row['lead_time_hours']}h. "
        "Tell me your delivery spot (hotel + room, or JKIA + terminal) and I'll lock in your order."
    )


def _ask_delivery_reply(product_id: str, *, is_sw: bool) -> str:
    row = HAZINA_PRODUCTS[product_id]
    if row.get("jkia_only"):
        if is_sw:
            return (
                f"*{row['name']}* — KES {row['price_kes']:,}. "
                "Niambie terminal ya JKIA (mf. 1A) na muda wa ndege yako inayotarajiwa kuondoka."
            )
        return (
            f"*{row['name']}* — KES {row['price_kes']:,}. "
            "Share your JKIA terminal (e.g. 1A) and expected departure time so we can meet the 4-hour window."
        )
    if is_sw:
        return (
            f"*{row['name']}* — KES {row['price_kes']:,}. "
            "Niambie jina la hoteli na nambari ya chumba, au JKIA + terminal, na muda unaopendelea."
        )
    return (
        f"*{row['name']}* — KES {row['price_kes']:,}. "
        "Where should we deliver? Hotel name + room, or JKIA + terminal, and your preferred window."
    )


def _corporate_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "Zawadi za kampuni — tunashughulikia oda za timu na matukio. "
            "Nimemwita concierge wa binafsi atakujibu hapa muda mfupi na bei za kundi."
        )
    return (
        "Corporate gifting — we handle team and event orders with curated packaging. "
        "I've asked a concierge to join this chat shortly with bulk pricing and timelines."
    )


async def _track_delivery_reply(
    db: AsyncSession,
    *,
    customer_id: uuid.UUID,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    is_sw: bool,
) -> str:
    from sqlalchemy import select

    from app.db.models import Order, PaymentStatus

    stmt = (
        select(Order)
        .where(Order.customer_id == customer_id)
        .where(Order.conversation_id == conversation_id)
        .where(Order.business_id == business_id if business_id is not None else Order.business_id.is_(None))
        .order_by(Order.created_at.desc())
        .limit(5)
    )
    orders = (await db.execute(stmt)).scalars().all()
    if not orders:
        return (
            "Bado sina oda yako. Chagua sanduku kutoka menu au niambie unachotaka kuagiza."
            if is_sw else
            "I don't have an order on file yet. Pick a gift box from the menu or tell me what you'd like."
        )
    order = orders[0]
    details = order.details if isinstance(order.details, dict) else {}
    summary = order_items_summary(
        [
            CafeOrderItem(
                str(r.get("sku_or_name") or r.get("name") or "gift box"),
                qty=int(r.get("qty") or 1),
                unit_price=float(r.get("unit_price") or 0),
            )
            for r in (details.get("items") or [])
            if isinstance(r, dict)
        ]
    ) or "your gift box"
    fulfillment = str(details.get("fulfillment_status") or "pending_payment")
    loc = details.get("delivery_location") or details.get("delivery_notes") or ""
    loc_bit = f" to {loc}" if loc else ""
    pay = order.payment_status.value
    if pay == PaymentStatus.paid.value:
        status_en = {
            "pending_payment": "paid — dispatch being scheduled",
            "out_for_delivery": "out for delivery",
            "delivered": "delivered",
        }.get(fulfillment, "paid — our team is preparing dispatch")
        if is_sw:
            return f"{summary}{loc_bit}: malipo yamethibitishwa, hali — {status_en}."
        return f"{summary}{loc_bit}: payment confirmed — {status_en}."
    if pay == PaymentStatus.pending.value:
        if is_sw:
            return (
                f"{summary} ya KES {int(float(order.amount or 0)):,} bado inasubiri malipo. "
                "Angalia STK kwa simu; andika 'resend STK' ikiisha muda."
            )
        return (
            f"{summary} at KES {int(float(order.amount or 0)):,} is awaiting payment. "
            "Check your phone for the M-Pesa prompt; type 'resend STK' if it expired."
        )
    return (
        f"{summary}: hali ya malipo — {pay}."
        if is_sw else
        f"{summary}: payment status is {pay}."
    )


def _parse_departure_iso(text: str) -> str | None:
    if not _DEPARTURE_RE.search(text or ""):
        return None
    # Store raw capture for concierge ops — full ISO parsing is LLM/tool territory.
    snippet = (text or "").strip()[:120]
    return snippet


async def _finalize_order(
    db: AsyncSession,
    *,
    customer_id: uuid.UUID,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    msisdn: str,
    product_id: str,
    delivery_location: str,
    departure_note: str | None,
    customer_name: str | None,
    is_sw: bool,
) -> GiftAutomationResult:
    row = HAZINA_PRODUCTS[product_id]
    items = [
        CafeOrderItem(
            sku_or_name=row["name"],
            qty=1,
            unit_price=float(row["price_kes"]),
        )
    ]
    notes_parts = [f"Gift concierge order — {row['sku']}"]
    if customer_name:
        notes_parts.append(f"Guest: {customer_name}")
    if departure_note:
        notes_parts.append(f"Departure: {departure_note}")

    result = await create_order_and_request_payment(
        db,
        customer_id=customer_id,
        conversation_id=conversation_id,
        business_id=business_id,
        msisdn=msisdn,
        items=items,
        delivery_notes=" | ".join(notes_parts),
        fast_path="hazina_gift_checkout",
    )
    # Patch delivery fields on the order row
    order = result.order
    details = dict(order.details or {})
    details["delivery_location"] = delivery_location
    if departure_note:
        details["departure_time_iso"] = departure_note
    details["product_id"] = product_id
    details["fulfillment_status"] = "pending_payment"
    order.details = details
    await db.flush()
    await _clear_checkout(conversation_id)

    amount = result.amount_kes
    summary = row["name"]
    if result.payment and not result.payment.ok:
        msg = (
            f"Sijaweza kutuma STK: {result.payment.message}. Jaribu tena baada ya muda mfupi."
            if is_sw else
            f"I could not send the M-Pesa prompt yet: {result.payment.message}. Try again shortly."
        )
        return GiftAutomationResult(reply=msg, safety_flag="deterministic:hazina_payment_failed")

    if is_sw:
        reply = (
            f"Nimeandaa {summary} ya KES {amount:,} kwa uwasilishaji: {delivery_location}. "
            "Angalia STK kwa simu na weka PIN; nitathibitisha malipo yakifika."
        )
    else:
        reply = (
            f"I've set up {summary} at KES {amount:,} for delivery to {delivery_location}. "
            "Check your phone for the M-Pesa STK prompt and enter your PIN — I'll confirm once payment lands."
        )
    from app.services.whatsapp_menus import order_actions_payload

    return GiftAutomationResult(
        reply=reply,
        interactive=order_actions_payload(language="sw" if is_sw else "en", business_slug=HAZINA_SLUG),
        safety_flag="deterministic:hazina_checkout",
    )


async def try_hazina_automation(
    db: AsyncSession,
    *,
    text: str,
    interactive_id: str | None,
    business_slug: str | None,
    customer,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    language: str | None,
) -> GiftAutomationResult | None:
    """Return a deterministic reply for Hazina, or None to fall through to café/AI."""
    if not is_hazina_slug(business_slug):
        return None

    is_sw = (language or "").lower().startswith(("sw", "she")) or (
        (getattr(customer, "preferred_language", None) or "").lower().startswith(("sw", "she"))
    )

    if looks_like_hazina_corporate(text):
        return GiftAutomationResult(
            reply=_corporate_reply(is_sw=is_sw),
            escalated=True,
            safety_flag="deterministic:hazina_corporate",
        )

    if looks_like_hazina_track(text):
        reply = await _track_delivery_reply(
            db,
            customer_id=customer.id,
            conversation_id=conversation_id,
            business_id=business_id,
            is_sw=is_sw,
        )
        from app.services.whatsapp_menus import back_to_menu_payload

        return GiftAutomationResult(
            reply=reply,
            interactive=back_to_menu_payload(language=language, business_slug=business_slug),
            safety_flag="deterministic:hazina_track",
        )

    checkout = await _get_checkout(conversation_id)
    if checkout and checkout.get("step") == "delivery":
        product_id = str(checkout.get("product_id") or "")
        if product_id not in HAZINA_PRODUCTS:
            await _clear_checkout(conversation_id)
            return None
        location = (text or "").strip()
        if len(location) < 6:
            return GiftAutomationResult(
                reply=(
                    "Tafadhali niambie hoteli + chumba, au JKIA + terminal (0.6+ herufi)."
                    if is_sw else
                    "Please share hotel + room, or JKIA + terminal (at least a few words)."
                ),
                safety_flag="deterministic:hazina_need_location",
            )
        departure = _parse_departure_iso(text) if _JKIA_RE.search(location) else None
        if _JKIA_RE.search(location) and not departure:
            checkout["delivery_location"] = location
            checkout["step"] = "departure"
            await _set_checkout(conversation_id, checkout)
            return GiftAutomationResult(
                reply=(
                    "Asante. Sasa niambie muda wa ndege yako inayotarajiwa kuondoka (mf. 'depart 18:30')."
                    if is_sw else
                    "Got it. What time is your flight departing (e.g. 'depart 6:30 pm')?"
                ),
                safety_flag="deterministic:hazina_need_departure",
            )
        if checkout.get("step") == "departure":
            departure = _parse_departure_iso(text) or location
            location = str(checkout.get("delivery_location") or location)
        name = getattr(customer, "name", None)
        return await _finalize_order(
            db,
            customer_id=customer.id,
            conversation_id=conversation_id,
            business_id=business_id,
            msisdn=customer.phone_number,
            product_id=product_id,
            delivery_location=location,
            departure_note=departure,
            customer_name=name,
            is_sw=is_sw,
        )

    product_id = resolve_product_id(text, interactive_id=interactive_id)
    tapped = product_id_from_interactive_id(interactive_id) is not None

    if product_id and re.search(r"\b(?:about|tell me|what is|details|bei)\b", text or "", re.I) and not tapped:
        return GiftAutomationResult(
            reply=_product_detail_reply(product_id, is_sw=is_sw),
            safety_flag="deterministic:hazina_product_info",
        )

    if tapped or (product_id and looks_like_hazina_order_intent(text)):
        pid = product_id or product_id_from_interactive_id(interactive_id)
        if not pid:
            return None
        await _set_checkout(
            conversation_id,
            {"product_id": pid, "step": "delivery"},
        )
        return GiftAutomationResult(
            reply=_ask_delivery_reply(pid, is_sw=is_sw),
            safety_flag="deterministic:hazina_order_start",
        )

    return None


async def finalize_checkout_from_ai(
    db: AsyncSession,
    *,
    conversation_id: uuid.UUID,
    customer,
    business_id: uuid.UUID | None,
    msisdn: str,
    order_id: str | None,
    language: str | None,
) -> GiftAutomationResult | None:
    """After AI create_order, push STK on the same fast payment path."""
    if not order_id:
        return None
    from sqlalchemy import select

    from app.db.models import Order, PaymentStatus
    from app.services.cafe_automation import request_order_payment

    order = (
        await db.execute(select(Order).where(Order.id == uuid.UUID(str(order_id))))
    ).scalar_one_or_none()
    if order is None or order.payment_status != PaymentStatus.pending:
        return None
    if getattr(order, "mpesa_checkout_id", None):
        return None
    payment = await request_order_payment(
        db, order=order, msisdn=msisdn, business_id=business_id,
    )
    is_sw = (language or "").lower().startswith(("sw", "she"))
    if not payment.ok:
        return GiftAutomationResult(
            reply=(
                f"Sijaweza kutuma STK: {payment.message}"
                if is_sw else
                f"I could not send the M-Pesa prompt: {payment.message}"
            ),
            safety_flag="deterministic:hazina_ai_payment",
        )
    amount = int(float(order.amount or 0))
    from app.services.whatsapp_menus import order_actions_payload

    return GiftAutomationResult(
        reply=(
            f"Nimetuma STK ya KES {amount:,}. Weka PIN; nitathibitisha malipo."
            if is_sw else
            f"M-Pesa STK sent for KES {amount:,}. Enter your PIN and I'll confirm payment."
        ),
        interactive=order_actions_payload(language=language, business_slug=HAZINA_SLUG),
        safety_flag="deterministic:hazina_ai_stk",
    )
