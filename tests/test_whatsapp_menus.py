from __future__ import annotations

import pytest

from app.services import whatsapp_menus as wm


def test_extract_and_strip_interactive_id() -> None:
    assert wm.extract_interactive_id("Order [lp:order]") == "lp:order"
    assert wm.extract_interactive_id("Coffee [lp:cat:coffee]") == "lp:cat:coffee"
    assert wm.extract_interactive_id("just text") is None
    assert wm.strip_interactive_id("Order [lp:order]") == "Order"
    assert wm.strip_interactive_id("plain") == "plain"


def test_command_for_interactive_id_maps_controls() -> None:
    assert wm.command_for_interactive_id("lp:menu") == "full menu"
    assert wm.command_for_interactive_id("lp:order") == "full menu"
    assert wm.command_for_interactive_id("lp:pay") == "resend STK"
    assert wm.command_for_interactive_id("lp:track") == "is my order ready?"
    assert wm.command_for_interactive_id("lp:staff") == "__staff_handoff__"
    assert wm.command_for_interactive_id("lp:cat:coffee") == "coffee"
    assert wm.command_for_interactive_id("lp:cat:pastry") == "pastries"
    assert wm.command_for_interactive_id(None) is None
    # Unknown non-category ids return None so the caller falls back to title text.
    assert wm.command_for_interactive_id("lp:unknown") is None
    # Category-prefixed ids we don't have a label for still pass through.
    assert wm.command_for_interactive_id("lp:cat:smoothie") == "smoothie"


def test_main_menu_payload_is_a_list_with_core_actions() -> None:
    payload = wm.main_menu_payload(business_name="Lily Pond Cafe", language="en")
    assert payload["type"] == "list"
    rows = payload["sections"][0]["rows"]
    ids = {row["id"] for row in rows}
    assert {wm.ID_ORDER, wm.ID_MENU, wm.ID_PAY, wm.ID_TRACK, wm.ID_STAFF} <= ids


def test_category_list_payload_filters_unknown_and_caps() -> None:
    payload = wm.category_list_payload(
        ["coffee", "breakfast", "other", "lunch"], language="en"
    )
    assert payload is not None
    rows = payload["sections"][0]["rows"]
    ids = [row["id"] for row in rows]
    assert "lp:cat:coffee" in ids
    assert "lp:cat:breakfast" in ids
    assert "lp:cat:other" not in ids  # unknown category dropped
    assert wm.ID_MENU in ids  # trailing full-menu shortcut


def test_category_list_payload_empty_when_no_known_categories() -> None:
    assert wm.category_list_payload(["other", "misc"], language="en") is None


def test_order_actions_payload_offers_pay_track_staff() -> None:
    payload = wm.order_actions_payload(language="en")
    assert payload["type"] == "buttons"
    ids = {b["id"] for b in payload["buttons"]}
    assert ids == {wm.ID_PAY, wm.ID_TRACK, wm.ID_STAFF}


@pytest.mark.asyncio
async def test_webhook_send_interactive_uses_list(monkeypatch) -> None:
    from app.api import whatsapp as wa_api

    calls: list[tuple] = []

    class FakeChannel:
        async def send_reply_buttons(self, to, *, body, buttons):
            calls.append(("buttons", to, body, buttons))
            return {"ok": True}

        async def send_list_message(self, to, *, body, button_text, sections):
            calls.append(("list", to, body, button_text, sections))
            return {"ok": True}

        async def send_text(self, to, text):
            calls.append(("text", to, text))
            return {"ok": True}

    payload = wm.main_menu_payload(business_name="Lily Pond", language="en")
    await wa_api._send_interactive("+254700000001", payload, FakeChannel())
    assert calls and calls[0][0] == "list"


@pytest.mark.asyncio
async def test_webhook_send_interactive_uses_buttons(monkeypatch) -> None:
    from app.api import whatsapp as wa_api

    calls: list[tuple] = []

    class FakeChannel:
        async def send_reply_buttons(self, to, *, body, buttons):
            calls.append(("buttons", to, body, buttons))
            return {"ok": True}

        async def send_text(self, to, text):
            calls.append(("text", to, text))
            return {"ok": True}

    payload = wm.order_actions_payload(language="en")
    await wa_api._send_interactive("+254700000001", payload, FakeChannel())
    assert calls and calls[0][0] == "buttons"
