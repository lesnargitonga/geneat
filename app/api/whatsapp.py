"""WhatsApp Cloud API webhook — Phase 3.

GET  /webhooks/whatsapp     → Meta verification handshake
POST /webhooks/whatsapp     → inbound messages (text, audio, image, etc.)

Security:
  • X-Hub-Signature-256 verified against META_WA_APP_SECRET (raw body HMAC).
  • Idempotency keyed on the Meta message id (Redis SETNX) + DB unique index.

For audio messages we download the media + transcribe with Whisper before
handing the text to the AI brain. The reply is sent back as a WA text message.
"""
import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.channels.base import InboundTurn, handle_inbound
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.rate_limit import limiter, try_consume
from app.core.security import hash_msisdn, normalize_msisdn, verify_meta_signature
from app.jobs.runner import enqueue_job
from app.db.models import Channel
from app.integrations import transcription, whatsapp_client
from app.schemas.webhooks import MetaWebhookPayload

log = get_logger("wa.webhook")
settings = get_settings()
router = APIRouter(prefix="/webhooks/whatsapp", tags=["whatsapp"])


# ── Verification handshake ───────────────────────────────────────────

@router.get("")
async def verify(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
):
    if hub_mode == "subscribe" and hub_verify_token == get_settings().meta_wa_verify_token:
        return PlainTextResponse(hub_challenge)
    raise HTTPException(status_code=403, detail="verify token mismatch")


# ── Inbound webhook ──────────────────────────────────────────────────

@router.post("")
@limiter.limit("120/minute")
async def inbound(
    request: Request,
    db: AsyncSession = Depends(db_session),
    x_hub_signature_256: Optional[str] = Header(None),
):
    raw = await request.body()
    secret = get_settings().meta_wa_app_secret.get_secret_value()
    if secret and not verify_meta_signature(secret, raw, x_hub_signature_256):
        log.warning("wa_signature_invalid")
        raise HTTPException(status_code=401, detail="signature invalid")

    payload_raw = await request.json()
    try:
        payload = MetaWebhookPayload.model_validate(payload_raw).model_dump(exclude_none=True)
    except Exception as exc:
        log.warning("wa_payload_validation_failed", error=str(exc))
        # ACK malformed payloads to avoid retry storms on unrecoverable shape errors.
        return Response(status_code=200)
    for wa_id in _sender_wa_ids(payload):
        allowed = await try_consume(
            f"wa:inbound:{wa_id}",
            capacity=10,
            refill_per_sec=8.0 / 60.0,
        )
        if not allowed:
            log.warning(
                "wa_inbound_edge_rate_limited",
                sender_hash=hash_msisdn("+" + wa_id)[:16],
            )
            return Response(status_code=200)

    await enqueue_job(
        db,
        kind="whatsapp.inbound",
        payload={"payload": payload},
    )
    await db.commit()
    # Meta ACKs immediately; nudge the in-process runner so replies are not
    # stuck behind the poll interval or lower-priority queued jobs.
    asyncio.create_task(_drain_whatsapp_jobs())
    return Response(status_code=200)


async def _drain_whatsapp_jobs() -> None:
    try:
        from app.jobs.runner import run_due_jobs_once

        await run_due_jobs_once(limit=20)
    except Exception as e:
        log.warning("wa_job_drain_failed", error=str(e))


def _sender_wa_ids(payload: dict) -> list[str]:
    """Unique Meta ``from`` ids in an inbound webhook batch."""
    seen: set[str] = set()
    out: list[str] = []
    for entry in payload.get("entry", []) or []:
        if not isinstance(entry, dict):
            continue
        for change in entry.get("changes", []) or []:
            if not isinstance(change, dict):
                continue
            value = change.get("value") or {}
            for msg in value.get("messages", []) or []:
                if not isinstance(msg, dict):
                    continue
                wa_id = str(msg.get("from") or "").strip()
                if wa_id and wa_id not in seen:
                    seen.add(wa_id)
                    out.append(wa_id)
    return out


# ── Processing (durable job + legacy import) ─────────────────────────

