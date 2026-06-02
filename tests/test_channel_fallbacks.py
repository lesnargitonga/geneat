from types import SimpleNamespace
import uuid

import pytest

from app.channels.base import (
    _customer_safe_kb_snippet,
    _extract_inline_customer_name,
    _greeting_reply,
    _is_degraded_fallback_text,
    _looks_like_bare_menu_item,
    _looks_like_demo_espresso_order,
    _looks_like_greeting,
    _looks_like_menu_photo_request,
    _looks_like_menu_info_request,
    _looks_like_payment_cancel,
    _looks_like_payment_claim,
    _looks_like_payment_resend,
    _looks_like_pickup_status_request,
    _looks_like_short_affirmative,
    _offer_options_from_text,
    _payment_tool_recovery_reply,
    _promises_ready_before_payment,
    _safe_payment_start_error,
    _specific_photo_reply,
    _unresolved_business_slug_reply,
)


def test_degraded_fallback_detector_filters_old_generic_copy() -> None:
    assert _is_degraded_fallback_text(
        "Thanks for your message - I'm pulling our team in now and will get back to you."
    )
    assert _is_degraded_fallback_text(
        "Sorry, the system took too long before I could finish that."
    )
    assert not _is_degraded_fallback_text(
        "Demo Espresso is KES 10. Want me to set one up for pickup?"
    )


def test_unresolved_hazina_slug_does_not_name_lily_pond() -> None:
    reply = _unresolved_business_slug_reply("hazina-nomads")
    assert "Hazina Nomads" in reply
    assert "Lily" not in reply


def test_payment_tool_recovery_reply_for_successful_stk() -> None:
    reply = _payment_tool_recovery_reply(
        {
            "tool_calls": [
                {"name": "create_order", "content": '{"ok": true, "amount_kes": 10}'},
                {"name": "request_mpesa_payment", "content": '{"ok": true, "amount_kes": 10}'},
            ]
        },
        msisdn="+254700000001",
    )

    assert reply is not None
    assert "KES 10" in reply
    assert "ending 0001" in reply
    assert "receipt once it lands" in reply


def test_premature_ready_detector_allows_payment_qualified_copy() -> None:
    assert _promises_ready_before_payment("Pickup ready by 10:30.")
    assert not _promises_ready_before_payment(
        "I'll confirm pickup timing once payment lands."
    )


def test_payment_cancel_intent_and_internal_kb_filter() -> None:
    assert _looks_like_payment_cancel("Cancel the payment for 10 please")
    assert _looks_like_payment_cancel("cancel this checkout please")
    assert not _looks_like_payment_cancel("I will stop by later")
    assert _looks_like_payment_resend("send STK")
    assert _looks_like_payment_resend("please resend the M-Pesa prompt")
    assert _looks_like_payment_resend("tuma stk tena")
    assert _looks_like_payment_resend("No stk yet")
    assert _looks_like_payment_resend("STK haijafika")
    assert _looks_like_payment_resend("resend link")
    assert _looks_like_payment_resend("please send a new checkout link")
    assert not _looks_like_payment_resend("send me a croissant photo")
    assert not _looks_like_payment_resend("send payment receipt")
    assert _customer_safe_kb_snippet(
        "DEMO FLOW - call create_order then trigger M-Pesa immediately"
    ) is None
    assert _customer_safe_kb_snippet(
        "LIVE DEMO - Demo Espresso KES 10. This is the tiny proof item for WhatsApp order + M-Pesa STK demos during pitches."
    ) is None
    assert _customer_safe_kb_snippet("PASTRIES - Butter Croissant KES 180.")
    assert _customer_safe_kb_snippet(
        "BRAND POSITIONING — Hazina Nomads is a premium travel concierge, not a souvenir shop."
    ) is None


def test_safe_payment_error_message_hides_provider_exception() -> None:
    en = _safe_payment_start_error(is_sw=False)
    sw = _safe_payment_start_error(is_sw=True)
    assert "RetryError" not in en
    assert "Traceback" not in en
    assert "RetryError" not in sw


def test_demo_espresso_fast_path_detects_order_with_name() -> None:
    text = "Hi Lily Pond, I want the KES 10 demo espresso. My name is Lesnar."

    assert _looks_like_demo_espresso_order(text)
    assert _looks_like_demo_espresso_order("May I have demo espresso")
    assert _looks_like_demo_espresso_order("Demo espresso, name is Lesnar, picking up by 12:13")
    assert _looks_like_demo_espresso_order("Demo espresso")
    assert _extract_inline_customer_name(text) == "Lesnar"
    assert not _looks_like_demo_espresso_order("How much is the demo espresso?")
    assert not _looks_like_demo_espresso_order("Got any pictures of the demo espresso?")


