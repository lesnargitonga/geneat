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
