"""Mutable state object that flows through the LangGraph nodes."""
from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict, total=False):
    # Identity
    msisdn: str
    customer_name: str | None
    customer_id: uuid.UUID | None
    conversation_id: uuid.UUID | None
    channel: Literal["whatsapp", "voice", "sms", "mock"]
    business_id: uuid.UUID | None
    business_profile: Any  # BusinessProfile dataclass (kept loose to avoid import cycle)
    language: str | None

    # The chat transcript (LangChain messages)
    messages: Annotated[list[BaseMessage], add_messages]

    # RAG output for current turn
    rag_context: str
    rag_hits: int

    # Control flags
    escalate: bool
    escalation_reason: str | None
    failed_turns: int
