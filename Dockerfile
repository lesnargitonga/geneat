# syntax=docker/dockerfile:1.7
# ---- Build stage --------------------------------------------------------
FROM python:3.12-slim AS builder
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt

# ---- Runtime stage ------------------------------------------------------
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app \
    PORT=8000

# Runtime deps only — libpq for asyncpg/psycopg, curl for HEALTHCHECK, tini for PID 1.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 curl tini ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1000 app && \
    useradd  --system --uid 1000 --gid app --home-dir /app --shell /sbin/nologin app

WORKDIR /app
COPY --from=builder /install /usr/local
COPY --chown=app:app . /app

# Strip caches & dev artefacts that may have been copied in.
RUN find /app -type d \( -name __pycache__ -o -name ".pytest_cache" -o -name ".mypy_cache" \) -prune -exec rm -rf {} + && \
    rm -rf /app/.git /app/.venv /app/tests 2>/dev/null || true

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:${PORT}/healthz || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*' --workers ${UVICORN_WORKERS:-2}"]
