from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.ai.graph import _build_system_instruction, run_turn


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
