"""Media service — Cloudflare R2 storage + Groq vision description.

Inbound WhatsApp images (and other binary media) are streamed straight to
R2 so we hold an immutable, time-stable URL even after Meta's signed link
expires. Images then get a one-shot description via Groq's free-tier
vision model so the LLM can reason over what the customer sent.

All functions degrade gracefully: if R2 credentials are missing the
upload returns ``None`` and image description quietly skips.
"""
from __future__ import annotations

import mimetypes
import uuid
from typing import Optional

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("media")
settings = get_settings()


def _ext_for(mime: str) -> str:
    return mimetypes.guess_extension(mime or "") or ".bin"


def _r2_configured() -> bool:
    return bool(
        settings.r2_account_id
        and settings.r2_bucket
        and settings.r2_access_key_id.get_secret_value()
        and settings.r2_secret_access_key.get_secret_value()
    )


async def upload_to_r2(
    data: bytes, mime_type: str, *, prefix: str = "inbound",
    presign_seconds: int = 3600,
) -> Optional[str]:
    """Upload bytes to R2 and return a fetchable URL.

    Prefers a public custom-domain URL when `R2_PUBLIC_URL_BASE` is set
    (eternal, CDN-cached). Falls back to a presigned GET URL (default 1 h
    TTL) so Groq vision / WhatsApp clients can fetch it without any
    bucket-level public-access toggling on the dashboard.
    """
    if not _r2_configured():
        log.info("r2_skip_upload_unconfigured", bytes=len(data))
        return None

    key = f"{prefix}/{uuid.uuid4().hex}{_ext_for(mime_type)}"
    try:
        import aioboto3  # type: ignore
    except ImportError:
        log.warning("r2_skip_no_aioboto3")
        return None

    endpoint = f"https://{settings.r2_account_id}.r2.cloudflarestorage.com"
    session = aioboto3.Session()
    try:
        async with session.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=settings.r2_access_key_id.get_secret_value(),
            aws_secret_access_key=settings.r2_secret_access_key.get_secret_value(),
            region_name="auto",
        ) as s3:
            await s3.put_object(
                Bucket=settings.r2_bucket,
                Key=key,
                Body=data,
                ContentType=mime_type or "application/octet-stream",
            )

            # Prefer a public URL when configured — survives bucket lifecycle.
            if settings.r2_public_url_base:
                base = settings.r2_public_url_base.rstrip("/")
                return f"{base}/{key}"

            # Fallback: short-lived presigned URL (no dashboard toggle needed).
            try:
                url = await s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": settings.r2_bucket, "Key": key},
                    ExpiresIn=presign_seconds,
                )
                return url
            except Exception as e:
                log.warning("r2_presign_failed", error=str(e), key=key)
                return f"s3://{settings.r2_bucket}/{key}"
    except Exception as e:  # network / auth — never break the inbound turn
        log.warning("r2_upload_failed", error=str(e), key=key)
        return None


async def describe_image(
    image_url: str, *, caption: str | None = None,
) -> Optional[str]:
    """One-shot vision description via Groq. Returns plain text or None."""
    api_key = settings.groq_api_key.get_secret_value()
    if not api_key:
        return None
    if not image_url.startswith(("http://", "https://")):
        # Groq needs a publicly fetchable URL.
        log.info("vision_skip_non_public_url", url=image_url[:60])
        return None

    prompt = (
        "You are a careful assistant describing an image a customer sent over "
        "WhatsApp. Reply in ONE short paragraph (max 3 sentences). Focus on "
        "what the customer is likely trying to ask about — product, receipt, "
        "ID, damage report, room photo, etc. Read any visible text verbatim."
    )
    if caption:
        prompt += f' The customer also wrote: "{caption}".'

    body = {
        "model": settings.groq_vision_model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            }
        ],
        "max_tokens": 220,
        "temperature": 0.2,
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json=body, headers=headers,
            )
            if r.status_code >= 400:
                log.warning("vision_failed", status=r.status_code, body=r.text[:300])
                return None
            data = r.json()
            return (data["choices"][0]["message"]["content"] or "").strip() or None
    except Exception as e:
        log.warning("vision_error", error=str(e))
        return None
