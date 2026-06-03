"""WhatsApp interactive menu helpers (Meta buttons/lists).

Presentation layer for deterministic automation:
- builds the main menu, category/product list, recent-orders and order-action payloads
- translates inbound interactive button/list IDs back into plain-text commands

Plain text remains the source of truth so Twilio and web chat keep working;
Meta WhatsApp additionally gets tappable buttons/lists when a payload is set.

Tenant-specific menus: pass ``business_slug`` (e.g. ``hazina-nomads``) to
``main_menu_payload``; café tenants keep the legacy food-order menu.
"""
from __future__ import annotations

import re
from typing import Sequence

# Stable IDs sent to Meta and echoed back on taps. Keep them short and prefixed
# so inbound routing can recognise our own controls unambiguously.
ID_MENU = "lp:menu"
ID_ORDER = "lp:order"
ID_PAY = "lp:pay"
ID_TRACK = "lp:track"
ID_STAFF = "lp:staff"
ID_ORDERS = "lp:orders"
ID_HOME = "lp:home"
ID_BACK = "lp:back"
ID_EXIT = "lp:exit"
ID_CATEGORY_PREFIX = "lp:cat:"
# Hazina Nomads gift-concierge menu ids
ID_SHOP = "lp:shop"
ID_CORPORATE = "lp:corp"
ID_CONCIERGE = "lp:concierge"
ID_HAZINA_COLLECTIONS = "lp:hazina:collections"
ID_HAZINA_BRIEF = "lp:hazina:brief"
ID_HAZINA_LOGISTICS = "lp:hazina:logistics"
ID_HAZINA_LOG_JKIA = "lp:hazina:log:jkia"
ID_HAZINA_LOG_DHL = "lp:hazina:log:dhl"
ID_HAZINA_LOG_HOTEL = "lp:hazina:log:hotel"
ID_HAZINA_ORDER_PREFIX = "lp:hazina:order:"
ID_HAZINA_PHOTO_PREFIX = "lp:hazina:photo:"
ID_PRODUCT_PREFIX = "lp:prod:"
# Hazina deterministic router (Meta + portal); also accepted as hz_cmd:* taps.
ID_HAZINA_SEND_STK = "hz_cmd_send_stk"
ID_HAZINA_CLEAR_CART = "hz_cmd_clear_cart"
ID_HAZINA_COASTAL = "hz_cmd_coastal"

HAZINA_NOMADS_SLUG = "hazina-nomads"

# Special markers handled directly in handle_inbound (not plain-text commands).
CMD_STAFF = "__staff_handoff__"
CMD_HOME = "__main_menu__"
CMD_EXIT = "__exit__"
CMD_ORDERS = "__my_orders__"
CMD_HAZINA_COLLECTIONS = "__hazina_collections__"
CMD_HAZINA_BRIEF = "__hazina_brief__"
CMD_HAZINA_LOGISTICS = "__hazina_logistics__"
CMD_HAZINA_PRODUCT_PREVIEW = "__hazina_product_preview__"
CMD_HAZINA_LOG_JKIA = "__hazina_log_jkia__"
CMD_HAZINA_LOG_DHL = "__hazina_log_dhl__"
CMD_HAZINA_LOG_HOTEL = "__hazina_log_hotel__"
CMD_HAZINA_SEND_STK = "__hazina_send_stk__"
CMD_HAZINA_CLEAR_CART = "__hazina_clear_cart__"
CMD_HAZINA_COASTAL = "__hazina_coastal__"
SPECIAL_COMMANDS = {
    CMD_STAFF,
    CMD_HOME,
    CMD_EXIT,
    CMD_ORDERS,
    CMD_HAZINA_COLLECTIONS,
    CMD_HAZINA_BRIEF,
    CMD_HAZINA_LOGISTICS,
    CMD_HAZINA_PRODUCT_PREVIEW,
    CMD_HAZINA_LOG_JKIA,
    CMD_HAZINA_LOG_DHL,
    CMD_HAZINA_LOG_HOTEL,
    CMD_HAZINA_SEND_STK,
    CMD_HAZINA_CLEAR_CART,
    CMD_HAZINA_COASTAL,
}

