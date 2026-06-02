"""Extra Hazina WhatsApp deterministic routes (order ref, vague intent, previews)."""
from __future__ import annotations

import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.gift_automation import (
    GiftAutomationResult,
    HAZINA_PRODUCTS,
    _product_detail_reply,
    _track_delivery_reply,
    looks_like_hazina_track,
)
from app.services.ops_automation import find_order_by_public_reference
from app.services.order_tracking import ensure_order_tracking, tracking_link_line
from app.services.whatsapp_menus import (
    ID_HAZINA_LOGISTICS,
    hazina_collection_buttons_payload,
    hazina_discovery_body,
    hazina_logistics_list_payload,
    hazina_track_prompt_body,
    main_menu_payload,
    product_id_from_hazina_interactive,
)

_HN_ORD_RE = re.compile(r"\b(HN-ORD-[A-Z0-9]{4,})\b", re.IGNORECASE)
_VAGUE_DISCOVERY_RE = re.compile(
    r"^\s*(?:gift|gifts|box|boxes|present|souvenir|souvenirs|help me|"
    r"i need|looking for|what do you have|options\??)\s*[!?.]*\s*$",
    re.IGNORECASE,
)
_THANKS_RE = re.compile(
    r"^\s*(?:thanks?|thank you|asante|thx|ok(?:ay)?|cool|perfect|great|sawa|poa)\s*[!?.]*\s*$",
    re.IGNORECASE,
)


def looks_like_hazina_order_reference(text: str) -> bool:
    return bool(_HN_ORD_RE.search(text or ""))


def extract_hazina_order_reference(text: str) -> str | None:
    match = _HN_ORD_RE.search(text or "")
    return match.group(1).upper() if match else None


def looks_like_hazina_vague_discovery(text: str) -> bool:
    return bool(_VAGUE_DISCOVERY_RE.match(text or ""))


def looks_like_hazina_thanks(text: str) -> bool:
    return bool(_THANKS_RE.match(text or ""))


async def try_track_by_public_reference(
    db: AsyncSession,
    *,
    customer_id: uuid.UUID,
    business_id: uuid.UUID | None,
    ref: str,
    is_sw: bool,
) -> GiftAutomationResult | None:
    order = await find_order_by_public_reference(db, ref.upper())
    if order is None or order.customer_id != customer_id:
        return GiftAutomationResult(
            reply=(
                f"Sioni oda {ref} kwenye akaunti yako. Hakikisha nambari ni sahihi, "
                "au chagua My Orders kutoka menu."
                if is_sw else
                f"I cannot find {ref} on your account. Double-check the reference, "
                "or choose My Orders from the concierge menu."
            ),
            safety_flag="deterministic:hazina_track_ref_miss",
        )
    details = order.details if isinstance(order.details, dict) else {}
    summary = str(details.get("public_reference") or ref)
    fulfillment = str(details.get("fulfillment_status") or "pending_payment")
    pay = order.payment_status.value
    await ensure_order_tracking(db, order)
    track = tracking_link_line(order, is_sw=is_sw)
    if is_sw:
        base = f"{summary}: malipo={pay}, hali={fulfillment}."
    else:
        base = f"{summary}: payment={pay}, fulfillment={fulfillment}."
    reply = f"{base}\n\n{track}" if track else base
    from app.services.whatsapp_menus import back_to_menu_payload

    return GiftAutomationResult(
        reply=reply,
        safety_flag="deterministic:hazina_track_ref",
        interactive=back_to_menu_payload(language="sw" if is_sw else "en", business_slug="hazina-nomads"),
    )


async def try_hazina_product_preview(
    *,
    interactive_id: str | None,
    language: str | None,
    business_slug: str | None,
) -> GiftAutomationResult | None:
    product_id = product_id_from_hazina_interactive(interactive_id)
    if not product_id or product_id not in HAZINA_PRODUCTS:
        return None
    is_sw = (language or "").lower().startswith(("sw", "she"))
    return GiftAutomationResult(
        reply=_product_detail_reply(product_id, is_sw=is_sw),
        interactive=hazina_collection_buttons_payload(product_id=product_id, language=language),
        safety_flag="deterministic:hazina_product_preview",
    )


async def try_hazina_router_extras(
    db: AsyncSession,
    *,
    text: str,
    interactive_id: str | None,
    customer_id: uuid.UUID,
    business_id: uuid.UUID | None,
    conversation_id: uuid.UUID,
    language: str | None,
    business_slug: str | None,
) -> GiftAutomationResult | None:
    is_sw = (language or "").lower().startswith(("sw", "she"))

    ref = extract_hazina_order_reference(text)
    if ref:
        return await try_track_by_public_reference(
            db,
            customer_id=customer_id,
            business_id=business_id,
            ref=ref,
            is_sw=is_sw,
        )

    if looks_like_hazina_thanks(text):
        return GiftAutomationResult(
            reply=(
                "Karibu sana. Niko hapa ukihitaji collection, brief, au ufuatiliaji wa oda."
                if is_sw else
                "You're welcome. I'm here whenever you need a collection, brief, or order update."
            ),
            interactive=main_menu_payload(
                business_name="Hazina Nomads",
                language=language,
                business_slug=business_slug,
            ),
            safety_flag="deterministic:hazina_thanks",
        )

    if looks_like_hazina_vague_discovery(text):
        return GiftAutomationResult(
            reply=hazina_discovery_body(language=language),
            interactive=main_menu_payload(
                business_name="Hazina Nomads",
                language=language,
                business_slug=business_slug,
            ),
            safety_flag="deterministic:hazina_discovery",
        )

    lid = (interactive_id or "").lower()
    if lid == ID_HAZINA_LOGISTICS:
        return GiftAutomationResult(
            reply=(
                "Chagua aina ya uwasilishaji:"
                if is_sw else
                "Select a delivery channel:"
            ),
            interactive=hazina_logistics_list_payload(language=language),
            safety_flag="deterministic:hazina_logistics_menu",
        )

    if looks_like_hazina_track(text) and not ref:
        track = await _track_delivery_reply(
            db,
            customer_id=customer_id,
            conversation_id=conversation_id,
            business_id=business_id,
            is_sw=is_sw,
        )
        if "don't have an order" in track.lower() or "bado sina oda" in track.lower():
            return GiftAutomationResult(
                reply=hazina_track_prompt_body(language=language),
                interactive=main_menu_payload(
                    business_name="Hazina Nomads",
                    language=language,
                    business_slug=business_slug,
                ),
                safety_flag="deterministic:hazina_track_prompt",
            )

    return None
