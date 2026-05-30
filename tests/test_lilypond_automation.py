from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.ai.rag import RetrievedChunk
from app.services.cafe_automation import (
    CafeOrderItem,
    order_items_summary,
    parse_cafe_order_items,
    stored_items_match,
)


LILY_CHUNKS = [
    RetrievedChunk(
        content=(
            "COFFEE - Espresso KES 120. Flat White / Cappuccino / Latte KES 220 "
            "(oat/almond +KES 40). Mocha KES 280.\n"
            "BREAKFAST - Avocado Toast on Sourdough KES 450 - add poached egg +KES 80. "
            "Mandazi & Masala Chai KES 230.\n"
            "LUNCH - Chicken Caesar Wrap KES 480. Halloumi & Avo Bowl KES 520.\n"
            "PASTRIES - Butter Croissant KES 180. Chocolate Brownie KES 200."
        ),
        source="menu",
        score=1.0,
    )
]


def test_parse_lily_food_order_with_polite_prefix() -> None:
    # "Caesar wrap please" must resolve deterministically so the fast path can
    # push the STK instead of dropping the turn to the slower LLM.
    items = parse_cafe_order_items("Okay, Caesar wrap please", LILY_CHUNKS)
    assert len(items) == 1
    assert items[0].sku_or_name == "Chicken Caesar Wrap"
    assert items[0].qty == 1
    assert items[0].unit_price == 480.0


def test_parse_lily_multi_item_order_with_modifiers() -> None:
    items = parse_cafe_order_items(
        "I want two flat whites with oat and a butter croissant, my name is Lesnar",
        LILY_CHUNKS,
    )

    assert [(item.sku_or_name, item.qty, item.unit_price, item.modifiers) for item in items] == [
        ("Flat White", 2, 260.0, ["oat milk"]),
        ("Butter Croissant", 1, 180.0, []),
    ]
    assert order_items_summary(items) == "2 x Flat White (oat milk), 1 x Butter Croissant"


def test_parse_lily_food_add_on() -> None:
    items = parse_cafe_order_items("Can I get avocado toast with poached egg", LILY_CHUNKS)

    assert len(items) == 1
    assert items[0] == CafeOrderItem(
        sku_or_name="Avocado Toast on Sourdough",
        qty=1,
        unit_price=530.0,
        modifiers=["poached egg"],
    )


def test_stored_items_match_understands_modifiers() -> None:
    items = [CafeOrderItem("Flat White", qty=1, unit_price=260, modifiers=["oat milk"])]

    assert stored_items_match(
        {"items": [{"sku_or_name": "Flat White", "qty": 1, "unit_price": 260, "modifiers": ["oat milk"]}]},
        items,
    )
    assert not stored_items_match(
        {"items": [{"sku_or_name": "Flat White", "qty": 1, "unit_price": 220}]},
        items,
    )


@pytest.mark.asyncio
async def test_demo_espresso_fast_path_uses_shared_payment_service(db, monkeypatch) -> None:
    from app.channels.base import _demo_espresso_fast_order_reply

    seen = {}

    async def fake_create_order_and_request_payment(*args, **kwargs):
        seen.update(kwargs)
        order = SimpleNamespace(
            amount=10,
            details={
                "items": [{"sku_or_name": "Demo Espresso", "qty": 1, "unit_price": 10.0}],
            },
        )
        return SimpleNamespace(
            order=order,
            created=True,
            payment=SimpleNamespace(ok=True, message="sent"),
            amount_kes=10,
        )

    monkeypatch.setattr("app.channels.base.create_order_and_request_payment", fake_create_order_and_request_payment)
    async def no_pending_order(*args, **kwargs):
        return None

    monkeypatch.setattr("app.channels.base._latest_pending_order_for_turn", no_pending_order)

    customer = SimpleNamespace(
        id=uuid.uuid4(),
        name=None,
        phone_number="+254700000001",
        preferred_language="en",
    )
    reply = await _demo_espresso_fast_order_reply(
        db,
        customer=customer,
        conversation_id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        text="Hi Lily Pond, I want the KES 10 demo espresso. My name is Lesnar.",
        language="en",
    )

    assert customer.name == "Lesnar"
    assert seen["fast_path"] == "demo_espresso"
    assert seen["items"] == [CafeOrderItem("Demo Espresso", qty=1, unit_price=10.0)]
    assert "sent a fresh STK" in reply


@pytest.mark.asyncio
async def test_demo_espresso_fast_path_gated_to_demo_tenant() -> None:
    # A real client tenant (slug != demo slug) must NOT auto-create a KES 10
    # "Demo Espresso" order even if a customer types the demo phrase.
    from app.channels.base import _demo_espresso_fast_order_reply

    reply = await _demo_espresso_fast_order_reply(
        None,  # db must not be touched on the gated-out path
        customer=SimpleNamespace(id=uuid.uuid4(), name="Lesnar", phone_number="+254700000001", preferred_language="en"),
        conversation_id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        text="Demo espresso",
        language="en",
        business_slug="pavilion-grill",
    )
    assert reply is None
