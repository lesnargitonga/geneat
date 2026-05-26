"""LangGraph orchestration: retrieve → reason+act → maybe-tool-loop → respond.

State flows as `AgentState` (see state.py). The graph is rebuilt per turn with
tools bound to the current AsyncSession, so audit/order writes go into the
right transaction. Multi-turn memory comes from messages persisted in Postgres
(loaded by the channel layer) + the last `messages` window in state.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
import time
import re
from typing import Sequence

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import get_chat_chain
from app.ai.prompts import RAG_PREAMBLE, render_system_prompt
from app.ai.quick_replies import (
    GENERIC_PHOTO_QUERY,
    looks_like_photo_request,
    photo_clarification_reply_from_chunks,
    photo_item_query,
)
from app.ai.rag import fetch_menu_chunks, format_context, retrieve
from app.ai.state import AgentState
from app.ai.tools import build_tools
from app.core.config import get_settings
from app.core.logging import get_logger
from app.api.metrics import record_llm_latency, record_rag_latency
from app.services.business_service import BusinessProfile, get_business_for_turn
from app.services.language import language_instruction

log = get_logger("graph")
settings = get_settings()

MAX_TOOL_HOPS = 4
RAG_TURN_CHUNKS = 3
_NORMALIZE_RE = re.compile(r"[^a-z0-9 ]+")


async def _release_db_connection(db: AsyncSession, *, stage: str) -> None:
    """End the current transaction so slow provider waits do not pin a pool slot."""
    if not db.in_transaction():
        return
    try:
        await db.commit()
        log.debug("db_transaction_released", stage=stage)
    except Exception:
        await db.rollback()
        log.warning("db_transaction_release_failed", stage=stage)
        raise


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


def _normalize_lookup_text(text: str) -> str:
    return _NORMALIZE_RE.sub(" ", (text or "").lower()).strip()


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
        await _release_db_connection(db, stage="after_profile_lookup")

    last_user = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)), None,
    )
    if not last_user:
        await _release_db_connection(db, stage="rag_no_user")
        return {"rag_context": "", "rag_hits": 0, "business_profile": profile}
    last_user_text = last_user.content if isinstance(last_user.content, str) else str(last_user.content)
    if looks_like_photo_request(last_user_text):
        await _release_db_connection(db, stage="rag_photo_fast_path")
        return {"rag_context": "", "rag_hits": 0, "business_profile": profile}

    biz_id = profile.id if profile else state.get("business_id")
    t0 = time.perf_counter()
    chunks = await retrieve(db, last_user_text, business_id=biz_id, k=RAG_TURN_CHUNKS)
    took_ms = int((time.perf_counter() - t0) * 1000)
    try:
        log.info("rag_retrieved", rag_hits=len(chunks), latency_ms=took_ms)
    except Exception:
        pass
    try:
        record_rag_latency(took_ms / 1000.0)
    except Exception:
        pass
    await _release_db_connection(db, stage="after_rag")
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

    # Detect whether this is the very first AI turn for this conversation.
    # If the customer has ANY prior AI message in history, the agent should
    # not re-introduce itself / re-greet with the brand name.
    prior_ai = sum(1 for m in state["messages"] if isinstance(m, AIMessage))
    is_first_turn = prior_ai == 0

    last_user_text = next(
        (m.content for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        "",
    )
    if looks_like_photo_request(last_user_text):
        item_query = photo_item_query(last_user_text)
        if item_query == GENERIC_PHOTO_QUERY:
            try:
                chunks = await fetch_menu_chunks(db, business_id=biz_id, k=8)
                clarification = photo_clarification_reply_from_chunks(chunks)
            except Exception as exc:
                log.warning("photo_clarification_lookup_failed", error=str(exc))
                clarification = (
                    "Which item should I send a picture of? "
                    "Tell me the item name and I will send that photo."
                )
            await _release_db_connection(db, stage="after_photo_clarification")
            return {
                "messages": [
                    AIMessage(content=clarification)
                ]
            }
        photo_tool = next((tool for tool in tools if getattr(tool, "name", "") == "send_menu_photo"), None)
        if photo_tool is not None:
            try:
                photo_result = await photo_tool.ainvoke({"item": item_query})
            except Exception as exc:
                log.warning("photo_fast_path_failed", error=str(exc))
                await _release_db_connection(db, stage="after_photo_tool_failure")
            else:
                if isinstance(photo_result, dict) and photo_result.get("ok"):
                    matched = str(photo_result.get("item") or "that").strip()
                    await _release_db_connection(db, stage="after_photo_tool")
                    return {
                        "messages": [AIMessage(content=f"Here you go for {matched}.")],
                        "photo_result": {
                            "item": matched,
                            "image_url": photo_result.get("image_url"),
                        },
                    }

    llm = get_chat_chain(tools)
    system = _build_system_instruction(
        state,
        profile=profile,
        is_first_turn=is_first_turn,
        last_user_text=last_user_text,
    )
    msgs: list[BaseMessage] = [system, *state["messages"]]
    t0 = time.perf_counter()
    response: AIMessage = await llm.ainvoke(msgs)
    took_ms = int((time.perf_counter() - t0) * 1000)
    try:
        log.info("llm_invoke_completed", provider=settings.llm_provider, latency_ms=took_ms)
    except Exception:
        pass
    try:
        record_llm_latency(settings.llm_provider or "unknown", took_ms / 1000.0)
    except Exception:
        pass
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

    async def tools_step(s: AgentState) -> dict:
        try:
            out = await tool_node.ainvoke(s)
        except Exception:
            if db.in_transaction():
                await db.rollback()
            raise
        await _release_db_connection(db, stage="after_tools")
        return out

    g = StateGraph(AgentState)
    g.add_node("retrieve", retrieve_step)
    g.add_node("agent",    agent_step)
    g.add_node("tools",    tools_step)

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
    photo_result = final.get("photo_result") if isinstance(final.get("photo_result"), dict) else None
    escalated = any(t["name"] == "escalate_to_human" for t in tool_calls)
    return {
        "reply": reply,
        "tool_calls": tool_calls,
        "escalated": escalated,
        "rag_hits": final.get("rag_hits", 0),
        "photo_result": photo_result,
    }
