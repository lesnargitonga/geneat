"""Hazina client-facing fallbacks — deterministic rescue when AI/sanitizer fails."""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.hazina_catalog import HAZINA_COLLECTIONS, hazina_catalog_search_payload
from app.services.gift_automation import (
    GiftAutomationResult,
    _catalog_reply,
    looks_like_hazina_catalog_request,
    looks_like_hazina_concierge_help,
    looks_like_hazina_corporate,
    looks_like_hazina_track,
    try_hazina_automation,
)
from app.services.hazina_escalation import hazina_desk_reply, open_hazina_desk_issue
from app.services.whatsapp_menus import main_menu_payload, product_list_payload

_PRICE_NEGOTIATION_RE = re.compile(
    r"\b(?:negotiat(?:e|ion)?|discount|cheaper|lower\s+price|best\s+price|"
    r"wholesale|bulk\s+rate|price\s+match)\b",
    re.IGNORECASE,
)
_LEAKED_AI_MARKERS = (
    "brand positioning",
    "not a souvenir",
    "souvenir shop",
    "travel concierge",
    "system prompt",
    "knowledge_lookup",
    "search_catalog",
    "from the menu:",
    "create_order",
)


@dataclass(frozen=True)
class HazinaRescueResult:
    reply: str
    safety_flag: str
    interactive: dict | None = None
    escalated: bool = False


def hazina_ai_paused_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "Asante — nimepita oda yako kwa concierge wa timu. "
            "Mtaalam atajibu hapa hivi karibuni."
        )
    return (
        "Thank you — I've passed your brief to our concierge team. "
        "A specialist will reply on this thread shortly."
    )


def hazina_soft_retry_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "Samahani, hilo halijapita vizuri kwa mfumo wetu. Tafadhali tuma tena, "
            "au chagua collection hapa chini — nitakusaidia haraka."
        )
    return (
        "Sorry, that didn't process cleanly on our side. Please send it once more, "
        "or pick a collection below and I'll guide you through checkout."
    )


def hazina_sanitizer_recovery_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "Samahani, sikupata jibu safi. Ninaweza kusaidia na Bespoke Curation, "
            "Seamless Logistics, Global Export, au kufuatilia oda — ungependa nini?"
        )
    return (
        "Sorry, I didn't format that cleanly. I can help with Bespoke Curation, "
        "Seamless Logistics, Global Export, or order tracking — what would you like?"
    )


def looks_like_hazina_price_negotiation(text: str) -> bool:
    return bool(_PRICE_NEGOTIATION_RE.search(text or ""))


def looks_like_leaked_internal_copy(text: str) -> bool:
    lowered = (text or "").lower()
    return any(marker in lowered for marker in _LEAKED_AI_MARKERS)


async def try_hazina_price_negotiation_escalation(
    db: AsyncSession,
    *,
    text: str,
    customer_id: uuid.UUID,
    business_id: uuid.UUID | None,
    msisdn: str | None,
    is_sw: bool,
) -> HazinaRescueResult | None:
    if not looks_like_hazina_price_negotiation(text):
        return None
    await open_hazina_desk_issue(
        db,
        customer_id=customer_id,
        business_id=business_id,
        reason="price_negotiation",
        msisdn=msisdn,
    )
    return HazinaRescueResult(
        reply=hazina_desk_reply(is_sw=is_sw),
        safety_flag="deterministic:hazina_price_negotiation",
        escalated=True,
    )


async def try_hazina_catalog_keyword_fallback(text: str, *, is_sw: bool) -> str | None:
    """Match customer text against catalog names/SKUs without LLM."""
    hint = (text or "").strip().lower()
    if len(hint) < 3:
        return None
    hits: list[str] = []
    for row in HAZINA_COLLECTIONS:
        name = str(row.get("name") or "").lower()
        sku = str(row.get("sku") or "").lower()
        if hint in name or hint in sku or any(tok in name for tok in hint.split() if len(tok) >= 4):
            hits.append(
                f"{row['name']} ({row['sku']}) — "
                f"USD {row['price_usd']} / KES {row['price_kes']:,}"
            )
    if not hits:
        return None
    header = "Hii ndiyo inalingana na catalog yetu:\n" if is_sw else "From our current catalog:\n"
    suffix = (
        "\n\nChagua collection hapa chini au niambie unataka custom brief."
        if is_sw
        else "\n\nPick a collection below or tell me if you want a custom brief."
    )
    return header + "\n".join(f"- {line}" for line in hits[:4]) + suffix


