"""Admin-console authentication: password hashing + JWT issue/verify.

Design choices
--------------
* **bcrypt** via passlib — battle-tested, costs tunable, automatic salt.
* **PyJWT** with HS256 — symmetric is fine for a single backend; rotate
  `JWT_SECRET` to invalidate all sessions globally.
* **Per-user `token_version`** — incremented when the user changes their
  password or hits "log out everywhere". The version is embedded in every
  issued JWT and re-checked on every request. No server-side token store
  needed; revocation is one UPDATE.
* **Access + refresh** — short access tokens (default 60 min) keep the
  blast radius of a leak small; long refresh tokens (default 14 d) survive
  laptop sleeps. Both are signed JWTs (`typ` claim distinguishes them).
* **No raw-DB dependency here** — this module is pure-crypto so it can be
  unit-tested without spinning up Postgres.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import jwt
from passlib.context import CryptContext

from app.core.config import get_settings


# bcrypt rounds left at passlib's default (12); pinning explicit rounds in
# config makes long-term cost-tuning trivial without code changes.
_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

TokenType = Literal["access", "refresh"]


# ── Passwords ────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Return a bcrypt hash. Raises ValueError on empty input."""
    if not plain or len(plain) < 8:
        raise ValueError("password must be at least 8 characters")
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time-ish verify. Returns False on any error (never raises)."""
    try:
        return _pwd_ctx.verify(plain, hashed)
    except Exception:
        return False


def needs_rehash(hashed: str) -> bool:
    """True when stored hash uses an outdated scheme/cost — upgrade on next login."""
    try:
        return _pwd_ctx.needs_update(hashed)
    except Exception:
        return False


# ── JWT ──────────────────────────────────────────────────────────────────

def _jwt_secret() -> str:
    s = get_settings()
    raw = s.jwt_secret.get_secret_value() or s.secret_key.get_secret_value()
    if not raw or raw == "change-me":
        # In dev we let this slide; the config validator hard-fails in prod.
        return "dev-insecure-jwt-secret-set-JWT_SECRET-in-prod"
    return raw


def issue_token(
    *,
    user_id: uuid.UUID | str,
    email: str,
    role: str,
    is_superadmin: bool,
    token_version: int,
    token_type: TokenType = "access",
    ttl: timedelta | None = None,
) -> tuple[str, datetime]:
    """Encode and sign a JWT. Returns (token, expires_at)."""
    s = get_settings()
    now = datetime.now(timezone.utc)
    if ttl is None:
        ttl = (
            timedelta(minutes=s.jwt_access_ttl_min)
            if token_type == "access"
            else timedelta(days=s.jwt_refresh_ttl_days)
        )
    exp = now + ttl
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "sa": bool(is_superadmin),
        "tv": int(token_version),
        "typ": token_type,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "iss": "omni-admin",
    }
    token = jwt.encode(payload, _jwt_secret(), algorithm=s.jwt_algorithm)
    return token, exp


class TokenError(Exception):
    """Raised when a JWT is missing, malformed, expired, or revoked."""


def decode_token(token: str, *, expected_type: TokenType | None = None) -> dict:
    """Decode + verify a JWT. Raises ``TokenError`` on any failure."""
    s = get_settings()
    try:
        payload = jwt.decode(
            token, _jwt_secret(), algorithms=[s.jwt_algorithm], issuer="omni-admin",
            options={"require": ["exp", "iat", "sub", "typ"]},
        )
    except jwt.ExpiredSignatureError as e:
        raise TokenError("token_expired") from e
    except jwt.InvalidTokenError as e:
        raise TokenError(f"invalid_token:{e.__class__.__name__}") from e
    if expected_type and payload.get("typ") != expected_type:
        raise TokenError(f"wrong_token_type:{payload.get('typ')}")
    return payload