_INTERACTIVE_ID_RE = re.compile(
    r"\[((?:lp:[a-z0-9:_-]+)|(?:hz_cmd[a-z0-9_]+))\]\s*$",
    re.IGNORECASE,
)

# Map a category id suffix to the plain text the deterministic menu router
# already classifies (see app/ai/quick_replies.py category hints).
_CATEGORY_COMMAND = {
    "coffee": "coffee",
    "breakfast": "breakfast",
    "lunch": "lunch",
    "pastry": "pastries",
    "drink": "drinks",
    "snack": "snacks",
}

_CATEGORY_LABEL = {
    "coffee": ("\u2615", "Coffee"),
    "breakfast": ("\U0001F373", "Breakfast"),
    "lunch": ("\U0001F37D\uFE0F", "Lunch"),
    "pastry": ("\U0001F950", "Pastries"),
    "drink": ("\U0001F964", "Drinks"),
    "snack": ("\U0001F36A", "Snacks"),
}

# Hazina gift-box product ids (mirror seed_hazina_nomads.py).
_HAZINA_PRODUCTS = (
    ("kenya-edit", "\U0001F381", "The Kenya Edit", "USD 249 · safari keepsake"),
    ("highland-treasure", "\u2615", "Highland Treasure", "USD 199 · tea & honey"),
    ("nomad-leather-set", "\U0001F9F3", "Nomad Leather Set", "USD 329 · passport & tag"),
    ("safari-romance-box", "\U0001F48D", "Safari Romance Box", "USD 449 · couples"),
    ("departure-drop", "\u2708\uFE0F", "Departure Drop", "USD 349 · 4h JKIA"),
)


def _is_hazina(slug: str | None) -> bool:
    return (slug or "").strip().lower() == HAZINA_NOMADS_SLUG


def extract_interactive_id(text: str) -> str | None:
    """Return the trailing interactive id (e.g. ``lp:menu``) if present."""
    if not text:
        return None
    match = _INTERACTIVE_ID_RE.search(text)
    return match.group(1).lower() if match else None


def strip_interactive_id(text: str) -> str:
    """Remove a trailing ``[lp:...]`` marker, returning the visible title."""
    if not text:
        return ""
    return _INTERACTIVE_ID_RE.sub("", text).strip()


def command_for_interactive_id(interactive_id: str | None) -> str | None:
    """Translate one of our interactive ids into a deterministic command.

    Returns a plain-text command (routed like typed text), one of the
    ``CMD_*`` special markers (handled directly in handle_inbound), or None
    for ids we do not recognise so the caller can fall back to the title text.
    """
    if not interactive_id:
        return None
    lid = interactive_id.lower()
    if lid in (ID_MENU, ID_ORDER, ID_SHOP, ID_HAZINA_COLLECTIONS):
        return CMD_HAZINA_COLLECTIONS if lid in (ID_SHOP, ID_HAZINA_COLLECTIONS) else "full menu"
    if lid == ID_HAZINA_BRIEF:
        return CMD_HAZINA_BRIEF
    if lid == ID_CORPORATE:
        return "corporate gifting"
    if lid == ID_CONCIERGE:
        return CMD_STAFF
    if lid == ID_PAY:
        return "resend STK"
    if lid == ID_TRACK:
        return "is my order ready?"
    if lid == ID_STAFF:
        return CMD_STAFF
    if lid in (ID_HOME, ID_BACK):
        return CMD_HOME
    if lid == ID_EXIT:
        return CMD_EXIT
    if lid == ID_ORDERS:
        return CMD_ORDERS
    if lid.startswith(ID_HAZINA_ORDER_PREFIX):
        suffix = lid[len(ID_HAZINA_ORDER_PREFIX):]
        return f"order {suffix.replace('-', ' ')}"
    if lid.startswith(ID_HAZINA_PHOTO_PREFIX):
        suffix = lid[len(ID_HAZINA_PHOTO_PREFIX):]
        return f"photo {suffix.replace('-', ' ')}"
    if lid.startswith(ID_PRODUCT_PREFIX):
        return CMD_HAZINA_PRODUCT_PREVIEW
    if lid == ID_HAZINA_SEND_STK:
        return CMD_HAZINA_SEND_STK
    if lid == ID_HAZINA_CLEAR_CART:
        return CMD_HAZINA_CLEAR_CART
    if lid == ID_HAZINA_COASTAL:
        return CMD_HAZINA_COASTAL
    if lid == ID_HAZINA_LOGISTICS:
        return CMD_HAZINA_LOGISTICS
    if lid == ID_HAZINA_LOG_JKIA:
        return CMD_HAZINA_LOG_JKIA
    if lid == ID_HAZINA_LOG_DHL:
        return CMD_HAZINA_LOG_DHL
    if lid == ID_HAZINA_LOG_HOTEL:
        return CMD_HAZINA_LOG_HOTEL
    if lid.startswith(ID_CATEGORY_PREFIX):
        suffix = lid[len(ID_CATEGORY_PREFIX):]
        return _CATEGORY_COMMAND.get(suffix, suffix)
    return None


