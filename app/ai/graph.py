"""LangGraph orchestration: retrieve → reason+act → maybe-tool-loop → respond.

State flows as `AgentState` (see state.py). The graph is rebuilt per turn with
tools bound to the current AsyncSession, so audit/order writes go into the
right transaction. Multi-turn memory comes from messages persisted in Postgres
(loaded by the channel layer) + the last `messages` window in state.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Sequence

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import get_chat_chain
from app.ai.prompts import RAG_PREAMBLE, render_system_prompt
from app.ai.rag import format_context, retrieve
from app.ai.state import AgentState
from app.ai.tools import build_tools
from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.business_service import BusinessProfile, get_business_for_turn
from app.services.language import language_instruction

log = get_logger("graph")
settings = get_settings()

MAX_TOOL_HOPS = 4
RAG_TURN_CHUNKS = 3


def _looks_like_name_only(text: str) -> bool:
    candidate = (text or "").strip()
    if not candidate or len(candidate) > 40:
        return False
    if any(ch.isdigit() for ch in candidate):
        return False
    normalized = candidate.replace("-", " ").replace("'", " ")
    parts = [p for p in normalized.split() if p]
    if not (1 <= len(parts) <= 2):
        return False
    return all(part.isalpha() and len(part) >= 2 for part in parts)


def _looks_like_short_followup(text: str) -> bool:
    candidate = (text or "").strip()
    if not candidate or len(candidate) > 32:
        return False
    lowered = candidate.lower()
    if lowered in {"yes", "yeah", "yep", "sawa", "ndio", "okay", "ok"}:
        return True
    if any(ch.isdigit() for ch in candidate):
        return False
    normalized = candidate.replace("-", " ").replace("'", " ")
    parts = [p for p in normalized.split() if p]
    if not (1 <= len(parts) <= 3):
        return False
    return all(part.isalpha() for part in parts)


def _build_system_instruction(
    state: AgentState,
    *,
    profile: BusinessProfile | None,
    is_first_turn: bool,
    last_user_text: str,
) -> SystemMessage:
    biz_name = profile.name if profile else "the business"
    now_local = datetime.now(timezone.utc) + timedelta(hours=3)

    sections: list[str] = [
        render_system_prompt(
            profile,
            now_local.date().isoformat(),
            now_local=now_local,
        ),
        RAG_PREAMBLE.format(
            business_name=biz_name,
            k=RAG_TURN_CHUNKS,
            context=state.get("rag_context") or "(none)",
        ),
        (
            f"Active channel: {state.get('channel','mock')}. "
            f"Customer: {state.get('customer_name') or 'unknown'} ({state.get('msisdn','?')}). "
            f"IS_FIRST_TURN: {'yes' if is_first_turn else 'no'} "
            f"(if no -> DO NOT repeat the greeting or brand-name intro; just answer)."
        ),
        language_instruction(state.get("language")),
    ]

    if _looks_like_name_only(last_user_text):
        sections.append(
            "LATEST_USER_MESSAGE_LOOKS_LIKE_NAME_ONLY: yes. "
            "Treat it as the answer to your cup-name / customer-name question. "
            "Save the name, acknowledge briefly, and move the order forward. "
            "Do not repeat the full menu unless the customer asked again."
        )
    elif _looks_like_short_followup(last_user_text):
        sections.append(
            "LATEST_USER_MESSAGE_IS_A_SHORT_FOLLOW_UP: yes. "
            "Treat it as a continuation of the current order or shortlist, not a brand-new topic. "
            "Use the immediately previous recommendations or order context. "
            "Do not reset the conversation or dump a fresh long menu."
        )

    return SystemMessage(content="\n\n".join(section for section in sections if section))


async def _retrieve_node(state: AgentState, *, db: AsyncSession) -> dict:
    # Load tenant profile if we have a business_id (else default to first active business).
    profile: BusinessProfile | None = state.get("business_profile")
    if profile is None:
        profile = await get_business_for_turn(db, business_id=state.get("business_id"))

    last_user = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)), None,
    )
    if not last_user:
        return {"rag_context": "", "rag_hits": 0, "business_profile": profile}
    biz_id = profile.id if profile else state.get("business_id")
    chunks = await retrieve(db, last_user.content, business_id=biz_id, k=RAG_TURN_CHUNKS)
    return {
        "rag_context": format_context(chunks),
        "rag_hits": len(chunks),
        "business_profile": profile,
    }


async def _agent_node(state: AgentState, *, db: AsyncSession) -> dict:
    profile: BusinessProfile | None = state.get("business_profile")
    biz_id = profile.id if profile else state.get("business_id")

    tools = build_tools(
        db, state.get("conversation_id"), biz_id,
        msisdn=state.get("msisdn"), channel=state.get("channel"),
    )
    llm = get_chat_chain(tools)

    # Detect whether this is the very first AI turn for this conversation.
    # If the customer has ANY prior AI message in history, the agent should
    # not re-introduce itself / re-greet with the brand name.
    prior_ai = sum(1 for m in state["messages"] if isinstance(m, AIMessage))
    is_first_turn = prior_ai == 0

    last_user_text = next(
        (m.content for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        "",
    )
    system = _build_system_instruction(
        state,
        profile=profile,
        is_first_turn=is_first_turn,
        last_user_text=last_user_text,
    )
    msgs: list[BaseMessage] = [system, *state["messages"]]
    response: AIMessage = await llm.ainvoke(msgs)
    return {"messages": [response]}


def _should_continue(state: AgentState) -> str:
    last = state["messages"][-1] if state["messages"] else None
    if isinstance(last, AIMessage) and getattr(last, "tool_calls", None):
        # cap tool hops to avoid runaway loops
        hops = sum(1 for m in state["messages"] if isinstance(m, ToolMessage))
        if hops >= MAX_TOOL_HOPS:
            return END
        return "tools"
    return END


def build_graph(
    db: AsyncSession,
    *,
    business_id: uuid.UUID | None = None,
    conversation_id: uuid.UUID | None = None,
    msisdn: str | None = None,
    channel: str | None = None,
):
    """Compile a LangGraph runnable bound to this DB session.

    CRITICAL: tools must be built with the tenant's ``business_id`` so that
    in-loop ``knowledge_lookup`` calls RAG with tenant scoping. Without this,
    a customer of one business can receive another tenant's content.
    """
    tools = build_tools(
        db,
        conversation_id=conversation_id,
        business_id=business_id,
        msisdn=msisdn,
        channel=channel,
    )
    tool_node = ToolNode(tools)  # tools are async StructuredTools

    async def retrieve_step(s: AgentState) -> dict:
        return await _retrieve_node(s, db=db)

    async def agent_step(s: AgentState) -> dict:
        return await _agent_node(s, db=db)

    g = StateGraph(AgentState)
    g.add_node("retrieve", retrieve_step)
    g.add_node("agent",    agent_step)
    g.add_node("tools",    tool_node)

    g.set_entry_point("retrieve")
    g.add_edge("retrieve", "agent")
    g.add_conditional_edges("agent", _should_continue, {"tools": "tools", END: END})
    g.add_edge("tools", "agent")
    return g.compile()


# ── Public entry-point ───────────────────────────────────────────────

async def run_turn(
    db: AsyncSession,
    *,
    msisdn: str,
    user_text: str,
    channel: str = "mock",
    conversation_id: uuid.UUID | None = None,
    customer_id: uuid.UUID | None = None,
    customer_name: str | None = None,
    business_id: uuid.UUID | None = None,
    history: Sequence[BaseMessage] = (),
    customer_language: str | None = None,
) -> dict:
    """Run a single turn. Returns dict with `reply` (str) and `tool_calls`."""
    graph = build_graph(
        db,
        business_id=business_id,
        conversation_id=conversation_id,
        msisdn=msisdn,
        channel=channel,
    )
    initial: AgentState = {
        "msisdn": msisdn,
        "customer_id": customer_id,
        "conversation_id": conversation_id,
        "customer_name": customer_name,
        "business_id": business_id,
        "channel": channel,
        "language": customer_language,
        "messages": [*history, HumanMessage(content=user_text)],
    }
    final: AgentState = await graph.ainvoke(initial)
    last_ai = next((m for m in reversed(final["messages"]) if isinstance(m, AIMessage)), None)
    raw_content = last_ai.content if last_ai else ""
    # Gemini returns content as a list of parts ([{"type":"text","text":"…"}, …]);
    # Groq/OpenAI return a plain string. Normalize to str.
    if isinstance(raw_content, list):
        parts: list[str] = []
        for p in raw_content:
            if isinstance(p, str):
                parts.append(p)
            elif isinstance(p, dict):
                parts.append(p.get("text") or p.get("content") or "")
        reply = "".join(parts)
    else:
        reply = raw_content or ""
    tool_calls = [
        {"name": m.name, "content": m.content[:500]}
        for m in final["messages"] if isinstance(m, ToolMessage)
    ]
    escalated = any(t["name"] == "escalate_to_human" for t in tool_calls)
    return {"reply": reply, "tool_calls": tool_calls, "escalated": escalated,
            "rag_hits": final.get("rag_hits", 0)}
