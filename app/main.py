"""FastAPI application bootstrap."""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.admin import router as admin_router
from app.api.admin_auth import router as admin_auth_router
from app.api.catalog import router as catalog_router
from app.api.admin_console import router as admin_console_router
from app.api.health import router as health_router
from app.api.metrics import MetricsMiddleware, router as metrics_router
from app.api.mock import router as mock_router
from app.api.payments import router as payments_router
from app.api.privacy import router as privacy_router
from app.api.voice import router as voice_router
from app.api.voice_at import router as voice_at_router
from app.api.whatsapp import router as whatsapp_router
from app.api.whatsapp_twilio import router as whatsapp_twilio_router
from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.logging import configure_logging, get_logger, request_id_ctx
from app.core.rate_limit import limiter
from app.core.redis_client import close_redis, get_redis

settings = get_settings()
configure_logging(settings.log_level, settings.log_format)
log = get_logger("app")

# Sentry — no-op when SENTRY_DSN is unset. Initialised before app creation so
# import-time exceptions are captured too.
from app.core.sentry_setup import init_sentry  # noqa: E402
init_sentry(settings)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("startup", env=settings.app_env)
    # Fail-fast on misconfiguration. Catches missing required keys at boot
    # so an orchestrator can restart, instead of failing on first traffic.
    from app.core.config_validator import enforce_or_die
    enforce_or_die(settings)
    try:
        await get_redis()  # warm connection
    except Exception as e:
        log.warning("redis_warmup_failed", error=str(e))
    # Cross-worker event bus — each worker subscribes to omni:events so
    # payment-completed / voice-hangup / interleaving notifications reach
    # whichever worker holds the relevant in-memory state.
    try:
        from app.core.event_bus import start_event_listener, stop_event_listener  # noqa: F401
        # Import handlers so their @on_event decorators register before we subscribe.
        from app.services import event_handlers  # noqa: F401
        # Outbound webhook dispatcher — also registers @on_event handlers
        # at import time. Must be imported AFTER event_handlers but BEFORE
        # start_event_listener.
        from app.services import webhook_dispatcher  # noqa: F401
        await start_event_listener()
    except Exception as e:
        log.warning("event_bus_startup_failed", error=str(e))
    # First-boot admin seeding — only runs if env vars are set AND no
    # admin user exists. Safe to leave configured indefinitely.
    try:
        from app.services.admin_seed import seed_if_needed
        await seed_if_needed()
    except Exception as e:
        log.warning("admin_seed_failed", error=str(e))
    try:
        from app.jobs import handlers  # noqa: F401
        from app.jobs.runner import start_job_runner
        await start_job_runner()
    except Exception as e:
        log.warning("job_runner_startup_failed", error=str(e))
    yield
    try:
        from app.jobs.runner import stop_job_runner
        await stop_job_runner()
    except Exception:
        pass
    try:
        from app.core.event_bus import stop_event_listener
        await stop_event_listener()
    except Exception:
        pass
    await close_redis()
    # Cleanly release the Postgres connection pool. Without this the
    # process can exit with connections still in TIME_WAIT, which on
    # Kubernetes manifests as slow rolling restarts.
    try:
        from app.db.session import engine
        await engine.dispose()
    except Exception as e:
        log.warning("engine_dispose_failed", error=str(e))
    log.info("shutdown")


app = FastAPI(
    title="Omnichannel AI Business Agent",
    version="0.2.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_prod else None,
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
# Metrics middleware records every request's latency + status. Added
# BEFORE CORS so OPTIONS preflight responses are counted too.
app.add_middleware(MetricsMiddleware)

# CORS — driven by ADMIN_CORS_ORIGINS. Comma-separated list, or "*" to
# disable origin checks entirely (only safe in dev). When an explicit
# allowlist is configured we enable credentials so the admin SPA can
# send its session cookie.
_cors_raw = (settings.admin_cors_origins or "*").strip()
if _cors_raw == "*":
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_credentials=False,
        allow_methods=["*"], allow_headers=["*"],
    )
else:
    _origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware, allow_origins=_origins, allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
        expose_headers=["X-Request-Id"],
    )


@app.middleware("http")
async def request_id_mw(request: Request, call_next):
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex
    request_id_ctx.set(rid)
    response = await call_next(request)
    response.headers["x-request-id"] = rid
    return response


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.code, "message": exc.message, **exc.extra},
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(_: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"error": "rate_limited", "message": str(exc)})


app.include_router(health_router)
app.include_router(metrics_router)
app.include_router(catalog_router)
app.include_router(mock_router)
app.include_router(whatsapp_router)
app.include_router(whatsapp_twilio_router)
app.include_router(payments_router)
app.include_router(voice_router)
app.include_router(voice_at_router)
# JWT-based admin console (Phase 8) MUST be registered before the legacy
# static-token admin router so first-match-wins routing prefers the new
# console endpoints. The legacy router still serves unique endpoints like
# the bulk CSV importer.
app.include_router(admin_auth_router)
app.include_router(admin_console_router)
app.include_router(admin_router)
app.include_router(privacy_router)

_STATIC_DIR = Path(__file__).parent / "static"
if _STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")

    @app.get("/admin", include_in_schema=False)
    async def admin_page() -> FileResponse:
        return FileResponse(_STATIC_DIR / "admin.html")


@app.get("/")
async def root() -> dict:
    return {"name": settings.app_name, "version": "0.2.0", "env": settings.app_env}