def _is_swahili(language: str | None) -> bool:
    return (language or "").lower().startswith(("sw", "she"))


def _cafe_main_menu_payload(*, business_name: str | None, language: str | None) -> dict:
    """Legacy café food-order main menu."""
    name = (business_name or "the cafe").replace("Caf\u00e9", "Cafe")
    if _is_swahili(language):
        rows = [
            {"id": ID_ORDER, "title": "\U0001F6D2 Weka oda", "description": "Anza oda ya chakula/kahawa"},
            {"id": ID_MENU, "title": "\U0001F4CB Ona menu", "description": "Bei na vyakula vyote"},
            {"id": ID_PAY, "title": "\U0001F4B3 Lipa / STK", "description": "Tuma tena STK ya M-Pesa"},
            {"id": ID_TRACK, "title": "\U0001F4E6 Hali ya oda", "description": "Iko tayari?"},
            {"id": ID_ORDERS, "title": "\U0001F9FE Oda zangu", "description": "Oda za hivi karibuni"},
            {"id": ID_STAFF, "title": "\U0001F9D1\u200D\U0001F373 Ongea na staff", "description": "Mhudumu akusaidie"},
            {"id": ID_EXIT, "title": "\u2716\uFE0F Toka", "description": "Maliza mazungumzo"},
        ]
        return {
            "type": "list",
            "header": name[:60],
            "body": "Gusa chaguo hapa chini:",
            "button_text": "Chagua",
            "sections": [{"title": "Menu", "rows": rows}],
        }
    rows = [
        {"id": ID_ORDER, "title": "\U0001F6D2 Order", "description": "Start a food/coffee order"},
        {"id": ID_MENU, "title": "\U0001F4CB See menu", "description": "Prices and all items"},
        {"id": ID_PAY, "title": "\U0001F4B3 Pay / Resend STK", "description": "Re-send the M-Pesa prompt"},
        {"id": ID_TRACK, "title": "\U0001F4E6 Track order", "description": "Is my order ready?"},
        {"id": ID_ORDERS, "title": "\U0001F9FE My orders", "description": "Recent orders & receipts"},
        {"id": ID_STAFF, "title": "\U0001F9D1\u200D\U0001F373 Talk to staff", "description": "A person will help"},
        {"id": ID_EXIT, "title": "\u2716\uFE0F Exit", "description": "End this chat"},
    ]
    return {
        "type": "list",
        "header": name[:60],
        "body": "Tap an option below:",
        "button_text": "Choose",
        "sections": [{"title": "Menu", "rows": rows}],
    }


