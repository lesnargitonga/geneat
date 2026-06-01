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
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.hazina_catalog import (
    HAZINA_COLLECTIONS,
    MIN_CUSTOM_ITEMS,
    PACKAGING_FEE_KES,
    PACKAGING_FEE_USD,
    hazina_treasure_by_sku,
)
from app.services.cafe_automation import (
    CafeOrderItem,
    create_order_and_request_payment,
    order_items_summary,
)
from app.services.whatsapp_menus import HAZINA_NOMADS_SLUG, ID_PRODUCT_PREFIX, product_list_payload

HAZINA_SLUG = HAZINA_NOMADS_SLUG

# Curated collections for menu taps (id → row).
HAZINA_PRODUCTS: dict[str, dict[str, Any]] = {
    row["id"]: {
        "name": row["name"],
        "sku": row["sku"],
        "price_kes": row["price_kes"],
        "price_usd": row["price_usd"],
        "lead_time_hours": row["lead_time_hours"],
        "jkia_only": bool(row.get("jkia_only")),
        "blurb": row["contents"] if isinstance(row.get("contents"), str) else row["name"],
        **({"personalization_note": row["personalization_note"]} if row.get("personalization_note") else {}),
    }
    for row in HAZINA_COLLECTIONS
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
_CUSTOM_BOX_INTRO_RE = re.compile(
    r"\b(custom gift box|build a custom|compose.*box|custom box)\b",
    re.IGNORECASE,
)
_CATALOG_RE = re.compile(
    r"\b(full menu|menu|catalogue|catalog|collections?|gift boxes?|what do you sell|"
    r"show (?:me )?(?:your )?(?:gifts|boxes|collections)|shop|browse)\b",
    re.IGNORECASE,
)
_PHOTO_RE = re.compile(r"\b(photo|picture|pic|image|picha|show me)\b", re.IGNORECASE)
_CHECKOUT_CANCEL_RE = re.compile(
    r"\b(cancel|stop|abort|sitisha)\b.{0,50}\b(checkout|order|payment|pay|malipo|oda)\b|"
    r"\b(checkout|order|payment|pay|malipo|oda)\b.{0,50}\b(cancel|stop|abort|sitisha)\b",
    re.IGNORECASE,
)
_CHECKOUT_STATUS_INTERRUPT_RE = re.compile(
    r"\b(resend|send again|retry|paid|nimepay|nimelipa|no stk|not received|haijafika)\b",
    re.IGNORECASE,
)
_SKU_LINE_RE = re.compile(r"\((HN-[A-Z0-9-]+)\)", re.IGNORECASE)
_SKU_QTY_LINE_RE = re.compile(
    r"^\s*(?:[•*-]\s*)?(?:(\d{1,2})\s*[x×]\s*)?.*?\((HN-[A-Z0-9-]+)\)",
    re.IGNORECASE | re.MULTILINE,
)
_USD_PAY_RE = re.compile(
    r"\b(usd|dollar|\$|card|visa|mastercard|apple pay|paystack|international)\b",
    re.IGNORECASE,
)
_KES_PAY_RE = re.compile(
    r"\b(kes|ksh|shilling|shillings|m-?pesa|stk|paybill|till)\b",
    re.IGNORECASE,
)
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


@dataclass(frozen=True)
class GiftAutomationResult:
    reply: str
    interactive: dict | None = None
    escalated: bool = False
    safety_flag: str = "deterministic:gift_automation"


@dataclass(frozen=True)
class ParsedCustomBox:
    items: list[CafeOrderItem]
    total_kes: float
    total_usd: float
    skus: list[str]


@dataclass(frozen=True)
class ParsedCheckoutDetails:
    delivery_type: str | None = None
    delivery_location: str | None = None
    delivery_window: str | None = None
    customer_name: str | None = None
    contact: str | None = None
    payment_currency: str | None = None
    quantity: int = 1


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
    if _PHOTO_RE.search(text or ""):
        return False
    return bool(_ORDER_RE.search(text or "")) or resolve_product_id(text) is not None


def looks_like_hazina_track(text: str) -> bool:
    return bool(_TRACK_RE.search(text or ""))


def looks_like_hazina_corporate(text: str) -> bool:
    return bool(_CORPORATE_RE.search(text or ""))


def looks_like_hazina_catalog_request(text: str) -> bool:
    return bool(_CATALOG_RE.search(text or ""))


def looks_like_checkout_cancel(text: str) -> bool:
    return bool(_CHECKOUT_CANCEL_RE.search(text or ""))


def should_pause_checkout_for_customer_request(text: str) -> bool:
    """Let informational/status turns escape a draft checkout state.

    A user can ask for a photo, menu, or payment status while a checkout is
    waiting for delivery details. Those turns must not be misread as hotel
    locations and accidentally start payment.
    """
    candidate = text or ""
    return bool(_PHOTO_RE.search(candidate) or _CHECKOUT_STATUS_INTERRUPT_RE.search(candidate))


def is_custom_box_handoff(text: str) -> bool:
    body = text or ""
    if _CUSTOM_BOX_INTRO_RE.search(body):
        return True
    return len(_SKU_LINE_RE.findall(body)) >= MIN_CUSTOM_ITEMS


def detect_payment_currency(text: str, *, checkout: dict | None = None) -> str:
    if checkout and checkout.get("payment_currency"):
        return str(checkout["payment_currency"]).upper()
    if _KES_PAY_RE.search(text or ""):
        return "KES"
    if _USD_PAY_RE.search(text or ""):
        return "USD"
    return "USD"


def _explicit_payment_currency(text: str | None) -> str | None:
    if _KES_PAY_RE.search(text or ""):
        return "KES"
    if _USD_PAY_RE.search(text or ""):
        return "USD"
    return None


def _price_label(*, usd: float | int, kes: float | int) -> str:
    return f"USD {int(usd):,} / KES {int(kes):,}"


def parse_custom_box_handoff(text: str) -> ParsedCustomBox | None:
    body = text or ""
    sku_qty_rows = _SKU_QTY_LINE_RE.findall(body)
    skus = [sku for _, sku in sku_qty_rows] or _SKU_LINE_RE.findall(body)
    if not skus and not _CUSTOM_BOX_INTRO_RE.search(body):
        return None

    items: list[CafeOrderItem] = []
    qty_by_sku: dict[str, int] = {}
    if sku_qty_rows:
        for qty_raw, sku in sku_qty_rows:
            qty = int(qty_raw or 1)
            sku_up = sku.upper()
            qty_by_sku[sku_up] = min(20, qty_by_sku.get(sku_up, 0) + max(1, qty))
    else:
        for sku in skus:
            sku_up = sku.upper()
            qty_by_sku[sku_up] = min(20, qty_by_sku.get(sku_up, 0) + 1)
    seen: set[str] = set()
    total_kes = 0.0
    total_usd = 0.0
    resolved_skus: list[str] = []

    for sku, qty in qty_by_sku.items():
        row = hazina_treasure_by_sku(sku)
        if row is None or row["sku"] in seen:
            continue
        seen.add(row["sku"])
        resolved_skus.append(row["sku"])
        items.append(
            CafeOrderItem(
                sku_or_name=f"{row['name']} ({row['sku']})",
                qty=qty,
                unit_price=float(row["price_kes"]),
            )
        )
        total_kes += float(row["price_kes"]) * qty
        total_usd += float(row["price_usd"]) * qty

    if re.search(r"premium packaging", body, re.IGNORECASE) and "HN-T-070" not in seen:
        packaging = hazina_treasure_by_sku("HN-T-070")
        if packaging:
            seen.add("HN-T-070")
            resolved_skus.append("HN-T-070")
            items.append(
                CafeOrderItem(
                    sku_or_name=f"{packaging['name']} ({packaging['sku']})",
                    qty=1,
                    unit_price=float(PACKAGING_FEE_KES),
                )
            )
            total_kes += float(PACKAGING_FEE_KES)
            total_usd += float(PACKAGING_FEE_USD)

    if len(items) < MIN_CUSTOM_ITEMS:
        return None
    return ParsedCustomBox(items=items, total_kes=total_kes, total_usd=total_usd, skus=resolved_skus)


def _structured_value(text: str, label: str) -> str | None:
    match = re.search(
        rf"^\s*{re.escape(label)}\s*:\s*(.+?)\s*$",
        text or "",
        re.IGNORECASE | re.MULTILINE,
    )
    if not match:
        return None
    value = match.group(1).strip()
    return value or None


def parse_checkout_details(text: str) -> ParsedCheckoutDetails:
    """Parse the structured handoff emitted by the Hazina website workflow."""
    body = text or ""
    payment_currency = detect_payment_currency(body)
    quantity = 1
    qty_match = re.search(
        r"^\s*Collection\s*:\s*(\d{1,2})\s*[x×]\s+",
        body,
        re.IGNORECASE | re.MULTILINE,
    )
    if qty_match:
        quantity = max(1, min(20, int(qty_match.group(1))))
    delivery_type = _structured_value(body, "Delivery type")
    delivery_location = _structured_value(body, "Delivery location")
    delivery_window = _structured_value(body, "Delivery window")
    customer_name = _structured_value(body, "Guest")
    contact = _structured_value(body, "Contact/payment detail")
    preferred_payment = _structured_value(body, "Preferred payment")
    if delivery_location is None:
        hotel_match = re.search(
            r"\b(?:hotel|suite|room|front desk|villa|camp|lodge)\b.{0,80}",
            body,
            re.IGNORECASE,
        )
        if hotel_match:
            delivery_location = hotel_match.group(0).strip(" .")
    if delivery_window is None:
        departure = _parse_departure_iso(body)
        if departure:
            delivery_window = departure
    if preferred_payment and _KES_PAY_RE.search(preferred_payment):
        payment_currency = "KES"
    elif preferred_payment and _USD_PAY_RE.search(preferred_payment):
        payment_currency = "USD"
    elif contact and _KES_PAY_RE.search(contact):
        payment_currency = "KES"
    elif contact and _USD_PAY_RE.search(contact):
        payment_currency = "USD"
    return ParsedCheckoutDetails(
        delivery_type=delivery_type,
        delivery_location=delivery_location,
        delivery_window=delivery_window,
        customer_name=customer_name,
        contact=contact,
        payment_currency=payment_currency,
        quantity=quantity,
    )


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
            f"*{name}* — {_price_label(usd=usd, kes=kes)}. {blurb}{extra} "
            f"Wakati wa kuandaa: saa {row['lead_time_hours']}. "
            "Niambie mahali pa kufikishia (hotel + chumba, au JKIA + terminal) ili tuendelee."
        )
    return (
        f"*{name}* — {_price_label(usd=usd, kes=kes)}. {blurb}{extra} "
        f"Lead time: {row['lead_time_hours']}h. "
            "Tell me your delivery spot (hotel + room, JKIA + terminal, or international address for a DHL quote) and I'll lock in your order."
    )


