# SYSTEM — single source of truth

**Scope:** Gen-Eat platform + Hazina Nomads + shared API (`api.lesnarai.co.ke`).  
**Maintain:** edit this file first when product, routing, catalog, deploy, or gaps change. Code wins if docs drift.  
**Verified:** 2026-06-01 · `git log -1 --oneline` · `git status -sb`  
**Security:** [SECURITY.md](../SECURITY.md)

**Legend:** ✅ shipped in code · 🟢 verified live · ⬜ not done · ◐ partial

---

## 1. Status matrix

| Area | Code | Live | Blocker / note |
|---|---|---|---|
| Shared API | ✅ | 🟢 | `api.lesnarai.co.ke`; `make doctor-hazina-live` passed on 2026-06-01 |
| Dedicated Hazina API service | ✅ | ◐ | `hazina-api.onrender.com` is same code but currently repair-gated by pgvector drift until migration `0013` deploys |
| Tenant `hazina-nomads` | ✅ | ◐ | `DEFAULT_BUSINESS_SLUG`; Meta `phone_number_id` |
| Gen-Eat portal | ✅ | 🟢 | `geneat.lesnarai.co.ke` |
| Hazina portal | ✅ | ⬜ | `hazina.lesnarai.co.ke` DNS unverified 2026-06-01; local `:3004` |
| Hazina WA | ✅ | ◐ | `+1 555 657 8220` |
| KES STK (IntaSend) | ✅ | 🟢 | Live keys; `PAYMENT_SIMULATOR=false`; primary M-Pesa rail |
| USD/card checkout | ✅ | ◐ | Paystack preferred when keys exist; IntaSend hosted checkout is fallback for now |
| Collections + guided checkout | ✅ | ◐ | Portal `ChatWidget` → structured payload |
| Private sourcing brief `/build` | ✅ | ◐ | Monograms + bespoke; may need push/deploy |
| Order tracking `HN-ORD-*?token=` | ✅ | ◐ | Needs `PUBLIC_HAZINA_PORTAL_URL` |
| Ghost Ops `!dispatch` / `!delivered` | ✅ | ⬜ | `ADMIN_WA_NUMBERS` on API |
| RAG / menu_photos | ✅ | ◐ | Shared API has pgvector + KB rows; dedicated Hazina DB needs `0013` repair + re-seed |
| Courier integration | ⬜ | ⬜ | Manual ops only |
| Partner payouts | ⬜ | ⬜ | Dashboard placeholder |
| DHL live rates | ⬜ | ⬜ | Stub in `app/ai/tools.py` |
| Collection/coastal photography | ◐ | ⬜ | Provisional heroes — brand risk |

---

## 2. Endpoints

| Resource | Value |
|---|---|
| API | `https://api.lesnarai.co.ke` |
| Health | `/healthz` `/readyz` `/health/deep` `/version` |
| Gen-Eat portal | `https://geneat.lesnarai.co.ke` · `gen-eat-portal/` |
| Hazina portal | `https://hazina.lesnarai.co.ke` · `hazina-portal/` · dev `make dev-hazina` → `:3004` |
| Hazina tracking | `{PUBLIC_HAZINA_PORTAL_URL}/orders/HN-ORD-{id8}?token={secret}` |
| Public order API | `GET /api/public/orders/{ref}?token=` |
| Git | `github.com/lesnargitonga/geneat` · branch `main` → Render |

**Tenants:** Production default `hazina-nomads`. Demo café only `lily-pond-cafe` (`DEMO_BUSINESS_SLUG`, KES 10 espresso). Also in DB: `library-bites`, `pavilion-grill`, `block-a-express`.

---

## 3. Architecture

```
Portals (/api/chat, /api/orders) + Meta WA webhook
  → FastAPI → tenant resolve → Redis lock/idempotency
  → [Hazina] ops_automation → gift_automation → pay resend
  → [Café] cafe_automation
  → else LangGraph + RAG + tools
  → Postgres (+ pgvector) · Redis (gift_checkout:*)
  → IntaSend (KES M-Pesa + card-link fallback) · Paystack (preferred USD card)
```

**No separate Hazina codebase.** The dedicated `hazina-api` Render service runs
the same FastAPI app and must pass the same `/health/deep` + Hazina doctor
checks before it becomes the public API target.

---

## 4. Routing (do not get this wrong)

