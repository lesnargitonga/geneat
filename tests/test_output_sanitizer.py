from app.services.output_sanitizer import sanitize_reply


def test_sanitizer_empty_reply_uses_honest_formatting_fallback() -> None:
    reply = sanitize_reply("", channel="whatsapp")

    assert "formatting hiccup" in reply
    assert "One moment" not in reply
