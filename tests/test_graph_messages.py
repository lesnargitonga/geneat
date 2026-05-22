from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import StructuredTool

from app.ai.graph import _build_system_instruction, _looks_like_photo_request, run_turn


def test_build_system_instruction_collapses_hints_into_one_message() -> None:
    state = {
        "channel": "whatsapp",
        "customer_name": "Lesnar",
        "msisdn": "+254700000001",
        "language": "en",
        "rag_context": "Mandazi KES 50",
    }

    msg = _build_system_instruction(
        state,
        profile=None,
        is_first_turn=False,
        last_user_text="Lesnar",
    )

    assert isinstance(msg, SystemMessage)
    assert "LATEST_USER_MESSAGE_LOOKS_LIKE_NAME_ONLY: yes." in msg.content
    assert "IS_FIRST_TURN: no" in msg.content
    assert "Mandazi KES 50" in msg.content


def test_photo_request_detector_matches_obvious_prompts() -> None:
    assert _looks_like_photo_request("show me a photo of the flat white")
    assert _looks_like_photo_request("send me a picture of the croissant")
    assert _looks_like_photo_request("picha ya avocado toast")
    assert not _looks_like_photo_request("what time do you open?")


@pytest.mark.asyncio
async def test_run_turn_sends_single_system_message_to_llm(db, stub_rag, monkeypatch):
    captured = {}

    class InspectingLLM:
        def bind_tools(self, tools):
            return self

        async def ainvoke(self, messages):
            captured["messages"] = messages
            return AIMessage(content="ok")

    monkeypatch.setattr("app.ai.graph.get_chat_chain", lambda *a, **kw: InspectingLLM())

    out = await run_turn(
        db,
        msisdn="+254700000001",
        user_text="Lesnar",
        channel="whatsapp",
        history=[HumanMessage(content="What's good for breakfast under KES 300?")],
    )

    assert out["reply"] == "ok"
    assert captured["messages"]
    assert isinstance(captured["messages"][0], SystemMessage)
    assert sum(isinstance(message, SystemMessage) for message in captured["messages"]) == 1


@pytest.mark.asyncio
async def test_run_turn_short_circuits_explicit_photo_requests(db, stub_rag, monkeypatch):
    async def fake_photo_tool(item: str) -> dict:
        assert "flat white" in item.lower()
        return {"ok": True, "item": "flat white", "image_url": "https://cdn.example.com/flat-white.jpg"}

    tool = StructuredTool.from_function(
        coroutine=fake_photo_tool,
        name="send_menu_photo",
        description="send a menu photo",
    )

    monkeypatch.setattr("app.ai.graph.build_tools", lambda *a, **kw: [tool])
    monkeypatch.setattr(
        "app.ai.graph.get_chat_chain",
        lambda *a, **kw: (_ for _ in ()).throw(AssertionError("LLM should not be called for explicit photo requests")),
    )

    out = await run_turn(
        db,
        msisdn="+254700000001",
        user_text="show me a photo of the flat white",
        channel="whatsapp",
    )

    assert out["reply"] == "Here you go for flat white."
