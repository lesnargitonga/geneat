from __future__ import annotations

import uuid

import pytest

from app.ai.quick_replies import (
    GENERIC_PHOTO_QUERY,
    availability_reply_from_chunks,
    full_menu_reply_from_chunks,
    looks_like_full_menu_request,
    looks_like_availability_request,
    looks_like_hours_request,
    looks_like_recommendation_request,
    maybe_build_quick_reply,
    photo_item_query,
    price_reply_from_chunks,
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
