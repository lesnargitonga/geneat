from app.core.config import Settings


def test_render_style_postgres_url_normalizes_to_async_and_sync() -> None:
    s = Settings(
        database_url="postgresql://user:pass@host:5432/dbname",
        database_url_sync="",
    )
    assert s.database_url == "postgresql+asyncpg://user:pass@host:5432/dbname"
    assert s.database_url_sync == "postgresql+psycopg://user:pass@host:5432/dbname"


def test_async_url_backfills_sync_url() -> None:
    s = Settings(
        database_url="postgresql+asyncpg://user:pass@host:5432/dbname",
        database_url_sync="",
    )
    assert s.database_url == "postgresql+asyncpg://user:pass@host:5432/dbname"
    assert s.database_url_sync == "postgresql+psycopg://user:pass@host:5432/dbname"


def test_redis_host_without_scheme_is_normalized() -> None:
    s = Settings(redis_url="redis-host:6379")
    assert s.redis_url == "redis://redis-host:6379"


def test_wrapped_env_quotes_are_stripped_before_type_parsing() -> None:
    s = Settings(
        app_env="'prod'",
        use_local_llm="'false'",
        payment_simulator='"false"',
        openai_use_responses_api="'true'",
        openai_embed_dimensions="'768'",
    )

    assert s.app_env == "prod"
    assert s.use_local_llm is False
    assert s.payment_simulator is False
    assert s.openai_use_responses_api is True
    assert s.openai_embed_dimensions == 768


def test_security_runtime_defaults_are_bounded(monkeypatch) -> None:
    monkeypatch.delenv("META_WA_VERIFY_TOKEN", raising=False)
    s = Settings(_env_file=None)
    assert s.app_host == "127.0.0.1"
    assert s.meta_wa_verify_token == ""
    assert s.request_max_body_bytes == 10 * 1024 * 1024
    assert s.rl_admin_per_min == 30
