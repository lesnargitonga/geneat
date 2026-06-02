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
    assert wm.command_for_interactive_id("lp:staff") == wm.CMD_STAFF
    assert wm.command_for_interactive_id("lp:home") == wm.CMD_HOME
    assert wm.command_for_interactive_id("lp:back") == wm.CMD_HOME
    assert wm.command_for_interactive_id("lp:exit") == wm.CMD_EXIT
    assert wm.command_for_interactive_id("lp:orders") == wm.CMD_ORDERS
    assert wm.command_for_interactive_id("lp:cat:coffee") == "coffee"
    assert wm.command_for_interactive_id("lp:cat:pastry") == "pastries"
    assert wm.command_for_interactive_id(None) is None
    # Unknown non-category ids return None so the caller falls back to title text.
    assert wm.command_for_interactive_id("lp:unknown") is None
    # Category-prefixed ids we don't have a label for still pass through.
    assert wm.command_for_interactive_id("lp:cat:smoothie") == "smoothie"


def test_hazina_main_menu_payload() -> None:
    payload = wm.main_menu_payload(
        business_name="Hazina Nomads", language="en", business_slug="hazina-nomads",
    )
    assert payload["type"] == "list"
    row_ids = {
        row["id"]
        for section in payload["sections"]
        for row in section["rows"]
    }
    assert wm.ID_HAZINA_COLLECTIONS in row_ids
    assert wm.ID_HAZINA_BRIEF in row_ids
    assert wm.ID_CONCIERGE in row_ids
    assert wm.ID_TRACK in row_ids
    assert wm.ID_ORDER not in row_ids  # café-only action
    assert payload["button_text"] == "Concierge Services"


def test_cafe_main_menu_unchanged_without_slug() -> None:
    payload = wm.main_menu_payload(business_name="Lily Pond Cafe", language="en")
    rows = payload["sections"][0]["rows"]
    ids = {row["id"] for row in rows}
    assert wm.ID_ORDER in ids
    assert wm.ID_SHOP not in ids


def test_product_list_payload_has_five_boxes() -> None:
    payload = wm.product_list_payload(language="en")
    rows = payload["sections"][0]["rows"]
    prod_rows = [r for r in rows if r["id"].startswith(wm.ID_PRODUCT_PREFIX)]
    assert len(prod_rows) == 5
    assert wm.ID_HOME in {r["id"] for r in rows}


def test_command_for_hazina_interactive_ids() -> None:
    assert wm.command_for_interactive_id("lp:shop") == wm.CMD_HAZINA_COLLECTIONS
    assert wm.command_for_interactive_id(wm.ID_HAZINA_COLLECTIONS) == wm.CMD_HAZINA_COLLECTIONS
    assert wm.command_for_interactive_id(wm.ID_HAZINA_BRIEF) == wm.CMD_HAZINA_BRIEF
    assert wm.command_for_interactive_id("lp:corp") == "corporate gifting"
    assert wm.command_for_interactive_id("lp:concierge") == wm.CMD_STAFF
    assert wm.command_for_interactive_id("lp:prod:kenya-edit") == "order kenya edit"


def test_main_menu_payload_is_a_list_with_core_actions() -> None:
    payload = wm.main_menu_payload(business_name="Lily Pond Cafe", language="en")
    assert payload["type"] == "list"
    assert payload["header"] == "Lily Pond Cafe"
    rows = payload["sections"][0]["rows"]
    ids = {row["id"] for row in rows}
    assert {wm.ID_ORDER, wm.ID_MENU, wm.ID_PAY, wm.ID_TRACK, wm.ID_ORDERS, wm.ID_STAFF, wm.ID_EXIT} <= ids
    # Every row should carry an emoji prefix for the polished look.
    assert all(row["title"][0] not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" for row in rows)


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
    assert wm.ID_HOME in ids  # main-menu navigation row


def test_category_list_payload_empty_when_no_known_categories() -> None:
    assert wm.category_list_payload(["other", "misc"], language="en") is None


def test_order_actions_payload_offers_pay_track_home() -> None:
    payload = wm.order_actions_payload(language="en")
    assert payload["type"] == "buttons"
    assert len(payload["buttons"]) <= 3  # Meta caps reply buttons at 3
    ids = {b["id"] for b in payload["buttons"]}
    assert ids == {wm.ID_PAY, wm.ID_TRACK, wm.ID_HOME}


def test_back_to_menu_payload_offers_home_and_staff() -> None:
    payload = wm.back_to_menu_payload(language="en")
    assert payload["type"] == "buttons"
    ids = {b["id"] for b in payload["buttons"]}
    assert ids == {wm.ID_HOME, wm.ID_STAFF}


@pytest.mark.asyncio
async def test_webhook_send_interactive_uses_list(monkeypatch) -> None:
    from app.api import whatsapp as wa_api

    calls: list[tuple] = []

    class FakeChannel:
        async def send_reply_buttons(self, to, *, body, buttons):
            calls.append(("buttons", to, body, buttons))
            return {"ok": True}

        async def send_list_message(self, to, *, body, button_text, sections, header=None, footer=None):
            calls.append(("list", to, body, button_text, sections, header, footer))
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
