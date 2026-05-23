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
        "intasend_api_token": "intasend-token",
        "intasend_webhook_secret": "intasend-webhook-secret",
        "phone_hash_pepper": "pepper",
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
