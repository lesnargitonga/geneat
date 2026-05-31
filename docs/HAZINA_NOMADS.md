# Hazina Nomads — Master Blueprint & Implementation

**Canonical launch document** for Hazina Nomads (premium tourist gift concierge).  
Merges the user master blueprint with in-repo implementation status.  
**Target launch:** Q3 2026 · **Model:** Premium tourist gift concierge · **Stack:** WhatsApp AI + Next.js portal on existing multi-tenant platform.

> Platform architecture remains in [README.md](../README.md). This doc owns Hazina-specific product, ops, and cutover truth.

---

## 1. Brand & positioning

You are **not** a souvenir shop — you are a **premium travel concierge**. Value = time, curation, convenience.

| Field | Value |
|---|---|
| **Name** | Hazina Nomads (*Hazina* = treasure, Swahili) |
| **Tagline** | Curated treasures for the modern nomad. |
| **Vision** | Pan-African brand; **MVP collection is strictly Kenyan** |
| **Industry slug** | `gift-concierge` |
| **Voice** | Professional, calm, high-end hotel concierge. 1–3 sentences. Zero campus-café slang. Confirm delivery location + departure before promising dispatch. |
| **Custom orders** | **Off** at launch unless corporate / high-budget → escalate human |

### Visual identity

| Token | Hex | Usage |
|---|---|---|
| Terracotta | `#C45C3E` | Primary CTA, brand accent (portal implements this; seed profile has `#B85C38` — align at design lock) |
| Sage | `#8B9A6B` | Secondary accent, chips |
| Charcoal | `#2C2C2C` | Body text / dark sections |
| Cream | `#F5F0E8` | Page background |

Fonts: minimalist serif/display (portal: Bricolage Grotesque + Inter via Google Fonts).

### AI persona (seeded)

- **Brand voice:** `scripts/seed_hazina_nomads.py` → `BRAND_VOICE`
- **Greeting:** `GREETING_TEMPLATE` — same file
- **Playbook:** retail vertical via `profile.vertical = "retail"` → `app/ai/playbooks/retail.py`

---

## 2. Product catalog (MVP — exactly 5 boxes)

**Code source of truth:** `scripts/seed_hazina_nomads.py` → `PRODUCTS`  
**Portal mirror:** `hazina-portal/lib/products.ts` → `GIFT_BOXES`  
**RAG catalog:** same seed file → `KB_CATALOG` (5 chunks)  
**No bespoke boxes** unless guest mentions corporate gifting or high budget.

### 2.1 The Kenya Edit

| | |
|---|---|
| **ID / SKU** | `kenya-edit` / `HN-KE-001` |
| **Price** | USD 89 · KES 11,500 |
| **Target** | Safari tourists, European/US visitors |
| **Contents** | Premium Kenyan coffee (250g), handmade Maasai beadwork (bracelet or necklace), small artisan soapstone carving, printed brand story card |
| **Lead time** | 24h |
| **Personalization** | No |

### 2.2 The Highland Treasure

| | |
|---|---|
| **ID / SKU** | `highland-treasure` / `HN-HT-002` |
| **Price** | USD 59 · KES 7,600 |
| **Target** | General gifting, diaspora, colleagues |
| **Contents** | Export-grade Kenyan coffee, premium Kenyan loose-leaf tea, local raw honey, carved wooden tasting spoon |
| **Lead time** | 24h |
| **Personalization** | No |

### 2.3 The Nomad Leather Set

| | |
|---|---|
| **ID / SKU** | `nomad-leather-set` / `HN-NL-003` |
| **Price** | USD 129 · KES 16,600 |
| **Target** | Business travellers, wealthy tourists |
| **Contents** | Handmade leather passport holder, luggage tag, travel notebook |
| **Lead time** | 24h |
| **Personalization** | Yes — **engraving requires 24-hour notice** |

### 2.4 The Safari Romance Box

