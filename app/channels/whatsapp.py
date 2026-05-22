"""WhatsApp channel — Phase 3 placeholder.

Webhook verification & message dispatch land here. For Phase 1+2 we only
expose the signature-verification helper and a no-op send function so the
rest of the system compiles and tests run.
"""
from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.rate_limit import wa_outbound_allowed
from app.core.security import verify_meta_signature

log = get_logger("wa")
settings = get_settings()


def verify_inbound(body: bytes, header: str | None) -> bool:
    secret = settings.meta_wa_app_secret.get_secret_value()
    if not secret:  # dev mode / mocks
        return True
    return verify_meta_signature(secret, body, header)


async def send_text(to_msisdn: str, text: str) -> dict:
    """Send a WhatsApp text reply (provider-aware) with outbound rate limit.

    Dispatch order keyed on ``settings.whatsapp_provider``:
      • ``twilio``  → Twilio REST API (``app.integrations.twilio_whatsapp``)
      • everything else (``meta`` / ``mock`` / default) → Meta Cloud API
    """
    if not await wa_outbound_allowed():
        log.warning("wa_outbound_rate_limited", to=to_msisdn[-4:])
        return {"ok": False, "error": "rate_limited"}
    try:
        if settings.whatsapp_provider == "twilio":
            from app.integrations import twilio_whatsapp
            return await twilio_whatsapp.send_text(to_msisdn, text)
        from app.integrations import whatsapp_client
        return await whatsapp_client.send_text(to_msisdn, text)
    except Exception as e:
        log.exception("wa_send_failed", error=str(e))
        return {"ok": False, "error": "upstream"}


async def send_image(to_msisdn: str, image_url: str, caption: str | None = None) -> dict:
    """Send a WhatsApp image (provider-aware).

    Dispatch order keyed on ``settings.whatsapp_provider``:
      • ``twilio`` → Twilio REST API ``send_media``
      • everything else → Meta Cloud API ``send_image``
    """
    if not await wa_outbound_allowed():
        log.warning("wa_outbound_rate_limited_image", to=to_msisdn[-4:])
        return {"ok": False, "error": "rate_limited"}
    try:
        if settings.whatsapp_provider == "twilio":
            from app.integrations import twilio_whatsapp
            return await twilio_whatsapp.send_media(to_msisdn, image_url, body=caption)
        from app.integrations import whatsapp_client
        return await whatsapp_client.send_image(to_msisdn, image_url, caption=caption)
    except Exception as e:
        log.exception("wa_send_image_failed", error=str(e))
        return {"ok": False, "error": "upstream"}
