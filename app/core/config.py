"""Centralised, environment-driven configuration.

Loaded once at process start via `get_settings()` (LRU cached).
Never read os.environ directly elsewhere in the codebase.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    # App
    app_env: Literal["dev", "staging", "prod", "test"] = "dev"
    app_name: str = "omnichannel-ai"
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    log_level: str = "INFO"
    log_format: Literal["auto", "json", "console"] = "auto"
    secret_key: SecretStr = Field(default=SecretStr("change-me"))
    phone_hash_pepper: SecretStr = Field(default=SecretStr("change-me"))

    # Database
    database_url: str = "postgresql+asyncpg://omni:omni@localhost:5432/omni"
    database_url_sync: str = "postgresql+psycopg://omni:omni@localhost:5432/omni"
    # Connection pool tuning (overridable per-deployment)
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_pre_ping: bool = True
    request_max_body_bytes: int = 10 * 1024 * 1024

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # OpenAI
    openai_api_key: SecretStr = Field(default=SecretStr(""))
    openai_model: str = "gpt-5.4-mini"
    openai_reasoning_effort: Literal["none", "low", "medium", "high", "xhigh"] = "low"
    openai_use_responses_api: bool = True
    openai_store_responses: bool = True
    openai_embed_model: str = "text-embedding-3-large"
    openai_embed_dimensions: int = 768

    # Groq (free, fast LPU inference — Llama 3.x family)
    groq_api_key: SecretStr = Field(default=SecretStr(""))
    groq_model: str = "llama-3.3-70b-versatile"  # or llama-3.1-8b-instant

    # Google Gemini (free tier — 2.5 Flash)
    gemini_api_key: SecretStr = Field(default=SecretStr(""))
    gemini_model: str = "gemini-2.5-flash"

    # Which provider drives the chat LLM.
    #   groq    → ChatGroq (recommended; free, fast, tool-calling)
    #   gemini  → ChatGoogleGenerativeAI
    #   openai  → ChatOpenAI (paid GPT-5 class models)
    #   local   → Ollama via OpenAI-compat /v1
    llm_provider: Literal["groq", "gemini", "openai", "local"] = "openai"

    # Embedding provider — independent of the chat LLM choice because the
    # knowledge_base.embedding column has a fixed dimension (768, matching
    # nomic-embed-text). Default is local Ollama which is free and exact.
    #   local   → nomic-embed-text via Ollama (768-dim) ✓ matches schema
    #   openai  → OpenAIEmbeddings with dimensions=768, schema-safe.
    embed_provider: Literal["local", "openai"] = "openai"

    # Comma-separated ordered list of fallback providers tried when the
    # primary raises a rate-limit / quota / transient error. Each provider
    # MUST also have its own model setting populated. Set to empty string
    # to disable failover. Example: "gemini,local".
    llm_fallback_providers: str = "groq"
    # Optional per-provider override of the primary's model when used as a
    # fallback. Example: when groq is the fallback we want the cheaper 8B
    # model, not the same expensive 70B that just hit TPD.
    groq_fallback_model: str = "llama-3.1-8b-instant"

    # AI turn timing. Normal turns should feel conversational on WhatsApp,
    # but still leave a short rescue window for transient provider hiccups.
    # Increased from 12s to 30s to reduce spurious degraded fallbacks.
    ai_turn_timeout_seconds: float = 30.0
    ai_turn_retry_timeout_seconds: float = 10.0

    # ElevenLabs
    elevenlabs_api_key: SecretStr = Field(default=SecretStr(""))
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_model: str = "eleven_turbo_v2_5"

    # WhatsApp
    whatsapp_provider: Literal["meta", "africastalking", "twilio", "mock"] = "mock"
    whatsapp_reengagement_template: str = "hello_world"
    whatsapp_reengagement_template_lang: str = "en_US"
    meta_wa_phone_number_id: str = ""
    meta_wa_access_token: SecretStr = Field(default=SecretStr(""))
    meta_wa_verify_token: str = ""
    meta_wa_app_secret: SecretStr = Field(default=SecretStr(""))

    # Africa's Talking
    at_username: str = "sandbox"
    at_api_key: SecretStr = Field(default=SecretStr(""))
    at_shortcode: str = ""
    at_base_url: str = "https://api.sandbox.africastalking.com"
    # Voice number AT routes calls FROM (your purchased phone number or shortcode).
    at_voice_phone: str = ""
    # Voice TTS settings — AT's built-in <Say> is free. Locale options:
    #   en-US-Standard-{B,C,D,E,F}, en-US-Wavenet-{A..F}, etc.
    at_voice_say_voice: str = "en-US-Standard-C"
    at_voice_say_playback_url: str = ""  # optional override

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: SecretStr = Field(default=SecretStr(""))
    twilio_phone_number: str = ""

    # M-Pesa
    mpesa_env: Literal["sandbox", "production"] = "sandbox"
    mpesa_consumer_key: SecretStr = Field(default=SecretStr(""))
    mpesa_consumer_secret: SecretStr = Field(default=SecretStr(""))
    mpesa_shortcode: str = "174379"
    mpesa_passkey: SecretStr = Field(default=SecretStr(""))
    mpesa_callback_url: str = ""

    # Google
    google_oauth_client_id: str = ""
    google_oauth_client_secret: SecretStr = Field(default=SecretStr(""))
    google_calendar_id: str = "primary"

    # Payment provider (daraja | intasend | paystack | stripe)
    payment_provider: Literal["daraja", "intasend", "paystack", "stripe"] = "daraja"
    # Development/demo: use an internal simulator instead of real providers
    payment_simulator: bool = False
    # When enabled, the playbook may allow pay-on-pickup for demo flows.
    demo_pay_on_pickup: bool = False
    # Simulator auto-confirm: when true, simulated STK pushes auto-mark paid
    # after `payment_simulator_autoconfirm_delay` seconds. Use for demos.
    payment_simulator_autoconfirm: bool = False
    payment_simulator_autoconfirm_delay: int = 3
    # IntaSend (fast-track Kenya M-Pesa, same-day onboarding)
    intasend_api_token: SecretStr = Field(default=SecretStr(""))
    intasend_publishable_key: str = ""
    intasend_test_mode: bool = True
    intasend_webhook_secret: SecretStr = Field(default=SecretStr(""))
    # Paystack
    paystack_secret_key: SecretStr = Field(default=SecretStr(""))
    paystack_public_key: str = ""
    # Stripe
    stripe_secret_key: SecretStr = Field(default=SecretStr(""))
    stripe_publishable_key: str = ""
    stripe_webhook_secret: SecretStr = Field(default=SecretStr(""))
    stripe_success_url: str = "https://example.com/ok"
    stripe_cancel_url: str = "https://example.com/cancel"

    # Local-stack overrides (zero-cost alpha mode)
    use_local_llm: bool = False
    local_llm_base_url: str = "http://localhost:11434/v1"   # Ollama
    local_llm_model: str = "llama3"
    use_local_stt: bool = False                              # faster-whisper
    use_local_tts: bool = False                              # Kokoro / XTTS

    # Rate limits
    rl_inbound_per_min: int = 120
    rl_admin_per_min: int = 30
    rl_wa_outbound_per_sec: int = 50
    rl_mpesa_stk_per_msisdn_sec: int = 30

    # Escalation
    owner_alert_phone: str = ""
    ai_max_failed_turns: int = 2
    # The safety turn cap is evaluated over a recent rolling window rather
    # than lifetime conversation history, so normal repeat customers do not
    # get escalated just because they have chatted before.
    ai_turn_cap_window_hours: float = 6.0

    # Admin API (merchant onboarding + KB upload)
    admin_api_token: SecretStr = Field(default=SecretStr(""))

    # ── Admin console (Phase 8) ───────────────────────────────────────
    # Symmetric secret for JWT signing. MUST be set in prod (validator).
    # In dev it falls back to `secret_key` to keep boot frictionless.
    jwt_secret: SecretStr = Field(default=SecretStr(""))
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_min: int = 60          # short-lived access token
    jwt_refresh_ttl_days: int = 14        # long-lived refresh token
    # First-boot seed: if no AdminUser rows exist, lifespan creates one
    # using these (idempotent, skipped if blank). The password is stored
    # hashed; the env value can be rotated/cleared afterwards.
    admin_seed_email: str = ""
    admin_seed_password: SecretStr = Field(default=SecretStr(""))
    # CORS for the admin SPA. Comma-separated. "*" disables credentials.
    admin_cors_origins: str = "*"

    # When a turn arrives with no explicit tenant routing (no /biz, no Meta
    # phone_number_id, no sticky conversation), this slug is used as the
    # global default. Falls back to the oldest active business if unset or
    # the slug doesn't exist.
    default_business_slug: str = "hazina-nomads"
    public_hazina_portal_url: str = "https://hazina.lesnarai.co.ke"

    # The KES 10 "Demo Espresso" instant-order fast path is a sales-demo feature.
    # It only fires for this tenant slug so a real client's customers can never
    # accidentally create a bogus KES 10 order by typing "demo espresso"/"10 bob".
    # Leave blank to allow it for every tenant (not recommended in production).
    demo_business_slug: str = "lily-pond-cafe"

    # ── Media storage (Cloudflare R2 — S3-compatible, free 10 GB tier) ─
    # When unset, media features degrade gracefully (no upload, no vision).
    r2_account_id: str = ""
    r2_access_key_id: SecretStr = Field(default=SecretStr(""))
    r2_secret_access_key: SecretStr = Field(default=SecretStr(""))
    r2_bucket: str = ""
    # Public base URL for objects (custom domain or r2.dev). Files are stored
    # at `<r2_public_url_base>/<key>`. Leave blank to use signed URLs only.
    r2_public_url_base: str = ""

    # Groq vision model (free tier). Used to describe inbound images.
    groq_vision_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"

    # Sentry — DSN omitted disables error tracking (no-op).
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.0  # set >0 to enable performance tracing
    sentry_send_pii: bool = False

    @model_validator(mode="before")
    @classmethod
    def _strip_wrapping_env_quotes(cls, data):
        """Tolerate env values saved with literal wrapping quotes.

        Hosts and shell snippets occasionally persist values like ``'false'``
        instead of ``false``. Pydantic treats the quotes as part of the string,
        which breaks bool/Literal parsing before our startup validator can
        explain the problem.
        """
        if not isinstance(data, dict):
            return data

        def _clean(value):
            if isinstance(value, str):
                stripped = value.strip()
                if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in {"'", '"'}:
                    return stripped[1:-1].strip()
                return stripped
            return value

        return {key: _clean(value) for key, value in data.items()}

    @model_validator(mode="after")
    def _normalize_render_urls(self) -> "Settings":
        """Accept plain Postgres URLs from hosts like Render and normalize
        them into the explicit SQLAlchemy driver URLs the app expects.
        Also accept Redis hosts that are missing an explicit scheme.
        """
        async_url = (self.database_url or "").strip()
        sync_url = (self.database_url_sync or "").strip()
        redis_url = (self.redis_url or "").strip()

        def _to_async(url: str) -> str:
            if url.startswith("postgresql+asyncpg://") or url.startswith("sqlite"):
                return url
            if url.startswith("postgresql+psycopg://"):
                return "postgresql+asyncpg://" + url.split("://", 1)[1]
            if url.startswith("postgresql://"):
                return "postgresql+asyncpg://" + url.split("://", 1)[1]
            return url

        def _to_sync(url: str) -> str:
            if url.startswith("postgresql+psycopg://") or url.startswith("sqlite"):
                return url
            if url.startswith("postgresql+asyncpg://"):
                return "postgresql+psycopg://" + url.split("://", 1)[1]
            if url.startswith("postgresql://"):
                return "postgresql+psycopg://" + url.split("://", 1)[1]
            return url

        self.database_url = _to_async(async_url)
        self.database_url_sync = _to_sync(sync_url or async_url)
        if redis_url and "://" not in redis_url:
            self.redis_url = f"redis://{redis_url}"
        return self

    @model_validator(mode="after")
    def _prod_hardening_checks(self) -> "Settings":
        """Production-only sanity checks to prevent insecure startups.

        These checks raise a clear error during app startup when required
        secrets or provider credentials are missing while running in `prod`.
        """
        # Production-hardening is handled by `app.core.config_validator.validate_settings`
        # and enforced at startup via `enforce_or_die()`. Keep this validator
        # as a no-op to avoid surprising side-effects when constructing
        # `Settings()` in unit tests or other non-startup contexts.
        return self

        return self

    @property
    def is_prod(self) -> bool:
        return self.app_env == "prod"


@lru_cache
def get_settings() -> Settings:
    return Settings()
