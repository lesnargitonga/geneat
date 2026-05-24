from __future__ import annotations

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

    assert any("SECRET_KEY is too weak" in err for err in errors)
    assert any("PHONE_HASH_PEPPER is too weak" in err for err in errors)
    assert any("JWT_SECRET is too weak" in err for err in errors)
    assert any("ADMIN_API_TOKEN is weak" in warning for warning in warnings)


def test_prod_requires_jwt_secret() -> None:
    errors, _warnings = validate_settings(
        _base_settings(jwt_secret="")
    )

    assert any("JWT_SECRET is required" in err for err in errors)
