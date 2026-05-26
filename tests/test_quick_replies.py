from __future__ import annotations

import uuid

import pytest

from app.ai.quick_replies import (
    GENERIC_PHOTO_QUERY,
    availability_reply_from_chunks,
    example_item_labels_from_chunks,
    full_menu_reply_from_chunks,
    looks_like_full_menu_request,
    looks_like_photo_request,
    looks_like_availability_request,
    looks_like_hours_request,
    looks_like_recommendation_request,
    match_order_item_from_chunks,
    maybe_build_quick_reply,
    photo_item_query,
    price_reply_from_chunks,
    photo_clarification_reply_from_chunks,
    recommendation_reply_from_chunks,
)
from app.ai.rag import RetrievedChunk
from app.services.business_service import BusinessProfile


def test_recommendation_detector_catches_budget_and_menu_questions() -> None:
    assert looks_like_recommendation_request("What's good for breakfast under KES 300?")
    assert looks_like_recommendation_request("What do you have for pastries?")
    assert not looks_like_recommendation_request("How much is the demo espresso?")
    assert not looks_like_recommendation_request("show me a photo of the flat white")


def test_hours_detector_matches_opening_questions() -> None:
    assert looks_like_hours_request("What time do you open?")
    assert looks_like_hours_request("closing time today?")
    assert not looks_like_hours_request("How much is the latte?")


def test_generic_photo_request_requires_specific_item() -> None:
    assert photo_item_query("Yes please, send a picture") == GENERIC_PHOTO_QUERY
    assert photo_item_query("send me a pic of the flat white") != GENERIC_PHOTO_QUERY
    assert looks_like_photo_request("Got any pictures of the espresso?")
    assert not looks_like_photo_request("Can you send me the full menu please?")


def test_photo_clarification_uses_tenant_menu_examples() -> None:
    chunks = [
        RetrievedChunk(
            content="BURGERS - Pavilion Classic KES 580. Chicken Burger KES 520. Fries KES 180.",
            source="menu",
            score=0.9,
        )
    ]

    assert example_item_labels_from_chunks(chunks) == (
        "Pavilion Classic",
        "Chicken Burger",
        "Fries",
    )
    reply = photo_clarification_reply_from_chunks(chunks)
    assert "Pavilion Classic" in reply
    assert "Chicken Burger" in reply
    assert "Demo Espresso" not in reply


def test_full_menu_request_and_reply() -> None:
    chunks = [
        RetrievedChunk(
            content=(
                "LIVE DEMO - Demo Espresso KES 10.\n"
                "COFFEE - Flat White KES 250. Cappuccino KES 240.\n"
                "PASTRIES - Butter Croissant KES 180. Almond Croissant KES 250."
            ),
            source="menu",
            score=0.9,
        )
    ]

    assert looks_like_full_menu_request("I need the full menu, now!")
    assert looks_like_full_menu_request("That's not the menu")
    assert looks_like_full_menu_request("Thanks, what else do you sell at the cafe?")
    assert looks_like_full_menu_request("Lemme see the menu first")
    assert looks_like_full_menu_request("Do you sell anything else?")
    assert not looks_like_recommendation_request("Lemme see the menu first")
    assert not looks_like_availability_request("Do you sell anything else?")
    reply = full_menu_reply_from_chunks(chunks)
    assert reply is not None
    assert "Demo Espresso - KES 10" in reply
    assert "Flat White - KES 250" in reply
    assert "specific item" in reply


def test_availability_reply_handles_plural_item_questions() -> None:
    chunks = [
        RetrievedChunk(
            content=(
                "PASTRIES - Butter Croissant KES 180. "
                "Pain au Chocolat KES 220. Almond Croissant KES 250."
            ),
            source="menu",
            score=0.9,
        )
    ]

    assert looks_like_availability_request("Do you have croissants?")
    reply = availability_reply_from_chunks("Do you have croissants?", chunks)
    assert reply is not None
    assert "Butter Croissant - KES 180" in reply
    assert "Almond Croissant - KES 250" in reply


def test_availability_reply_handles_es_plural_item_questions() -> None:
    chunks = [
        RetrievedChunk(
            content=(
                "GRAB-AND-GO MEALS - Chicken Mayo Sandwich KES 280. "
                "Veggie Wrap KES 240. Tuna Crunch Baguette KES 320."
            ),
            source="menu",
            score=0.9,
        )
    ]

    reply = availability_reply_from_chunks("Do you have sandwiches?", chunks)

    assert reply is not None
    assert "Chicken Mayo Sandwich - KES 280" in reply