async def process_whatsapp_payload(payload: dict) -> bool:
    """Walk Meta's nested structure → flatten to one InboundTurn per message.

    Returns True when at least one inbound message failed so the durable job
    can retry instead of being marked done with no customer reply.
    """
    from app.db.session import SessionLocal

    had_failures = False
    try:
        for entry in payload.get("entry", []) or []:
            if not isinstance(entry, dict):
                continue
            for change in entry.get("changes", []) or []:
                if not isinstance(change, dict):
                    continue
                value = change.get("value", {})
                phone_number_id = (value.get("metadata") or {}).get("phone_number_id")
                contacts = {
                    str(c.get("wa_id")): c
                    for c in (value.get("contacts", []) or [])
                    if isinstance(c, dict) and c.get("wa_id")
                }
                for status in value.get("statuses", []) or []:
                    if not isinstance(status, dict):
                        continue
                    _log_status(status, phone_number_id)
                for msg in value.get("messages", []) or []:
                    if not isinstance(msg, dict):
                        continue
                    try:
                        await _handle_one_message(SessionLocal, msg, contacts, phone_number_id)
                    except Exception as e:
                        had_failures = True
                        log.exception(
                            "wa_message_failed",
                            error=str(e),
                            msg_id=msg.get("id"),
                            msg_type=msg.get("type"),
                        )
    except Exception as e:
        log.exception("wa_process_failed", error=str(e))
        return True
    return had_failures


def _log_status(status: dict, phone_number_id: str | None) -> None:
    """Record Meta delivery callbacks without logging raw phone numbers."""
    try:
        from app.core.security import hash_msisdn

        recipient = status.get("recipient_id") or ""
        errors = status.get("errors") or []
        log.info(
            "wa_status_callback",
            phone_number_id=phone_number_id,
            message_id=status.get("id"),
            status=status.get("status"),
            recipient_hash=hash_msisdn("+" + recipient)[:16] if recipient else None,
            error_codes=[
                e.get("code") for e in errors
                if isinstance(e, dict) and e.get("code") is not None
            ],
        )
    except Exception as e:  # pragma: no cover
        log.warning("wa_status_log_failed", error=str(e))


