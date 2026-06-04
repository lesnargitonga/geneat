from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.ai.prompts import render_system_prompt
from app.services.business_service import BusinessProfile


def test_render_system_prompt_sanitizes_unsafe_branded_greeting() -> None:
    profile = BusinessProfile(
        id=uuid.uuid4(),
        slug="block-a-express",
        name="Block A Express",
        industry="campus-cafe",
        brand_voice="Fast cafe voice.",
        greeting_template="Hey, Block A here. Order in 10 sec, ready in 5.",
        profile={"avg_prep_minutes": 4, "pickup_only": True},
        vertical="restaurant",
    )

    prompt = render_system_prompt(
        profile,
        "2026-05-26",
        now_local=datetime(2026, 5, 26, 8, 0, tzinfo=timezone.utc),
    )

    assert "Order in 10 sec, ready in 5" not in prompt
    assert "I can help with the menu, prices, item photos, or an order." in prompt
    assert "quote only after payment is confirmed" in prompt


def test_render_system_prompt_hazina_loads_visual_sourcing_rules() -> None:
    profile = BusinessProfile(
        id=uuid.uuid4(),
        slug="hazina-nomads",
        name="Hazina Nomads",
        industry="gift-concierge",
        location="Nairobi, Kenya",
        brand_voice=(
            "Professional, calm, high-end hotel concierge. If a guest wants an "
            "unlisted piece with a reference photo, open a custom visual sourcing brief. "
            "Support seamless nationwide handoffs only after "
            "field feasibility is confirmed."
        ),
        profile={
            "vertical": "gift-concierge",
            "currency": "USD",
            "fulfillment_pillars": ["Bespoke Curation", "Seamless Logistics", "Global Export"],
            "fulfillment_capabilities": ["property handoff", "departure-sensitive handoff"],
        },
        vertical="gift-concierge",
    )

    prompt = render_system_prompt(
        profile,
        "2026-06-03",
        now_local=datetime(2026, 6, 3, 20, 0, tzinfo=timezone.utc),
    )

    assert "custom visual sourcing brief" in prompt
    assert "reference image" in prompt
    prompt_lc = prompt.lower()
    assert "do not claim the item is stocked" in prompt_lc or "do not imply it is stocked" in prompt_lc
    assert "seamless logistics" in prompt_lc
    assert "departure-sensitive" in prompt_lc or "departure meeting point" in prompt_lc
    assert "do not invent regional transit windows" in prompt_lc
    assert "not a café" in prompt_lc or "not a cafe" in prompt_lc
