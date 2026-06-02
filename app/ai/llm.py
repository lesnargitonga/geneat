"""LLM and embedding client factories.

Provider switch via `LLM_PROVIDER` env (primary). Fallback chain via
`LLM_FALLBACK_PROVIDERS` (comma-separated). When the primary raises a rate
limit / quota / transient error mid-turn, LangChain's RunnableWithFallbacks
automatically retries with the next provider. The channel layer only shows a
degraded fallback if all available model attempts fail or time out.

    openai → ChatOpenAI         (paid GPT-5 class models; primary path)
    gemini → ChatGoogleGenerativeAI (fallback)
    groq   → ChatGroq           (optional free/fast fallback, quota-sensitive)
    local  → Ollama via /v1 shim (zero-cost, local GPU; always available)

Embeddings use OpenAI text-embedding-3-large at 768 dimensions when
`EMBED_PROVIDER=openai`; this preserves the current pgvector schema while
improving retrieval. Local Ollama embeddings remain available for zero-cost
operation.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Sequence

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.runnables import Runnable

from app.ai.ollama_embed import OllamaEmbedder
from app.core.config import Settings, get_settings
from app.core.logging import get_logger

log = get_logger("llm")


def _is_openai_reasoning_model(model: str) -> bool:
    name = (model or "").lower()
    return name.startswith(("gpt-5", "o1", "o3", "o4"))


def _resolve_local_llm_model(s: Settings, business_slug: str | None) -> str:
    """Hazina open-ended turns can use a dedicated fine-tuned Ollama model."""
    slug = (business_slug or "").strip().lower()
    hazina_model = (getattr(s, "hazina_llm_model", None) or "").strip()
    if hazina_model and slug == "hazina-nomads":
        return hazina_model
    return s.local_llm_model


def _build_provider(
    provider: str,
    s: Settings,
    *,
    temperature: float,
    streaming: bool,
    is_fallback: bool = False,
    business_slug: str | None = None,
) -> BaseChatModel | None:
    """Build a single chat model for the given provider. Returns None if the
    provider can't be constructed (missing key / misconfigured) — caller
    skips it. Never raises."""
    try:
        if provider == "groq":
            from langchain_groq import ChatGroq
            key = s.groq_api_key.get_secret_value()
            if not key:
                return None
            # When acting as a fallback, prefer the cheaper/larger-quota model.
            model = s.groq_fallback_model if is_fallback else s.groq_model
            log.info("llm_built", provider="groq", model=model, fallback=is_fallback)
            return ChatGroq(
                model=model, api_key=key, temperature=temperature,
                streaming=streaming, timeout=30, max_retries=1,
                max_tokens=600,
            )

        if provider == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI
            key = s.gemini_api_key.get_secret_value()
            if not key:
                return None
            log.info("llm_built", provider="gemini", model=s.gemini_model, fallback=is_fallback)
            return ChatGoogleGenerativeAI(
                model=s.gemini_model, google_api_key=key, temperature=temperature,
                timeout=30, max_retries=1,
                max_output_tokens=600,
            )

        if provider == "openai":
            from langchain_openai import ChatOpenAI
            key = s.openai_api_key.get_secret_value()
            if not key:
                return None
            log.info("llm_built", provider="openai", model=s.openai_model, fallback=is_fallback)
            is_reasoning = _is_openai_reasoning_model(s.openai_model)
            kwargs = {
                "model": s.openai_model,
                "api_key": key,
                "temperature": None if is_reasoning else temperature,
                "streaming": streaming,
                "timeout": 30,
                "max_retries": 1,
                "max_completion_tokens": 600,
                # Responses API tool loops can include response-item ids in
                # subsequent model inputs. Those ids are only resolvable when
                # response items are stored; otherwise OpenAI returns 404 on
                # the post-tool follow-up turn.
                "store": s.openai_store_responses,
                "use_responses_api": s.openai_use_responses_api,
            }
            if is_reasoning:
                kwargs["reasoning_effort"] = s.openai_reasoning_effort
            return ChatOpenAI(
                **kwargs,
            )

        if provider == "local":
            # Use native langchain_ollama client — the ChatOpenAI compat shim
            # breaks on newer openai-python (>=1.50) with
            # "Client.__init__() got an unexpected keyword argument 'proxies'".
            from langchain_ollama import ChatOllama
            # Strip the trailing /v1 (OpenAI compat path) — ChatOllama wants
            # the Ollama root e.g. http://localhost:11434.
            base = s.local_llm_base_url.rstrip("/")
            if base.endswith("/v1"):
                base = base[:-3]
            local_model = _resolve_local_llm_model(s, business_slug)
            log.info(
                "llm_built",
                provider="local",
                model=local_model,
                fallback=is_fallback,
                business_slug=business_slug,
            )
            return ChatOllama(
                base_url=base, model=local_model,
                temperature=temperature, num_predict=512,
                async_client_kwargs={"timeout": 30},
                sync_client_kwargs={"timeout": 30},
            )
    except Exception as e:
        log.warning("llm_build_failed", provider=provider, error=str(e))
        return None

    return None


@lru_cache
def get_chat_llm(temperature: float = 0.2, streaming: bool = False) -> BaseChatModel:
    """Return the PRIMARY chat model only (no fallbacks). Kept for backward
    compatibility with non-graph callers that don't bind tools."""
    s = get_settings()
    llm = _build_provider(s.llm_provider, s, temperature=temperature, streaming=streaming)
    if llm is not None:
        return llm
    # Last-resort: local Ollama (always available if Ollama is running).
    log.warning("primary_llm_unbuildable_falling_back_to_local", provider=s.llm_provider)
    fb = _build_provider("local", s, temperature=temperature, streaming=streaming)
    if fb is None:
        raise RuntimeError(
            f"No chat LLM could be built. Primary='{s.llm_provider}', "
            "and local Ollama fallback also failed. Check .env."
        )
    return fb


