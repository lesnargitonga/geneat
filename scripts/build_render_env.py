#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ENV = ROOT / ".env"
OUTPUT_ENV = ROOT / "deploy" / "render" / "render.local.env"


def parse_env(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()
    return data


def main() -> int:
    if not SOURCE_ENV.exists():
        raise SystemExit(f"Missing source env file: {SOURCE_ENV}")

    current = parse_env(SOURCE_ENV)

    fixed: dict[str, str] = {
        "APP_ENV": "prod",
        "LOG_LEVEL": current.get("LOG_LEVEL", "INFO"),
        "UVICORN_WORKERS": "1",
        "DEFAULT_BUSINESS_SLUG": current.get("DEFAULT_BUSINESS_SLUG", "hazina-nomads"),
        "HAZINA_CLAIMS_META_PHONE": current.get("HAZINA_CLAIMS_META_PHONE", "true"),
        "PUBLIC_HAZINA_PORTAL_URL": current.get("PUBLIC_HAZINA_PORTAL_URL", "https://hazina.lesnarai.co.ke"),
        "APP_HOST": "0.0.0.0",
        "APP_PORT": "8000",
        "LLM_PROVIDER": current.get("LLM_PROVIDER", "openai"),
        "LLM_FALLBACK_PROVIDERS": current.get("LLM_FALLBACK_PROVIDERS", "groq"),
        "EMBED_PROVIDER": current.get("EMBED_PROVIDER", "openai"),
        "OPENAI_MODEL": current.get("OPENAI_MODEL", "gpt-5.4-mini"),
        "OPENAI_REASONING_EFFORT": current.get("OPENAI_REASONING_EFFORT", "low"),
        "OPENAI_USE_RESPONSES_API": current.get("OPENAI_USE_RESPONSES_API", "true"),
        "OPENAI_STORE_RESPONSES": current.get("OPENAI_STORE_RESPONSES", "true"),
        "OPENAI_EMBED_MODEL": current.get("OPENAI_EMBED_MODEL", "text-embedding-3-large"),
        "OPENAI_EMBED_DIMENSIONS": current.get("OPENAI_EMBED_DIMENSIONS", "768"),
        "WHATSAPP_PROVIDER": current.get("WHATSAPP_PROVIDER", "meta"),
        "PAYMENT_PROVIDER": current.get("PAYMENT_PROVIDER", "intasend"),
        "PAYMENT_SIMULATOR": current.get("PAYMENT_SIMULATOR", "false"),
        "DEMO_PAY_ON_PICKUP": current.get("DEMO_PAY_ON_PICKUP", "false"),
        "WHATSAPP_REENGAGEMENT_TEMPLATE": current.get("WHATSAPP_REENGAGEMENT_TEMPLATE", "hello_world"),
        "WHATSAPP_REENGAGEMENT_TEMPLATE_LANG": current.get("WHATSAPP_REENGAGEMENT_TEMPLATE_LANG", "en_US"),
        "OPENAI_API_KEY": current.get("OPENAI_API_KEY", ""),
        "GROQ_API_KEY": current.get("GROQ_API_KEY", ""),
        "GROQ_MODEL": current.get("GROQ_MODEL", ""),
        "GEMINI_API_KEY": current.get("GEMINI_API_KEY", ""),
        "GEMINI_MODEL": current.get("GEMINI_MODEL", ""),
        "SECRET_KEY": current.get("SECRET_KEY", ""),
        "PHONE_HASH_PEPPER": current.get("PHONE_HASH_PEPPER", ""),
        "ADMIN_API_TOKEN": current.get("ADMIN_API_TOKEN", ""),
        "JWT_SECRET": current.get("JWT_SECRET", current.get("SECRET_KEY", "")),
        "ADMIN_CORS_ORIGINS": current.get(
            "ADMIN_CORS_ORIGINS",
            "https://geneat.lesnarai.co.ke,https://hazina.lesnarai.co.ke,https://www.lesnarai.co.ke,https://lesnarai.co.ke",
        ),
        "META_WA_PHONE_NUMBER_ID": current.get("META_WA_PHONE_NUMBER_ID", ""),
        "META_WA_ACCESS_TOKEN": current.get("META_WA_ACCESS_TOKEN", ""),
        "META_WA_VERIFY_TOKEN": current.get("META_WA_VERIFY_TOKEN", ""),
        "META_WA_APP_SECRET": current.get("META_WA_APP_SECRET", ""),
        "INTASEND_API_TOKEN": current.get("INTASEND_API_TOKEN", ""),
        "INTASEND_PUBLISHABLE_KEY": current.get("INTASEND_PUBLISHABLE_KEY", ""),
        "INTASEND_TEST_MODE": current.get("INTASEND_TEST_MODE", "false"),
        "INTASEND_WEBHOOK_SECRET": current.get("INTASEND_WEBHOOK_SECRET", ""),
        "R2_ACCOUNT_ID": current.get("R2_ACCOUNT_ID", ""),
        "R2_ACCESS_KEY_ID": current.get("R2_ACCESS_KEY_ID", ""),
        "R2_SECRET_ACCESS_KEY": current.get("R2_SECRET_ACCESS_KEY", ""),
        "R2_BUCKET": current.get("R2_BUCKET", ""),
        "R2_PUBLIC_URL_BASE": current.get("R2_PUBLIC_URL_BASE", ""),
        "SENTRY_DSN": current.get("SENTRY_DSN", ""),
        # Render-managed values to replace after service creation.
        "DATABASE_URL": "__SET_FROM_RENDER_POSTGRES__",
        "DATABASE_URL_SYNC": "__SET_FROM_RENDER_POSTGRES__",
        "REDIS_URL": "__SET_FROM_RENDER_KEY_VALUE__",
    }

    ordered_keys = [
        "APP_ENV",
        "LOG_LEVEL",
        "UVICORN_WORKERS",
        "DEFAULT_BUSINESS_SLUG",
        "HAZINA_CLAIMS_META_PHONE",
        "PUBLIC_HAZINA_PORTAL_URL",
        "APP_HOST",
        "APP_PORT",
        "SECRET_KEY",
        "PHONE_HASH_PEPPER",
        "DATABASE_URL",
        "DATABASE_URL_SYNC",
        "REDIS_URL",
        "LLM_PROVIDER",
        "LLM_FALLBACK_PROVIDERS",
        "EMBED_PROVIDER",
        "OPENAI_API_KEY",
        "OPENAI_MODEL",
        "OPENAI_REASONING_EFFORT",
        "OPENAI_USE_RESPONSES_API",
        "OPENAI_STORE_RESPONSES",
        "OPENAI_EMBED_MODEL",
        "OPENAI_EMBED_DIMENSIONS",
        "GROQ_API_KEY",
        "GROQ_MODEL",
        "GEMINI_API_KEY",
        "GEMINI_MODEL",
        "WHATSAPP_PROVIDER",
        "WHATSAPP_REENGAGEMENT_TEMPLATE",
        "WHATSAPP_REENGAGEMENT_TEMPLATE_LANG",
        "META_WA_PHONE_NUMBER_ID",
        "META_WA_ACCESS_TOKEN",
        "META_WA_VERIFY_TOKEN",
        "META_WA_APP_SECRET",
        "PAYMENT_PROVIDER",
        "PAYMENT_SIMULATOR",
        "DEMO_PAY_ON_PICKUP",
        "INTASEND_API_TOKEN",
        "INTASEND_PUBLISHABLE_KEY",
        "INTASEND_TEST_MODE",
        "INTASEND_WEBHOOK_SECRET",
        "ADMIN_API_TOKEN",
        "JWT_SECRET",
        "ADMIN_CORS_ORIGINS",
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET",
        "R2_PUBLIC_URL_BASE",
        "SENTRY_DSN",
    ]

    OUTPUT_ENV.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Render-ready env bundle generated from local .env",
        "# Replace the __SET_FROM_RENDER_*__ placeholders with values from Render-managed services.",
        "",
    ]
    for key in ordered_keys:
        lines.append(f"{key}={fixed.get(key, '')}")
    OUTPUT_ENV.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_ENV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
