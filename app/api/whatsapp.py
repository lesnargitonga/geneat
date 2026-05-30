"""WhatsApp Cloud API webhook — Phase 3.

GET  /webhooks/whatsapp     → Meta verification handshake
POST /webhooks/whatsapp     → inbound messages (text, audio, image, etc.)

Security:
  • X-Hub-Signature-256 verified against META_WA_APP_SECRET (raw body HMAC).
  • Idempotency keyed on the Meta message id (Redis SETNX) + DB unique index.

For audio messages we download the media + transcribe with Whisper before
handing the text to the AI brain. The reply is sent back as a WA text message.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db_session
from app.channels.base import InboundTurn, handle_inbound
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.core.security import verify_meta_signature
from app.db.models import Channel
from app.integrations import transcription, whatsapp_client

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
@limiter.limit("600/minute")
async def inbound(
    request: Request,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(db_session),
    x_hub_signature_256: Optional[str] = Header(None),
):
    raw = await request.body()
    secret = get_settings().meta_wa_app_secret.get_secret_value()
    if secret and not verify_meta_signature(secret, raw, x_hub_signature_256):
        log.warning("wa_signature_invalid")
        raise HTTPException(status_code=401, detail="signature invalid")

    payload = await request.json()
    # Hand off the (potentially slow) processing to a background task so we ACK
    # Meta within the required 5 seconds.
    bg.add_task(_process_payload, payload)
    return Response(status_code=200)


# ── Processing ───────────────────────────────────────────────────────

async def _process_payload(payload: dict) -> None:
    """Walk Meta's nested structure → flatten to one InboundTurn per message."""
    from app.db.session import SessionLocal
    try:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                phone_number_id = (value.get("metadata") or {}).get("phone_number_id")
                contacts = {c["wa_id"]: c for c in value.get("contacts", [])}
                for status in value.get("statuses", []):
                    _log_status(status, phone_number_id)
                for msg in value.get("messages", []):
                    await _handle_one_message(SessionLocal, msg, contacts, phone_number_id)
    except Exception as e:
        log.exception("wa_process_failed", error=str(e))


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
    wa_id = msg.get("from", "")          # e.g. "254712345678"
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
                audio, mime = await whatsapp_client.download_media(media_id)
                text = await transcription.transcribe(audio, mime_type=mime)
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
                text = "\n".join(parts)
                media_url = public_url or f"wa-media:{media_id}"
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

    async with SessionLocal() as db:
        # Tenant routing: which business owns this WhatsApp number?
        from app.services.business_service import get_business_for_turn
        business = await get_business_for_turn(db, phone_number_id=phone_number_id)
        result = await handle_inbound(db, InboundTurn(
            msisdn_raw="+" + wa_id, text=text, channel=Channel.whatsapp,
            customer_name=profile_name, media_url=media_url,
            provider_message_id=msg_id,
            business_id=business.id if business else None,
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
    try:
        from app.channels import whatsapp as wa_channel
        sent = await wa_channel.send_text("+" + wa_id, reply)
        if not sent.get("ok", True):
            log.warning("wa_reply_send_retry", error=sent.get("error"))
            await wa_channel.send_text("+" + wa_id, reply)
        # Follow the authoritative text with tappable controls (Meta only;
        # the channel module degrades to plain text for other providers).
        interactive = getattr(result, "interactive", None)
        if interactive and isinstance(interactive, dict):
            await _send_interactive("+" + wa_id, interactive, wa_channel)
    except Exception as e:
        log.exception("wa_reply_send_failed", error=str(e))


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