def _hazina_main_menu_payload(*, business_name: str | None, language: str | None) -> dict:
    """Hazina top-of-funnel interactive list — zero-LLM router."""
    if _is_swahili(language):
        return {
            "type": "list",
            "header": "Hazina Private Sourcing"[:60],
            "body": (
                "Karibu Hazina Nomads. Tunatoa bespoke curation, seamless logistics, "
                "na global export kwa vipande vya premium vya Kenya. Chagua huduma:"
            ),
            "footer": "Gusa kitufe hapa chini kuchagua.",
            "button_text": "Huduma za Concierge",
            "sections": [
                {
                    "title": "Mkusanyiko Tayari",
                    "rows": [
                        {
                            "id": ID_HAZINA_COLLECTIONS,
                            "title": "Signature Collections",
                            "description": "Sanduku za zawadi za premium",
                        },
                        {
                            "id": ID_HAZINA_COASTAL,
                            "title": "Swahili Coast",
                            "description": "Lamu na vipande vya pwani",
                        },
                    ],
                },
                {
                    "title": "Huduma Maalum",
                    "rows": [
                        {
                            "id": ID_HAZINA_BRIEF,
                            "title": "Bespoke Curation",
                            "description": "Tengeneza brief ya kibinafsi",
                        },
                        {
                            "id": ID_CORPORATE,
                            "title": "Corporate Gifting",
                            "description": "Oda za timu na matukio",
                        },
                        {
                            "id": ID_HAZINA_LOGISTICS,
                            "title": "Seamless Logistics",
                            "description": "Nationwide handoff",
                        },
                    ],
                },
                {
                    "title": "Msaada wa Mteja",
                    "rows": [
                        {
                            "id": ID_TRACK,
                            "title": "Track Order",
                            "description": "Angalia hali ya uwasilishaji",
                        },
                        {
                            "id": ID_CONCIERGE,
                            "title": "Connect with Agent",
                            "description": "Ongea na timu yetu",
                        },
                        {
                            "id": ID_ORDERS,
                            "title": "My Orders",
                            "description": "Oda za hivi karibuni",
                        },
                    ],
                },
            ],
        }
    return {
        "type": "list",
        "header": "Hazina Private Sourcing",
        "body": (
            "Welcome to Hazina Nomads. We offer bespoke curation, seamless logistics, "
            "and global export for premium Kenyan heritage items. Would you like "
            "to view our signature collections, or initialize a private sourcing brief?"
        ),
        "footer": "Tap the button below to select an option.",
        "button_text": "Concierge Services",
        "sections": [
            {
                "title": "Ready-to-Ship Curations",
                "rows": [
                    {
                        "id": ID_HAZINA_COLLECTIONS,
                        "title": "Signature Collections",
                        "description": "Curated premium gift boxes",
                    },
                    {
                        "id": ID_HAZINA_COASTAL,
                        "title": "Swahili Coast",
                        "description": "Lamu & coastal artisan pieces",
                    },
                ],
            },
            {
                "title": "Bespoke Services",
                "rows": [
                    {
                        "id": ID_HAZINA_BRIEF,
                        "title": "Bespoke Curation",
                        "description": "Build a personalized brief",
                    },
                    {
                        "id": ID_CORPORATE,
                        "title": "Corporate Gifting",
                        "description": "Team & event commissions",
                    },
                    {
                        "id": ID_HAZINA_LOGISTICS,
                        "title": "Seamless Logistics",
                        "description": "Nationwide handoff",
                    },
                ],
            },
            {
                "title": "Client Support",
                "rows": [
                    {
                        "id": ID_TRACK,
                        "title": "Track Order",
                        "description": "Check delivery status",
                    },
                    {
                        "id": ID_CONCIERGE,
                        "title": "Connect with Agent",
                        "description": "Speak to our team directly",
                    },
                    {
                        "id": ID_ORDERS,
                        "title": "My Orders",
                        "description": "Recent orders & receipts",
                    },
                ],
            },
        ],
    }


def hazina_welcome_body(*, language: str | None) -> str:
    if _is_swahili(language):
        return (
            "Karibu Hazina Nomads. Tunatoa bespoke curation, seamless logistics, "
            "na global export kwa vipande vya premium vya Kenya."
        )
    return (
        "Welcome to Hazina Nomads. We offer bespoke curation, seamless logistics, "
        "and global export for premium Kenyan heritage items."
    )


def main_menu_payload(
    *,
    business_name: str | None,
    language: str | None,
    business_slug: str | None = None,
) -> dict:
    """Main menu list — tenant-aware (Hazina vs café default)."""
    if _is_hazina(business_slug):
        return _hazina_main_menu_payload(business_name=business_name, language=language)
    return _cafe_main_menu_payload(business_name=business_name, language=language)


