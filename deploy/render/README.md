# Render Go-Live

This file is a deployment pointer, not the canonical system document.

Current single source of truth:

- [Production Deployment Runbook](../../README.md#19-production-deployment-runbook)
- [Current Truth And Verification](../../README.md#2-current-truth-and-verification)
- [Scaling Notes And Known Gaps](../../README.md#23-scaling-notes-and-known-gaps)

Important current truth:

- the live beta stack is already running on Render,
- the live beta cutover was finalized manually,
- `render.yaml` expresses the cleaner desired target shape,
- so do not assume the current live service names exactly match the blueprint.

This deployment path replaces the laptop-hosted backend with a managed Render
stack while keeping:

- `geneat.lesnarai.co.ke` on Vercel
- `api.lesnarai.co.ke` as the backend API custom domain
- DNS and public TLS on Cloudflare
- the Truehost purchase as the domain registrar only

## Files

- `render.yaml` — Render Blueprint for API + Postgres + Redis-compatible Key Value
- `Dockerfile` — used by the Render web service

## Why this path

Render supports:

- Docker-based web services
- custom domains with managed TLS
- managed Postgres
- managed Redis-compatible Key Value
- pre-deploy commands for migrations on paid web services

## 1. Create the Render Blueprint

1. Push the repo with `render.yaml` to GitHub.
2. In Render, choose **New > Blueprint**.
3. Select the repository.
4. Render will discover:
   - `geneat-api`
   - `geneat-postgres`
   - `geneat-redis`

## 2. Fill the required secrets

Render will prompt for all `sync: false` variables on first creation.

Local helper:

```bash
python scripts/build_render_env.py
```

That writes `deploy/render/render.local.env`, which is intentionally ignored
by git. Use it only as a copy/paste checklist for Render environment variables;
replace the database and Redis placeholders with Render-managed values.

Minimum required for your live setup:

- `SECRET_KEY`
- `PHONE_HASH_PEPPER`
- `OPENAI_API_KEY`
- `META_WA_PHONE_NUMBER_ID`
- `META_WA_ACCESS_TOKEN`
- `META_WA_VERIFY_TOKEN`
- `META_WA_APP_SECRET`
- `INTASEND_API_TOKEN`
- `ADMIN_API_TOKEN`
- `JWT_SECRET`

Recommended at the same time:

- `INTASEND_PUBLISHABLE_KEY`
- `INTASEND_WEBHOOK_SECRET`
- `ADMIN_CORS_ORIGINS`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_URL_BASE`
- `SENTRY_DSN`

Notes:

- `DATABASE_URL` and `DATABASE_URL_SYNC` are wired automatically from the
  managed Render Postgres instance.
- `REDIS_URL` is wired automatically from Render Key Value.
- The app now accepts Render's plain `postgresql://...` URLs and normalizes
  them internally to the async/sync SQLAlchemy driver URLs it needs.

## 3. Create the custom domain in Render

In the `geneat-api` service settings:

1. Add custom domain: `api.lesnarai.co.ke`
2. Render will show the target DNS record to configure

## 4. Point Cloudflare DNS to Render

In Cloudflare DNS for `lesnarai.co.ke`:

1. Update the `api` record to the value Render gives you
2. Keep Cloudflare proxying enabled unless Render explicitly instructs otherwise

After verification:

- Render will issue TLS for `api.lesnarai.co.ke`
- Cloudflare will continue serving edge TLS to the public

## 5. Verify the deploy

Once Render finishes:

```bash
curl -s https://api.lesnarai.co.ke/healthz
curl -s https://api.lesnarai.co.ke/readyz
```

Expected:

- `/healthz` → `{"status":"ok"}`
- `/readyz` → DB and Redis healthy

## 6. Reconnect external providers

After the new API is healthy, make sure these point to the Render-backed API:

- Meta WhatsApp webhook:
  - `https://api.lesnarai.co.ke/webhooks/whatsapp`
- IntaSend callback / webhook:
  - `https://api.lesnarai.co.ke/payments/intasend/callback`

## 7. Seed / restore data

Two options:

### Option A — keep demo-only data

After first deploy, seed the Render Postgres instance with the current demo data:

```bash
python scripts/seed_geneat_demo.py
```

Run this with the Render `DATABASE_URL` / `DATABASE_URL_SYNC` values exported
locally, or through a one-off shell attached to the Render environment.

### Option B — migrate current data

If the local Postgres contains the latest truth you want to preserve:

1. `pg_dump` the current database
2. restore into the Render Postgres instance
3. re-run `alembic upgrade head`

## 8. Final cutover

When all checks pass:

1. test Lily Pond web chat
2. test Lily Pond WhatsApp live chat
3. test a real STK payment
4. confirm receipt message delivery
5. stop the laptop-hosted backend tunnel

At that point the app is no longer dependent on this PC being on.

## Recommended post-cutover hardening

- Switch Cloudflare SSL mode from `Full` to `Full (strict)` after the Render
  custom domain is healthy
- Add alerts for `/readyz`, payment callback failures, and webhook delivery failures
- Add `ruff`/lint and migration checks to CI
