from __future__ import annotations

from types import SimpleNamespace
import uuid

import pytest

from app.catalog.hazina_catalog import ENGRAVING_FEE_KES, ENGRAVING_SKU
from app.services import gift_automation as ga


def test_resolve_product_id_from_text() -> None:
    assert ga.resolve_product_id("I want the Kenya Edit please") == "kenya-edit"
    assert ga.resolve_product_id("order departure drop") == "departure-drop"


def test_product_id_from_interactive() -> None:
    assert ga.product_id_from_interactive_id("lp:prod:highland-treasure") == "highland-treasure"
    assert ga.product_id_from_interactive_id("lp:prod:unknown") is None


def test_hazina_intent_detectors() -> None:
    assert ga.looks_like_hazina_order_intent("order kenya edit")
    assert not ga.looks_like_hazina_order_intent("send me a picture of The Kenya Edit")
    assert ga.looks_like_hazina_track("track my delivery")
    assert ga.looks_like_hazina_corporate("corporate gifting for our team")
    assert ga.looks_like_hazina_concierge_help("Hello Hazina Nomads - I'd like concierge help.")
    assert ga.looks_like_hazina_logistics_question("do you ship abroad?") == "dhl"
    assert ga.looks_like_hazina_logistics_question("can you deliver to JKIA Terminal 1A?") == "jkia"
    assert ga.looks_like_hazina_logistics_question("I want the Departure Drop") is None
    assert ga.looks_like_hazina_catalog_request("what do you sell?")
    assert ga.looks_like_hazina_catalog_request("show me your gift boxes")
    assert ga.looks_like_cafe_menu_question("do you sell croissants?")
    assert ga.looks_like_cafe_menu_question("can I get a flat white?")
    # Coffee/tea GIFTS are core Hazina products — these must reach the AI concierge,
    # not the "we're not a cafe" boundary.
    assert not ga.looks_like_cafe_menu_question(
        "what Kenyan coffee gift do you recommend under $80?"
    )
    assert not ga.looks_like_cafe_menu_question("send a coffee gift box to my client")
    assert ga.should_pause_checkout_for_customer_request("send me a picture of The Kenya Edit")
    assert ga.should_pause_checkout_for_customer_request("no stk yet")
    assert ga.looks_like_checkout_cancel("cancel this checkout please")
    assert not ga.should_pause_checkout_for_customer_request("Villa Rosa room 412 today 7 pm")


def test_checkout_back_edit_cancel_navigation() -> None:
    # Step-back ordering
    assert ga._checkout_prev_step("location") == "delivery_type"
    assert ga._checkout_prev_step("name") == "name"
    assert ga._checkout_prev_step("confirm") == "contact"

    # Edit a named field mid-flow
    assert ga._checkout_edit_target("change the address") == "location"
    assert ga._checkout_edit_target("edit my name") == "name"
    assert ga._checkout_edit_target("wrong payment currency") == "payment"
    assert ga._checkout_edit_target("change phone number") == "contact"
    # A plain answer is not an edit command
    assert ga._checkout_edit_target("Karen estate, Nairobi") is None

    # Bare back intent (anchored so it never eats a real answer)
    assert ga._CHECKOUT_BACK_RE.match("back")
    assert ga._CHECKOUT_BACK_RE.match("go back")
    assert ga._CHECKOUT_BACK_RE.match("previous")
    assert not ga._CHECKOUT_BACK_RE.match("back gate, Karen")

    # Widened cancel: a bare cancel/restart now counts (only consulted mid-checkout)
    assert ga.looks_like_checkout_cancel("cancel")
    assert ga.looks_like_checkout_cancel("start over")
    assert ga.looks_like_checkout_cancel("never mind")
    assert ga.looks_like_checkout_cancel("cancel this checkout please")
    assert not ga.looks_like_checkout_cancel("Karen estate, Nairobi")


def test_is_hazina_slug() -> None:
    assert ga.is_hazina_slug("hazina-nomads")
    assert not ga.is_hazina_slug("lily-pond-cafe")


def test_parse_custom_box_handoff() -> None:
    msg = """Hello Hazina Nomads — I'd like to build a custom gift box:

• Premium Kenyan Coffee (HN-T-001)
• Maasai Beaded Bracelet (HN-T-010)
• Premium packaging & story card

Estimated total: USD 125 / KES 16,300"""
    parsed = ga.parse_custom_box_handoff(msg)
    assert parsed is not None
    assert len(parsed.items) == 3
    assert parsed.total_kes == 16300
    assert "HN-T-001" in parsed.skus
    assert "HN-T-070" in parsed.skus