| | |
|---|---|
| **ID / SKU** | `safari-romance-box` / `HN-SR-004` |
| **Price** | USD 199 · KES 25,600 |
| **Target** | Honeymooners, anniversary trips |
| **Contents** | Matching couple's beadwork, premium treats (chocolate/coffee), framed minimalist safari route map, leather luggage tags |
| **Lead time** | 48h (assembly); leather tag engraving +24h notice |
| **Personalization** | Yes |

### 2.5 The Departure Drop

| | |
|---|---|
| **ID / SKU** | `departure-drop` / `HN-DD-005` |
| **Price** | USD 149 · KES 19,200 |
| **Target** | Last-minute JKIA departures |
| **Contents** | Pre-packed fast movers: coffee, tea, un-personalized leather, beadwork |
| **Lead time** | **4h** (JKIA-optimised) |
| **Flag** | `jkia_only: true` in seed/profile |

---

## 3. Logistics & delivery rules

Seeded into RAG as `KB_POLICIES` (8 chunks) in `scripts/seed_hazina_nomads.py`.

### 3.1 Delivery zones (MVP)

| Zone | Status |
|---|---|
| Westlands | ✅ In zone |
| Kilimani | ✅ In zone |
| Karen | ✅ In zone |
| JKIA (all terminals) | ✅ In zone |
| Other Nairobi neighbourhoods | ❌ **Not at MVP** |

### 3.2 Hotel delivery

Collect before dispatch:

- Hotel name
- Room number **or** front-desk hold
- Preferred delivery window
- Guest name on order

### 3.3 JKIA delivery

Required:

- **≥ 4 hours** before guest departure (`profile.jkia_delivery_window_hours`)
- Terminal number (e.g. `1A`, `1E`)
- Reachable phone / WhatsApp

**Preferred SKU:** Departure Drop.  
**AI must capture:** `delivery_location` + `departure_time_iso` on `create_order` (see §8).

### 3.4 Late dispatch

| Rule | Value |
|---|---|
| Cutoff | After **20:00 EAT** (`profile.late_dispatch_after`) |
| Fee | **USD 15** (`profile.late_dispatch_fee_usd`) |
| Same-day JKIA before 20:00 | 4-hour window, no late fee if feasible |

### 3.5 Operating hours

Dispatch coordination: **08:00–20:00 EAT** daily (KB policy chunk).

### 3.6 Affiliate (configured, not wired)

| Field | Value |
|---|---|
| Host commission | 15% (`profile.affiliate.host_commission_pct`) |
| Referral prefix | `REF-HOST-` (`profile.affiliate.referral_prefix`) |
| Payout | Blueprint: Friday IntaSend batch — **TODO Day 6**

---

## 4. Financial & payment infrastructure

IntaSend KES cap (~KES 300,000) ≈ 20–30 premium boxes/day before needing scale path.

### Phase 1 — Day 1–30 (Hybrid stack) — **partial**

| Rail | Provider | Status | Notes |
|---|---|---|---|
| KES M-Pesa STK | IntaSend | ✅ Platform supports via `PAYMENT_PROVIDER=intasend` | Wire as default for Hazina cutover |
| USD cards (Visa/MC/Apple Pay) | Paystack | ⬜ **TODO Day 4** | Generate USD checkout link post-`create_order` |
| Tooling | `request_mpesa_payment` | ✅ Exists in `app/ai/tools.py` | Agent fires after order confirmed |

### Phase 2 — Scale ($5k–$10k/mo)

| Rail | Provider | Status |
|---|---|---|
| International travel payments | DPO Group | ⬜ Apply after volume proof |

### Global shipping

| Component | Status | Path |
|---|---|---|
| AI quote tool | ✅ **Stub** | `app/ai/tools.py` → `calculate_dhl_shipping` |
| Real DHL rate API | ⬜ TODO | Replace weight-band stub |
| Frontend option | ⬜ TODO | Next.js checkout / concierge flow |

**Stub behaviour:** weight bands → USD estimate, `stub: true` in response, 3–5 business day lead.

---

## 5. Physical sourcing & fulfillment

**Status: blueprint only — no in-repo automation.**

### 5.1 Packaging & photography

