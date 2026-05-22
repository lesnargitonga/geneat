"""LangGraph orchestration: retrieve → reason+act → maybe-tool-loop → respond.

State flows as `AgentState` (see state.py). The graph is rebuilt per turn with
tools bound to the current AsyncSession, so audit/order writes go into the
right transaction. Multi-turn memory comes from messages persisted in Postgres
(loaded by the channel layer) + the last `messages` window in state.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
import re
from typing import Sequence

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import get_chat_chain
from app.ai.prompts import RAG_PREAMBLE, render_system_prompt
from app.ai.rag import format_context, retrieve
from app.ai.safety import extract_kes_amounts
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
_PHOTO_REQUEST_RE = re.compile(
    r"\b("
    r"photo|picture|pic|image|picha|show me|send me|let me see|lemme see|how does .* look"
    r")\b",
    re.IGNORECASE,
)
_PRICE_REQUEST_RE = re.compile(
    r"\b("
    r"how much|price|cost|bei|kes ngapi|ni how much|how much is|how much for|price of|price for"
    r")\b",
    re.IGNORECASE,
)
_NORMALIZE_RE = re.compile(r"[^a-z0-9 ]+")
_PRICE_STOPWORDS = {
    "how", "much", "is", "for", "the", "a", "an", "of", "price", "cost", "bei",
    "ni", "kes", "ksh", "bob", "please", "me", "show", "tell", "what", "whats",
}


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


def _looks_like_photo_request(text: str) -> bool:
    candidate = (text or "").strip()
    if not candidate:
        return False
    return bool(_PHOTO_REQUEST_RE.search(candidate))


def _looks_like_price_request(text: str) -> bool:
    candidate = (text or "").strip()
    if not candidate:
        return False
    return bool(_PRICE_REQUEST_RE.search(candidate))


def _photo_item_query(text: str) -> str:
    candidate = (text or "").strip()
    if not candidate:
        return "menu"
    lowered = candidate.lower()
    if any(token in lowered for token in ("whole menu", "full menu", "entire menu", "menu pictures", "menu photo")):
        return "menu"
    return candidate


def _normalize_lookup_text(text: str) -> str:
    return _NORMALIZE_RE.sub(" ", (text or "").lower()).strip()


def _price_item_query(text: str) -> str:
    lowered = _normalize_lookup_text(text)
    for phrase in (
        "how much is", "how much for", "how much", "price of", "price for", "price", "cost of", "cost",
        "bei ya", "bei", "kes ngapi", "ni how much",
    ):
        lowered = lowered.replace(phrase, " ")
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered or text.strip()


def _price_reply_from_chunks(query: str, chunks) -> str | None:
    item_query = _price_item_query(query)
    query_norm = _normalize_lookup_text(item_query)
    query_tokens = {
        token for token in query_norm.split()
        if token and token not in _PRICE_STOPWORDS and len(token) >= 3
    }
    if not query_tokens and query_norm:
        query_tokens = {query_norm}

    best_segment: str | None = None
    best_score = -1
    best_price: int | None = None
    for chunk in chunks:
        for raw_segment in re.split(r"[\n•]+", chunk.content or ""):
            segment = raw_segment.strip(" -:\t")
            if not segment:
                continue
            seg_norm = _normalize_lookup_text(segment)
            score = 0
            if query_norm and query_norm in seg_norm:
                score += 3
            score += sum(1 for token in query_tokens if token in seg_norm)
            if score <= 0:
                continue
            amounts = sorted(extract_kes_amounts(segment))
            if not amounts:
                continue
            if score > best_score:
                best_score = score
                best_segment = segment
                best_price = amounts[0]

    if best_price is None:
        return None

    label = item_query.strip(" ?.!").title() if item_query.strip() else "That item"
    if "demo espresso" in query_norm or "demo order" in query_norm or "10 bob" in query_norm or "ten bob" in query_norm:
        return "Demo Espresso is KES 10. Want me to set one up for pickup?"
    if best_segment and "/" in best_segment and best_score < 4:
        return f"The listed price there is KES {best_price}. Want me to pull the exact item for you?"
    return f"{label} is KES {best_price}. Want me to sort one for pickup?"


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

    # Detect whether this is the very first AI turn for this conversation.
    # If the customer has ANY prior AI message in history, the agent should
    # not re-introduce itself / re-greet with the brand name.
    prior_ai = sum(1 for m in state["messages"] if isinstance(m, AIMessage))
    is_first_turn = prior_ai == 0

    last_user_text = next(
        (m.content for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        "",
    )
    if _looks_like_photo_request(last_user_text):
        photo_tool = next((tool for tool in tools if getattr(tool, "name", "") == "send_menu_photo"), None)
        if photo_tool is not None:
            try:
                photo_result = await photo_tool.ainvoke({"item": _photo_item_query(last_user_text)})
            except Exception as exc:
                log.warning("photo_fast_path_failed", error=str(exc))
            else:
                if isinstance(photo_result, dict) and photo_result.get("ok"):
                    matched = str(photo_result.get("item") or "that").strip()
                    return {"messages": [AIMessage(content=f"Here you go for {matched}.")]}

    if _looks_like_price_request(last_user_text):
        price_chunks = await retrieve(db, last_user_text, business_id=biz_id, k=3)
        price_reply = _price_reply_from_chunks(last_user_text, price_chunks)
        if price_reply:
            return {"messages": [AIMessage(content=price_reply)]}

    llm = get_chat_chain(tools)
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
