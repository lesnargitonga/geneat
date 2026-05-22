"""Twilio WhatsApp REST client — outbound message sender.

Used by `app/channels/whatsapp.py` when `WHATSAPP_PROVIDER=twilio`.

Twilio WhatsApp API:
    POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
    Basic auth (SID, AuthToken)
    Form fields: To=whatsapp:+E164, From=whatsapp:+E164, Body=...

Outbound is only needed when we send PROACTIVE messages (i.e. not the
synchronous TwiML reply to an inbound webhook). For sandbox demos the
TwiML reply path is sufficient and this client is the fallback.
"""
from __future__ import annotations

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("twilio.wa")

_API_BASE = "https://api.twilio.com/2010-04-01"
_BODY_LIMIT = 1600  # Twilio WhatsApp single-segment cap.


def _token_value(secret) -> str:
    return secret.get_secret_value() if hasattr(secret, "get_secret_value") else (secret or "")


async def send_text(to_msisdn: str, body: str) -> dict:
    """Send a WhatsApp text via Twilio REST API.

    `to_msisdn` accepts either bare E.164 (`+254...`) or the `whatsapp:` prefix.
    Returns `{"ok": True, "sid": "..."}` on success, `{"ok": False, "error": ...}`
    on failure (never raises — caller logs and continues).
    """
    s = get_settings()
    sid = s.twilio_account_sid
    token = _token_value(s.twilio_auth_token)
    from_ = s.twilio_phone_number
    if not (sid and token and from_):
        log.warning("twilio_wa_missing_credentials")
        return {"ok": False, "error": "config"}

    to_ = to_msisdn if to_msisdn.startswith("whatsapp:") else f"whatsapp:{to_msisdn}"
    if not from_.startswith("whatsapp:"):
        from_ = f"whatsapp:{from_}"

    url = f"{_API_BASE}/Accounts/{sid}/Messages.json"
    data = {"To": to_, "From": from_, "Body": body[:_BODY_LIMIT]}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, data=data, auth=(sid, token))
    except httpx.HTTPError as e:
        log.warning("twilio_wa_send_network_error", error=str(e))
        return {"ok": False, "error": "network"}

    if r.status_code >= 400:
        log.warning("twilio_wa_send_failed", status=r.status_code, body=r.text[:200])
        return {"ok": False, "error": f"http_{r.status_code}"}
    try:
        payload = r.json()
    except ValueError:
        payload = {}
    return {"ok": True, "sid": payload.get("sid")}


async def send_media(to_msisdn: str, media_url: str, body: str | None = None) -> dict:
    """Send a WhatsApp image (or other media) via Twilio REST API.

    `media_url` must be a public https URL Twilio can fetch (jpg/png/etc).
    `body` is an optional caption sent in the same message.
    Returns `{"ok": True, "sid": "..."}` on success.
    """
    s = get_settings()
    sid = s.twilio_account_sid
    token = _token_value(s.twilio_auth_token)
    from_ = s.twilio_phone_number
    if not (sid and token and from_):
        log.warning("twilio_wa_missing_credentials")
        return {"ok": False, "error": "config"}

    to_ = to_msisdn if to_msisdn.startswith("whatsapp:") else f"whatsapp:{to_msisdn}"
    if not from_.startswith("whatsapp:"):
        from_ = f"whatsapp:{from_}"

    url = f"{_API_BASE}/Accounts/{sid}/Messages.json"
    data: dict[str, str] = {"To": to_, "From": from_, "MediaUrl": media_url}
    if body:
        data["Body"] = body[:_BODY_LIMIT]
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(url, data=data, auth=(sid, token))
    except httpx.HTTPError as e:
        log.warning("twilio_wa_send_media_network_error", error=str(e))
        return {"ok": False, "error": "network"}

    if r.status_code >= 400:
        log.warning("twilio_wa_send_media_failed", status=r.status_code, body=r.text[:200])
        return {"ok": False, "error": f"http_{r.status_code}"}
    try:
        payload = r.json()
    except ValueError:
        payload = {}
    return {"ok": True, "sid": payload.get("sid")}
