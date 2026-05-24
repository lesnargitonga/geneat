"""Sentry integration — no-op when SENTRY_DSN is unset.

Initialised early in `app.main` lifespan. Auto-captures unhandled exceptions
from FastAPI, asyncio tasks, and SQLAlchemy. PII (phone numbers, message
bodies) is stripped via `before_send` unless `SENTRY_SEND_PII=true`.
"""
from __future__ import annotations

import re
from typing import Any

from app.core.config import Settings
from app.core.logging import get_logger

log = get_logger("sentry")

_PII_PHONE = re.compile(r"\+?\d{8,15}")


def _scrub(event: dict[str, Any], _hint: dict) -> dict | None:
    """Strip likely PII from event payloads before they leave the process."""
    def _walk(obj):
        if isinstance(obj, str):
            return _PII_PHONE.sub("[phone]", obj)
        if isinstance(obj, dict):
            return {k: _walk(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_walk(x) for x in obj]
        return obj

    # Scrub common containers
    for k in ("breadcrumbs", "request", "extra", "tags", "contexts"):
        if k in event:
            event[k] = _walk(event[k])
    if "message" in event and isinstance(event["message"], str):
        event["message"] = _PII_PHONE.sub("[phone]", event["message"])
    return event


def init_sentry(s: Settings) -> bool:
    """Initialise Sentry. Returns True if active, False if disabled or unavailable."""
    dsn = (getattr(s, "sentry_dsn", "") or "").strip()
    traces_sample_rate = float(getattr(s, "sentry_traces_sample_rate", 0.0) or 0.0)
    send_pii = bool(getattr(s, "sentry_send_pii", False))
    log.info(
        "sentry_init_start",
        env=s.app_env,
        dsn_configured=bool(dsn),
        traces_sample_rate=traces_sample_rate,
        send_default_pii=send_pii,
    )
    if not dsn:
        log.info("sentry_disabled", env=s.app_env, reason="no_dsn")
        return False
    try:
        import sentry_sdk
        from sentry_sdk.integrations.asyncio import AsyncioIntegration
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.redis import RedisIntegration
    except ImportError as exc:
        log.warning("sentry_disabled", env=s.app_env, reason="sentry_sdk_not_installed", error=str(exc))
        return False

    sentry_sdk.init(
        dsn=dsn,
        environment=s.app_env,
        release=getattr(s, "app_version", None) or "omnichannel-ai@0.2.0",
        traces_sample_rate=traces_sample_rate,
        send_default_pii=send_pii,
        integrations=[
            FastApiIntegration(),
            AsyncioIntegration(),
            SqlalchemyIntegration(),
            RedisIntegration(),
        ],
        before_send=_scrub if not send_pii else None,
    )
    log.info(
        "sentry_enabled",
        env=s.app_env,
        traces_sample_rate=traces_sample_rate,
        send_default_pii=send_pii,
    )
    return True