async def try_hazina_ai_rescue(
    db: AsyncSession,
    *,
    text: str,
    interactive_id: str | None,
    business_slug: str | None,
    customer,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    language: str | None,
    escalated: bool,
) -> HazinaRescueResult | None:
    """Deterministic rescue after AI timeout/sanitizer failure (Hazina only)."""
    is_sw = (language or "").lower().startswith(("sw", "she")) or (
        (getattr(customer, "preferred_language", None) or "").lower().startswith(("sw", "she"))
    )

    negotiation = await try_hazina_price_negotiation_escalation(
        db,
        text=text,
        customer_id=customer.id,
        business_id=business_id,
        msisdn=getattr(customer, "phone_number", None),
        is_sw=is_sw,
    )
    if negotiation is not None:
        return negotiation

    automation: GiftAutomationResult | None = await try_hazina_automation(
        db,
        text=text,
        interactive_id=interactive_id,
        business_slug=business_slug,
        customer=customer,
        conversation_id=conversation_id,
        business_id=business_id,
        language=language,
    )
    if automation is not None:
        return HazinaRescueResult(
            reply=automation.reply,
            safety_flag=automation.safety_flag,
            interactive=automation.interactive,
            escalated=automation.escalated,
        )

    if looks_like_hazina_catalog_request(text) or looks_like_hazina_concierge_help(text):
        return HazinaRescueResult(
            reply=_catalog_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_rescue_catalog",
            interactive=product_list_payload(language=language),
        )

    if looks_like_hazina_track(text):
        from app.services.gift_automation import _track_delivery_reply
        from app.services.whatsapp_menus import back_to_menu_payload

        track = await _track_delivery_reply(
            db,
            customer_id=customer.id,
            conversation_id=conversation_id,
            business_id=business_id,
            is_sw=is_sw,
        )
        return HazinaRescueResult(
            reply=track,
            safety_flag="deterministic:hazina_rescue_track",
            interactive=back_to_menu_payload(language=language, business_slug=business_slug),
        )

    catalog_hint = await try_hazina_catalog_keyword_fallback(text, is_sw=is_sw)
    if catalog_hint:
        return HazinaRescueResult(
            reply=catalog_hint,
            safety_flag="deterministic:hazina_rescue_catalog_keyword",
            interactive=product_list_payload(language=language),
        )

    if escalated or looks_like_hazina_corporate(text):
        await open_hazina_desk_issue(
            db,
            customer_id=customer.id,
            business_id=business_id,
            reason="ai_failure_escalation" if escalated else "corporate_gifting",
            msisdn=getattr(customer, "phone_number", None),
        )
        return HazinaRescueResult(
            reply=hazina_desk_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_rescue_desk",
            escalated=True,
        )

    categories = hazina_catalog_search_payload().get("categories") or []
    cat_sample = ", ".join(str(c).replace("-", " ") for c in categories[:5])
    if is_sw:
        reply = (
            f"Nikusaidie kupata kipande sahihi. Tunajumuisha {cat_sample} na zaidi — "
            f"chagua collection hapa chini, au niambie mpokeaji, tukio, au bajeti."
        )
    else:
        reply = (
            f"Let me help you find the right piece. We cover {cat_sample} and more — "
            f"pick a collection below, or tell me the recipient, occasion, or budget."
        )
    return HazinaRescueResult(
        reply=reply,
        safety_flag="deterministic:hazina_rescue_soft",
        interactive=main_menu_payload(
            business_name="Hazina Nomads",
            language=language,
            business_slug=business_slug,
        ),
    )