def _ask_delivery_reply(product_id: str, *, is_sw: bool) -> str:
    row = HAZINA_PRODUCTS[product_id]
    if is_sw:
        return (
            f"*{row['name']}* — {_price_label(usd=row['price_usd'], kes=row['price_kes'])}. "
            "Tutamaliza hatua kwa hatua. Kwanza, niweke jina gani kwa oda?"
        )
    return (
        f"*{row['name']}* — {_price_label(usd=row['price_usd'], kes=row['price_kes'])}. "
        "I will collect the details one at a time. First, what name should I put on the order?"
    )


def _ask_custom_delivery_reply(*, item_count: int, total_kes: float, total_usd: float, is_sw: bool) -> str:
    if is_sw:
        return (
            f"Sanduku lako la desturi ({item_count} vitu, {_price_label(usd=total_usd, kes=total_kes)}) — "
            "tutamaliza hatua kwa hatua. Kwanza, niweke jina gani kwa oda?"
        )
    return (
        f"Your custom box ({item_count} treasures, {_price_label(usd=total_usd, kes=total_kes)}) — "
        "we will finish checkout one step at a time. First, what name should I put on the order?"
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


def _catalog_reply(*, is_sw: bool) -> str:
    lines = [
        f"- {row['name']} — {_price_label(usd=row['price_usd'], kes=row['price_kes'])}"
        for row in HAZINA_PRODUCTS.values()
    ]
    if is_sw:
        return (
            "Hizi ndizo collection zetu kuu:\n"
            + "\n".join(lines)
            + "\n\nChagua moja hapa chini, au tuma custom box kutoka /build ukiwa na angalau vitu 2."
        )
    return (
        "These are our signature collections:\n"
        + "\n".join(lines)
        + "\n\nPick one below, or send a custom box from /build with at least 2 treasures."
    )


def _delivery_type_from_text(text: str | None, *, fallback: str | None = None) -> str | None:
    body = (text or "").lower()
    if "dhl" in body or "export" in body or "international" in body or "abroad" in body:
        return "DHL/export shipping quote"
    if "jkia" in body or "airport" in body or "terminal" in body or "flight" in body:
        return "JKIA terminal handoff"
    if "hotel" in body or "room" in body or "front desk" in body or "lodge" in body or "camp" in body:
        return "Hotel delivery"
    if fallback:
        low = fallback.lower()
        if "dhl" in low or "export" in low or "international" in low:
            return "DHL/export shipping quote"
        if "jkia" in low or "airport" in low or "terminal" in low:
            return "JKIA terminal handoff"
        if "hotel" in low or "room" in low or "front desk" in low:
            return "Hotel delivery"
    return None


def _checkout_next_step(checkout: dict) -> str | None:
    if len(str(checkout.get("customer_name") or "").strip()) < 2:
        return "name"
    if not _delivery_type_from_text(None, fallback=str(checkout.get("delivery_type") or "")):
        return "delivery_type"
    if len(str(checkout.get("delivery_location") or "").strip()) < 5:
        return "location"
    if len(str(checkout.get("delivery_window") or "").strip()) < 3:
        return "window"
    if str(checkout.get("payment_currency") or "").upper() not in {"USD", "KES"}:
        return "payment"
    contact = str(checkout.get("contact") or "").strip()
    if len(contact) < 5:
        return "contact"
    if str(checkout.get("payment_currency") or "").upper() == "KES":
        digits = re.sub(r"\D", "", contact)
        if len(digits) < 9:
            return "contact"
    return None


def _checkout_prompt(checkout: dict, *, is_sw: bool) -> str:
    step = str(checkout.get("step") or _checkout_next_step(checkout) or "confirm")
    if step == "name":
        return "Niweke jina gani kwa oda?" if is_sw else "What name should I put on the order?"
    if step == "delivery_type":
        return (
            "Utataka hotel delivery, JKIA handoff, au DHL/export?"
            if is_sw else
            "Should this be hotel delivery, JKIA handoff, or a DHL/export quote?"
        )
    if step == "location":
        dtype = _delivery_type_from_text(None, fallback=str(checkout.get("delivery_type") or ""))
        if dtype and "JKIA" in dtype:
            return (
                "Ni terminal gani ya JKIA au meeting point gani?"
                if is_sw else
                "Which JKIA terminal or airport meeting point should we use?"
            )
        if dtype and "DHL" in dtype:
            return (
                "Ni nchi, mji, na anwani gani ya DHL?"
                if is_sw else
                "Which country, city, and delivery address should we quote for DHL?"
            )
        return (
            "Ni hoteli gani, chumba, au front desk gani?"
            if is_sw else
            "Which hotel, room, or front desk name should we deliver to?"
        )
    if step == "window":
        dtype = _delivery_type_from_text(None, fallback=str(checkout.get("delivery_type") or ""))
        if dtype and "JKIA" in dtype:
            return (
                "Ndege inaondoka saa ngapi?"
                if is_sw else
                "What flight or departure time should we work around?"
            )
        if dtype and "DHL" in dtype:
            return (
                "Unahitaji parcel ifike au itumwe lini?"
                if is_sw else
                "When do you need the parcel delivered or dispatched?"
            )
        return "Unataka delivery lini?" if is_sw else "What delivery window works best?"
    if step == "payment":
        return "Utalipa kwa USD card link au KES M-Pesa?" if is_sw else "Would you like USD card link or KES M-Pesa?"
    if step == "contact":
        if str(checkout.get("payment_currency") or "").upper() == "KES":
            return "Ni nambari gani ya M-Pesa ipokee STK?" if is_sw else "Which M-Pesa phone number should receive the STK prompt?"
        return (
            "Ni email au WhatsApp number gani ipokee secure card link?"
            if is_sw else
            "Which email or WhatsApp number should receive the secure card checkout link?"
        )
    return "Thibitisha tuanze checkout." if is_sw else "Confirm and I will create the order."


async def _ask_next_checkout_step(conversation_id: uuid.UUID, checkout: dict, *, is_sw: bool) -> GiftAutomationResult:
    next_step = _checkout_next_step(checkout)
    if next_step is None:
        checkout["step"] = "confirm"
    else:
        checkout["step"] = next_step
    await _set_checkout(conversation_id, checkout)
    return GiftAutomationResult(
        reply=_checkout_prompt(checkout, is_sw=is_sw),
        safety_flag=f"deterministic:hazina_need_{checkout['step']}",
    )


def _payment_success_reply(
    *,
    summary: str,
    amount_kes: int,
    amount_usd: float,
    delivery_location: str,
    payment,
    is_sw: bool,
) -> str:
    if payment and payment.currency == "USD" and payment.redirect_url:
        if is_sw:
            return (
                f"Nimeandaa {summary} ({_price_label(usd=amount_usd, kes=amount_kes)}) kwa uwasilishaji: {delivery_location}. "
                f"Lipa hapa: {payment.redirect_url}"
            )
        return (
            f"I've set up {summary} at {_price_label(usd=amount_usd, kes=amount_kes)} for delivery to {delivery_location}. "
            f"Pay securely here: {payment.redirect_url}"
        )
    if is_sw:
        return (
            f"Nimeandaa {summary} ({_price_label(usd=amount_usd, kes=amount_kes)}) kwa uwasilishaji: {delivery_location}. "
            "Angalia STK kwa simu na weka PIN; nitathibitisha malipo yakifika."
        )
    return (
        f"I've set up {summary} at {_price_label(usd=amount_usd, kes=amount_kes)} for delivery to {delivery_location}. "
        "Check your phone for the M-Pesa STK prompt and enter your PIN — I'll confirm once payment lands."
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
    pay_cur = str(details.get("payment_currency") or "KES").upper()
    from app.services.order_tracking import ensure_order_tracking, tracking_link_line

    await ensure_order_tracking(db, order)
    track = tracking_link_line(order, is_sw=is_sw)

    if pay == PaymentStatus.paid.value:
        status_en = {
            "pending_payment": "paid — dispatch being scheduled",
            "out_for_delivery": "out for delivery",
            "delivered": "delivered",
        }.get(fulfillment, "paid — our team is preparing dispatch")
        if is_sw:
            base = f"{summary}{loc_bit}: malipo yamethibitishwa, hali — {status_en}."
        else:
            base = f"{summary}{loc_bit}: payment confirmed — {status_en}."
        return f"{base}\n\n{track}" if track else base
    if pay == PaymentStatus.pending.value:
        if pay_cur == "USD":
            amt = float(details.get("amount_usd") or 0)
            if is_sw:
                return f"{summary} ya USD {amt:.0f} bado inasubiri malipo. Andika 'resend link' kwa kiungo kipya."
            return f"{summary} at USD {amt:.0f} is awaiting payment. Type 'resend link' for a fresh checkout link."
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
    delivery_type: str | None,
    customer_name: str | None,
    is_sw: bool,
    quantity: int = 1,
    payment_currency: str = "USD",
    payment_email: str | None = None,
) -> GiftAutomationResult:
    row = HAZINA_PRODUCTS[product_id]
    quantity = max(1, min(20, int(quantity or 1)))
    items = [
        CafeOrderItem(
            sku_or_name=row["name"],
            qty=quantity,
            unit_price=float(row["price_kes"]),
        )
    ]
    notes_parts = [f"Gift concierge order — {row['sku']}"]
    if delivery_type:
        notes_parts.append(f"Delivery type: {delivery_type}")
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
        payment_currency=payment_currency,
        amount_usd=(float(row["price_usd"]) * quantity) if payment_currency == "USD" else None,
        payment_email=payment_email,
    )
    order = result.order
    details = dict(order.details or {})
    details["delivery_location"] = delivery_location
    if delivery_type:
        details["delivery_type"] = delivery_type
    if departure_note:
        details["departure_time_iso"] = departure_note
    details["product_id"] = product_id
    details["fulfillment_status"] = "pending_payment"
    order.details = details
    await db.flush()
    await _clear_checkout(conversation_id)

    if result.payment and not result.payment.ok:
        msg = (
            f"Sijaweza kuanzisha malipo: {result.payment.message}. Jaribu tena baada ya muda mfupi."
            if is_sw else
            f"I could not start payment yet: {result.payment.message}. Try again shortly."
        )
        return GiftAutomationResult(reply=msg, safety_flag="deterministic:hazina_payment_failed")

    from app.services.order_tracking import ensure_order_tracking, tracking_link_line
    from app.services.whatsapp_menus import order_actions_payload

    await ensure_order_tracking(db, order)
    reply = _payment_success_reply(
        summary=order_items_summary(items) or row["name"],
        amount_kes=int(float(row["price_kes"]) * quantity),
        amount_usd=float(row["price_usd"]) * quantity,
        delivery_location=delivery_location,
        payment=result.payment,
        is_sw=is_sw,
    )
    track = tracking_link_line(order, is_sw=is_sw)
    if track:
        reply = f"{reply}\n\n{track}"
    return GiftAutomationResult(
        reply=reply,
        interactive=order_actions_payload(language="sw" if is_sw else "en", business_slug=HAZINA_SLUG),
        safety_flag="deterministic:hazina_checkout",
    )