def test_payment_claim_and_pickup_intents_are_deterministic() -> None:
    assert _looks_like_payment_claim("Paid")
    assert _looks_like_payment_claim("nimeshalipa")
    assert not _looks_like_payment_claim("not paid yet")
    assert _looks_like_pickup_status_request("Can I skip line and pick up at 12:30?")
    assert _looks_like_pickup_status_request("is it ready?")
    assert _looks_like_pickup_status_request("Can I collect at 12:30?")


def test_menu_info_fast_path_avoids_order_and_photo_turns() -> None:
    assert _looks_like_menu_info_request("Do you have croissants?")
    assert _looks_like_menu_info_request("How much is a flat white?")
    assert _looks_like_menu_info_request("What do you sell at the cafe?")
    assert _looks_like_menu_info_request("You mean you don't know what an espresso is or you don't sell?")
    assert not _looks_like_menu_info_request("I want a flat white")
    assert not _looks_like_menu_info_request("show me a photo of the flat white")
    assert not _looks_like_menu_info_request("I want the KES 10 demo espresso")
    assert not _looks_like_menu_info_request("Hey")


def test_greeting_reply_does_not_promise_readiness() -> None:
    assert _looks_like_greeting("Hey")
    assert _looks_like_greeting("Hi there")
    assert _looks_like_greeting("Hello Lily Pond")
    assert not _looks_like_greeting("Hey, may I have an espresso")
    reply = _greeting_reply(business_name="Lily Pond Café", language="en")
    assert "Lily Pond Cafe" in reply
    assert "menu" in reply
    assert "ready" not in reply.lower()
    assert "pickup" not in reply.lower()
    assert "queue" not in reply.lower()
    hazina = _greeting_reply(business_name="Hazina Nomads", language="en")
    assert "gift collection" in hazina
    assert "DHL" in hazina
    assert "cafe" not in hazina.lower()


def test_bare_item_and_affirmative_followups_are_controlled() -> None:
    assert _looks_like_bare_menu_item("The espresso")
    assert _looks_like_bare_menu_item("flat white")
    assert not _looks_like_bare_menu_item("Hey")
    assert not _looks_like_bare_menu_item("Paid")
    assert _looks_like_short_affirmative("Yeah")
    assert _looks_like_short_affirmative("sure")
    assert not _looks_like_short_affirmative("Sure, send a picture of espresso")


def test_offer_option_parser_handles_deterministic_menu_copy() -> None:
    assert _offer_options_from_text("Espresso is KES 120. Want me to sort one?") == [
        ("Espresso", 120)
    ]
    assert _offer_options_from_text("Yes - Espresso - KES 120. Want one?") == [
        ("Espresso", 120)
    ]
    assert _offer_options_from_text("Good picks: Mandazi - KES 50, Chai - KES 150.") == [
        ("Mandazi", 50),
        ("Chai", 150),
    ]


def test_menu_photo_request_becomes_menu_text_not_generic_cafe_image() -> None:
    assert _looks_like_menu_photo_request("Lemme see a picture of your menu")
    assert not _looks_like_menu_photo_request("Can you send me the full menu please?")
    assert not _looks_like_menu_photo_request("Got any pictures of the espresso")


@pytest.mark.asyncio
async def test_specific_photo_reply_uses_whatsapp_tool_channel(db, monkeypatch) -> None:
    seen = {}

    class PhotoTool:
        name = "send_menu_photo"

        async def ainvoke(self, args):
            seen["args"] = args
            return {"ok": True, "item": "Espresso", "image_url": "https://cdn.example/espresso.jpg"}

    def fake_build_tools(*args, **kwargs):
        seen["channel"] = kwargs.get("channel")
        return [PhotoTool()]

    monkeypatch.setattr("app.ai.tools.build_tools", fake_build_tools)

    reply, image_url, item = await _specific_photo_reply(
        db,
        customer=SimpleNamespace(phone_number="+254700000001"),
        conversation_id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        text="Got any pictures of the espresso?",
        channel="whatsapp",
    )

    assert seen["channel"] == "whatsapp"
    assert seen["args"] == {"item": "Got any pictures of the espresso?"}
    assert reply == "Here you go for Espresso."
    assert image_url is None
    assert item == "Espresso"