- [ ] 10× matte-black rigid magnetic-closure boxes (Industrial Area / packaging suppliers)
- [ ] Branded cream tissue, wax seals or premium logo stickers
- [ ] Product shots: natural light, wood/marble surface — **no stock photos**
- [ ] Upload to Meta WhatsApp Catalog + `profile.menu_photos` + portal

### 5.2 Supplier agreements

| Category | Sourcing note |
|---|---|
| **Leather** | Kariokor / River Road workshop; fixed wholesale; **12h engraving SLA** |
| **Crafts** | Single Maasai Market vendor as premium buyer — consistent quality |
| **Coffee / tea / honey** | Export-grade; lock SKUs before photography |

### 5.3 Last-mile

- **No standard boda-bodas** — perceived value risk
- Contract professional courier (e.g. Express Messengers) **or** 2 vetted Uber Package drivers with clean cars
- Branded Hazina delivery sleeves for handoff

---

## 6. Go-to-market & B2B partnerships

**Status: operational playbook — mostly external execution.**

### 6.1 Airbnb host network

- Heavy-cardstock QR: *"Scan to order premium Kenyan gifts, delivered to this Airbnb."*
- Target Superhosts in Kilimani / Westlands
- Tracking code: `REF-HOST-{NAME}` (matches seed `referral_prefix`)
- **15% commission**, automated Friday payout via IntaSend — **TODO Day 6**

### 6.2 Safari drivers & tour guides

- Physical affiliate cards at drop-off / tour operator offices
- Flat cash commission per box sold

### 6.3 Boutique hotel concierges

- 10–15 boutique properties (not large chains)
- Front-desk commission for souvenir referrals

### 6.4 Digital interception (SEO & social)

| Asset | Status | Path |
|---|---|---|
| JKIA last-minute landing | ✅ Implemented | `/last-minute-kenya-gifts-jkia` |
| Safari souvenirs Nairobi | ⬜ TODO | Blueprint: `/premium-safari-souvenirs-nairobi` |
| TikTok / short video | ⬜ External | "Departure Drop to Terminal 1A in 3 hours" narrative |

---

## 7. Seven-day launch sequence

| Day | Workstream | Blueprint intent | In-repo status |
|---|---|---|---|
| **1** | Digital real estate | Domains, social handles, logo, Paystack application | ⬜ **External** — user-owned |
| **2** | Tech pivot — tenant | Postgres tenant `hazina-nomads`, env prep | ✅ **`scripts/seed_hazina_nomads.py`** — 5 products, 13 KB chunks, brand voice |
| **2–3** | Tech pivot — frontend | Standalone Hazina portal | ✅ `hazina-portal/` (see §9) |
| **3** | Physical prototyping | Source coffee, beadwork, rigid boxes; assemble prototype | ⬜ **External** |
| **3** | WhatsApp + AI tools | Hazina menus, delivery fields on orders | ✅ See §10–§11 |
| **4** | Media production | Product photography → WA Catalog + website | ⬜ **`profile.menu_photos` empty** |
| **4** | Paystack USD | Checkout links for international guests | ⬜ Not wired |
| **5** | AI calibration | RAG rules, eval matrix for terminals/times | ✅ RAG seeded; run `make eval-whatsapp-local` before cutover |
| **6** | Logistics lock | Vet courier/driver; packaging workflow | ⬜ **External** |
| **6** | Host affiliate | `REF-HOST-*` tracking + commission ledger | ⬜ Config in seed only |
| **7** | Soft launch | Render deploy, live USD rehearsal, 50 Airbnb QR cards | ✅ **`DEFAULT_BUSINESS_SLUG=hazina-nomads`** in `render.yaml` + gift automation |

---

## 8. Technical tenant configuration

### 8.1 Tenant record

| Field | Value |
|---|---|
| **Slug** | `hazina-nomads` |
| **Name** | Hazina Nomads |
| **Industry** | `gift-concierge` |
| **Location** | Nairobi — Westlands, Kilimani, Karen & JKIA delivery |
| **Phone** | `+254700000001` (seed placeholder) |
| **Email** | `concierge@hazina-nomads.com` |
| **Languages** | `en` primary, `sw` secondary |
| **Coords** | -1.2921, 36.7853 (Nairobi) |
| **Timezone** | `Africa/Nairobi` |