| Signal | Tenant |
|---|---|
| Meta `phone_number_id` on webhook | Linked business row |
| `DEFAULT_BUSINESS_SLUG` | Fallback |
| Portal `business_slug=hazina-nomads` | Hazina |
| `HAZINA_CLAIMS_META_PHONE=true` | Meta phone → Hazina during cutover |
| `ensure_hazina_business()` | Auto-provision/repair from catalog |

**Failure:** wrong slug or stale Lily Pond mapping → café menus on Hazina number.

---

## 5. Code map (edit these)

| Path | Role |
|---|---|
| `app/catalog/hazina_catalog.py` | **Canonical Hazina catalog** — mirror to TS, then seed |
| `hazina-portal/lib/products.ts` `lib/treasures.ts` | Portal mirror |
| `app/services/gift_automation.py` | Hazina WA: menus, brief, checkout, pay |
| `app/services/order_tracking.py` `app/api/public_orders.py` | Tracking + public GET |
| `app/services/ops_automation.py` | `!dispatch` / `!delivered` |
| `app/services/cafe_automation.py` | Orders + `request_order_payment` |
| `app/channels/base.py` | Hazina fast path; ops first; payment resend |
| `app/integrations/payments/factory.py` | `resolve_payment_service(currency)` |
| `scripts/seed_hazina_nomads.py` | Tenant + KB |
| `hazina-portal/components/PackBuilder.tsx` | Private brief UI |
| `hazina-portal/components/ChatWidget.tsx` | Guided checkout |
| `render.yaml` | API + hazina-portal services |

Deep API/model reference: [README.md §3–§20](../README.md).

---

## 6. Payments

| CCY | Provider | Live requires |
|---|---|---|
| KES | IntaSend STK | `INTASEND_*`, `PAYMENT_SIMULATOR=false` |
| USD/card | Paystack link first, IntaSend checkout link fallback | `PAYSTACK_SECRET_KEY` or `INTASEND_API_TOKEN` |

Resend: guest text `resend STK` / `resend link` → `channels/base.py`.  
Order: `order.details.payment_currency`, `amount_usd`, `items`, `fulfillment_status`.

---

## 7. Hazina

**Slug:** `hazina-nomads`. One tenant on shared stack.

### Catalog

| | Count | Source |
|---|---:|---|
| Collections | 5 | `HAZINA_COLLECTIONS` |
| Treasures | 33 | `HAZINA_TREASURES` |
| Swahili Coast | 3 | `HN-T-071`–`073` |
| Engravable | 8 | `is_engravable` / `isEngravable` |
| menu_photos | ~108 | `build_hazina_menu_photos()` |

| Constant | Value |
|---|---|
| `MIN_CUSTOM_ITEMS` | 2 |
| Packaging | USD 45 / KES 5,800 (`HN-T-070`) |
| Engraving | USD 15 / KES 1,950 per line · SKU `HN-FEE-ENGRAVING` on order |

**Sync:** `hazina_catalog.py` → `lib/*.ts` → `PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py`

### Portal (customer)

| Route | Notes |
|---|---|
| `/collections`, `/collections/[id]` | 5 boxes · `CollectionCheckout` |
| `/build` | Private sourcing brief · `PackBuilder` |
| `/treasures` | 301 → `/build` |
| `/treasures/[id]` | Detail · `?add=` |
| `/orders/[id]?token=` | Tracking · noindex · no nav |
| `/hosts-guides`, `/partners/*` | Ghost · noindex |

### Capabilities

| Feature | Behaviour |
|---|---|
| Guided checkout | Chat: name → delivery → timing → pay → confirm → API payload |
| Private brief | SKU lines; optional `— Monogram: …`; `Bespoke requests:` block |
| Photos | **WhatsApp only** after brief (no portal upload) |
| Tracking | `ensure_order_tracking` → link in payment reply |
| Ghost Ops | `!dispatch HN-ORD-… <courier>` · `!delivered HN-ORD-…` · needs `ADMIN_WA_NUMBERS` |

**Engravable IDs:** `leather-passport`, `leather-luggage-tag`, `soapstone-big-five`, `antelope-carving`, `wood-carving-set`, `wooden-combs`, `beaded-wood-containers`, `lamu-keepsake-box`.

**Brief intro line:** `Hello Hazina Nomads — private sourcing brief:`

**WA channel order:** `ops_automation` → `gift_automation` → payment resend → LLM.

