"""Failover battery — verify that:

1. A bare CircuitBreaker opens after `fail_max` consecutive failures and
   short-circuits subsequent calls until the reset window elapses.
2. A LangChain `with_fallbacks` chain transparently retries on the next
   provider when the first raises.
3. The combined breaker-wrapped chain (the production assembly in
   `app.ai.llm._wrap_with_breaker`) collapses to the second provider
   *instantly* once the primary breaker is open \u2014 i.e. there's no
   30-second timeout cost on every request after the primary dies.

This is the "OpenAI is down at 02:00" sanity test the architect asked for.
"""
from __future__ import annotations

import asyncio

import pytest
from langchain_core.runnables import RunnableLambda

from app.core.circuit_breaker import (
    CircuitBreaker,
    CircuitOpenError,
    _REGISTRY,
    get_breaker,
)


@pytest.fixture(autouse=True)
def _clear_breakers():
    """Each test gets a clean breaker registry so we don't bleed state."""
    _REGISTRY.clear()
    yield
    _REGISTRY.clear()


# ── 1. Bare breaker ───────────────────────────────────────────────────

def test_breaker_opens_after_fail_max():
    b = CircuitBreaker(name="t1", fail_max=3, reset_timeout=60.0)
    assert b.allow()
    for _ in range(3):
        b.record_failure()
    assert b.state == "open"
    assert b.allow() is False  # short-circuits


def test_breaker_recovers_after_success():
    b = CircuitBreaker(name="t2", fail_max=3, reset_timeout=60.0)
    b.record_failure()
    b.record_failure()
    b.record_success()
    assert b.state == "closed"
    assert b._failures == 0


def test_breaker_half_open_after_reset_timeout(monkeypatch):
    b = CircuitBreaker(name="t3", fail_max=2, reset_timeout=0.05)
    b.record_failure(); b.record_failure()
    assert b.state == "open"
    import time as _t
    _t.sleep(0.06)
    assert b.allow() is True  # transitioned to half_open
    assert b.state == "half_open"
    # Probe failure re-opens immediately.
    b.record_failure()
    assert b.state == "open"


# ── 2. LangChain with_fallbacks transparently retries ─────────────────

@pytest.mark.asyncio
async def test_with_fallbacks_invokes_second_runnable_on_first_failure():
    calls = []

    async def primary(_msgs):
        calls.append("primary")
        raise RuntimeError("primary down (simulated insufficient_quota)")

    async def secondary(_msgs):
        calls.append("secondary")
        return "ok-from-secondary"

    chain = RunnableLambda(primary).with_fallbacks([RunnableLambda(secondary)])
    out = await chain.ainvoke([])
    assert out == "ok-from-secondary"
    assert calls == ["primary", "secondary"]


@pytest.mark.asyncio
async def test_with_fallbacks_raises_when_all_fail():
    async def boom(_msgs):
        raise RuntimeError("nope")

    chain = RunnableLambda(boom).with_fallbacks([RunnableLambda(boom)])
    with pytest.raises(RuntimeError):
        await chain.ainvoke([])


# ── 3. Breaker-wrapped chain skips dead primary without paying timeout ─

def _wrap(breaker_name: str, fail_max: int, *, side_effect):
    """Mirror the production wrapper in app.ai.llm._wrap_with_breaker."""
    breaker = get_breaker(breaker_name, fail_max=fail_max, reset_timeout=60.0)

    async def _call(_msgs):
        if not breaker.allow():
            raise CircuitOpenError(breaker.name, 0.0)
        try:
            res = side_effect()
            if asyncio.iscoroutine(res):
                res = await res
            breaker.record_success()
            return res
        except Exception:
            breaker.record_failure()
            raise

    return RunnableLambda(_call)


@pytest.mark.asyncio
async def test_open_primary_breaker_short_circuits_to_fallback():
    invocations = {"primary_real_calls": 0, "secondary": 0}

    def primary_se():
        invocations["primary_real_calls"] += 1
        raise RuntimeError("api timeout")

    def secondary_se():
        invocations["secondary"] += 1
        return "ok"

    primary = _wrap("llm:primary-test", fail_max=3, side_effect=primary_se)
    fallback = _wrap("llm:secondary-test", fail_max=3, side_effect=secondary_se)
    chain = primary.with_fallbacks([fallback])

    # First 3 calls open the primary breaker (each hits the real primary,
    # then falls back to secondary).
    for _ in range(3):
        out = await chain.ainvoke([])
        assert out == "ok"
    assert invocations["primary_real_calls"] == 3
    assert get_breaker("llm:primary-test").state == "open"

    # The next 5 calls must NOT touch the primary side-effect — the
    # breaker short-circuits and with_fallbacks rolls straight to secondary.
    for _ in range(5):
        out = await chain.ainvoke([])
        assert out == "ok"
    assert invocations["primary_real_calls"] == 3   # unchanged
    assert invocations["secondary"] == 8            # 3 + 5


@pytest.mark.asyncio
async def test_circuit_open_error_propagates_when_all_open():
    async def boom():
        raise RuntimeError("x")

    primary = _wrap("llm:p-all-open", fail_max=1, side_effect=lambda: (_ for _ in ()).throw(RuntimeError("p")))
    secondary = _wrap("llm:s-all-open", fail_max=1, side_effect=lambda: (_ for _ in ()).throw(RuntimeError("s")))
    chain = primary.with_fallbacks([secondary])

    # First call opens both breakers (primary then fallback both fail).
    with pytest.raises(Exception):
        await chain.ainvoke([])
    assert get_breaker("llm:p-all-open").state == "open"
    assert get_breaker("llm:s-all-open").state == "open"

    # Second call: both breakers open \u2192 CircuitOpenError surfaces.
    with pytest.raises(Exception) as excinfo:
        await chain.ainvoke([])
    # Either branch can win the race, but it must be a CircuitOpenError.
    assert isinstance(excinfo.value, CircuitOpenError)
