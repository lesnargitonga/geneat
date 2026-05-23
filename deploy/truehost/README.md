# Truehost API Cutover

This file documents the backup / alternative server-side path, not the current
live production truth.

Current single source of truth:

- [Production Deployment Runbook](../../README.md#19-production-deployment-runbook)
- [Current Truth And Verification](../../README.md#2-current-truth-and-verification)

Important current truth:

- the active hosted beta backend is on Render,
- this Truehost bundle remains useful if the project later moves off Render
  or wants a more VM-style deployment path.

This folder is the server-side bundle for moving `api.lesnarai.co.ke` off the
local laptop and onto the Truehost host while keeping Cloudflare in front.

## Target shape

- `geneat.lesnarai.co.ke` stays on Vercel
- `api.lesnarai.co.ke` stays on the existing Cloudflare tunnel hostname
- the tunnel connector runs on the Truehost machine instead of this laptop
- the FastAPI app runs in Docker on `127.0.0.1:8000`

## Files

- `docker-compose.api.yml`
  Runs the API and a `cloudflared` sidecar.
- `cloudflared/config.yml.example`
  Template for the named Cloudflare tunnel already in use locally.

## Server prerequisites

1. Docker Engine with Compose plugin
2. A copy of this repo on the server
3. A production `.env` file placed next to `docker-compose.api.yml`
   - start from `deploy/truehost/.env.example`
4. The Cloudflare tunnel credentials JSON copied from the current machine into:
   `deploy/truehost/cloudflared/81fbd285-69b0-4509-83c3-ea7171a80532.json`

## Expected directory layout on the server

```text
/srv/geneat/
  Dockerfile
  requirements.txt
  ...
  deploy/truehost/
    docker-compose.api.yml
    .env
    cloudflared/
      config.yml
      81fbd285-69b0-4509-83c3-ea7171a80532.json
```

## First boot

From `deploy/truehost/`:

```bash
cp cloudflared/config.yml.example cloudflared/config.yml
docker compose -f docker-compose.api.yml up -d --build
docker compose -f docker-compose.api.yml ps
docker compose -f docker-compose.api.yml logs api --tail=100
docker compose -f docker-compose.api.yml logs cloudflared --tail=100
```

## Cutover verification

Run these after the stack is up:

```bash
curl -s http://127.0.0.1:8000/healthz
curl -s https://api.lesnarai.co.ke/healthz
curl -s https://api.lesnarai.co.ke/readyz
```

Expected:

- `/healthz` returns `{"status":"ok"}`
- `/readyz` shows database and redis healthy
- `cloudflared` logs show an active connector

## Cutover order

1. Start the new stack on Truehost
2. Confirm `https://api.lesnarai.co.ke/healthz` works from the server-backed tunnel
3. Stop the laptop tunnel
4. Re-test WhatsApp webhook verification and a real Lily Pond chat

## Notes

- This setup assumes Postgres and Redis are external production services and are
  provided through `.env`
- If you later move to a VM without Docker, the same app can be run behind
  `systemd` with the root `Dockerfile` or `uvicorn` directly