async def _finalize_custom_order(
    db: AsyncSession,
    *,
    customer_id: uuid.UUID,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    msisdn: str,
    parsed: ParsedCustomBox,
    delivery_location: str,
    departure_note: str | None,
    delivery_type: str | None,
    customer_name: str | None,
    is_sw: bool,
    payment_currency: str,
    payment_email: str | None,
) -> GiftAutomationResult:
    notes_parts = [f"Custom box — {', '.join(parsed.skus)}"]
    if delivery_type:
        notes_parts.append(f"Delivery type: {delivery_type}")
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
        items=parsed.items,
        delivery_notes=" | ".join(notes_parts),
        fast_path="hazina_custom_box",
        payment_currency=payment_currency,
        amount_usd=parsed.total_usd if payment_currency == "USD" else None,
        payment_email=payment_email,
    )
    order = result.order
    details = dict(order.details or {})
    details["delivery_location"] = delivery_location
    if delivery_type:
        details["delivery_type"] = delivery_type
    if departure_note:
        details["departure_time_iso"] = departure_note
    details["order_type"] = "custom_box"
    details["treasure_skus"] = parsed.skus
    details["fulfillment_status"] = "pending_payment"
    order.details = details
    await db.flush()
    await _clear_checkout(conversation_id)

    from app.services.order_tracking import ensure_order_tracking, tracking_link_line

    await ensure_order_tracking(db, order)
    summary = order_items_summary(parsed.items) or "your custom box"
    if result.payment and not result.payment.ok:
        msg = (
            f"Sijaweza kuanzisha malipo: {result.payment.message}."
            if is_sw else
            f"I could not start payment: {result.payment.message}."
        )
        return GiftAutomationResult(reply=msg, safety_flag="deterministic:hazina_custom_payment_failed")

    from app.services.whatsapp_menus import order_actions_payload

    reply = _payment_success_reply(
        summary=summary,
        amount_kes=int(parsed.total_kes),
        amount_usd=parsed.total_usd,
        delivery_location=delivery_location,
        payment=result.payment,
        is_sw=is_sw,
    )
    track = tracking_link_line(order, is_sw=is_sw)
    if track:
        reply = f"{reply}\n\n{track}"
    return GiftAutomationResult(
        reply=reply,
        interactive=order_actions_payload(language="sw" if is_sw else "en", business_slug=HAZINA_SLUG),
        safety_flag="deterministic:hazina_custom_checkout",
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
    payment_email = None
    email_match = _EMAIL_RE.search(text or "")
    if email_match:
        payment_email = email_match.group(0)

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

    if looks_like_hazina_catalog_request(text):
        if checkout:
            await _clear_checkout(conversation_id)
        return GiftAutomationResult(
            reply=_catalog_reply(is_sw=is_sw),
            interactive=product_list_payload(language=language),
            safety_flag="deterministic:hazina_catalog",
        )

    if checkout and looks_like_checkout_cancel(text):
        await _clear_checkout(conversation_id)
        return GiftAutomationResult(
            reply=(
                "Sawa, nimefuta checkout hiyo. Unaweza kuchagua collection au kujenga box mpya wakati wowote."
                if is_sw else
                "Done — I cancelled that draft checkout. You can choose a collection or build a new box whenever you are ready."
            ),
            safety_flag="deterministic:hazina_checkout_cancel",
        )

    if checkout and should_pause_checkout_for_customer_request(text):
        return None

    if checkout and checkout.get("step") in {
        "name",
        "delivery_type",
        "location",
        "window",
        "payment",
        "contact",
        "confirm",
    }:
        step = str(checkout.get("step") or "")
        value = (text or "").strip()
        if step == "name":
            if len(value) < 2:
                return GiftAutomationResult(
                    reply=_checkout_prompt(checkout, is_sw=is_sw),
                    safety_flag="deterministic:hazina_need_name",
                )
            checkout["customer_name"] = value
        elif step == "delivery_type":
            dtype = _delivery_type_from_text(value)
            if not dtype:
                return GiftAutomationResult(
                    reply=_checkout_prompt(checkout, is_sw=is_sw),
                    safety_flag="deterministic:hazina_need_delivery_type",
                )
            checkout["delivery_type"] = dtype
        elif step == "location":
            if len(value) < 5:
                return GiftAutomationResult(
                    reply=_checkout_prompt(checkout, is_sw=is_sw),
                    safety_flag="deterministic:hazina_need_location",
                )
            checkout["delivery_location"] = value
        elif step == "window":
            if len(value) < 3:
                return GiftAutomationResult(
                    reply=_checkout_prompt(checkout, is_sw=is_sw),
                    safety_flag="deterministic:hazina_need_window",
                )
            checkout["delivery_window"] = value
        elif step == "payment":
            pay_cur = _explicit_payment_currency(value)
            if pay_cur not in {"USD", "KES"}:
                return GiftAutomationResult(
                    reply=_checkout_prompt(checkout, is_sw=is_sw),
                    safety_flag="deterministic:hazina_need_payment",
                )
            checkout["payment_currency"] = pay_cur
        elif step == "contact":
            if len(value) < 5:
                return GiftAutomationResult(
                    reply=_checkout_prompt(checkout, is_sw=is_sw),
                    safety_flag="deterministic:hazina_need_contact",
                )
            if str(checkout.get("payment_currency") or "").upper() == "KES":
                digits = re.sub(r"\D", "", value)
                if len(digits) < 9:
                    return GiftAutomationResult(
                        reply=_checkout_prompt(checkout, is_sw=is_sw),
                        safety_flag="deterministic:hazina_need_contact",
                    )
            checkout["contact"] = value
        elif step == "confirm":
            if not re.search(r"\b(yes|confirm|go ahead|proceed|create|checkout|sawa|ndio)\b", value, re.I):
                checkout["step"] = "name"
                await _set_checkout(conversation_id, checkout)
                return GiftAutomationResult(
                    reply=(
                        "Sawa, tutapitia maelezo tena. " + _checkout_prompt(checkout, is_sw=is_sw)
                        if is_sw else
                        "No problem, we can correct the details. " + _checkout_prompt(checkout, is_sw=is_sw)
                    ),
                    safety_flag="deterministic:hazina_checkout_edit",
                )

            contact = str(checkout.get("contact") or "")
            email = (_EMAIL_RE.search(contact or "") or email_match)
            payment_email = email.group(0) if email else payment_email
            payment_currency = str(checkout.get("payment_currency") or "USD").upper()
            delivery_location = str(checkout.get("delivery_location") or "")
            departure_note = str(checkout.get("delivery_window") or "")
            delivery_type = str(checkout.get("delivery_type") or "")
            customer_name = str(checkout.get("customer_name") or getattr(customer, "name", None) or "")

            if checkout.get("order_type") == "custom_box":
                parsed_data = checkout.get("custom_box") or {}
                items = [
                    CafeOrderItem(
                        str(r.get("sku_or_name") or ""),
                        qty=int(r.get("qty") or 1),
                        unit_price=float(r.get("unit_price") or 0),
                    )
                    for r in (parsed_data.get("items") or [])
                    if isinstance(r, dict)
                ]
                if len(items) < MIN_CUSTOM_ITEMS:
                    await _clear_checkout(conversation_id)
                    return None
                parsed = ParsedCustomBox(
                    items=items,
                    total_kes=float(parsed_data.get("total_kes") or 0),
                    total_usd=float(parsed_data.get("total_usd") or 0),
                    skus=list(parsed_data.get("skus") or []),
                )
                return await _finalize_custom_order(
                    db,
                    customer_id=customer.id,
                    conversation_id=conversation_id,
                    business_id=business_id,
                    msisdn=customer.phone_number,
                    parsed=parsed,
                    delivery_location=delivery_location,
                    departure_note=departure_note,
                    delivery_type=delivery_type,
                    customer_name=customer_name,
                    is_sw=is_sw,
                    payment_currency=payment_currency,
                    payment_email=payment_email,
                )

            product_id = str(checkout.get("product_id") or "")
            if product_id not in HAZINA_PRODUCTS:
                await _clear_checkout(conversation_id)
                return None
            return await _finalize_order(
                db,
                customer_id=customer.id,
                conversation_id=conversation_id,
                business_id=business_id,
                msisdn=customer.phone_number,
                product_id=product_id,
                quantity=int(checkout.get("quantity") or 1),
                delivery_location=delivery_location,
                departure_note=departure_note,
                delivery_type=delivery_type,
                customer_name=customer_name,
                is_sw=is_sw,
                payment_currency=payment_currency,
                payment_email=payment_email,
            )

        next_step = _checkout_next_step(checkout)
        if next_step is None:
            checkout["step"] = "confirm"
            await _set_checkout(conversation_id, checkout)
            summary = (
                f"Thibitisha: {checkout.get('customer_name')} - {checkout.get('delivery_type')} - "
                f"{checkout.get('delivery_location')} - {checkout.get('delivery_window')} - "
                f"{checkout.get('payment_currency')}. Andika 'confirm' tuanze checkout."
                if is_sw else
                f"Please confirm: {checkout.get('customer_name')} - {checkout.get('delivery_type')} - "
                f"{checkout.get('delivery_location')} - {checkout.get('delivery_window')} - "
                f"{checkout.get('payment_currency')}. Reply 'confirm' and I will create the order."
            )
            return GiftAutomationResult(reply=summary, safety_flag="deterministic:hazina_checkout_confirm")
        checkout["step"] = next_step
        await _set_checkout(conversation_id, checkout)
        return GiftAutomationResult(
            reply=_checkout_prompt(checkout, is_sw=is_sw),
            safety_flag=f"deterministic:hazina_need_{next_step}",
        )

    if checkout and checkout.get("step") in {"delivery", "departure", "custom_delivery"}:
        if checkout.get("order_type") == "custom_box":
            location = (text or "").strip()
            if checkout.get("step") == "custom_delivery":
                if len(location) < 6:
                    return GiftAutomationResult(
                        reply=(
                            "Tafadhali niambie hoteli + chumba, JKIA + terminal, au nchi/anwani ya DHL."
                            if is_sw else
                            "Please share hotel + room, JKIA + terminal, or international address for DHL quote."
                        ),
                        safety_flag="deterministic:hazina_custom_need_location",
                    )
                departure = _parse_departure_iso(text) if _JKIA_RE.search(location) else None
                if _JKIA_RE.search(location) and not departure:
                    checkout["delivery_location"] = location
                    checkout["step"] = "departure"
                    await _set_checkout(conversation_id, checkout)
                    return GiftAutomationResult(
                        reply=(
                            "Asante. Niambie muda wa ndege yako inayotarajiwa kuondoka."
                            if is_sw else
                            "Got it. What time is your flight departing?"
                        ),
                        safety_flag="deterministic:hazina_custom_need_departure",
                    )
                if checkout.get("step") == "departure":
                    departure = _parse_departure_iso(text) or location
                    location = str(checkout.get("delivery_location") or location)
                parsed_data = checkout.get("custom_box") or {}
                items = [
                    CafeOrderItem(
                        str(r.get("sku_or_name") or ""),
                        qty=int(r.get("qty") or 1),
                        unit_price=float(r.get("unit_price") or 0),
                    )
                    for r in (parsed_data.get("items") or [])
                    if isinstance(r, dict)
                ]
                if len(items) < MIN_CUSTOM_ITEMS:
                    await _clear_checkout(conversation_id)
                    return None
                parsed = ParsedCustomBox(
                    items=items,
                    total_kes=float(parsed_data.get("total_kes") or 0),
                    total_usd=float(parsed_data.get("total_usd") or 0),
                    skus=list(parsed_data.get("skus") or []),
                )
                pay_cur = detect_payment_currency(text, checkout=checkout)
                return await _finalize_custom_order(
                    db,
                    customer_id=customer.id,
                    conversation_id=conversation_id,
                    business_id=business_id,
                    msisdn=customer.phone_number,
                    parsed=parsed,
                    delivery_location=location,
                    departure_note=departure,
                    delivery_type=str(checkout.get("delivery_type") or ""),
                    customer_name=getattr(customer, "name", None),
                    is_sw=is_sw,
                    payment_currency=pay_cur,
                    payment_email=payment_email,
                )

        product_id = str(checkout.get("product_id") or "")
        if product_id not in HAZINA_PRODUCTS:
            await _clear_checkout(conversation_id)
            return None
        location = (text or "").strip()
        if len(location) < 6:
            return GiftAutomationResult(
                reply=(
                    "Tafadhali niambie hoteli + chumba, JKIA + terminal, au nchi/anwani ya DHL."
                    if is_sw else
                    "Please share hotel + room, JKIA + terminal, or international address for DHL quote."
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
        pay_cur = detect_payment_currency(text, checkout=checkout)
        quantity = int(checkout.get("quantity") or 1)
        return await _finalize_order(
            db,
            customer_id=customer.id,
            conversation_id=conversation_id,
            business_id=business_id,
            msisdn=customer.phone_number,
            product_id=product_id,
            quantity=quantity,
            delivery_location=location,
            departure_note=departure,
            delivery_type=str(checkout.get("delivery_type") or ""),
            customer_name=getattr(customer, "name", None),
            is_sw=is_sw,
            payment_currency=pay_cur,
            payment_email=payment_email,
        )

    parsed_box = parse_custom_box_handoff(text)
    if parsed_box:
        checkout_details = parse_checkout_details(text)
        has_delivery = (
            checkout_details.delivery_location
            and len(checkout_details.delivery_location.strip()) >= 6
        )
        has_window = (
            checkout_details.delivery_window
            and len(checkout_details.delivery_window.strip()) >= 3
        )
        has_name = bool(checkout_details.customer_name and checkout_details.customer_name.strip())
        has_contact = bool(checkout_details.contact and checkout_details.contact.strip())
        if has_delivery and has_window and has_name and has_contact:
            return await _finalize_custom_order(
                db,
                customer_id=customer.id,
                conversation_id=conversation_id,
                business_id=business_id,
                msisdn=customer.phone_number,
                parsed=parsed_box,
                delivery_location=checkout_details.delivery_location.strip(),
                departure_note=checkout_details.delivery_window.strip(),
                delivery_type=checkout_details.delivery_type,
                customer_name=checkout_details.customer_name or getattr(customer, "name", None),
                is_sw=is_sw,
                payment_currency=checkout_details.payment_currency or detect_payment_currency(text),
                payment_email=payment_email,
            )
        draft_checkout = {
            "order_type": "custom_box",
            "custom_box": {
                "items": [i.to_order_dict() for i in parsed_box.items],
                "total_kes": parsed_box.total_kes,
                "total_usd": parsed_box.total_usd,
                "skus": parsed_box.skus,
            },
            "delivery_type": checkout_details.delivery_type,
            "delivery_location": checkout_details.delivery_location,
            "delivery_window": checkout_details.delivery_window,
            "customer_name": checkout_details.customer_name,
            "contact": checkout_details.contact,
            "payment_currency": _explicit_payment_currency(text),
        }
        intro = _ask_custom_delivery_reply(
            item_count=len(parsed_box.items),
            total_kes=parsed_box.total_kes,
            total_usd=parsed_box.total_usd,
            is_sw=is_sw,
        )
        next_step = _checkout_next_step(draft_checkout)
        draft_checkout["step"] = next_step or "confirm"
        await _set_checkout(conversation_id, draft_checkout)
        prompt = _checkout_prompt(draft_checkout, is_sw=is_sw)
        return GiftAutomationResult(
            reply=prompt if next_step != "name" else intro,
            safety_flag="deterministic:hazina_custom_start",
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
        checkout_details = parse_checkout_details(text)
        has_delivery = (
            checkout_details.delivery_location
            and len(checkout_details.delivery_location.strip()) >= 6
        )
        has_window = (
            checkout_details.delivery_window
            and len(checkout_details.delivery_window.strip()) >= 3
        )
        has_name = bool(checkout_details.customer_name and checkout_details.customer_name.strip())
        has_contact = bool(checkout_details.contact and checkout_details.contact.strip())
        if has_delivery and has_window and has_name and has_contact:
            return await _finalize_order(
                db,
                customer_id=customer.id,
                conversation_id=conversation_id,
                business_id=business_id,
                msisdn=customer.phone_number,
                product_id=pid,
                quantity=checkout_details.quantity,
                delivery_location=checkout_details.delivery_location.strip(),
                departure_note=checkout_details.delivery_window.strip(),
                delivery_type=checkout_details.delivery_type,
                customer_name=checkout_details.customer_name or getattr(customer, "name", None),
                is_sw=is_sw,
                payment_currency=checkout_details.payment_currency or detect_payment_currency(text),
                payment_email=payment_email,
            )
        draft_checkout = {
            "product_id": pid,
            "quantity": checkout_details.quantity,
            "delivery_type": checkout_details.delivery_type,
            "delivery_location": checkout_details.delivery_location,
            "delivery_window": checkout_details.delivery_window,
            "customer_name": checkout_details.customer_name,
            "contact": checkout_details.contact,
            "payment_currency": _explicit_payment_currency(text),
        }
        draft_checkout["step"] = _checkout_next_step(draft_checkout) or "confirm"
        await _set_checkout(conversation_id, draft_checkout)
        return GiftAutomationResult(
            reply=(
                _ask_delivery_reply(pid, is_sw=is_sw)
                if draft_checkout["step"] == "name"
                else _checkout_prompt(draft_checkout, is_sw=is_sw)
            ),
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
    """After AI create_order, push payment on the same fast payment path."""
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
    details = order.details if isinstance(order.details, dict) else {}
    pay_cur = str(details.get("payment_currency") or "KES").upper()
    payment = await request_order_payment(
        db, order=order, msisdn=msisdn, business_id=business_id, currency=pay_cur,
    )
    is_sw = (language or "").lower().startswith(("sw", "she"))
    if not payment.ok:
        return GiftAutomationResult(
            reply=(
                f"Sijaweza kuanzisha malipo: {payment.message}"
                if is_sw else
                f"I could not start payment: {payment.message}"
            ),
            safety_flag="deterministic:hazina_ai_payment",
        )
    from app.services.whatsapp_menus import order_actions_payload

    if pay_cur == "USD" and payment.redirect_url:
        amt = float(details.get("amount_usd") or 0)
        reply = (
            f"Kiungo cha malipo cha USD {amt:.0f}: {payment.redirect_url}"
            if is_sw else
            f"Paystack link for USD {amt:.0f}: {payment.redirect_url}"
        )
    else:
        amount = int(float(order.amount or 0))
        reply = (
            f"Nimetuma STK ya KES {amount:,}. Weka PIN; nitathibitisha malipo."
            if is_sw else
            f"M-Pesa STK sent for KES {amount:,}. Enter your PIN and I'll confirm payment."
        )
    return GiftAutomationResult(
        reply=reply,
        interactive=order_actions_payload(language=language, business_slug=HAZINA_SLUG),
        safety_flag="deterministic:hazina_ai_stk",
    )
