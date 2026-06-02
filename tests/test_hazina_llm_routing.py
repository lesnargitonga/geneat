"""Hazina tenant uses HAZINA_LLM_MODEL when LLM_PROVIDER=local."""
from __future__ import annotations

from app.ai.llm import _resolve_local_llm_model
from app.core.config import Settings


def test_hazina_slug_uses_dedicated_model() -> None:
    s = Settings(
        local_llm_model="llama3.1",
        hazina_llm_model="hazina-concierge",
    )
    assert _resolve_local_llm_model(s, "hazina-nomads") == "hazina-concierge"


def test_other_slug_uses_base_local_model() -> None:
    s = Settings(
        local_llm_model="llama3.1",
        hazina_llm_model="hazina-concierge",
    )
    assert _resolve_local_llm_model(s, "lily-pond-cafe") == "llama3.1"
    assert _resolve_local_llm_model(s, None) == "llama3.1"


def test_hazina_falls_back_when_override_empty() -> None:
    s = Settings(local_llm_model="llama3.1", hazina_llm_model="")
    assert _resolve_local_llm_model(s, "hazina-nomads") == "llama3.1"