def test_availability_reply_skips_internal_demo_policy_segments() -> None:
    chunks = [
        RetrievedChunk(
            content=(
                "LIVE DEMO - Demo Espresso KES 10. This is the tiny proof item for "
                "WhatsApp order + M-Pesa STK demos during pitches. If a customer asks "
                "for '10 bob', treat it as Demo Espresso KES 10.\n"
                "COFFEE - Espresso KES 120 / Double KES 160."
            ),
            source="menu",
            score=1.0,
        )
    ]

    assert looks_like_availability_request("May I have espresso?")
    reply = availability_reply_from_chunks("May I have espresso?", chunks)

    assert reply is not None
    assert "Espresso - KES 120" in reply
    assert "Demo Espresso" not in reply
    assert "tiny proof item" not in reply


def test_availability_reply_recovers_from_customer_confusion_about_item() -> None:
    chunks = [
        RetrievedChunk(
            content="COFFEE - Espresso KES 120 / Double KES 160. Flat White KES 220.",
            source="menu",
            score=1.0,
        )
    ]

    assert looks_like_availability_request("You mean you don't know what an espresso is or you don't sell?")
    reply = availability_reply_from_chunks(
        "You mean you don't know what an espresso is or you don't sell?",
        chunks,
    )

    assert reply == "Yes — Espresso - KES 120. Want me to sort Espresso for you?"


def test_price_reply_from_chunks_handles_demo_espresso() -> None:
    chunks = [
        RetrievedChunk(
            content="LIVE DEMO - Demo Espresso KES 10. Use this for live demos.",
            source="menu",
            score=0.9,
        )
    ]
    assert price_reply_from_chunks("How much is the demo espresso?", chunks) == (
        "Demo Espresso is KES 10. Want me to set one up for pickup?"
    )


def test_price_reply_uses_base_price_before_add_on_price() -> None:
    reply = price_reply_from_chunks(
        "How much is the flat white?",
        [
            RetrievedChunk(
                content=(
                    "COFFEE - Espresso KES 120 / Double KES 160. "
                    "Macchiato/Cortado KES 170. "
                    "Flat White / Cappuccino / Latte KES 220 (oat/almond +KES 40)."
                ),
                source="menu",
                score=1.0,
            )
        ],
    )

    assert reply == "Flat White is KES 220. Want me to sort one for pickup?"


def test_plain_espresso_price_does_not_match_demo_espresso() -> None:
    reply = price_reply_from_chunks(
        "How much is the espresso?",
        [
            RetrievedChunk(
                content=(
                    "LIVE DEMO - Demo Espresso KES 10.\n"
                    "COFFEE - Espresso KES 120 / Double KES 160."
                ),
                source="menu",
                score=1.0,
            )
        ],
    )

    assert reply == "Espresso is KES 120. Want me to sort one for pickup?"


def test_simple_order_match_prefers_plain_item_over_demo_alias() -> None:
    match = match_order_item_from_chunks(
        "May I have the espresso?",
        [
            RetrievedChunk(
                content=(
                    "LIVE DEMO - Demo Espresso KES 10.\n"
                    "COFFEE - Espresso KES 120 / Double KES 160. Flat White KES 220."
                ),
                source="menu",
                score=1.0,
            )
        ],
    )

    assert match is not None
    assert match.label == "Espresso"
    assert match.unit_price == 120
    assert match.quantity == 1


def test_simple_order_match_handles_bare_item_fragment() -> None:
    match = match_order_item_from_chunks(
        "The espresso",
        [
            RetrievedChunk(
                content=(
                    "LIVE DEMO - Demo Espresso KES 10.\n"
                    "COFFEE - Espresso KES 120 / Double KES 160. Flat White KES 220."
                ),
                source="menu",
                score=1.0,
            )
        ],
    )

    assert match is not None
    assert match.label == "Espresso"
    assert match.unit_price == 120


def test_simple_order_match_parses_quantity_and_plural() -> None:
    match = match_order_item_from_chunks(
        "Can I get 2 flat whites please?",
        [
            RetrievedChunk(
                content="COFFEE - Espresso KES 120. Flat White KES 220.",
                source="menu",
                score=1.0,
            )
        ],
    )

    assert match is not None
    assert match.label == "Flat White"
    assert match.unit_price == 220
    assert match.quantity == 2


def test_simple_order_match_handles_es_plural() -> None:
    match = match_order_item_from_chunks(
        "Can I get two sandwiches?",
        [
            RetrievedChunk(
                content="GRAB-AND-GO - Chicken Mayo Sandwich KES 280. Veggie Wrap KES 240.",
                source="menu",
                score=1.0,
            )
        ],
    )

    assert match is not None
    assert match.label == "Chicken Mayo Sandwich"
    assert match.unit_price == 280
    assert match.quantity == 2


