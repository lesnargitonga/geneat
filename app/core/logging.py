"""Structured JSON logging with request_id / conversation_id correlation."""
from __future__ import annotations

import logging
import sys
from contextvars import ContextVar

import structlog

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)
conversation_id_ctx: ContextVar[str | None] = ContextVar("conversation_id", default=None)
business_id_ctx: ContextVar[str | None] = ContextVar("business_id", default=None)
tenant_slug_ctx: ContextVar[str | None] = ContextVar("tenant_slug", default=None)


def _add_context(_, __, event_dict):
    rid = request_id_ctx.get()
    cid = conversation_id_ctx.get()
    bid = business_id_ctx.get()
    slug = tenant_slug_ctx.get()
    if rid:
        event_dict.setdefault("request_id", rid)
    if cid:
        event_dict.setdefault("conversation_id", cid)
    if bid:
        event_dict.setdefault("business_id", bid)
    if slug:
        event_dict.setdefault("tenant", slug)
    return event_dict


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        format="%(message)s", stream=sys.stdout, level=getattr(logging, level.upper(), logging.INFO)
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            _add_context,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level.upper(), logging.INFO)
        ),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = "app") -> structlog.stdlib.BoundLogger:  # type: ignore[name-defined]
    return structlog.get_logger(name)
