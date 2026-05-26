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
