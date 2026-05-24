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
    Gauge,
    Histogram,
    generate_latest,
    multiprocess,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.logging import get_logger

log = get_logger("metrics")

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
_LLM_LATENCY = Histogram(
    "omni_llm_invoke_duration_seconds",
    "LLM invocation latency by provider.",
    labelnames=("provider",),
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0),
)
_RAG_LATENCY = Histogram(
    "omni_rag_retrieval_duration_seconds",
    "RAG retrieval latency (embed + DB) in seconds.",
    buckets=(0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)
_EMBED_CACHE_HITS = Counter(
    "omni_embed_query_cache_hits_total",
    "Embed query cache hits.",
)
_EMBED_REMOTE = Histogram(
    "omni_embed_query_remote_duration_seconds",
    "Remote embedder call latency in seconds.",
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)
_DB_POOL_SIZE = Gauge("omni_db_pool_size", "Configured SQLAlchemy DB pool size.")
_DB_POOL_CHECKED_OUT = Gauge("omni_db_pool_checked_out", "Currently checked-out DB connections.")
_DB_POOL_CHECKED_IN = Gauge("omni_db_pool_checked_in", "Currently idle DB connections in the pool.")
_DB_POOL_OVERFLOW = Gauge("omni_db_pool_overflow", "Current SQLAlchemy DB pool overflow connections.")


def record_event(event: str) -> None:
    """Public helper for event_bus / handlers to bump the events counter."""
    try:
        _EVT_COUNT.labels(event=event).inc()
    except Exception as exc:
        log.debug("event_metric_record_failed", error=str(exc))


def record_llm_latency(provider: str, seconds: float) -> None:
    try:
        _LLM_LATENCY.labels(provider=provider or "unknown").observe(float(seconds))
    except Exception as exc:
        log.debug("llm_latency_metric_failed", error=str(exc))


def record_rag_latency(seconds: float) -> None:
    try:
        _RAG_LATENCY.observe(float(seconds))
    except Exception as exc:
        log.debug("rag_latency_metric_failed", error=str(exc))


def record_embed_cache_hit() -> None:
    try:
        _EMBED_CACHE_HITS.inc()
    except Exception as exc:
        log.debug("embed_cache_metric_failed", error=str(exc))


def record_embed_remote(seconds: float) -> None:
    try:
        _EMBED_REMOTE.observe(float(seconds))
    except Exception as exc:
        log.debug("embed_remote_metric_failed", error=str(exc))


def record_tool(tool: str, ok: bool) -> None:
    try:
        _TOOL_COUNT.labels(tool=tool, ok="true" if ok else "false").inc()
    except Exception as exc:
        log.debug("tool_metric_record_failed", error=str(exc))


def record_safety(direction: str, verdict: str) -> None:
    try:
        _SAFETY_COUNT.labels(direction=direction, verdict=verdict).inc()
    except Exception as exc:
        log.debug("safety_metric_record_failed", error=str(exc))


def record_webhook(event: str, outcome: str) -> None:
    """outcome ∈ {ok, retry, failed, disabled}."""
    try:
        _WEBHOOK_COUNT.labels(event=event, outcome=outcome).inc()
    except Exception as exc:
        log.debug("webhook_metric_record_failed", error=str(exc))


def record_db_pool_metrics() -> None:
    """Best-effort SQLAlchemy pool gauges.

    These methods exist on QueuePool/AsyncAdaptedQueuePool. SQLite/static pools
    do not expose all of them, so missing methods are treated as "not
    applicable" rather than a metrics endpoint failure.
    """
    try:
        from app.db.session import engine
        pool = engine.sync_engine.pool
        if hasattr(pool, "size"):
            _DB_POOL_SIZE.set(float(pool.size()))
        if hasattr(pool, "checkedout"):
            _DB_POOL_CHECKED_OUT.set(float(pool.checkedout()))
        if hasattr(pool, "checkedin"):
            _DB_POOL_CHECKED_IN.set(float(pool.checkedin()))
        if hasattr(pool, "overflow"):
            _DB_POOL_OVERFLOW.set(float(pool.overflow()))
    except Exception as exc:
        log.debug("db_pool_metric_record_failed", error=str(exc))


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
            except Exception as exc:
                log.debug("http_metric_record_failed", error=str(exc))


router = APIRouter(tags=["meta"])


@router.get("/metrics", include_in_schema=False)
async def metrics() -> Response:
    # Single-process mode is sufficient for one uvicorn worker. For
    # multi-worker setups, set PROMETHEUS_MULTIPROC_DIR and the
    # collector below will aggregate across workers.
    import os
    record_db_pool_metrics()
    if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        data = generate_latest(registry)
    else:
        data = generate_latest(REGISTRY)
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)
