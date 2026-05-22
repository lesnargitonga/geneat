"""Meta WhatsApp Cloud API client.

- OAuth: uses a long-lived Page/System-User access token (env: META_WA_ACCESS_TOKEN).
- Send text + template messages.
- Download media (voice notes, images) via the two-step Graph API flow:
    GET /v18.0/{media_id}    → { url, mime_type, ... }
    GET {url}                → binary (must send Bearer token here too)

All outbound calls go through the Redis token-bucket so we never breach Meta's
80 msg/s tier limits.
"""
from __future__ import annotations

import mimetypes

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

from app.core.config import get_settings
from app.core.exceptions import UpstreamError
from app.core.logging import get_logger
from app.core.rate_limit import wa_outbound_allowed

log = get_logger("wa.client")
settings = get_settings()

GRAPH_BASE = "https://graph.facebook.com/v20.0"


def _auth_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.meta_wa_access_token.get_secret_value()}",
        "Content-Type": "application/json",
    }


async def _upload_media_from_url(image_url: str) -> str | None:
    """Mirror a remote image into Meta media storage and return its media id.

    This avoids relying on third-party image hosts being fetchable by Meta at
    send time. Falls back to plain link sends if anything in the upload path
    fails.
    """
    if not settings.meta_wa_phone_number_id:
        return None
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
        src = await c.get(image_url)
        src.raise_for_status()
        mime = src.headers.get("content-type", "").split(";", 1)[0].strip() or "image/jpeg"
        ext = mimetypes.guess_extension(mime) or ".jpg"
        files = {
            "file": (f"menu-photo{ext}", src.content, mime),
            "messaging_product": (None, "whatsapp"),
        }
        upload = await c.post(
            f"{GRAPH_BASE}/{settings.meta_wa_phone_number_id}/media",
            headers={"Authorization": f"Bearer {settings.meta_wa_access_token.get_secret_value()}"},
            files=files,
        )
        if upload.status_code >= 400:
            log.warning("wa_media_upload_failed", status=upload.status_code, body=upload.text[:300])
            return None
        media_id = str(upload.json().get("id") or "").strip()
        return media_id or None


@retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=0.3, max=3.0))
async def send_text(to_msisdn: str, body: str) -> dict:
    if not await wa_outbound_allowed():
        log.warning("wa_outbound_rate_limited"); raise UpstreamError("wa rate limited")
    if not settings.meta_wa_phone_number_id:
        log.info("wa_send_stub_no_creds", tail=to_msisdn[-4:]); return {"stub": True}

    url = f"{GRAPH_BASE}/{settings.meta_wa_phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_msisdn.lstrip("+"),
        "type": "text",
        "text": {"preview_url": False, "body": body[:4000]},
    }
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(url, json=payload, headers=_auth_headers())
        if r.status_code >= 400:
            log.error("wa_send_failed", status=r.status_code, body=r.text[:500])
            raise UpstreamError(f"wa send failed: {r.status_code}")
        return r.json()


@retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=0.3, max=3.0))
async def send_template(to_msisdn: str, template_name: str, lang: str = "en", components: list | None = None) -> dict:
    if not await wa_outbound_allowed():
        raise UpstreamError("wa rate limited")
    url = f"{GRAPH_BASE}/{settings.meta_wa_phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_msisdn.lstrip("+"),
        "type": "template",
        "template": {"name": template_name, "language": {"code": lang},
                     "components": components or []},
    }
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(url, json=payload, headers=_auth_headers())
        if r.status_code >= 400:
            raise UpstreamError(f"wa template failed: {r.status_code} {r.text[:300]}")
        return r.json()


async def download_media(media_id: str) -> tuple[bytes, str]:
    """Return (binary, mime_type). Two-step download per Meta's docs."""
    async with httpx.AsyncClient(timeout=20) as c:
        meta = await c.get(f"{GRAPH_BASE}/{media_id}", headers=_auth_headers())
        meta.raise_for_status()
        info = meta.json()
        url = info["url"]; mime = info.get("mime_type", "application/octet-stream")
        binr = await c.get(url, headers=_auth_headers())
        binr.raise_for_status()
        return binr.content, mime


@retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=0.3, max=3.0))
async def send_image(to_msisdn: str, image_url: str, caption: str | None = None) -> dict:
    """Send a WhatsApp image message.

    Prefer uploading the image into Meta media storage first so delivery does
    not depend on the remote image host being reachable from Meta. If upload
    fails, fall back to a plain public-link send.
    """
    if not await wa_outbound_allowed():
        raise UpstreamError("wa rate limited")
    if not settings.meta_wa_phone_number_id:
        log.info("wa_send_stub_no_creds_image"); return {"stub": True}
    url = f"{GRAPH_BASE}/{settings.meta_wa_phone_number_id}/messages"
    media_id = None
    try:
        media_id = await _upload_media_from_url(image_url)
    except Exception as e:
        log.warning("wa_media_upload_exception", error=str(e))
    image: dict = {"id": media_id} if media_id else {"link": image_url}
    if caption:
        image["caption"] = caption[:1024]
    payload = {
        "messaging_product": "whatsapp",
        "to": to_msisdn.lstrip("+"),
        "type": "image",
        "image": image,
    }
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(url, json=payload, headers=_auth_headers())
        if r.status_code >= 400:
            log.error("wa_send_image_failed", status=r.status_code, body=r.text[:500])
            raise UpstreamError(f"wa image failed: {r.status_code}")
        return r.json()


@retry(stop=stop_after_attempt(3), wait=wait_exponential_jitter(initial=0.3, max=3.0))
async def send_location(
    to_msisdn: str, latitude: float, longitude: float,
    name: str | None = None, address: str | None = None,
) -> dict:
    """Send a WhatsApp location pin."""
    if not await wa_outbound_allowed():
        raise UpstreamError("wa rate limited")
    if not settings.meta_wa_phone_number_id:
        log.info("wa_send_stub_no_creds_location"); return {"stub": True}
    url = f"{GRAPH_BASE}/{settings.meta_wa_phone_number_id}/messages"
    loc: dict = {"latitude": latitude, "longitude": longitude}
    if name:
        loc["name"] = name[:1000]
    if address:
        loc["address"] = address[:1000]
    payload = {
        "messaging_product": "whatsapp",
        "to": to_msisdn.lstrip("+"),
        "type": "location",
        "location": loc,
    }
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(url, json=payload, headers=_auth_headers())
        if r.status_code >= 400:
            log.error("wa_send_location_failed", status=r.status_code, body=r.text[:500])
            raise UpstreamError(f"wa location failed: {r.status_code}")
        return r.json()
