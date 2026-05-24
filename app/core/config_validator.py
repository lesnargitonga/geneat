"""Startup-time validation of required configuration.

Catches misconfiguration at boot instead of at first traffic — a missing
WhatsApp secret should crash the pod immediately so the orchestrator can
restart it, not silently fail when the first customer sends a message.

Severity levels:
    error   — fail-fast (RuntimeError raised, process exits)
    warning — logged at WARN, service still starts (degraded mode)
"""
from __future__ import annotations

from app.core.config import Settings
from app.core.logging import get_logger

log = get_logger("config_validator")


def _secret(value) -> str:
    """Unwrap SecretStr/str without raising."""
    try:
        return value.get_secret_value() if hasattr(value, "get_secret_value") else (value or "")
    except Exception:
        return ""


_WEAK_SECRET_VALUES = {
    "change-me",
    "changeme",
    "secret",
    "password",
    "admin",
    "token",
    "test",
    "dev",
    "default",
    "please-change-me",
}


def _weak_secret(value, *, min_len: int = 32) -> bool:
    raw = _secret(value).strip()
    if len(raw) < min_len:
        return True
    lowered = raw.lower()
    if lowered in _WEAK_SECRET_VALUES or lowered.startswith(("change-me", "changeme", "replace-me")):
        return True
    if len(set(raw)) <= 2:
        return True
    return False


