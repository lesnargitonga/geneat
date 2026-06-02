from __future__ import annotations

import pytest

from app.services import whatsapp_menus as wm
from app.services.hazina_whatsapp_router import (
    extract_hazina_order_reference,
    looks_like_hazina_order_reference,
    looks_like_hazina_vague_discovery,
)


def test_order_reference_extract() -> None:
    assert looks_like_hazina_order_reference("status for HN-ORD-A1B2C3D4 please")
    assert extract_hazina_order_reference("HN-ORD-abc12345") == "HN-ORD-ABC12345"


def test_vague_discovery() -> None:
    assert looks_like_hazina_vague_discovery("gift")
    assert looks_like_hazina_vague_discovery("what do you have?")
    assert not looks_like_hazina_vague_discovery("order kenya edit")


def test_collection_buttons_payload() -> None:
    payload = wm.hazina_collection_buttons_payload(product_id="kenya-edit", language="en")
    assert payload["type"] == "buttons"
    assert len(payload["buttons"]) == 3
    assert payload["buttons"][0]["id"] == "lp:hazina:order:kenya-edit"


def test_product_list_preview_command() -> None:
    assert wm.command_for_interactive_id("lp:prod:kenya-edit") == wm.CMD_HAZINA_PRODUCT_PREVIEW
    assert wm.command_for_interactive_id("lp:hazina:order:kenya-edit") == "order kenya edit"