### 8.2 Seed command

```bash
# Full tenant + KB re-embed (requires EMBED_PROVIDER in .env)
PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py

# Flags
PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py --skip-kb   # business row only
```

**KB output:** 5 catalog + 8 policy = **13 chunks**.

### 8.3 Environment variables (cutover)

Documented in `.env.example` (lines 78–83). **Do not flip production until Day 7 decision.**

```bash
# Tenant routing (production)
DEFAULT_BUSINESS_SLUG=hazina-nomads          # render.yaml + config default
DEMO_BUSINESS_SLUG=lily-pond-cafe            # KES 10 demo espresso — café tenant only

# WhatsApp
META_WA_PHONE_NUMBER_ID=<Hazina Meta number>

# URLs — Hazina has its own portal domain (not geneat.lesnarai.co.ke)
PUBLIC_HAZINA_PORTAL_URL=https://hazina.lesnarai.co.ke
PUBLIC_API_URL=https://api.lesnarai.co.ke
ADMIN_CORS_ORIGINS=https://hazina.lesnarai.co.ke,https://geneat.lesnarai.co.ke,...

# Payments
PAYMENT_PROVIDER=intasend                    # KES STK
# Paystack keys when Day 4 USD checkout lands

# hazina-portal/ (set in Render or Vercel)
NEXT_PUBLIC_HAZINA_WHATSAPP=254700000001
NEXT_PUBLIC_HAZINA_PHONE=+254700000001
NEXT_PUBLIC_BACKEND_URL=https://api.lesnarai.co.ke
```

### 8.4 Pre-flight checklist

```bash
# 1. Seed tenant
PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py

# 2. Go-live gate (chat + optional live)
python scripts/tenant_go_live_check.py --slug hazina-nomads --chat
python scripts/tenant_go_live_check.py --slug hazina-nomads --live --chat

# 3. WhatsApp menu unit tests
./.venv/bin/python -m pytest -q tests/test_whatsapp_menus.py

# 4. Reply matrix
make eval-whatsapp-local

# 5. Portal build
cd hazina-portal && npm run build
```

### 8.5 Production cutover (Day 7)

**In-repo (done):** `render.yaml` defaults to `hazina-nomads`; `app/services/gift_automation.py` mirrors Lily Pond fast paths; seed links `META_WA_PHONE_NUMBER_ID` when set.

**You must set on Render (sync: false secrets):**

1. `META_WA_PHONE_NUMBER_ID` — Hazina Meta Cloud API phone id (maps tenant via seed)
2. `META_WA_ACCESS_TOKEN`, `META_WA_VERIFY_TOKEN`, `META_WA_APP_SECRET`
3. `ADMIN_CORS_ORIGINS` — include `https://hazina.lesnarai.co.ke`
4. `NEXT_PUBLIC_HAZINA_WHATSAPP` / `NEXT_PUBLIC_HAZINA_PHONE` on `hazina-portal` service
5. Re-run `scripts/seed_hazina_nomads.py` after setting Meta phone id

Then: live WhatsApp → menu tap → delivery capture → M-Pesa STK; free-form Q&A still uses AI; `create_order` from AI triggers automatic STK via `finalize_checkout_from_ai`.

### 8.6 Tenant swap model

No app rewrite — **multi-tenant swap**:

```
Meta WA webhook → resolve business by phone_number_id or DEFAULT_BUSINESS_SLUG
               → RAG scoped to business_id
               → WhatsApp menus branch on business_slug
               → create_order writes to orders.details for that tenant
```

Gen-Eat café tenants (`lily-pond-cafe`, etc.) remain in DB; demo path stays on `DEMO_BUSINESS_SLUG`.

---

## 9. Website implementation (`hazina-portal/`)

**Standalone Next.js app** — not part of `gen-eat-portal/`. Gen-Eat café demo stays at `geneat.lesnarai.co.ke`; Hazina deploys to **`hazina.lesnarai.co.ke`**.