Brand copy, full SKU table, launch playbook: [HAZINA_NOMADS.md](HAZINA_NOMADS.md).

---

## 8. Gen-Eat (demo)

| | |
|---|---|
| Portal | `gen-eat-portal/` · Vercel |
| Flagship | `lily-pond-cafe` |
| Demo SKU | Demo Espresso KES 10 — **`DEMO_BUSINESS_SLUG` only** |
| Rehearsal | `make eval-whatsapp-live` · `make pre-demo-live` |

Same WA number as Hazina only if routing is confirmed — do not mix demos blindly.

---

## 9. Gaps, flaws, actions

### Not built / not live

| Item | Owner |
|---|---|
| Live Paystack + IntaSend | Ops — Render secrets |
| Hazina DNS + portal deploy | Ops |
| Prod KB re-seed | Ops — after catalog edits |
| `ADMIN_WA_NUMBERS` | Ops |
| Courier webhook | Eng |
| Partner ledger | Eng |
| Real DHL API | Eng |
| Finished-box + coastal photos | Creative |
| `pip-audit` / Next major upgrade | Eng |

### Architectural debt (fix when scaling)

| Issue | Sev |
|---|---|
| Py + TS catalog must stay in sync | High |
| ~~Engraving not structured on `order.details`~~ | ✅ `engravings[]`, `bespoke_request` on finalize |
| ~~Engraving fee not line-item SKU~~ | ✅ `HN-FEE-ENGRAVING` line in `details.items` |
| Ghost Ops scans last 500 orders | Med |
| Tracking token never rotates | Med |
| RAG stale until re-seed | Med |
| DHL stub may sound binding in AI | Med |

### P0 (before real money)

1. Push `main` · redeploy API + portal · align `PUBLIC_HAZINA_PORTAL_URL`  
2. `PAYMENT_SIMULATOR=false` · live keys · one KES + one USD order  
3. `ADMIN_WA_NUMBERS` · ops trained on Ghost Ops  
4. Prod seed · real collection/coastal images or label provisional  

### P1 (month one)

Courier webhook or ops UI · CI `len(HAZINA_TREASURES)` == portal `TREASURES.length`  

**Not implied by “done”:** tracking page ≠ courier API · brief UI ≠ workshop WMS · IntaSend card fallback ≠ Paystack merchant approved  

---

## 10. Ops

```bash
make dev              # API :8000
make dev-hazina       # portal :3004
make preview-hazina   # prod build — CSS QA
make test-hazina
make doctor-hazina-live   # safe no-money Hazina check against api.lesnarai.co.ke
make doctor-hazina-api    # same check against hazina-api.onrender.com
PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py
```

**Deploy:** `alembic upgrade head` → seed → `make test-hazina` → portal build → push → check `/version` → `make doctor-hazina-live` → secrets below → smoke order + brief + tracking + `!dispatch`.

### Env (minimum)

| Variable | Service | Purpose |
|---|---|---|
| `DEFAULT_BUSINESS_SLUG` | API | `hazina-nomads` |
| `DEMO_BUSINESS_SLUG` | API | `lily-pond-cafe` |
| `HAZINA_CLAIMS_META_PHONE` | API | Cutover routing |
| `META_WA_*` | API | WhatsApp |
| `PUBLIC_HAZINA_PORTAL_URL` | API | Tracking links |
| `ADMIN_WA_NUMBERS` | API | Ghost Ops |
| `PAYMENT_SIMULATOR` | API | `false` for real money |
| `INTASEND_*` `PAYSTACK_*` | API | Payments |
| `BACKEND_URL` | Portal | `https://api.lesnarai.co.ke` |
| `NEXT_PUBLIC_HAZINA_WHATSAPP` | Portal | CTA |

Full: `.env.example` · [README.md §19](../README.md).

### Tests

`test_gift_automation` · `test_order_tracking` · `test_ops_automation` · `test_payment_routing` · `test_channel_fallbacks`

---

## 11. Other docs

| File | Use |
|---|---|
| **SYSTEM.md** | **This file — only status authority** |
| [README.md](../README.md) | Architecture / API / scaling reference |
| [HAZINA_NOMADS.md](HAZINA_NOMADS.md) | Brand, SKU tables, launch, portal troubleshooting |
| [hazina-portal/README.md](../hazina-portal/README.md) | Portal commands only |

Do not add a second master doc.
