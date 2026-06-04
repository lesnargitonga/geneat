# Hazina Nomads portal

Customer-facing Next.js 14 app for **hazina.lesnarai.co.ke**. Shares the repo API at `api.lesnarai.co.ke` (not the Gen-Eat `gen-eat-portal/` app).

**Status & ops:** [docs/SYSTEM.md](../docs/SYSTEM.md) · **Brand/SKU detail:** [docs/HAZINA_NOMADS.md](../docs/HAZINA_NOMADS.md) · **Portal commands:** below.

---

## Local development

One URL, hot reload — save a file and refresh the browser.

```bash
# from repo root
make dev-hazina

# foreground logs
make dev-hazina-fg

# or
cd hazina-portal && npm run dev
```

Open **http://localhost:3004** (override: `HAZINA_DEV_PORT=3005`).

For chat widget tests, run the API in another terminal:

```bash
make dev   # FastAPI on :8000
```

Production-style preview (rebuild after each change):

```bash
make preview-hazina   # next build + next start on :3004
```

---

## Public site map (2026-06-01)

| URL | In nav? | Notes |
|---|---|---|
| `/` | — | Hero + mobile collection rail + path cards |
| `/collections` | ✅ | 5 curated boxes |
| `/collections/[id]` | via cards | Checkout + inside-the-box |
| `/build` | ✅ | Browse treasures + custom box cart |
| `/treasures/[id]` | via build | Item detail; back → `/build` |
| `/premium-safari-souvenirs-nairobi` | ✅ Curation | Legacy SEO landing, Triad-aligned copy |
| `/about` | ✅ | Brand story |
| `/treasures` | — | **301 → `/build`** |
| `/last-minute-kenya-gifts-jkia` | — | **301 → `/collections/departure-drop`** |

**Nav:** Collections · Build · Curation · About · Chat in app · Order on WhatsApp.

---

## Partner / hosts (not in public nav)

| URL | Purpose |
|---|---|
| `/hosts-guides` | B2B pitch — `noindex`; share URL directly |
| `/partners/login` | Sign-in wall |
| `/partners/dashboard` | Referral code + placeholder earnings |

Set in `.env` (see repo `.env.example`):

```bash
PARTNER_PORTAL_EMAIL=
PARTNER_PORTAL_PASSWORD=
PARTNER_REFERRAL_CODE=REF-HOST-001
```

**Not built yet:** real commission ledger, per-host accounts, payout API.

---

## Catalog source of truth

Authoritative catalog truth lives in **`app/catalog/hazina_catalog.py`**.

The portal now prefers:

```text
GET {BACKEND_URL}/catalog/businesses/hazina-nomads/hazina
```

and falls back to `lib/products.ts` / `lib/treasures.ts` only when the backend
is unavailable during a deploy window. Keep the TypeScript files as a resilience
fallback, but do not treat them as the production source of truth.

After catalog edits:

1. Edit **`app/catalog/hazina_catalog.py`**.
2. Run the catalog contract tests.
3. Re-seed: `PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py`
4. Deploy backend before portal if the portal depends on new catalog fields.

Packaging fee: **USD 45 / KES 5,800**. Minimum custom items: **2**.

---

## Scripts

```bash
npm run dev          # next dev (:3004 via root script)
npm run build        # production build
npm run typecheck
npm run lint
```

From repo root:

```bash
make test-hazina     # backend tests for Hazina flows
python scripts/check_asset_images.py
```

---

## Deploy

Render service `hazina-portal` in `render.yaml` → `hazina.lesnarai.co.ke`.

The Render blueprint targets Frankfurt resources:

```text
hazina-api          frankfurt
hazina-portal       frankfurt
hazina-postgres-fra frankfurt
hazina-redis-fra    frankfurt
```

Existing managed resources named `hazina-postgres` or `hazina-redis` in Oregon
are legacy resources. Render does not move a managed database/Redis instance
when a region env var changes; create/attach the Frankfurt resources and point
`DATABASE_URL`, `DATABASE_URL_SYNC`, and `REDIS_URL` at the Frankfurt instances.

**www alias:** In Vercel (or your DNS host), add `www.hazina.lesnarai.co.ke` as a domain alias pointing at the same project. Middleware + `next.config` redirect `www` → apex. Without the DNS record, `www` will not resolve for guests.

Env: `BACKEND_URL`, `PUBLIC_HAZINA_PORTAL_URL`, `NEXT_PUBLIC_HAZINA_WHATSAPP`, `NEXT_PUBLIC_HAZINA_PHONE`, partner vars above.

### Order tracking (magic links)

Guest URL: `/orders/{HN-ORD-…}?token=…` (sent via WhatsApp after checkout).

- Portal server-fetches `GET {BACKEND_URL}/api/public/orders/{ref}?token=…`
- BFF mirror: `GET /api/orders/{ref}?token=…` (same payload; useful for debugging)
- Ops updates (`!dispatch` / `!delivered`) and payment webhooks drive `order.details.fulfillment_status`

Local: copy `.env.example` → `.env.local`, run API (`make dev`) + portal (`make dev-hazina`).

If the live site looks like an old UI, redeploy after `git push` — local commits do not update production until Render rebuilds.

### Site shows 500 or “Cannot find module './NN.js'”

Stale `.next` from mixing `next dev` and `next start`. Fix:

```bash
make preview-hazina    # stable: rebuild + production server on :3004
# or
./scripts/dev-hazina.sh --clean
```

Do not run `next start` and `next dev` on the same port without deleting `.next` first.
