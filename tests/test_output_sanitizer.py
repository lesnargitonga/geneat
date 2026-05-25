from app.services.output_sanitizer import sanitize_reply


def test_sanitizer_empty_reply_uses_honest_formatting_fallback() -> None:
    reply = sanitize_reply("", channel="whatsapp")

    assert "formatting hiccup" in reply
    assert "One moment" not in reply


def test_sanitizer_replaces_json_tool_envelopes() -> None:
    reply = sanitize_reply(
        '{"tool_calls":[{"function":{"name":"knowledge_lookup","arguments":"{\\"query\\":\\"menu\\"}"}}]}',
        channel="whatsapp",
    )

    assert "formatting hiccup" in reply
    assert "tool_calls" not in reply


def test_sanitizer_replaces_function_call_text() -> None:
    reply = sanitize_reply(
        "knowledge_lookup(query='full menu')",
        channel="whatsapp",
    )

    assert "formatting hiccup" in reply
    assert "knowledge_lookup" not in reply
