# Hazina Nomads portal

## Local development (recommended)

One URL, hot reload — save a file and refresh the browser.

```bash
# from repo root
make dev-hazina

# or
cd hazina-portal && npm run dev
```

Open **http://localhost:3004** (always this port).

Production-style preview (rebuild required after each change):

```bash
make preview-hazina
```

## Partner / hosts (ghost pages)

- **`/hosts-guides`** — B2B pitch only; not in nav/footer; `noindex`. Share the URL directly with hosts.
- **`/partners/login`** — Partner wall; set `PARTNER_PORTAL_EMAIL` and `PARTNER_PORTAL_PASSWORD` in env.
- **`/partners/dashboard`** — Referral code and earnings (login required).
