"""Hazina fast-path gate — cart recovery and menu payloads."""
from __future__ import annotations

import pytest

from app.services import whatsapp_menus as wm
from app.services.hazina_deterministic_gate import (
    _TOP_FUNNEL_GREETING_RE,
    _explicit_hazina_navigation,
)


def test_hz_cmd_ids_map_to_commands() -> None:
    assert wm.command_for_interactive_id("hz_cmd_send_stk") == wm.CMD_HAZINA_SEND_STK
    assert wm.command_for_interactive_id("hz_cmd_clear_cart") == wm.CMD_HAZINA_CLEAR_CART
    assert wm.command_for_interactive_id("hz_cmd_coastal") == wm.CMD_HAZINA_COASTAL
    assert wm.extract_interactive_id("Send STK [hz_cmd_send_stk]") == "hz_cmd_send_stk"


def test_cart_recovery_payload_buttons() -> None:
    payload = wm.hazina_cart_recovery_payload(cart_total_kes=32400, language="en")
    assert payload["type"] == "buttons"
    assert "32,400" in payload["body"]
    assert payload["buttons"][0]["id"] == wm.ID_HAZINA_SEND_STK
    assert payload["buttons"][1]["id"] == wm.ID_HAZINA_CLEAR_CART


def test_coastal_list_has_swahili_coast_rows() -> None:
    payload = wm.hazina_coastal_list_payload(language="en")
    assert payload["type"] == "list"
    rows = payload["sections"][0]["rows"]
    assert any("coastal" in (r.get("title") or "").lower() for r in rows)


def test_main_menu_includes_coastal_row() -> None:
    payload = wm.main_menu_payload(
        business_name="Hazina Nomads",
        language="en",
        business_slug="hazina-nomads",
    )
    rows = [r for sec in payload["sections"] for r in sec["rows"]]
    assert any(r["id"] == wm.ID_HAZINA_COASTAL for r in rows)


def test_greeting_regex() -> None:
    assert _TOP_FUNNEL_GREETING_RE.match("Hi")
    assert _TOP_FUNNEL_GREETING_RE.match("menu")
    assert not _TOP_FUNNEL_GREETING_RE.match("I want kenya edit please")


def test_home_not_explicit_when_pending_wall() -> None:
    assert not _explicit_hazina_navigation("hello", "lp:home")