def validate_settings(s: Settings) -> tuple[list[str], list[str]]:
    """Return (errors, warnings). Errors should abort startup; warnings just log."""
    errors: list[str] = []
    warnings: list[str] = []
    is_prod = bool(getattr(s, "is_prod", False))

    # ── LLM provider ──────────────────────────────────────────────
    provider = (getattr(s, "llm_provider", "") or "").lower()
    provider_key_map = {
        "groq": ("groq_api_key", "GROQ_API_KEY"),
        "gemini": ("gemini_api_key", "GEMINI_API_KEY"),
        "openai": ("openai_api_key", "OPENAI_API_KEY"),
        "local": (None, None),
    }
    if provider not in provider_key_map:
        errors.append(f"LLM_PROVIDER='{provider}' is invalid. Must be one of: groq, gemini, openai, local")
    else:
        attr, env_name = provider_key_map[provider]
        if attr and not _secret(getattr(s, attr, "")):
            errors.append(f"LLM_PROVIDER='{provider}' but {env_name} is missing.")
        if provider == "openai":
            model = (getattr(s, "openai_model", "") or "").lower()
            use_responses = bool(getattr(s, "openai_use_responses_api", False))
            store_responses = bool(getattr(s, "openai_store_responses", False))
            if model.startswith("gpt-5") and use_responses and not store_responses:
                msg = (
                    "OPENAI_STORE_RESPONSES must be true when using GPT-5 with "
                    "OPENAI_USE_RESPONSES_API=true; otherwise tool turns can fail "
                    "or lose context."
                )
                if is_prod:
                    errors.append(msg)
                else:
                    warnings.append(msg)

    # Fallback providers — warn (not error) if any fallback is missing a key
    fb_raw = (getattr(s, "llm_fallback_providers", "") or "").strip()
    for fb in [p.strip().lower() for p in fb_raw.split(",") if p.strip()]:
        if fb == provider:
            continue
        attr_env = provider_key_map.get(fb)
        if attr_env is None:
            warnings.append(f"Fallback provider '{fb}' is not a recognised provider; will be ignored.")
            continue
        attr, env_name = attr_env
        if attr and not _secret(getattr(s, attr, "")):
            warnings.append(f"Fallback provider '{fb}' has no {env_name}; will be skipped at runtime.")

    embed_provider = (getattr(s, "embed_provider", "local") or "local").lower()
    if embed_provider not in {"local", "openai"}:
        errors.append("EMBED_PROVIDER must be one of: local, openai")
    elif embed_provider == "openai":
        if not _secret(getattr(s, "openai_api_key", "")):
            errors.append("EMBED_PROVIDER=openai but OPENAI_API_KEY is missing.")
        dims = int(getattr(s, "openai_embed_dimensions", 0) or 0)
        if dims != 768:
            msg = (
                "OPENAI_EMBED_DIMENSIONS must remain 768 until "
                "knowledge_base.embedding is migrated."
            )
            if is_prod:
                errors.append(msg)
            else:
                warnings.append(msg)

    # ── WhatsApp ──────────────────────────────────────────────────
    wa_provider = (getattr(s, "whatsapp_provider", "meta") or "meta").lower()
    if wa_provider == "meta":
        if not (getattr(s, "meta_wa_phone_number_id", "") or ""):
            errors.append("META_WA_PHONE_NUMBER_ID is required when WHATSAPP_PROVIDER=meta.")
        if not _secret(getattr(s, "meta_wa_access_token", "")):
            errors.append("META_WA_ACCESS_TOKEN is required when WHATSAPP_PROVIDER=meta.")
        if not _secret(getattr(s, "meta_wa_app_secret", "")):
            msg = (
                "META_WA_APP_SECRET is required when WHATSAPP_PROVIDER=meta "
                "(needed for webhook signature verification)."
            )
            if is_prod:
                errors.append(msg)
            else:
                warnings.append(msg)
        if not (getattr(s, "meta_wa_verify_token", "") or ""):
            warnings.append("META_WA_VERIFY_TOKEN not set; webhook subscription handshake will fail.")

    # ── Payments ──────────────────────────────────────────────────
    pay = (getattr(s, "payment_provider", "daraja") or "daraja").lower()
    if bool(getattr(s, "payment_simulator", False)):
        if is_prod:
            errors.append("PAYMENT_SIMULATOR=true is forbidden in production — real payment provider checks are skipped.")
    elif pay == "intasend":
        if not _secret(getattr(s, "intasend_api_token", "")):
            errors.append("PAYMENT_PROVIDER=intasend but INTASEND_API_TOKEN is missing.")
        if bool(getattr(s, "intasend_test_mode", True)):
            msg = (
                "PAYMENT_PROVIDER=intasend but INTASEND_TEST_MODE=true — "
                "real customer phones will not receive live STK prompts."
            )
            if is_prod:
                errors.append(msg)
            else:
                warnings.append(msg)
        if not _secret(getattr(s, "intasend_webhook_secret", "")):
            msg = (
                "PAYMENT_PROVIDER=intasend but INTASEND_WEBHOOK_SECRET is empty — "
                "webhook signature verification will be skipped (INSECURE for production)."
            )
            if is_prod:
                errors.append(msg)
            else:
                warnings.append(msg)
    elif pay == "daraja":
        # daraja sandbox is fine without keys; warn only if prod env
        if getattr(s, "is_prod", False):
            for attr, env in (
                ("mpesa_consumer_key", "MPESA_CONSUMER_KEY"),
                ("mpesa_consumer_secret", "MPESA_CONSUMER_SECRET"),
                ("mpesa_shortcode", "MPESA_SHORTCODE"),
                ("mpesa_passkey", "MPESA_PASSKEY"),
            ):
                if not _secret(getattr(s, attr, "")):
                    errors.append(f"PAYMENT_PROVIDER=daraja in prod but {env} is missing.")

    # ── Security ──────────────────────────────────────────────────
    if not _secret(getattr(s, "phone_hash_pepper", "")):
        errors.append("PHONE_HASH_PEPPER is required (used for PII hashing in logs).")
    admin_token = _secret(getattr(s, "admin_api_token", ""))
    if not admin_token:
        warnings.append("ADMIN_API_TOKEN is empty — /admin/* endpoints will reject all requests.")
    if is_prod:
        for attr, env_name, min_len in (
            ("secret_key", "SECRET_KEY", 32),
            ("phone_hash_pepper", "PHONE_HASH_PEPPER", 32),
        ):
            value = getattr(s, attr, "")
            if _weak_secret(value, min_len=min_len):
                errors.append(
                    f"{env_name} is too weak for production. Use at least {min_len} unpredictable characters."
                )
        jwt_secret = _secret(getattr(s, "jwt_secret", ""))
        if not jwt_secret:
            errors.append("JWT_SECRET is required in production.")
        elif _weak_secret(jwt_secret, min_len=32):
            warnings.append(
                "JWT_SECRET is weak for production. Use at least 32 unpredictable characters."
            )
        if admin_token and _weak_secret(admin_token, min_len=24):
            warnings.append(
                "ADMIN_API_TOKEN is weak for production. Use at least 24 unpredictable characters."
            )

    # ── Database ──────────────────────────────────────────────────
    if not (getattr(s, "database_url", "") or ""):
        errors.append("DATABASE_URL is required.")

    # ── Production safety rails ───────────────────────────────────
    # Local LLM/STT/TTS toggles are for laptop demos only. On a shared
    # cloud node without a GPU, a single audio frame will pin one CPU
    # core to 100%, time-out every other tenant's webhook, and trip the
    # global circuit breakers. Refuse to boot in prod with these on.
    if getattr(s, "is_prod", False):
        for flag in ("use_local_llm", "use_local_stt", "use_local_tts"):
            if bool(getattr(s, flag, False)):
                errors.append(
                    f"{flag.upper()}=true is forbidden when APP_ENV=prod "
                    "(no on-CPU AI in production; would block other tenants)."
                )
        # mpesa env coherence — prod app must use prod Daraja
        if (getattr(s, "payment_provider", "") or "").lower() == "daraja" \
                and (getattr(s, "mpesa_env", "") or "").lower() == "sandbox":
            errors.append(
                "APP_ENV=prod but MPESA_ENV=sandbox — refusing to take live money against sandbox."
            )
        # Sentry should be mandatory in prod so we hear about failures
        # before paying customers do.
        if not (getattr(s, "sentry_dsn", "") or ""):
            warnings.append(
                "APP_ENV=prod but SENTRY_DSN is empty — error tracking is disabled. "
                "Strongly recommended to configure Sentry before onboarding clients."
            )

    # ── DB pool sizing vs worker count ────────────────────────────
    # If `workers * (pool_size + max_overflow)` exceeds Postgres'
    # `max_connections`, the Nth worker will fail to acquire a connection
    # under load and emit cryptic "too many connections" errors. We can't
    # introspect PG from here without a round-trip, so we just enforce a
    # documented per-worker ceiling and warn on configs that look risky.
    import os as _os
    try:
        _workers = int(_os.getenv("UVICORN_WORKERS", "1") or "1")
    except ValueError:
        _workers = 1
    _per_worker = 10 + 20  # matches app/db/session.py pool_size + max_overflow
    _total_conns = _workers * _per_worker
    # Default PG max_connections is 100. Allow tuning via PG_MAX_CONNECTIONS env.
    try:
        _pg_max = int(_os.getenv("PG_MAX_CONNECTIONS", "100") or "100")
    except ValueError:
        _pg_max = 100
    # Reserve 15 conns for psql / migrations / monitoring.
    if _total_conns > (_pg_max - 15):
        warnings.append(
            f"DB pool sizing risk: {_workers} workers × {_per_worker} conns = "
            f"{_total_conns}, but PG_MAX_CONNECTIONS={_pg_max} (reserving 15). "
            "Lower UVICORN_WORKERS or raise Postgres max_connections."
        )

    return errors, warnings


def enforce_or_die(s: Settings) -> None:
    """Validate at boot. Logs warnings, raises RuntimeError on any error."""
    errors, warnings = validate_settings(s)
    for w in warnings:
        log.warning("config_warning", message=w)
    if errors:
        for e in errors:
            log.error("config_error", message=e)
        raise RuntimeError(
            "Configuration validation failed:\n  - " + "\n  - ".join(errors)
        )
    log.info("config_validated", warnings=len(warnings))
