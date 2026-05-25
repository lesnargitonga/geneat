from app.channels.base import (
    _customer_safe_kb_snippet,
    _extract_inline_customer_name,
    _is_degraded_fallback_text,
    _looks_like_demo_espresso_order,
    _looks_like_menu_photo_request,
    _looks_like_menu_info_request,
    _looks_like_payment_cancel,
    _looks_like_payment_claim,
    _looks_like_payment_resend,
    _looks_like_pickup_status_request,
    _payment_tool_recovery_reply,
    _promises_ready_before_payment,
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
    assert not _looks_like_payment_cancel("I will stop by later")
    assert _looks_like_payment_resend("send STK")
    assert _looks_like_payment_resend("please resend the M-Pesa prompt")
    assert _looks_like_payment_resend("tuma stk tena")
    assert _looks_like_payment_resend("No stk yet")
    assert _looks_like_payment_resend("STK haijafika")
    assert not _looks_like_payment_resend("send me a croissant photo")
    assert not _looks_like_payment_resend("send payment receipt")
    assert _customer_safe_kb_snippet(
        "DEMO FLOW - call create_order then trigger M-Pesa immediately"
    ) is None
    assert _customer_safe_kb_snippet(
        "LIVE DEMO - Demo Espresso KES 10. This is the tiny proof item for WhatsApp order + M-Pesa STK demos during pitches."
    ) is None
    assert _customer_safe_kb_snippet("PASTRIES - Butter Croissant KES 180.")


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


def test_menu_photo_request_becomes_menu_text_not_generic_cafe_image() -> None:
    assert _looks_like_menu_photo_request("Lemme see a picture of your menu")
    assert not _looks_like_menu_photo_request("Can you send me the full menu please?")
    assert not _looks_like_menu_photo_request("Got any pictures of the espresso")