def test_parse_custom_box_handoff_monograms_and_bespoke() -> None:
    msg = """Hello Hazina Nomads — private sourcing brief:

• Leather Passport Holder (HN-T-020) — Monogram: J.K.
• Lamu Carved Wood Keepsake Box (HN-T-071) — Monogram: Amina
• Maasai Beaded Bracelet (HN-T-010)

Bespoke requests:
I am looking for a specific type of green malachite stone.

Estimated total: USD 200 / KES 26,000"""
    parsed = ga.parse_custom_box_handoff(msg)
    assert parsed is not None
    assert parsed.bespoke_request == "I am looking for a specific type of green malachite stone."
    assert parsed.engravings == ("J.K.", "Amina")
    # 95 + 65 + 45 treasure subtotal + 2 × USD 15 engraving
    assert parsed.total_usd == 235
    assert parsed.total_kes == 30550
    engraving = next(item for item in parsed.items if ENGRAVING_SKU in item.sku_or_name)
    assert engraving.qty == 2
    assert engraving.unit_price == ENGRAVING_FEE_KES


def test_engraving_order_line_item_dict() -> None:
    row = ga._hazina_item_to_order_dict(ga._engraving_cafe_item(2))
    assert row["id"] == ENGRAVING_SKU
    assert row["name"] == "Bespoke Engraving Service"
    assert row["quantity"] == 2
    assert row["unit_price"] == 15
    assert row["currency"] == "USD"


def test_parse_custom_box_handoff_keeps_quantities() -> None:
    msg = """Hello Hazina Nomads — automated custom gift box checkout:

• 2× Premium Kenyan Coffee (HN-T-001)
• Maasai Beaded Bracelet (HN-T-010)

Estimated total: USD 115 / KES 15,100"""
    parsed = ga.parse_custom_box_handoff(msg)
    assert parsed is not None
    coffee = next(item for item in parsed.items if "HN-T-001" in item.sku_or_name)
    bracelet = next(item for item in parsed.items if "HN-T-010" in item.sku_or_name)
    assert coffee.qty == 2
    assert bracelet.qty == 1
    assert parsed.total_kes == 15100


def test_parse_checkout_details_from_website_handoff() -> None:
    msg = """Hello Hazina Nomads — automated custom gift box checkout:

• Premium Kenyan Coffee (HN-T-001)
• Maasai Beaded Bracelet (HN-T-010)
• Premium packaging & story card

Estimated total: USD 125 / KES 16,300
Guest: Amina
Delivery type: Hotel delivery
Delivery location: Villa Rosa Kempinski room 412
Delivery window: Today 7:30 pm
Contact/payment detail: amina@example.com
Preferred payment: USD card link

Please create the order, confirm availability, and start payment."""
    details = ga.parse_checkout_details(msg)
    assert details.customer_name == "Amina"
    assert details.delivery_type == "Hotel delivery"
    assert details.delivery_location == "Villa Rosa Kempinski room 412"
    assert details.delivery_window == "Today 7:30 pm"
    assert details.payment_currency == "USD"
    assert details.quantity == 1


def test_portal_collection_checkout_not_catalog_request() -> None:
    msg = """Hello Hazina Nomads - automated collection checkout:

Collection: 1x The Highland Treasure (highland-treasure)
Estimated total: USD 199 / KES 25,900
Guest: lesnar
Delivery type: Hotel delivery
Delivery location: sarova
Delivery window: 1200
Contact/payment detail: +254712345678
Preferred payment: KES M-Pesa STK

Please create the order, confirm availability, and start payment."""
    assert ga.looks_like_portal_collection_checkout(msg)
    assert not ga.looks_like_hazina_catalog_request(msg)


def test_parse_collection_checkout_quantity() -> None:
    msg = """Hello Hazina Nomads - automated collection checkout:

Collection: 3x The Kenya Edit (HN-KE-001)
Guest: Amina
Delivery type: Hotel delivery
Delivery location: Villa Rosa Kempinski room 412
Delivery window: Today 7:30 pm
Preferred payment: KES M-Pesa STK"""
    details = ga.parse_checkout_details(msg)
    assert details.quantity == 3
    assert details.payment_currency == "KES"


def test_detect_payment_currency() -> None:
    assert ga.detect_payment_currency("pay with card please") == "USD"
    assert ga.detect_payment_currency("M-Pesa STK") == "KES"
    assert ga.detect_payment_currency("deliver to Villa Rosa room 412") == "USD"
    assert ga.detect_payment_currency("ok", checkout={"payment_currency": "USD"}) == "USD"


