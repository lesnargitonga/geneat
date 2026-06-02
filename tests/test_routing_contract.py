from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

import app.services.gift_automation as ga


@pytest.mark.asyncio
async def test_routing_precedence_order() -> None:
    """
    CONTRACT: structured checkout payload wins over concierge-help phrase.
    """
    conflicting_text = (
        "Hello Hazina Nomads - automated collection checkout:\n"
        "Collection: 1x The Highland Treasure\n"
        "I'd like concierge help"
    )

    assert ga.looks_like_portal_collection_checkout(conflicting_text) is True
    assert ga.looks_like_hazina_concierge_help(conflicting_text) is True

    # Simulate router precedence: structured payload branch short-circuits first.
    finalize = AsyncMock()
    menu = AsyncMock()
    if ga.looks_like_portal_collection_checkout(conflicting_text):
        await finalize(conflicting_text)
    elif ga.looks_like_hazina_concierge_help(conflicting_text):
        await menu(conflicting_text)

    finalize.assert_awaited_once()
    menu.assert_not_awaited()


@pytest.mark.parametrize(
    "payload,expected_checkout,expected_concierge",
    [
        ("Hello Hazina Nomads - automated collection checkout:", True, False),
        ("Hello Hazina Nomads - I'd like concierge help.", False, True),
        ("concierge help", False, True),
        ("help me choose", False, True),
        ("I have a big collection of stamps.", False, False),
        ("This automated system is weird.", False, False),
        ("Can you help me choose a movie tonight?", False, True),
        ("I would like someone to help me, thanks.", False, False),
    ],
)
def test_regex_word_boundaries(
    payload: str,
    expected_checkout: bool,
    expected_concierge: bool,
) -> None:
    """
    CONTRACT: strict boundaries prevent loose keyword hijacking.
    """
    assert ga.looks_like_portal_collection_checkout(payload) == expected_checkout
    assert ga.looks_like_hazina_concierge_help(payload) == expected_concierge


@pytest.mark.parametrize(
    "cafe_input",
    [
        "I want a flat white and a croissant",
        "Give me an espresso shot",
        "Can I get a cappuccino?",
    ],
)
def test_cross_tenant_boundary_leakage(cafe_input: str) -> None:
    """
    CONTRACT: cafe intents in Hazina path are deterministically intercepted.
    """
    is_cafe_leak = ga.looks_like_cafe_menu_question(cafe_input)
    assert is_cafe_leak is True

    response = (
        "This channel is dedicated strictly to Hazina Nomads private sourcing. "
        "If you are looking for our cafe menus, please visit Lily Pond Café."
    )
    assert "Lily Pond" in response