### 9.0 Deployment (mirrors Gen-Eat split)

| Layer | Gen-Eat (reference) | Hazina Nomads |
|---|---|---|
| Customer portal | `geneat.lesnarai.co.ke` via **Vercel** (`gen-eat-portal/vercel.json`) | `hazina.lesnarai.co.ke` via **Render** (`render.yaml` → `hazina-portal`) or Vercel (`hazina-portal/vercel.json`) |
| Backend API | `api.lesnarai.co.ke` on Render (`geneat-api`) | **Same shared API** — tenant resolved by `business_slug` / WhatsApp phone |
| Portal → API | `BACKEND_URL` / `NEXT_PUBLIC_BACKEND_URL` → `/mock/message` proxy in `app/api/chat/route.ts` | Same pattern |
| DNS | Cloudflare on `lesnarai.co.ke` | Add `hazina` CNAME to Render (or Vercel) |

**Recommended subdomain:** `hazina.lesnarai.co.ke` (consistent with `geneat.` and `api.`). Register `hazina-nomads.com` later and 301 to the subdomain or vice versa.

**Render cutover:**

1. Push repo; Render Blueprint picks up `hazina-portal` service.
2. In Cloudflare DNS: `hazina` → Render hostname (proxy on).
3. Set `NEXT_PUBLIC_HAZINA_WHATSAPP` / `NEXT_PUBLIC_HAZINA_PHONE` in Render env.
4. Add `https://hazina.lesnarai.co.ke` to `ADMIN_CORS_ORIGINS` on `geneat-api`.

**Vercel alternative:** import `hazina-portal/` as its own project (same as Gen-Eat portal pattern).

### 9.1 Routes

| Route | Status | File |
|---|---|---|
| `/` | ✅ Concierge homepage | `app/page.tsx` |
| `/collections` | ✅ 5-box catalog grid | `app/collections/page.tsx` |
| `/last-minute-kenya-gifts-jkia` | ✅ SEO landing (Departure Drop CTA) | `app/last-minute-kenya-gifts-jkia/page.tsx` |
| `/about` | ✅ Brand story | `app/about/page.tsx` |
| `/premium-safari-souvenirs-nairobi` | ⬜ Blueprint only | — |

No `/cafes`, `/map`, or `/owners` — those remain Gen-Eat-only in `gen-eat-portal/`.

### 9.2 Components & data

| Asset | Path |
|---|---|
| Product catalog | `lib/products.ts` — includes `image` / `imageAlt` per box |
| Product photos | `public/products/` — one hero shot per MVP box |
| Brand atmosphere | `public/brand/` — `hero-bg.jpg`, `hero-gift-box.png`, `safari-sunset.jpg` |
| Product image component | `components/ProductImage.tsx` |
| Nav | `components/Nav.tsx` — Collections, JKIA gifts, About |
| Footer | `components/Footer.tsx` |
| Chat widget | `components/ChatWidget.tsx` — Hazina-only; `business_slug=hazina-nomads` |
| Styles | `tailwind.config.ts`, `app/globals.css` |
| Metadata | `app/layout.tsx` |

**Image usage by page**

| Page | Images |
|---|---|
| `/` | Hero: Kenya Edit product shot; collection cards; JKIA banner uses `brand/safari-sunset.jpg` |
| `/collections` | All five `public/products/*` via `ProductImage` |
| `/last-minute-kenya-gifts-jkia` | `departure-drop.png` hero + safari sunset accent |

Source assets live in `docs/pictures/` (43 files); portal uses 8 mapped copies under `public/`.

### 9.3 Local dev

From repo root (kills stale servers on 3000–3002, clears `.next`, starts Hazina on **3001**):

```bash
./scripts/dev-hazina.sh
# or: make dev-hazina
# http://localhost:3001
# http://localhost:3001/collections
# http://localhost:3001/last-minute-kenya-gifts-jkia
```

API for chat widget: `make dev` in another terminal (:8000).

---

## 10. WhatsApp menu implementation

