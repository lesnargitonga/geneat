"""Prometheus metrics endpoint + instrumentation.

Exposes `/metrics` in the standard Prometheus text format. Designed for
scrape by a sidecar / node exporter. Counters and histograms are kept
deliberately small (cardinality-safe) — we label by route template, not
by the raw path, and we drop the method when it's not interesting.

Wire-up (in ``app.main``):

    from app.api.metrics import router as metrics_router, MetricsMiddleware
    app.add_middleware(MetricsMiddleware)
    app.include_router(metrics_router)
"""
from __future__ import annotations

import time

from fastapi import APIRouter, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    REGISTRY,
    CollectorRegistry,
    Counter,
    Histogram,
    generate_latest,
    multiprocess,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# ── Metric definitions ───────────────────────────────────────────────
# Histogram buckets chosen for a chat/orders workload — sub-100ms is
# the AI-free admin path, 1-10s is the LLM path. Anything > 30s is a
# timeout or stuck request.
_LATENCY = Histogram(
    "omni_http_request_duration_seconds",
    "HTTP request latency by route template.",
    labelnames=("method", "route", "status_bucket"),
    buckets=(0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)
_REQ_COUNT = Counter(
    "omni_http_requests_total",
    "Total HTTP requests by route template + status bucket.",
    labelnames=("method", "route", "status_bucket"),
)
_EVT_COUNT = Counter(
    "omni_events_total",
    "Internal event-bus messages by type.",
    labelnames=("event",),
)
_TOOL_COUNT = Counter(
    "omni_tool_invocations_total",
    "AI tool invocations by name + outcome.",
    labelnames=("tool", "ok"),
)
_SAFETY_COUNT = Counter(
    "omni_safety_verdicts_total",
    "Safety filter verdicts by direction + outcome.",
    labelnames=("direction", "verdict"),
)
_WEBHOOK_COUNT = Counter(
    "omni_webhook_deliveries_total",
    "Outbound webhook deliveries by event + outcome.",
    labelnames=("event", "outcome"),
)


def record_event(event: str) -> None:
    """Public helper for event_bus / handlers to bump the events counter."""
    try:
        _EVT_COUNT.labels(event=event).inc()
    except Exception:
        pass


def record_tool(tool: str, ok: bool) -> None:
    try:
        _TOOL_COUNT.labels(tool=tool, ok="true" if ok else "false").inc()
    except Exception:
        pass


def record_safety(direction: str, verdict: str) -> None:
    try:
        _SAFETY_COUNT.labels(direction=direction, verdict=verdict).inc()
    except Exception:
        pass


def record_webhook(event: str, outcome: str) -> None:
    """outcome ∈ {ok, retry, failed, disabled}."""
    try:
        _WEBHOOK_COUNT.labels(event=event, outcome=outcome).inc()
    except Exception:
        pass


def _status_bucket(code: int) -> str:
    if code < 200:
        return "1xx"
    if code < 300:
        return "2xx"
    if code < 400:
        return "3xx"
    if code < 500:
        return "4xx"
    return "5xx"


def _route_template(request: Request) -> str:
    """Use the matched route's template ('/admin/customers/{id}') instead
    of the literal path, to keep label cardinality bounded."""
    route = request.scope.get("route")
    if route is not None and getattr(route, "path", None):
        return route.path  # type: ignore[no-any-return]
    return request.url.path  # fallback (e.g. 404s)


class MetricsMiddleware(BaseHTTPMiddleware):
    """Records duration + count per request. Skips /metrics itself so
    scrapes don't show up as request load."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)
        t0 = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            elapsed = time.perf_counter() - t0
            bucket = _status_bucket(status_code)
            route = _route_template(request)
            method = request.method
            try:
                _LATENCY.labels(method=method, route=route, status_bucket=bucket).observe(elapsed)
                _REQ_COUNT.labels(method=method, route=route, status_bucket=bucket).inc()
            except Exception:
                pass


router = APIRouter(tags=["meta"])


@router.get("/metrics", include_in_schema=False)
async def metrics() -> Response:
    # Single-process mode is sufficient for one uvicorn worker. For
    # multi-worker setups, set PROMETHEUS_MULTIPROC_DIR and the
    # collector below will aggregate across workers.
    import os
    if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        data = generate_latest(registry)
    else:
        data = generate_latest(REGISTRY)
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)
