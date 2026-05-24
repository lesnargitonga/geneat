"""Background runner that processes outbox rows and delivers webhooks.

This mirrors the delivery semantics previously embedded in
``webhook_dispatcher._deliver_one`` but centralises retries, metrics and
endpoint state updates in a single background task.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone

import httpx

from app.core.logging import get_logger
from app.db.models import Outbox, WebhookEndpoint
from app.db.session import SessionLocal
from app.services.outbox import fetch_pending, mark_sent, mark_failed
from app.api.metrics import record_webhook

log = get_logger("outbox.runner")

_runner_task: asyncio.Task | None = None
_poll_interval = 1.0


async def _post_with_retries(url: str, body: bytes, sig: str) -> tuple[int | None, str | None]:
    delays = [0.5, 2.0, 8.0]
    last_status: int | None = None
    last_error: str | None = None
    headers = {
        "Content-Type": "application/json",
        "X-Omni-Signature": sig,
        "User-Agent": "Gen-Eat-Webhooks/1.0",
    }
    timeout = httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        for attempt, delay in enumerate(delays):
            try:
                resp = await client.post(url, content=body, headers=headers)
                last_status = resp.status_code
                if 200 <= resp.status_code < 300:
                    return last_status, None
                last_error = f"http_{resp.status_code}"
                if 400 <= resp.status_code < 500 and resp.status_code not in (408, 429):
                    return last_status, last_error
            except httpx.HTTPError as e:
                last_error = type(e).__name__
            if attempt < len(delays) - 1:
                await asyncio.sleep(delay)
    return last_status, last_error or "exhausted_retries"


async def _process_row(row: Outbox) -> None:
    payload = dict(row.payload or {})
    endpoint_id = payload.get("endpoint_id")
    body_text = payload.get("body")
    sig = payload.get("sig")
    if not endpoint_id or not body_text:
        await mark_failed(int(row.id), "invalid_payload")
        return

    body = body_text.encode("utf-8")

    try:
        # Load endpoint and deliver.
        async with SessionLocal() as db:
            try:
                eid = uuid.UUID(endpoint_id)
            except Exception:
                await mark_failed(int(row.id), "bad_endpoint_id")
                return
            endpoint = await db.get(WebhookEndpoint, eid)
            if endpoint is None or not endpoint.active:
                await mark_failed(int(row.id), "endpoint_missing_or_inactive")
                return
            url = endpoint.url

        status, err = await _post_with_retries(url, body, sig or "")

        # Update endpoint metadata and record metrics.
        async with SessionLocal() as db:
            fresh = await db.get(WebhookEndpoint, eid)
            if fresh is None:
                # Endpoint removed after enqueue — nothing to do.
                await mark_failed(int(row.id), "endpoint_deleted")
                return
            fresh.last_delivery_at = datetime.now(timezone.utc)
            fresh.last_status = status
            if err is None:
                fresh.last_error = None
                fresh.failure_count = 0
                # Record metrics: success
                try:
                    et = payload.get("event_type") or ""
                    record_webhook(et, "ok")
                except Exception:
                    pass
            else:
                fresh.last_error = (err or "")[:500]
                fresh.failure_count = (fresh.failure_count or 0) + 1
                # Record metrics: failure or disabled
                try:
                    et = payload.get("event_type") or ""
                    if fresh.failure_count >= 20:
                        record_webhook(et, "disabled")
                    else:
                        record_webhook(et, "failed")
                except Exception:
                    pass
                if fresh.failure_count >= 20:
                    fresh.active = False
            await db.commit()

        # Finalise outbox row.
        if err is None:
            await mark_sent(int(row.id))
        else:
            await mark_failed(int(row.id), str(err)[:500])

    except Exception as e:  # pragma: no cover - defensive
        log.exception("outbox_process_error", error=str(e))
        await mark_failed(int(row.id), "internal_error")


async def _runner_loop() -> None:
    log.info("outbox_runner_started")
    while True:
        try:
            rows = await fetch_pending(limit=20)
            if not rows:
                await asyncio.sleep(_poll_interval)
                continue
            for r in rows:
                await _process_row(r)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # pragma: no cover
            log.warning("outbox_runner_error", error=str(e))
            await asyncio.sleep(_poll_interval)


async def start_outbox_runner() -> asyncio.Task:
    global _runner_task
    if _runner_task is None or _runner_task.done():
        _runner_task = asyncio.create_task(_runner_loop(), name="outbox-runner")
    return _runner_task


async def stop_outbox_runner() -> None:
    global _runner_task
    if _runner_task and not _runner_task.done():
        _runner_task.cancel()
        try:
            await _runner_task
        except (asyncio.CancelledError, Exception):
            pass
    _runner_task = None