def test_recommendation_reply_from_chunks_respects_budget() -> None:
    chunks = [
        RetrievedChunk(
            content=(
                "BREAKFAST - Served 07:00-11:30.\n"
                "- Mandazi & Masala Chai KES 230 - three light mandazi + spiced milk tea.\n"
                "- Big Pond Plate KES 620 - two eggs, bacon, beans, toast.\n"
                "- Butter Croissant KES 180.\n"
            ),
            source="menu",
            score=0.9,
        )
    ]
    reply = recommendation_reply_from_chunks("What's good for breakfast under KES 300?", chunks)
    assert reply is not None
    assert "KES 230" in reply
    assert "KES 180" in reply
    assert "KES 620" not in reply


@pytest.mark.asyncio
async def test_maybe_build_quick_reply_uses_profile_hours(db, monkeypatch) -> None:
    profile = BusinessProfile(
        id=uuid.uuid4(),
        slug="lily-pond-cafe",
        name="Lily Pond Cafe",
        industry="campus-cafe",
        profile={"hours_summary": "Mon-Fri 07:00-21:00 | Sat 09:00-18:00 | Closed Sun"},
    )

    async def no_retrieve(*_args, **_kwargs):
        return []

    monkeypatch.setattr("app.ai.quick_replies.retrieve", no_retrieve)
    reply = await maybe_build_quick_reply(
        db,
        business_id=profile.id,
        profile=profile,
        text="What time do you open?",
    )

    assert reply == "We\u2019re open Mon-Fri 07:00-21:00 | Sat 09:00-18:00 | Closed Sun."


@pytest.mark.asyncio
async def test_maybe_build_full_menu_reply_does_not_embed_query(db, monkeypatch) -> None:
    async def fake_menu_chunks(*_args, **_kwargs):
        return [
            RetrievedChunk(
                content=(
                    "LIVE DEMO - Demo Espresso KES 10.\n"
                    "COFFEE - Flat White KES 250. Cappuccino KES 240.\n"
                    "PASTRIES - Butter Croissant KES 180."
                ),
                source="menu",
                score=1.0,
            )
        ]

    monkeypatch.setattr("app.ai.quick_replies.fetch_menu_chunks", fake_menu_chunks)
    monkeypatch.setattr(
        "app.ai.quick_replies.retrieve",
        lambda *a, **kw: (_ for _ in ()).throw(AssertionError("Full menu replies should not run vector retrieval")),
    )

    reply = await maybe_build_quick_reply(
        db,
        business_id=uuid.uuid4(),
        profile=None,
        text="I need the full menu, now!",
    )

    assert reply is not None
    assert "Demo Espresso - KES 10" in reply
    assert "Flat White - KES 250" in reply


def test_full_menu_reply_skips_policy_chunks_and_operator_instructions() -> None:
    reply = full_menu_reply_from_chunks([
        RetrievedChunk(
            content=(
                "DEMO ESPRESSO ORDER - Demo Espresso KES 10. "
                "If a customer asks for Demo Espresso, ask for or use their name."
            ),
            source="policies",
            score=1.0,
        ),
        RetrievedChunk(
            content=(
                "LIVE DEMO - Demo Espresso KES 10. "
                "If a customer asks for '10 bob', treat it as Demo Espresso KES 10.\n"
                "COFFEE - Flat White KES 250."
            ),
            source="menu",
            score=1.0,
        ),
    ])

    assert reply is not None
    assert "Demo Espresso - KES 10" in reply
    assert "Flat White - KES 250" in reply
    assert "If a customer asks" not in reply


@pytest.mark.asyncio
async def test_maybe_build_price_reply_uses_menu_fetch_before_vector(db, monkeypatch) -> None:
    async def fake_menu_chunks(*_args, **_kwargs):
        return [
            RetrievedChunk(
                content="COFFEE - Demo Espresso KES 10. Flat White KES 250.",
                source="menu",
                score=1.0,
            )
        ]

    monkeypatch.setattr("app.ai.quick_replies.fetch_menu_chunks", fake_menu_chunks)
    monkeypatch.setattr(
        "app.ai.quick_replies.retrieve",
        lambda *a, **kw: (_ for _ in ()).throw(AssertionError("Price replies should use menu rows first")),
    )

    reply = await maybe_build_quick_reply(
        db,
        business_id=uuid.uuid4(),
        profile=None,
        text="How much is the demo espresso?",
    )

    assert reply == "Demo Espresso is KES 10. Want me to set one up for pickup?"
