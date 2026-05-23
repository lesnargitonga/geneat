from app.channels.base import _is_degraded_fallback_text


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