**File:** `app/services/whatsapp_menus.py`  
**Dispatch:** `app/channels/base.py` passes `business_slug=_biz_slug` into `main_menu_payload` / `back_to_menu_payload`.

### 10.1 Hazina main menu (`business_slug=hazina-nomads`)

| Button | Interactive ID | Routed command / action |
|---|---|---|
| Shop The Kenya Edit | `lp:shop` | Opens `product_list_payload()` (5 boxes) via deterministic handler in `base.py` |
| Corporate Gifting | `lp:corp` | Plain text → `corporate gifting` |
| Talk to Concierge | `lp:concierge` | `CMD_STAFF` → human escalation |
| Track Delivery | `lp:track` | `gift_automation` delivery status (no LLM) |
| My orders | `lp:orders` | Recent orders reply |
| Exit | `lp:exit` | End chat |

### 10.2 Product drill-down list

`product_list_payload()` — rows `lp:prod:{id}` → `order {product}` → `gift_automation` checkout (Redis state → delivery → STK).

### 10.5 Hybrid automation architecture (Lily Pond pattern)

```
Inbound WhatsApp
    │
    ├─ Menu tap (lp:shop / lp:prod:*) ──► base.py ──► gift_automation (no LLM)
    ├─ Track / Corporate / Pay resend ──► gift_automation or cafe payment helpers
    ├─ Greeting ──► main menu payload (instant)
    │
    └─ Free-form question ──► LangGraph + RAG + tools
            │
            └─ create_order tool ──► finalize_checkout_from_ai ──► M-Pesa STK
```

**File:** `app/services/gift_automation.py`  
**Shared order/payment:** `app/services/cafe_automation.py`

### 10.3 Café tenants (unchanged)

Default menu when slug ≠ `hazina-nomads`: Order, See menu, Pay, Track, My orders, Talk to staff, Exit.

### 10.4 Tests

`tests/test_whatsapp_menus.py` — 13 tests including Hazina branch (`test_hazina_main_menu_payload`, etc.).

---

## 11. AI tools implementation

**File:** `app/ai/tools.py`  
**Order persistence:** `app/services/cafe_automation.py` → `create_pending_order`

### 11.1 `create_order`

| Field | Type | Stored |
|---|---|---|
| `items` | `[{sku_or_name, qty, unit_price}]` | `order.details.items` |
| `delivery_location` | string | `order.details.delivery_location` + composed `delivery_notes` |
| `departure_time_iso` | ISO-8601 | `order.details.departure_time_iso`; also sets `appointment_time` if no `appointment_time_iso` |
| `delivery_notes` | string | Appended to composed notes |
| `appointment_time_iso` | ISO-8601 | `order.appointment_time` |

**Composed notes example:** `Location: JKIA Terminal 1A | Departure: 2026-06-15T18:00:00+03:00`

### 11.2 `calculate_dhl_shipping` (stub)

| Input | `destination_country`, `box_weight_kg` (default 1.5) |
| Output | `estimate_usd`, `lead_days`, `stub: true` |
| Weight bands | ≤2 kg → $45; ≤5 kg → $78; else $78 + $12/kg over 5 |

### 11.3 Other tools (unchanged, tenant-scoped)

`knowledge_lookup`, `request_mpesa_payment`, `escalate_to_human`, `send_location_pin`, `send_menu_photo`, `update_customer_name`.

---

## 12. Implementation file map (DONE vs TODO)

