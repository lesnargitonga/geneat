"""WhatsApp interactive menu helpers (Meta buttons/lists).

This is a presentation layer on top of the deterministic café automation:
- builds the main menu, category list, recent-orders and order-action payloads
- translates inbound interactive button/list IDs back into the plain-text
  commands (or special markers) the deterministic router already understands

Plain text remains the source of truth so Twilio and web chat keep working;
Meta WhatsApp additionally gets tappable buttons/lists when a payload is set.
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

# Special markers handled directly in handle_inbound (not plain-text commands).
CMD_STAFF = "__staff_handoff__"
CMD_HOME = "__main_menu__"
CMD_EXIT = "__exit__"
CMD_ORDERS = "__my_orders__"
SPECIAL_COMMANDS = {CMD_STAFF, CMD_HOME, CMD_EXIT, CMD_ORDERS}

_INTERACTIVE_ID_RE = re.compile(r"\[(lp:[a-z0-9:_-]+)\]\s*$", re.IGNORECASE)

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
    if lid in (ID_MENU, ID_ORDER):
        return "full menu"
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
    if lid.startswith(ID_CATEGORY_PREFIX):
        suffix = lid[len(ID_CATEGORY_PREFIX):]
        return _CATEGORY_COMMAND.get(suffix, suffix)
    return None


def _is_swahili(language: str | None) -> bool:
    return (language or "").lower().startswith(("sw", "she"))


def main_menu_payload(*, business_name: str | None, language: str | None) -> dict:
    """A single list message that mirrors the greeting's offered actions."""
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


def back_to_menu_payload(*, language: str | None) -> dict:
    """Compact buttons that let the customer jump back to the main menu/staff."""
    if _is_swahili(language):
        return {
            "type": "buttons",
            "body": "Unahitaji kingine?",
            "buttons": [
                {"id": ID_HOME, "title": "\U0001F3E0 Menu kuu"},
                {"id": ID_STAFF, "title": "\U0001F9D1\u200D\U0001F373 Ongea na staff"},
            ],
        }
    return {
        "type": "buttons",
        "body": "Anything else?",
        "buttons": [
            {"id": ID_HOME, "title": "\U0001F3E0 Main menu"},
            {"id": ID_STAFF, "title": "\U0001F9D1\u200D\U0001F373 Talk to staff"},
        ],
    }