def test_hazina_checkout_step_sequence_collects_details_one_at_a_time() -> None:
    checkout = {"product_id": "kenya-edit"}
    assert ga._checkout_next_step(checkout) == "name"

    checkout["customer_name"] = "Amina"
    assert ga._checkout_next_step(checkout) == "delivery_type"
    assert "delivery channel" in ga._checkout_prompt(checkout, is_sw=False)
    assert ga._delivery_type_from_text("local handoff") == "Seamless Logistics - local handoff"
    assert ga._delivery_type_from_text("departure handoff") == "Seamless Logistics - JKIA terminal handoff"

    checkout["delivery_type"] = "Hotel delivery"
    assert ga._checkout_next_step(checkout) == "location"
    assert "hotel" in ga._checkout_prompt(checkout, is_sw=False).lower()

    checkout["delivery_location"] = "Villa Rosa room 412"
    assert ga._checkout_next_step(checkout) == "window"

    checkout["delivery_window"] = "Today 7 pm"
    assert ga._checkout_next_step(checkout) == "payment"

    checkout["payment_currency"] = "KES"
    assert ga._checkout_next_step(checkout) == "contact"

    checkout["contact"] = "+254700000000"
    assert ga._checkout_next_step(checkout) is None


@pytest.mark.asyncio
async def test_active_checkout_treats_hotel_delivery_as_delivery_type(db, fake_redis, monkeypatch) -> None:
    async def none_result(*args, **kwargs):
        return None

    monkeypatch.setattr(
        "app.services.hazina_deterministic_gate.try_hazina_deterministic_gate",
        none_result,
    )
    monkeypatch.setattr(
        "app.services.hazina_whatsapp_router.try_hazina_router_extras",
        none_result,
    )
    monkeypatch.setattr(
        "app.services.hazina_customer_fallbacks.try_hazina_price_negotiation_escalation",
        none_result,
    )
    monkeypatch.setattr(
        "app.services.state_aware_greeter.try_state_aware_greeter",
        none_result,
    )
    customer = SimpleNamespace(
        id=uuid.uuid4(),
        phone_number="+254700000000",
        preferred_language="en",
    )
    conversation_id = uuid.uuid4()
    await ga._set_checkout(
        conversation_id,
        {
            "product_id": "kenya-edit",
            "customer_name": "Amina Mwangi",
            "step": "delivery_type",
        },
    )
    assert (await ga._get_checkout(conversation_id))["step"] == "delivery_type"
    assert ga._delivery_type_from_text("Hotel delivery") == "Seamless Logistics - local handoff"

    delivery = await ga.try_hazina_automation(
        db,
        text="Hotel delivery",
        interactive_id=None,
        business_slug="hazina-nomads",
        customer=customer,
        conversation_id=conversation_id,
        business_id=None,
        language="en",
    )
    assert delivery is not None
    assert delivery.safety_flag == "deterministic:hazina_need_location"
    assert "room" in delivery.reply.lower()


def test_hazina_checkout_does_not_default_to_usd_until_guest_chooses() -> None:
    assert ga._explicit_payment_currency("order the Kenya Edit") is None
    assert ga._explicit_payment_currency("send a USD card link") == "USD"
    assert ga._explicit_payment_currency("M-Pesa please") == "KES"


def test_hazina_logistics_replies_are_deterministic() -> None:
    dhl = ga._logistics_reply("dhl", is_sw=False)
    assert "Global Export" in dhl
    assert "DHL" in dhl
    assert "before payment" in dhl

    jkia = ga._logistics_reply("jkia", is_sw=False)
    assert "Seamless Logistics" in jkia
    assert "JKIA" in jkia
    assert "departure handoff" in jkia

    hotel = ga._logistics_reply("hotel", is_sw=False)
    assert "hotel" in hotel.lower()
    assert "room" in hotel
    assert "delivery window" in hotel


def test_hazina_cafe_boundary_reply_points_to_gifts() -> None:
    reply = ga._cafe_boundary_reply(is_sw=False)
    assert "not a cafe" in reply
    assert "Bespoke Curation" in reply


@pytest.mark.asyncio
async def test_checkout_photo_uses_active_product_context(db, monkeypatch) -> None:
    def fake_find_photo(_slug, item_query, _custom):
        assert item_query == "The Kenya Edit"
        return "kenya edit", "https://example.test/kenya-edit.jpg"

    monkeypatch.setattr("app.services.menu_photos.find_photo", fake_find_photo)
    result = await ga._checkout_product_photo_reply(
        db,
        business_id=None,
        checkout={"product_id": "kenya-edit"},
        is_sw=False,
    )
    assert result.image_url == "https://example.test/kenya-edit.jpg"
    assert result.photo_item == "kenya edit"
    assert "The Kenya Edit" in result.reply
    assert result.safety_flag == "deterministic:hazina_checkout_photo"


def test_is_custom_box_handoff() -> None:
    assert ga.is_custom_box_handoff("I'd like to build a custom gift box")
    assert ga.is_custom_box_handoff("• Coffee (HN-T-001)\n• Tea (HN-T-002)")
