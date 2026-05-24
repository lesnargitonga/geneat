from __future__ import annotations

import yaml

from app.core.config import Settings
from app.core.config_validator import validate_settings


def _base_settings(**overrides) -> Settings:
    values = {
        "app_env": "prod",
        "llm_provider": "local",
        "embed_provider": "local",
        "whatsapp_provider": "mock",
        "payment_provider": "intasend",
        "payment_simulator": False,
        "intasend_test_mode": False,
        "intasend_api_token": "intasend-token",
        "intasend_webhook_secret": "intasend-webhook-secret",
        "secret_key": "prod-secret-key-" + ("a" * 64),
        "phone_hash_pepper": "prod-phone-pepper-" + ("b" * 64),
        "jwt_secret": "prod-jwt-secret-" + ("c" * 64),
        "admin_api_token": "admin-token-1234567890abcdef",
        "database_url": "sqlite+aiosqlite:///:memory:",
    }
    values.update(overrides)
    return Settings(**values)


def test_prod_intasend_requires_webhook_secret() -> None:
    errors, _warnings = validate_settings(
        _base_settings(intasend_webhook_secret="")
    )

    assert any("INTASEND_WEBHOOK_SECRET" in err for err in errors)


def test_prod_rejects_payment_simulator() -> None:
    errors, _warnings = validate_settings(
        _base_settings(payment_simulator=True, intasend_api_token="", intasend_webhook_secret="")
    )

    assert any("PAYMENT_SIMULATOR=true" in err for err in errors)
    assert not any("INTASEND_API_TOKEN" in err for err in errors)


def test_prod_intasend_rejects_test_mode() -> None:
    errors, _warnings = validate_settings(
        _base_settings(intasend_test_mode=True)
    )

    assert any("INTASEND_TEST_MODE=true" in err for err in errors)


def test_prod_gpt5_responses_requires_stored_responses() -> None:
    errors, _warnings = validate_settings(
        _base_settings(
            llm_provider="openai",
            openai_api_key="sk-test",
            openai_model="gpt-5.4-mini",
            openai_use_responses_api=True,
            openai_store_responses=False,
        )
    )

    assert any("OPENAI_STORE_RESPONSES" in err for err in errors)


def test_prod_openai_embeddings_must_match_pgvector_dimension() -> None:
    errors, _warnings = validate_settings(
        _base_settings(
            embed_provider="openai",
            openai_api_key="sk-test",
            openai_embed_dimensions=1536,
        )
    )

    assert any("OPENAI_EMBED_DIMENSIONS" in err for err in errors)


def test_dev_meta_app_secret_is_warning_not_boot_blocker() -> None:
    errors, warnings = validate_settings(
        _base_settings(
            app_env="dev",
            whatsapp_provider="meta",
            meta_wa_phone_number_id="123",
            meta_wa_access_token="token",
            meta_wa_app_secret="",
        )
    )

    assert not any("META_WA_APP_SECRET" in err for err in errors)
    assert any("META_WA_APP_SECRET" in warning for warning in warnings)


def test_prod_rejects_weak_core_secrets_and_warns_for_admin_tokens() -> None:
    errors, warnings = validate_settings(
        _base_settings(
            secret_key="change-me",
            phone_hash_pepper="pepper",
            jwt_secret="secret",
            admin_api_token="token",
        )
    )

    assert any("SECRET_KEY is missing or still set to a default" in err for err in errors)
    assert any("PHONE_HASH_PEPPER is short or low-entropy" in warning for warning in warnings)
    assert any("JWT_SECRET is missing or still set to a default" in err for err in errors)
    assert any("ADMIN_API_TOKEN is weak" in warning for warning in warnings)


def test_prod_warns_for_short_non_default_core_secrets() -> None:
    errors, warnings = validate_settings(
        _base_settings(
            secret_key="short-but-not-default",
            phone_hash_pepper="short-but-not-default-pepper",
            jwt_secret="short-but-not-default-jwt",
        )
    )

    assert not any("SECRET_KEY" in err for err in errors)
    assert not any("PHONE_HASH_PEPPER" in err for err in errors)
    assert not any("JWT_SECRET" in err for err in errors)
    assert any("SECRET_KEY is short or low-entropy" in warning for warning in warnings)
    assert any("PHONE_HASH_PEPPER is short or low-entropy" in warning for warning in warnings)
    assert any("JWT_SECRET is short or low-entropy" in warning for warning in warnings)


def test_prod_allows_missing_jwt_secret_when_secret_key_is_strong() -> None:
    errors, warnings = validate_settings(
        _base_settings(jwt_secret="")
    )

    assert not any("JWT_SECRET" in err for err in errors)
    assert any("JWT_SECRET is missing" in warning for warning in warnings)


def test_prod_rejects_missing_jwt_secret_when_secret_key_is_weak() -> None:
    errors, _warnings = validate_settings(
        _base_settings(jwt_secret="", secret_key="change-me")
    )

    assert any("JWT_SECRET is missing" in err for err in errors)


def test_render_blueprint_sets_live_intasend_mode() -> None:
    with open("render.yaml", "r", encoding="utf-8") as fh:
        blueprint = yaml.safe_load(fh)

    api_service = next(
        service for service in blueprint["services"]
        if service.get("name") == "geneat-api"
    )
    env = {
        item["key"]: item.get("value")
        for item in api_service.get("envVars", [])
        if "key" in item
    }

    assert env["PAYMENT_PROVIDER"] == "intasend"
    assert env["PAYMENT_SIMULATOR"] == "false"
    assert env["INTASEND_TEST_MODE"] == "false"
