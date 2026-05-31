from __future__ import annotations

import pytest

from app.services import gift_automation as ga


def test_resolve_product_id_from_text() -> None:
    assert ga.resolve_product_id("I want the Kenya Edit please") == "kenya-edit"
    assert ga.resolve_product_id("order departure drop") == "departure-drop"


def test_product_id_from_interactive() -> None:
    assert ga.product_id_from_interactive_id("lp:prod:highland-treasure") == "highland-treasure"
    assert ga.product_id_from_interactive_id("lp:prod:unknown") is None


def test_hazina_intent_detectors() -> None:
    assert ga.looks_like_hazina_order_intent("order kenya edit")
    assert ga.looks_like_hazina_track("track my delivery")
    assert ga.looks_like_hazina_corporate("corporate gifting for our team")


def test_is_hazina_slug() -> None:
    assert ga.is_hazina_slug("hazina-nomads")
    assert not ga.is_hazina_slug("lily-pond-cafe")


def test_parse_custom_box_handoff() -> None:
    msg = """Hello Hazina Nomads — I'd like to build a custom gift box:

• Premium Kenyan Coffee (HN-T-001)
• Maasai Beaded Bracelet (HN-T-010)
• Premium packaging & story card

Estimated total: KES 8,300 (~USD 64)"""
    parsed = ga.parse_custom_box_handoff(msg)
    assert parsed is not None
    assert len(parsed.items) == 3
    assert parsed.total_kes == 8300
    assert "HN-T-001" in parsed.skus
    assert "HN-T-070" in parsed.skus


def test_detect_payment_currency() -> None:
    assert ga.detect_payment_currency("pay with card please") == "USD"
    assert ga.detect_payment_currency("M-Pesa STK") == "KES"
    assert ga.detect_payment_currency("ok", checkout={"payment_currency": "USD"}) == "USD"


def test_is_custom_box_handoff() -> None:
    assert ga.is_custom_box_handoff("I'd like to build a custom gift box")
    assert ga.is_custom_box_handoff("• Coffee (HN-T-001)\n• Tea (HN-T-002)")
