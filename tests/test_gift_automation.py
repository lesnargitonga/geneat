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