def hazina_cart_recovery_payload(*, cart_total_kes: int, language: str | None) -> dict:
    """Button reply when a pending Hazina order blocks discovery — no raw STK dumps."""
    is_sw = _is_swahili(language)
    total = f"{int(cart_total_kes):,}"
    body = (
        f"Karibu tena. Una oda ya Hazina inayosubiri malipo (jumla: KES {total}).\n\n"
        "Nitume STK ya M-Pesa, au ufute oda uanze upya?"
        if is_sw else
        f"Welcome back. You have a pending Hazina collection ready for checkout (Total: KES {total}).\n\n"
        "Would you like me to send the M-Pesa prompt, or clear this order and start over?"
    )
    return {
        "type": "buttons",
        "body": body,
        "buttons": [
            {
                "id": ID_HAZINA_SEND_STK,
                "title": ("Tuma STK" if is_sw else "Send M-Pesa STK")[:20],
            },
            {
                "id": ID_HAZINA_CLEAR_CART,
                "title": ("Futa oda" if is_sw else "Clear order")[:20],
            },
        ],
    }


def hazina_coastal_list_payload(*, language: str | None) -> dict:
    """Swahili Coast artisan treasures — deterministic list, no LLM."""
    from app.catalog.hazina_catalog import HAZINA_TREASURES

    is_sw = _is_swahili(language)
    rows = []
    for row in HAZINA_TREASURES:
        if str(row.get("category") or "") != "swahili-coast":
            continue
        title = str(row["name"])[:24]
        desc = f"USD {row['price_usd']} · KES {int(row['price_kes']):,}"[:72]
        rows.append({
            "id": f"{ID_PRODUCT_PREFIX}{row['id']}",
            "title": title,
            "description": desc,
        })
        if len(rows) >= 9:
            break
    rows.append({
        "id": ID_HAZINA_COLLECTIONS,
        "title": ("\U0001F381 Collections" if not is_sw else "\U0001F381 Mkusanyiko")[:24],
        "description": ("Gift boxes" if not is_sw else "Sanduku za zawadi")[:72],
    })
    rows.append({
        "id": ID_HOME,
        "title": ("\U0001F3E0 Main menu" if not is_sw else "\U0001F3E0 Menu kuu")[:24],
        "description": ("Concierge home" if not is_sw else "Huduma za concierge")[:72],
    })
    return {
        "type": "list",
        "header": ("Swahili Coast" if not is_sw else "Pwani ya Kiswahili")[:60],
        "body": (
            "Chagua kipande cha ufundi kutoka pwani:"
            if is_sw else
            "Select a coastal artisan piece:"
        ),
        "button_text": ("Chagua" if is_sw else "Choose"),
        "sections": [{"title": ("Vipande" if is_sw else "Pieces"), "rows": rows}],
    }


def product_list_payload(*, language: str | None) -> dict:
    """Hazina signature collections list — prices from catalog source of truth."""
    from app.catalog.hazina_catalog import HAZINA_COLLECTIONS

    is_sw = _is_swahili(language)
    emoji_by_id = {pid: emoji for pid, emoji, _, _ in _HAZINA_PRODUCTS}

    rows = []
    for row in HAZINA_COLLECTIONS:
        pid = str(row["id"])
        emoji = emoji_by_id.get(pid, "\U0001F381")
        title = str(row["name"])
        desc = f"USD {row['price_usd']} · KES {int(row['price_kes']):,}"
        if row.get("jkia_only"):
            desc = (desc + " · JKIA 4h")[:72]
        rows.append({
            "id": f"{ID_PRODUCT_PREFIX}{pid}",
            "title": f"{emoji} {title}"[:24],
            "description": desc[:72],
        })
    rows.append({
        "id": ID_HOME,
        "title": ("\U0001F3E0 Menu kuu" if is_sw else "\U0001F3E0 Main menu"),
        "description": ("Rudi mwanzo" if is_sw else "Back to start"),
    })
    return {
        "type": "list",
        "header": ("Signature Collections" if not is_sw else "Mkusanyiko Maalum")[:60],
        "body": ("Chagua sanduku la zawadi:" if is_sw else "Select a curated gift box:"),
        "button_text": ("Chagua" if is_sw else "Choose"),
        "sections": [{"title": ("Sanduku" if is_sw else "Gift boxes"), "rows": rows}],
    }


