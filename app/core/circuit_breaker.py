"""In-process circuit breaker for upstream calls (LLMs, payment APIs, etc).

When a provider keeps failing, opening the breaker stops further calls to it
for a cool-down period, so we fail over INSTANTLY instead of waiting for each
request to time out (which would cause a thundering herd on retries).

States:
    closed     — normal traffic
    open       — upstream is dead; calls short-circuit immediately
    half_open  — cool-down elapsed; allow one trial call to probe recovery

Thread/async-safe for single-process use. For multi-worker deployments,
breaker state is per-worker — that's intentional: each worker probes
independently and tolerates a small per-worker spike.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from app.core.logging import get_logger

log = get_logger("breaker")


class CircuitOpenError(Exception):
    """Raised when a call is short-circuited because the breaker is OPEN."""

    def __init__(self, name: str, opened_for_seconds: float):
        self.name = name
        self.opened_for = opened_for_seconds
        super().__init__(
            f"Circuit '{name}' is OPEN (opened {opened_for_seconds:.1f}s ago)"
        )


@dataclass
class CircuitBreaker:
    name: str
    fail_max: int = 5
    reset_timeout: float = 60.0  # seconds
    # internal state
    _state: str = field(default="closed")
    _failures: int = field(default=0)
    _opened_at: float = field(default=0.0)

    def allow(self) -> bool:
        """Return True if a call should be attempted; transitions OPEN→HALF_OPEN
        once the cool-down has elapsed."""
        if self._state == "closed":
            return True
        if self._state == "open":
            if time.time() - self._opened_at >= self.reset_timeout:
                self._state = "half_open"
                log.info("breaker_half_open", name=self.name)
                return True
            return False
        # half_open: allow probe through.
        return True

    def record_success(self) -> None:
        if self._state != "closed":
            log.info("breaker_closed", name=self.name, prior_failures=self._failures)
        self._failures = 0
        self._state = "closed"

    def record_failure(self) -> None:
        self._failures += 1
        if self._state == "half_open":
            # Probe failed → re-open.
            self._state = "open"
            self._opened_at = time.time()
            log.warning("breaker_reopened", name=self.name, failures=self._failures)
            return
        if self._state == "closed" and self._failures >= self.fail_max:
            self._state = "open"
            self._opened_at = time.time()
            log.warning(
                "breaker_opened", name=self.name,
                failures=self._failures, cool_down=self.reset_timeout,
            )

    @property
    def state(self) -> str:
        return self._state

    def snapshot(self) -> dict:
        return {
            "name": self.name,
            "state": self._state,
            "failures": self._failures,
            "opened_for": (time.time() - self._opened_at) if self._state != "closed" else 0,
        }


_REGISTRY: dict[str, CircuitBreaker] = {}


def get_breaker(name: str, *, fail_max: int = 5, reset_timeout: float = 60.0) -> CircuitBreaker:
    """Return the singleton breaker for `name`, creating it on first access."""
    b = _REGISTRY.get(name)
    if b is None:
        b = CircuitBreaker(name=name, fail_max=fail_max, reset_timeout=reset_timeout)
        _REGISTRY[name] = b
    return b


def snapshot_all() -> list[dict]:
    return [b.snapshot() for b in _REGISTRY.values()]