def get_chat_chain(
    tools: Sequence | None = None,
    *,
    temperature: float = 0.2,
    streaming: bool = False,
    business_slug: str | None = None,
) -> Runnable:
    """Return a tool-bound Runnable with automatic provider failover.

    On a 429 / quota / transient error from the primary, LangChain's
    `.with_fallbacks([...])` mechanism transparently retries the same input
    against the next provider in the chain. Tools are bound to EACH
    underlying model up-front so the fallbacks can still emit tool_calls.

    The chain is rebuilt per turn (not lru_cached) because tools are bound
    to a per-turn AsyncSession — caching across turns would leak sessions.
    """
    s = get_settings()
    primary_provider = s.llm_provider

    # Build the primary.
    primary = _build_provider(
        primary_provider,
        s,
        temperature=temperature,
        streaming=streaming,
        business_slug=business_slug,
    )

    # Build fallbacks: parse comma-separated list, dedupe vs primary, drop
    # providers we can't build (missing keys).
    fb_order: list[str] = []
    for p in (s.llm_fallback_providers or "").split(","):
        p = p.strip().lower()
        if not p or p == primary_provider or p in fb_order:
            continue
        fb_order.append(p)

    fallback_specs: list[tuple[str, BaseChatModel]] = []
    for p in fb_order:
        m = _build_provider(
            p,
            s,
            temperature=temperature,
            streaming=streaming,
            is_fallback=True,
            business_slug=business_slug,
        )
        if m is not None:
            fallback_specs.append((p, m))

    # If primary failed to build entirely, promote the first available fallback.
    if primary is None:
        if not fallback_specs:
            raise RuntimeError(
                "No chat LLM available — primary and all fallbacks failed to build. "
                "Check API keys in .env."
            )
        _, primary = fallback_specs.pop(0)
        log.warning("primary_unbuildable_promoting_fallback")

    # Bind tools to every model in the chain (each must be able to call tools).
    if tools:
        primary_bound: Runnable = primary.bind_tools(tools)
        fallback_bound: list[tuple[str, Runnable]] = [
            (provider_name, model.bind_tools(tools)) for provider_name, model in fallback_specs
        ]
    else:
        primary_bound = primary
        fallback_bound = list(fallback_specs)

    if not fallback_bound:
        return primary_bound

    # `.with_fallbacks` only catches Exception subclasses by default — which
    # covers all rate-limit / API errors we care about.
    log.info(
        "llm_chain_assembled",
        primary=primary_provider,
        fallbacks=[provider_name for provider_name, _ in fallback_bound],
    )

    # Wrap each model with a circuit breaker so a dead provider opens out
    # within `fail_max` failures and skips for `reset_timeout` seconds —
    # without it, every request pays the 30s timeout cost before failover.
    from langchain_core.runnables import RunnableLambda
    from app.core.circuit_breaker import CircuitOpenError, get_breaker

    def _wrap_with_breaker(model: Runnable, provider_name: str, *, is_primary: bool):
        breaker = get_breaker(
            f"llm:{provider_name}",
            fail_max=5 if is_primary else 3,
            reset_timeout=60.0 if is_primary else 120.0,
        )

        async def _call(msgs):
            if not breaker.allow():
                # Short-circuit — raise so with_fallbacks moves on instantly.
                raise CircuitOpenError(breaker.name, breaker.snapshot()["opened_for"])
            try:
                out = await model.ainvoke(msgs)
                breaker.record_success()
                return out
            except Exception as e:
                breaker.record_failure()
                if is_primary:
                    log.warning(
                        "primary_llm_failed",
                        provider=provider_name,
                        error_type=type(e).__name__,
                        error=str(e)[:500],
                        breaker_state=breaker.state,
                    )
                else:
                    log.info(
                        "fallback_llm_failed",
                        provider=provider_name,
                        error_type=type(e).__name__,
                        error=str(e)[:300],
                        breaker_state=breaker.state,
                    )
                raise

        return RunnableLambda(_call)

    primary_wrapped = _wrap_with_breaker(primary_bound, primary_provider, is_primary=True)
    fallback_wrapped = [
        _wrap_with_breaker(model, provider_name, is_primary=False)
        for provider_name, model in fallback_bound
    ]

    return primary_wrapped.with_fallbacks(fallback_wrapped)


@lru_cache
def get_embedder():
    """Return an object exposing aembed_query / aembed_documents.

    Default: OpenAI text-embedding-3-large shortened to 768 dimensions,
    matching the `knowledge_base.embedding` column. The chat LLM provider
    (`llm_provider`) is independent of the embedder, so flipping between
    OpenAI/Gemini/Groq/local for chat does not break retrieval.
    """
    s = get_settings()
    if s.embed_provider == "openai" and s.openai_api_key.get_secret_value():
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(
            model=s.openai_embed_model,
            api_key=s.openai_api_key.get_secret_value(),
            dimensions=s.openai_embed_dimensions,
        )
    return OllamaEmbedder(
        base_url=s.local_llm_base_url,
        model="nomic-embed-text",
    )