async def _handle_one_message(SessionLocal, msg: dict, contacts: dict, phone_number_id: str | None) -> None:
    wa_id = str(msg.get("from", "") or "").strip()          # e.g. "254712345678"
    if not wa_id:
        return
    msg_id = msg.get("id")
    msg_type = msg.get("type", "text")
    contact = contacts.get(wa_id, {})
    profile_name = (contact.get("profile") or {}).get("name")

    text, media_url = "", None

    if msg_type == "text":
        text = (msg.get("text") or {}).get("body", "")
    elif msg_type == "audio":
        media_id = (msg.get("audio") or {}).get("id")
        if media_id:
            try:
                async def _audio_pipeline() -> str:
                    audio, mime = await whatsapp_client.download_media(media_id)
                    return await transcription.transcribe(audio, mime_type=mime)

                text = await asyncio.wait_for(_audio_pipeline(), timeout=12.0)
                media_url = f"wa-media:{media_id}"
            except Exception as e:
                log.warning("wa_audio_handle_failed", error=str(e))
                text = "[voice note could not be transcribed]"
    elif msg_type in {"image", "document"}:
        caption = (msg.get(msg_type) or {}).get("caption") or ""
        media_id = (msg.get(msg_type) or {}).get("id")
        if msg_type == "image" and media_id:
            # Download from Meta, mirror to R2, describe with Groq vision so
            # the LLM has actual semantic content to reason over.
            try:
                from app.services import media as media_svc

                async def _image_pipeline() -> tuple[str, str | None]:
                    binary, mime = await whatsapp_client.download_media(media_id)
                    public_url = await media_svc.upload_to_r2(
                        binary, mime, prefix="wa-inbound",
                    )
                    description: str | None = None
                    if public_url and public_url.startswith(("http://", "https://")):
                        description = await media_svc.describe_image(
                            public_url, caption=caption or None,
                        )
                    parts: list[str] = []
                    if caption:
                        parts.append(f'Customer caption: "{caption}"')
                    if description:
                        parts.append(f"Image description: {description}")
                    if not parts:
                        parts.append("[image received — no description available]")
                    return "\n".join(parts), public_url or f"wa-media:{media_id}"

                text, media_url = await asyncio.wait_for(_image_pipeline(), timeout=15.0)
            except Exception as e:
                log.warning("wa_image_handle_failed", error=str(e))
                text = caption or "[image received]"
                media_url = f"wa-media:{media_id}"
        else:
            text = caption or f"[{msg_type} received]"
            media_url = f"wa-media:{media_id}" if media_id else None
    elif msg_type == "location":
        loc = msg.get("location") or {}
        lat, lng = loc.get("latitude"), loc.get("longitude")
        name = loc.get("name") or ""
        addr = loc.get("address") or ""
        text = (
            f"[Customer shared a location pin] lat={lat} lng={lng}"
            + (f" name={name!r}" if name else "")
            + (f" address={addr!r}" if addr else "")
        )
        media_url = f"geo:{lat},{lng}" if lat is not None and lng is not None else None
    elif msg_type == "interactive":
        inter = msg.get("interactive") or {}
        reply = (inter.get("button_reply") or inter.get("list_reply") or {})
        title = str(reply.get("title") or "").strip()
        reply_id = str(reply.get("id") or "").strip()
        text = f"{title} [{reply_id}]" if title and reply_id else title
    else:
        text = f"[unsupported message type: {msg_type}]"

    if not text:
        return

    # Meta can deliver queued/test messages long after their original
    # timestamp. Free-form replies to those messages are rejected as
    # "Re-engagement message" (#131047), so reopen with a template instead.
    if _is_stale_customer_message(msg):
        log.info(
            "wa_stale_message_reengagement",
            msg_id=msg_id,
            msg_timestamp=msg.get("timestamp"),
        )
        try:
            await whatsapp_client.send_template(
                "+" + wa_id,
                settings.whatsapp_reengagement_template,
                lang=settings.whatsapp_reengagement_template_lang,
            )
        except Exception as e:
            log.exception("wa_reengagement_template_failed", error=str(e))
        return

    try:
        async with SessionLocal() as db:
            # Tenant routing: which business owns this WhatsApp number?
            from app.services.business_service import get_business_for_turn
            business = await get_business_for_turn(db, phone_number_id=phone_number_id)
            result = await handle_inbound(db, InboundTurn(
                msisdn_raw=normalize_msisdn("+" + wa_id), text=text, channel=Channel.whatsapp,
                customer_name=profile_name, media_url=media_url,
                provider_message_id=msg_id,
                business_id=business.id if business else None,
                meta_phone_number_id=phone_number_id,
            ))
        if result.duplicate:
            return
        reply = (result.reply or "").strip()
        if not reply:
            log.warning(
                "wa_empty_reply_fallback",
                conv=str(result.conversation_id),
                escalated=result.escalated,
            )
            reply = (
                "Sorry — I hit a snag on that one. "
                "Please try again, or ask about the menu, prices, or an order."
            )
        from app.channels import whatsapp as wa_channel
        sent = await wa_channel.send_text("+" + wa_id, reply)
        if not sent.get("ok", True):
            log.warning("wa_reply_send_retry", error=sent.get("error"))
            retry = await wa_channel.send_text("+" + wa_id, reply)
            if not retry.get("ok", True):
                raise RuntimeError(str(retry.get("error") or sent.get("error") or "send_failed"))
        # Follow the authoritative text with tappable controls (Meta only;
        # the channel module degrades to plain text for other providers).
        interactive = getattr(result, "interactive", None)
        if interactive and isinstance(interactive, dict):
            await _send_interactive("+" + wa_id, interactive, wa_channel)
    except Exception as e:
        log.exception("wa_reply_send_failed", error=str(e), msg_id=msg_id)
        try:
            from app.channels import whatsapp as wa_channel
            await wa_channel.send_text(
                "+" + wa_id,
                "Our concierge line is catching up. Please send your message again in a moment.",
            )
        except Exception as apology_exc:
            log.exception("wa_apology_send_failed", error=str(apology_exc))
        raise


async def _send_interactive(to_msisdn: str, interactive: dict, wa_channel) -> None:
    """Send a Meta buttons/list payload as a follow-up to the text reply."""
    kind = (interactive.get("type") or "").lower()
    body = (interactive.get("body") or "").strip()
    try:
        if kind == "buttons":
            buttons = interactive.get("buttons") or []
            if buttons:
                await wa_channel.send_reply_buttons(to_msisdn, body=body, buttons=buttons)
        elif kind == "list":
            sections = interactive.get("sections") or []
            if sections:
                await wa_channel.send_list_message(
                    to_msisdn,
                    body=body,
                    button_text=interactive.get("button_text") or "Choose",
                    sections=sections,
                    header=interactive.get("header"),
                    footer=interactive.get("footer"),
                )
    except Exception as e:
        log.warning("wa_interactive_send_failed", error=str(e), kind=kind)


def _is_stale_customer_message(msg: dict, *, max_age_seconds: int = 23 * 3600) -> bool:
    ts_raw = msg.get("timestamp")
    try:
        ts = int(str(ts_raw))
    except (TypeError, ValueError):
        return False
    age = int(datetime.now(timezone.utc).timestamp()) - ts
    return age > max_age_seconds