def hazina_logistics_list_payload(*, language: str | None) -> dict:
    is_sw = _is_swahili(language)
    rows = [
        {
            "id": ID_HAZINA_LOG_HOTEL,
            "title": ("\U0001F3E8 Local handoff" if not is_sw else "\U0001F3E8 Local handoff")[:24],
            "description": ("Hotels, villas, residences" if not is_sw else "Hoteli, villa, residence")[:72],
        },
        {
            "id": ID_HAZINA_LOG_JKIA,
            "title": ("\u2708\uFE0F Departure handoff" if not is_sw else "\u2708\uFE0F Departure handoff")[:24],
            "description": ("JKIA terminal timing" if not is_sw else "JKIA na muda wa ndege")[:72],
        },
        {
            "id": ID_HAZINA_LOG_DHL,
            "title": ("\U0001F4E6 Global export" if not is_sw else "\U0001F4E6 Global export")[:24],
            "description": ("DHL/insured courier quote" if not is_sw else "DHL/insured courier")[:72],
        },
        {
            "id": ID_HOME,
            "title": ("\U0001F3E0 Main menu" if not is_sw else "\U0001F3E0 Menu kuu")[:24],
            "description": ("Back to concierge services" if not is_sw else "Rudi huduma za concierge")[:72],
        },
    ]
    return {
        "type": "list",
        "header": ("Seamless Logistics" if not is_sw else "Seamless Logistics")[:60],
        "body": (
            "Chagua fulfillment pillar:"
            if is_sw else
            "Choose the fulfillment pillar for this order:"
        ),
        "button_text": ("Chagua" if is_sw else "Choose"),
        "sections": [{"title": ("Uwasilishaji" if is_sw else "Delivery"), "rows": rows}],
    }


def hazina_collection_buttons_payload(*, product_id: str, language: str | None) -> dict:
    """Reply buttons after a collection is selected from the list."""
    from app.catalog.hazina_catalog import hazina_collection_by_id

    row = hazina_collection_by_id(product_id) or {}
    name = str(row.get("name") or product_id.replace("-", " ").title())[:40]
    is_sw = _is_swahili(language)
    return {
        "type": "buttons",
        "body": (
            f"Ungependa kuendelea na {name}?"
            if is_sw else
            f"How would you like to proceed with {name}?"
        ),
        "buttons": [
            {
                "id": f"{ID_HAZINA_ORDER_PREFIX}{product_id}",
                "title": ("\U0001F6D2 Start brief" if not is_sw else "\U0001F6D2 Anza brief")[:20],
            },
            {
                "id": f"{ID_HAZINA_PHOTO_PREFIX}{product_id}",
                "title": ("\U0001F4F7 Photo" if not is_sw else "\U0001F4F7 Picha")[:20],
            },
            {
                "id": ID_HAZINA_COLLECTIONS,
                "title": ("\U0001F381 Collections" if not is_sw else "\U0001F381 Mkusanyiko")[:20],
            },
        ],
    }


def hazina_track_prompt_body(*, language: str | None) -> str:
    if _is_swahili(language):
        return (
            "Tafadhali tuma nambari yako ya oda (mfano HN-ORD-A1B2C3D4), "
            "au chagua *My Orders* kutoka menu kuu."
        )
    return (
        "Please send your Hazina order reference (e.g. HN-ORD-A1B2C3D4), "
        "or choose *My Orders* from the main concierge menu."
    )


def hazina_discovery_body(*, language: str | None) -> str:
    if _is_swahili(language):
        return (
            "Ninaweza kukusaidia kuchagua collection, kuanza brief ya custom, "
            "kufuatilia oda, au kuunganisha na concierge. Chagua chaguo hapa chini."
        )
    return (
        "I can help you browse collections, start a custom brief, track an order, "
        "or connect you with a concierge. Choose an option below."
    )


def product_id_from_hazina_interactive(interactive_id: str | None) -> str | None:
    if not interactive_id:
        return None
    lid = interactive_id.lower()
    for prefix in (ID_PRODUCT_PREFIX, ID_HAZINA_ORDER_PREFIX, ID_HAZINA_PHOTO_PREFIX):
        if lid.startswith(prefix):
            return lid[len(prefix):].strip() or None
    return None


