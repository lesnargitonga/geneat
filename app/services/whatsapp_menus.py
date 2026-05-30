"""WhatsApp interactive menu helpers (Meta buttons/lists).

This is a presentation layer on top of the deterministic café automation:
- builds the main menu and category list payloads
- translates inbound interactive button/list IDs back into the plain-text
  commands the deterministic router already understands

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
ID_CATEGORY_PREFIX = "lp:cat:"

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
    "coffee": "Coffee",
    "breakfast": "Breakfast",
    "lunch": "Lunch",
    "pastry": "Pastries",
    "drink": "Drinks",
    "snack": "Snacks",
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
    """Translate one of our interactive ids into a deterministic text command.

    Returns None for ids we do not recognise so the caller can fall back to the
    plain title text and ordinary routing.
    """
    if not interactive_id:
        return None
    lid = interactive_id.lower()
    if lid == ID_MENU or lid == ID_ORDER:
        return "full menu"
    if lid == ID_PAY:
        return "resend STK"
    if lid == ID_TRACK:
        return "is my order ready?"
    if lid == ID_STAFF:
        return "__staff_handoff__"
    if lid.startswith(ID_CATEGORY_PREFIX):
        suffix = lid[len(ID_CATEGORY_PREFIX):]
        return _CATEGORY_COMMAND.get(suffix, suffix)
    return None


def main_menu_payload(*, business_name: str | None, language: str | None) -> dict:
    """A single list message that mirrors the greeting's offered actions."""
    is_sw = (language or "").lower().startswith(("sw", "she"))
    if is_sw:
        body = "Gusa chaguo hapa chini:"
        button_text = "Chagua"
        rows = [
            {"id": ID_ORDER, "title": "Weka oda", "description": "Anza oda ya chakula/kahawa"},
            {"id": ID_MENU, "title": "Ona menu", "description": "Bei na vyakula vyote"},
            {"id": ID_PAY, "title": "Lipa / STK", "description": "Tuma tena STK ya M-Pesa"},
            {"id": ID_TRACK, "title": "Hali ya oda", "description": "Iko tayari?"},
            {"id": ID_STAFF, "title": "Ongea na staff", "description": "Mhudumu akusaidie"},
        ]
    else:
        body = "Tap an option below:"
        button_text = "Choose"
        rows = [
            {"id": ID_ORDER, "title": "Order", "description": "Start a food/coffee order"},
            {"id": ID_MENU, "title": "See menu", "description": "Prices and all items"},
            {"id": ID_PAY, "title": "Pay / Resend STK", "description": "Re-send the M-Pesa prompt"},
            {"id": ID_TRACK, "title": "Track order", "description": "Is my order ready?"},
            {"id": ID_STAFF, "title": "Talk to staff", "description": "A person will help"},
        ]
    return {
        "type": "list",
        "body": body,
        "button_text": button_text,
        "sections": [{"title": "Menu", "rows": rows}],
    }


def category_list_payload(category_names: Sequence[str], *, language: str | None) -> dict | None:
    """Build a category drill-down list from known menu categories."""
    rows = []
    for name in category_names:
        label = _CATEGORY_LABEL.get(name)
        if not label:
            continue
        rows.append({"id": f"{ID_CATEGORY_PREFIX}{name}", "title": label, "description": f"See {label.lower()}"})
        if len(rows) >= 9:
            break
    if not rows:
        return None
    rows.append({"id": ID_MENU, "title": "Full menu", "description": "Everything we have"})
    is_sw = (language or "").lower().startswith(("sw", "she"))
    return {
        "type": "list",
        "body": "Chagua aina:" if is_sw else "Pick a category:",
        "button_text": "Chagua" if is_sw else "Choose",
        "sections": [{"title": "Categories" if not is_sw else "Aina", "rows": rows}],
    }


def order_actions_payload(*, language: str | None) -> dict:
    """Reply buttons offered after a pending order + STK is created."""
    is_sw = (language or "").lower().startswith(("sw", "she"))
    if is_sw:
        return {
            "type": "buttons",
            "body": "Ukimaliza malipo nitathibitisha. Unahitaji nini kingine?",
            "buttons": [
                {"id": ID_PAY, "title": "Tuma STK tena"},
                {"id": ID_TRACK, "title": "Hali ya oda"},
                {"id": ID_STAFF, "title": "Ongea na staff"},
            ],
        }
    return {
        "type": "buttons",
        "body": "I'll confirm once payment lands. Anything else?",
        "buttons": [
            {"id": ID_PAY, "title": "Resend STK"},
            {"id": ID_TRACK, "title": "Track order"},
            {"id": ID_STAFF, "title": "Talk to staff"},
        ],
    }
