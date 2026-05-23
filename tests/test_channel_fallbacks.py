from app.channels.base import (
    _is_degraded_fallback_text,
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