def hazina_brief_portal_reply(*, language: str | None, portal_url: str) -> str:
    url = (portal_url or "https://hazina.lesnarai.co.ke").rstrip("/")
    build_url = f"{url}/build"
    if _is_swahili(language):
        return (
            f"Ili kuanza brief ya custom sourcing, tumia portal yetu salama:\n{build_url}\n\n"
            "Ukimaliza, nitakusaidia kukamilisha checkout hapa."
        )
    return (
        f"To begin a custom sourcing brief, use our secure portal:\n{build_url}\n\n"
        "Once you submit it here, I will guide you through checkout."
    )


def category_list_payload(category_names: Sequence[str], *, language: str | None) -> dict | None:
    """Build a category drill-down list from known menu categories."""
    is_sw = _is_swahili(language)
    rows = []
    for name in category_names:
        label = _CATEGORY_LABEL.get(name)
        if not label:
            continue
        emoji, text = label
        desc = (f"Ona {text.lower()}" if is_sw else f"See {text.lower()}")
        rows.append({"id": f"{ID_CATEGORY_PREFIX}{name}", "title": f"{emoji} {text}", "description": desc})
        if len(rows) >= 8:
            break
    if not rows:
        return None
    rows.append({
        "id": ID_MENU,
        "title": ("\U0001F4CB Menu kamili" if is_sw else "\U0001F4CB Full menu"),
        "description": ("Vyakula vyote" if is_sw else "Everything we have"),
    })
    rows.append({
        "id": ID_HOME,
        "title": ("\U0001F3E0 Menu kuu" if is_sw else "\U0001F3E0 Main menu"),
        "description": ("Rudi mwanzo" if is_sw else "Back to start"),
    })
    return {
        "type": "list",
        "header": ("Aina za Menu" if is_sw else "Our Menu"),
        "body": ("Chagua aina:" if is_sw else "Pick a category:"),
        "button_text": ("Chagua" if is_sw else "Choose"),
        "sections": [{"title": ("Aina" if is_sw else "Categories"), "rows": rows}],
    }


def order_actions_payload(*, language: str | None) -> dict:
    """Reply buttons offered after a pending order + STK is created."""
    if _is_swahili(language):
        return {
            "type": "buttons",
            "body": "Ukimaliza malipo nitathibitisha. Unahitaji nini kingine?",
            "buttons": [
                {"id": ID_PAY, "title": "\U0001F4B3 Tuma STK"},
                {"id": ID_TRACK, "title": "\U0001F4E6 Hali ya oda"},
                {"id": ID_HOME, "title": "\U0001F3E0 Menu kuu"},
            ],
        }
    return {
        "type": "buttons",
        "body": "I'll confirm once payment lands. Anything else?",
        "buttons": [
            {"id": ID_PAY, "title": "\U0001F4B3 Resend STK"},
            {"id": ID_TRACK, "title": "\U0001F4E6 Track order"},
            {"id": ID_HOME, "title": "\U0001F3E0 Main menu"},
        ],
    }


def back_to_menu_payload(*, language: str | None, business_slug: str | None = None) -> dict:
    """Compact buttons that let the customer jump back to the main menu/staff."""
    staff_label = (
        "\U0001F9D1\u200D\U0001F4BC Concierge"
        if _is_hazina(business_slug)
        else "\U0001F9D1\u200D\U0001F373 Talk to staff"
    )
    if _is_swahili(language):
        staff_sw = (
            "\U0001F9D1\u200D\U0001F4BC Concierge"
            if _is_hazina(business_slug)
            else "\U0001F9D1\u200D\U0001F373 Ongea na staff"
        )
        return {
            "type": "buttons",
            "body": "Unahitaji kingine?",
            "buttons": [
                {"id": ID_HOME, "title": "\U0001F3E0 Menu kuu"},
                {"id": ID_STAFF, "title": staff_sw},
            ],
        }
    return {
        "type": "buttons",
        "body": "Anything else?",
        "buttons": [
            {"id": ID_HOME, "title": "\U0001F3E0 Main menu"},
            {"id": ID_STAFF, "title": staff_label},
        ],
    }
