"""Security utilities: phone normalisation/hashing, webhook signature verification."""
from __future__ import annotations

import hashlib
import hmac
import re
from base64 import b64encode

from app.core.config import get_settings

_E164_RE = re.compile(r"^\+\d{8,15}$")
_KE_LOCAL_RE = re.compile(r"^0\d{9}$")


def normalize_msisdn(raw: str, default_country: str = "+254") -> str:
    """Return an E.164 string. Accepts '0712…', '254712…', '+254712…', 'whatsapp:+254…'."""
    if not raw:
        raise ValueError("empty msisdn")
    s = raw.strip().replace(" ", "")
    if s.startswith("whatsapp:"):
        s = s[len("whatsapp:"):]
    if s.startswith("tel:"):
        s = s[len("tel:"):]
    if s.startswith("+"):
        pass
    elif s.startswith("00"):
        s = "+" + s[2:]
    elif _KE_LOCAL_RE.match(s):
        s = default_country + s[1:]
    elif s.isdigit() and len(s) >= 10:
        s = "+" + s
    if not _E164_RE.match(s):
        raise ValueError(f"invalid msisdn: {raw!r}")
    return s


def hash_msisdn(msisdn: str) -> str:
    """HMAC-SHA256 phone hash for log lines so we never log raw numbers."""
    pepper = get_settings().phone_hash_pepper.get_secret_value().encode()
    return hmac.new(pepper, msisdn.encode(), hashlib.sha256).hexdigest()[:16]


# ── Webhook signature verifiers ───────────────────────────────────────

def verify_meta_signature(app_secret: str, body: bytes, header: str | None) -> bool:
    """Validate X-Hub-Signature-256 from Meta WhatsApp Cloud webhooks."""
    if not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.split("=", 1)[1])


def verify_twilio_signature(auth_token: str, url: str, params: dict, header: str | None) -> bool:
    """Twilio sends X-Twilio-Signature = base64(HMAC-SHA1(authToken, url+sortedParams))."""
    if not header:
        return False
    data = url + "".join(f"{k}{params[k]}" for k in sorted(params))
    mac = hmac.new(auth_token.encode(), data.encode(), hashlib.sha1).digest()
    return hmac.compare_digest(b64encode(mac).decode(), header)


def verify_at_signature(api_key: str, body: bytes, header: str | None) -> bool:
    """Africa's Talking uses HMAC-SHA256 of raw body with the API key."""
    if not header:
        return False
    expected = hmac.new(api_key.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)


def verify_mpesa_source_ip(remote_ip: str) -> bool:
    """Safaricom Daraja callbacks originate from a documented range.
    Production hardening: replace with the official allowlist."""
    allowlist_prefixes = ("196.201.214.", "196.201.213.", "196.201.212.", "127.0.0.")
    return any(remote_ip.startswith(p) for p in allowlist_prefixes)