| Area | Path | Status |
|---|---|---|
| Tenant seed + KB | `scripts/seed_hazina_nomads.py` | ✅ DONE |
| Env hints | `.env.example` | ✅ DONE (comment only) |
| Render default slug | `render.yaml` | ✅ `hazina-nomads` |
| Gift automation | `app/services/gift_automation.py` | ✅ DONE |
| Standalone portal | `hazina-portal/` | ✅ DONE |
| Render service | `render.yaml` → `hazina-portal` | ✅ DONE |
| Portal catalog data | `hazina-portal/lib/products.ts` | ✅ DONE |
| Portal UI | `hazina-portal/app/page.tsx`, `Nav.tsx`, `Footer.tsx`, styles | ✅ DONE |
| JKIA SEO page | `hazina-portal/app/last-minute-kenya-gifts-jkia/page.tsx` | ✅ DONE |
| Collections page | `hazina-portal/app/collections/page.tsx` | ✅ DONE |
| WhatsApp menus | `app/services/whatsapp_menus.py` | ✅ DONE |
| Channel dispatch | `app/channels/base.py` | ✅ Hazina fast path + AI STK handoff |
| `create_order` delivery fields | `app/ai/tools.py`, `cafe_automation.py` | ✅ DONE |
| `calculate_dhl_shipping` | `app/ai/tools.py` | ✅ Stub only |
| Paystack USD checkout | — | ⬜ TODO |
| Product photos | `profile.menu_photos` | ⬜ Empty `{}` · portal uses `public/products/` |
| Host affiliate ledger | — | ⬜ TODO |
| Safari SEO landing | — | ⬜ TODO |
| Gen-Eat portal separation | Hazina moved to `hazina-portal/` | ✅ DONE |
| Menu tests | `tests/test_whatsapp_menus.py` | ✅ DONE |

---

## 13. How to test locally

```bash
# From repo root

# Seed (once)
PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py

# Point local env at Hazina ( .env only — do not commit )
# DEFAULT_BUSINESS_SLUG=hazina-nomads

# Unit tests
./.venv/bin/python -m pytest -q tests/test_whatsapp_menus.py

# WhatsApp reply matrix (mock channel)
make eval-whatsapp-local

# Full dev stack
./scripts/run_dev.sh   # or: make dev

# Portal (stops conflicting dev servers, fresh .next)
./scripts/dev-hazina.sh
```

**Manual WhatsApp check:** greet → main menu shows Shop / Corporate / Concierge / Track → Shop → 5 product rows → select box → agent should confirm location + departure before `create_order`.

---

## 14. Blockers & decisions needed

| # | Decision | Owner | Blocks |
|---|---|---|---|
| 1 | **Flip `DEFAULT_BUSINESS_SLUG`** on Render | User | Production Hazina traffic |
| 2 | **Live WhatsApp number** + Meta `phone_number_id` | User | Real customer WA |
| 3 | **Paystack merchant approval** | User | USD checkout (Day 4) |
| 4 | **Domain** `hazina.lesnarai.co.ke` (Render) or `hazina-nomads.com` | User | Public SEO / trust |
| 5 | **Product photography** | User | WA Catalog, portal polish |
| 6 | **Courier contract** | User | Last-mile SLA |
| 7 | **Terracotta hex alignment** seed `#B85C38` vs portal `#C45C3E` | Design | Brand consistency |
| 8 | **ChatWidget** Hazina tenant on live API | Eng | Verify `/mock/message` with `hazina-nomads` locally |

---

## 15. Release checklist

Use before any production tag or Hazina cutover (§8.5).

- Bump app version and update changelog.
- Run `alembic upgrade head` in staging; run smoke tests (`./scripts/run_smoke_tests.py`).
- Rotate provider keys if the release requires it.
- Verify Prometheus alerts and dashboards reflect new metrics.
- **Hazina cutover:** complete §8.4 pre-flight, then flip `DEFAULT_BUSINESS_SLUG` per §8.5.
- Tag the release and publish the changelog entry.

---

## 16. Related documents

| Doc | Relationship |
|---|---|
| [README.md](../README.md) | Platform architecture, Gen-Eat demo (§15), deployment & ops |
| [SECURITY.md](../SECURITY.md) | Security audit findings and hardening |
| [hazina-portal/README.md](../hazina-portal/README.md) | Hazina portal quick commands |
| [gen-eat-portal/README.md](../gen-eat-portal/README.md) | Gen-Eat café demo portal (separate) |
| [docs/archive/](../archive/) | Archived Gen-Eat-era and superseded deploy guides |

**Do not maintain a second Hazina blueprint elsewhere.** Update this file when product, ops, or implementation status changes.
