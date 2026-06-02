"""Structured logging with request_id / conversation_id correlation.

Production keeps JSON logs for machines.
Local development can use a colorized console renderer for human eyes.
"""
from __future__ import annotations

import logging
import sys
from contextlib import contextmanager
from contextvars import ContextVar, Token
from typing import Any, Iterator
from uuid import UUID

import structlog

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)
conversation_id_ctx: ContextVar[str | None] = ContextVar("conversation_id", default=None)
business_id_ctx: ContextVar[str | None] = ContextVar("business_id", default=None)
tenant_slug_ctx: ContextVar[str | None] = ContextVar("tenant_slug", default=None)
order_id_ctx: ContextVar[str | None] = ContextVar("order_id", default=None)
public_reference_ctx: ContextVar[str | None] = ContextVar("public_reference", default=None)


def _add_context(_, __, event_dict):
    rid = request_id_ctx.get()
    cid = conversation_id_ctx.get()
    bid = business_id_ctx.get()
    slug = tenant_slug_ctx.get()
    oid = order_id_ctx.get()
    pref = public_reference_ctx.get()
    if rid:
        event_dict.setdefault("request_id", rid)
    if cid:
        event_dict.setdefault("conversation_id", cid)
    if bid:
        event_dict.setdefault("business_id", bid)
    if slug:
        event_dict.setdefault("tenant", slug)
    if oid:
        event_dict.setdefault("order_id", oid)
    if pref:
        event_dict.setdefault("public_reference", pref)
    return event_dict


def _public_reference_from_details(details: Any, *, order_id: UUID | str | None = None) -> str | None:
    if isinstance(details, dict):
        ref = str(details.get("public_reference") or "").strip()
        if ref:
            return ref
    if order_id is not None:
        from app.services.order_tracking import public_reference_for

        return public_reference_for(UUID(str(order_id)))
    return None


def bind_order_log_context(
    order: Any | None = None,
    *,
    order_id: UUID | str | None = None,
    public_reference: str | None = None,
    details: dict | None = None,
) -> None:
    """Attach order correlation fields to structlog for the current task."""
    oid = order_id
    pref = (public_reference or "").strip() or None
    det = details
    if order is not None:
        oid = oid or getattr(order, "id", None)
        det = det if det is not None else getattr(order, "details", None)
    if oid is not None:
        order_id_ctx.set(str(oid))
    if not pref:
        pref = _public_reference_from_details(det, order_id=oid)
    if pref:
        public_reference_ctx.set(pref)


@contextmanager
def order_log_context(
    order: Any | None = None,
    *,
    order_id: UUID | str | None = None,
    public_reference: str | None = None,
    details: dict | None = None,
) -> Iterator[None]:
    """Temporarily bind order_id / public_reference to structlog context."""
    tokens: list[tuple[ContextVar[str | None], Token[str | None]]] = []
    oid = order_id or (getattr(order, "id", None) if order is not None else None)
    det = details if details is not None else (getattr(order, "details", None) if order is not None else None)
    pref = (public_reference or "").strip() or None
    if not pref:
        pref = _public_reference_from_details(det, order_id=oid)
    if oid is not None:
        tokens.append((order_id_ctx, order_id_ctx.set(str(oid))))
    if pref:
        tokens.append((public_reference_ctx, public_reference_ctx.set(pref)))
    try:
        yield
    finally:
        for var, token in reversed(tokens):
            var.reset(token)


def _pick_renderer(*, level: str, log_format: str | None) -> object:
    fmt = (log_format or "auto").strip().lower()
    if fmt not in {"auto", "json", "console"}:
        fmt = "auto"

    if fmt == "json":
        return structlog.processors.JSONRenderer()

    if fmt == "console" or (fmt == "auto" and sys.stdout.isatty()):
        return structlog.dev.ConsoleRenderer(
            colors=sys.stdout.isatty(),
            sort_keys=False,
        )

    return structlog.processors.JSONRenderer()


def configure_logging(level: str = "INFO", log_format: str | None = None) -> None:
    renderer = _pick_renderer(level=level, log_format=log_format)
    logging.basicConfig(
        format="%(message)s", stream=sys.stdout, level=getattr(logging, level.upper(), logging.INFO)
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            _add_context,
            structlog.stdlib.add_logger_name,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            renderer,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level.upper(), logging.INFO)
        ),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = "app") -> structlog.stdlib.BoundLogger:  # type: ignore[name-defined]
    return structlog.get_logger(name)
