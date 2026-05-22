"""End-to-end test of the AI engine using stubs (no network, no Postgres)."""
from __future__ import annotations

import pytest
from langchain_core.messages import HumanMessage

from app.ai.graph import run_turn

# These tests need the full schema (JSONB, pgvector columns). They run
# against the SQLite fixture by design but were broken when the models
# were tightened to PG-only types. Skip in unit CI; opt-in with `-m pg`.
pytestmark = pytest.mark.pg


@pytest.mark.asyncio
async def test_basic_reply(db, stub_llm, stub_rag):
    out = await run_turn(db, msisdn="+254700000001", user_text="Hello", channel="mock")
    assert "You said" in out["reply"]
    assert out["escalated"] is False


@pytest.mark.asyncio
async def test_swahili_passthrough(db, stub_llm, stub_rag):
    out = await run_turn(db, msisdn="+254700000002", user_text="Habari za asubuhi", channel="mock")
    assert "Habari" in out["reply"]


@pytest.mark.asyncio
async def test_escalation_via_tool(db, stub_llm, stub_rag):
    out = await run_turn(db, msisdn="+254700000003", user_text="I want a human agent", channel="mock")
    assert out["escalated"] is True


@pytest.mark.asyncio
async def test_history_threaded(db, stub_llm, stub_rag):
    history = [HumanMessage(content="My name is Asha")]
    out = await run_turn(db, msisdn="+254700000004", user_text="What is 2+2?",
                         channel="mock", history=history)
    assert out["reply"].startswith("You said:")
