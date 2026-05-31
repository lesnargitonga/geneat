# Hazina Nomads — Master Blueprint & Implementation

**Canonical launch document** for Hazina Nomads (premium tourist gift concierge).  
Merges the user master blueprint with in-repo implementation status.  
**Target launch:** Q3 2026 · **Model:** Premium tourist gift concierge · **Stack:** WhatsApp AI + Next.js portal on existing multi-tenant platform.

> Platform architecture remains in [README.md](../README.md). This doc owns Hazina-specific product, ops, and cutover truth.

---

## 0. Current system snapshot (what exists today)

Hazina Nomads is a **live multi-tenant configuration** on the existing Gen-Eat / Omni AI stack — not a separate backend rewrite. Production routing defaults to `hazina-nomads`; Gen-Eat café tenants remain in the database for demo and legacy use.

### 0.1 Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CUSTOMER TOUCHPOINTS                                                   │
├──────────────────────────┬──────────────────────────────────────────────┤
│  hazina-portal/          │  WhatsApp (Meta Cloud API)                   │
│  hazina.lesnarai.co.ke   │  Real business number → hazina-nomads      │
│  Next.js 14 · port 3001  │  Interactive menus + free-form chat        │
└────────────┬─────────────┴──────────────────┬───────────────────────────┘
             │  /api/chat proxy               │  POST /webhooks/meta/wa
             ▼                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SHARED API (Render) · api.lesnarai.co.ke                               │
│  FastAPI · app/channels/base.py                                         │
│    ├─ Tenant resolve: phone_number_id → slug → DEFAULT_BUSINESS_SLUG    │
│    ├─ gift_automation.py — fast paths (menus, checkout, STK, track)    │
│    └─ LangGraph + RAG + tools — Q&A, then handoff back to automation    │
├──────────────────────────┬──────────────────────────────────────────────┤
│  Postgres                │  Redis · IntaSend (M-Pesa STK)              │
│  businesses, orders,     │  Checkout state · payment callbacks         │
│  knowledge_base (RAG)    │  Hybrid payments: KES→IntaSend, USD→Paystack  │
└──────────────────────────┴──────────────────────────────────────────────┘
```

### 0.2 Product surface (customer-facing)

| Layer | What the customer gets | Status |
|---|---|---|
| **5 curated collections** | Fixed gift boxes (Kenya Edit → Departure Drop) | ✅ Portal + WhatsApp + seed |
| **26 individual treasures** | Coffee, beadwork, leather, carvings, textiles, art, baskets, packaging | ✅ Portal + RAG + WhatsApp custom box |
| **Build your box** | Pick 2+ treasures + optional packaging → WhatsApp handoff | ✅ `/build` |
| **Collection detail** | See exactly which treasures are inside each box | ✅ `/collections/[id]` |
| **Treasure detail** | Photo, origin, lead time, add to custom box | ✅ `/treasures/[id]` |
| **JKIA express landing** | Departure Drop SEO page, flight coordinates copy | ✅ `/last-minute-kenya-gifts-jkia` |
| **WhatsApp concierge** | Menu taps (instant) + AI for open questions + STK after order | ✅ `gift_automation.py` |

### 0.3 Media & assets

| Asset pool | Count | Location | Used for |
|---|---|---|---|
| Source photography | 43 | `docs/pictures/` | Master archive (all filenames preserved) |
| Portal treasure images | 43 | `hazina-portal/public/treasures/` | Slug-renamed copies for web |
| Collection hero shots | 5 | `hazina-portal/public/products/` | Curated box cards |
| Brand atmosphere | 3 | `hazina-portal/public/brand/` | Hero, JKIA banner, backgrounds |

### 0.4 Repositories & services map

| Component | Path / service | Role |
|---|---|---|
| **Tenant seed + RAG** | `scripts/seed_hazina_nomads.py` + `app/catalog/hazina_catalog.py` | Business row, 5 collections, 26 treasures, ~33 KB chunks |
| **Gift automation** | `app/services/gift_automation.py` | Deterministic WA checkout (578 lines) |
| **WhatsApp menus** | `app/services/whatsapp_menus.py` | Hazina-specific interactive lists |
| **Channel router** | `app/channels/base.py` | Hazina branch before LLM; AI → STK handoff |
| **AI tools** | `app/ai/tools.py` | `create_order` (USD fields), hybrid `request_mpesa_payment`, DHL stub |
| **Customer portal** | `hazina-portal/` | Standalone Next.js — **not** `gen-eat-portal/` |
| **Gen-Eat portal** | `gen-eat-portal/` + `geneat.lesnarai.co.ke` | Separate café demo (Vercel) |
| **API** | `render.yaml` → `geneat-api` | Shared multi-tenant backend |
| **Portal deploy** | `render.yaml` → `hazina-portal` | `hazina.lesnarai.co.ke` |
| **Dev launcher** | `scripts/dev-hazina.sh`, `make dev-hazina` | Kill stale ports, clear `.next`, start portal |
| **Tests** | `tests/test_whatsapp_menus.py`, `tests/test_gift_automation.py`, `tests/test_payment_routing.py`, `tests/test_ai_tools_payment.py` | Menu + automation + hybrid payment + AI USD wiring |
| **This doc** | `docs/HAZINA_NOMADS.md` | Single source of truth |

### 0.5 What is NOT built yet

- Paystack **live** keys on Render (routing wired; needs merchant approval + `PAYSTACK_SECRET_KEY`)
- Real DHL rate API (stub only)
- Meta WhatsApp Catalog sync (photos seeded in `profile.menu_photos`; needs Meta merchant setup)
- Host affiliate ledger (`REF-HOST-*` payouts)
- Physical fulfillment automation (courier status updates)

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

### Visual identity (portal — editorial luxury)

Implemented in `hazina-portal/tailwind.config.ts` and `app/globals.css`:

| Token | Hex | Usage |
|---|---|---|
| Sand | `#FAF8F5` | Page background |
| Obsidian | `#1C1A17` | Headlines, dark sections, primary buttons |
| Bronze | `#A67C52` | Accent, prices, italic wordmark |
| Ink mute | `#5C564E` | Body secondary |
| Border | `#EAE6DF` | Card edges, dividers |

**Typography (Google Fonts via `app/layout.tsx`):**

| Role | Font |
|---|---|
| Headlines / display | Cormorant Garamond (serif) |
| Body | Inter |
| Labels, prices, nav | DM Mono (uppercase, wide tracking) |

**UI patterns:** `card-luxury` bordered cards, asymmetric 12-column grids, alternating sand/obsidian sections, outline CTAs. Not the earlier terracotta/sage campus-café palette.

Seed profile still has legacy hex `#B85C38` — align at design lock if needed.

### AI persona (seeded)

- **Brand voice:** `scripts/seed_hazina_nomads.py` → `BRAND_VOICE`
- **Greeting:** `GREETING_TEMPLATE` — same file
- **Playbook:** retail vertical via `profile.vertical = "retail"` → `app/ai/playbooks/retail.py`

---

## 2. Product catalog

### 2.0 Overview

| Catalog type | Count | Code source | WhatsApp | Portal |
|---|---|---|---|---|
| **Curated collections** | 5 fixed boxes | `scripts/seed_hazina_nomads.py` → `PRODUCTS` | ✅ Menu + automation | ✅ |
| **Individual treasures** | 26 mix-and-match items | `hazina-portal/lib/treasures.ts` → `TREASURES` | ⬜ Web only (concierge can discuss via AI) | ✅ |
| **Custom box builder** | 2+ treasures + packaging fee | `components/PackBuilder.tsx` | ✅ Parses SKUs → delivery → STK or Paystack link | ✅ |

**Portal mirrors:** `hazina-portal/lib/products.ts` (collections) · `hazina-portal/lib/treasures.ts` (items)  
**RAG catalog:** `app/catalog/hazina_catalog.py` → seed `KB_CATALOG` (5 collections + 26 treasures + custom-box policy)  
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
| **Includes (portal)** | `premium-coffee-250g`, `loose-leaf-tea`, `leather-passport`, `maasai-bracelet`, `premium-packaging` |

### 2.6 Individual treasures (26 items)

**Code source of truth:** `hazina-portal/lib/treasures.ts`  
**Images:** `hazina-portal/public/treasures/` (43 files copied from `docs/pictures/`)

Each treasure has: `id`, `sku` (`HN-T-xxx`), `name`, `category`, USD/KES price, photo, description, optional `origin`, `lead_time_hours`, `personalization`.

| Category | Count | Example items |
|---|---|---|
| Coffee & Tea | 2 | Premium Kenyan Coffee, Highland Loose-Leaf Tea |
| Beadwork & Jewellery | 3 | Maasai Bracelet, Necklace, Earrings |
| Leather & Travel | 3 | Passport Holder, Luggage Tag, Maasai Sandals |
| Wood & Carvings | 6 | Antelope Carving, Swahili Drums, Rungu Clubs, Wooden Combs |
| Textiles & Kitenge | 4 | Kitenge Fabric, Beaded Market Bag, Kitenge Umbrella, Market Tote |
| Art & Sculpture | 5 | Soapstone Big Five, Wall Art, Pottery, Big Five Print |
| Honey & Pantry | 1 | Local Raw Honey |
| Baskets & Weaving | 2 | Hand-Woven Basket, Small Keepsake Basket |
| Gift Presentation | 1 | Premium Gift Box & Tissue (+KES 3,200) |

**Custom box rules (`/build`):**

- Minimum **2** treasures (`MIN_CUSTOM_ITEMS`)
- Optional premium packaging (+KES 3,200 / USD 25)
- Running total in sidebar; **Send to concierge** opens WhatsApp with item list
- Deep link: `/build?add=premium-coffee-250g` pre-selects from treasure detail page

**Collection → treasure mapping:** Each curated box lists `itemIds[]` in `lib/products.ts`; detail pages at `/collections/[id]` show linked treasure photos and prices.

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
| USD cards (Visa/MC/Apple Pay) | Paystack | ✅ Wired | `resolve_payment_service(currency=USD)` → checkout link over WhatsApp |
| Tooling | `request_mpesa_payment` | ✅ Hybrid | `resolve_payment_service(currency=…)` — KES STK or USD Paystack link with `redirect_url` |

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
| JKIA last-minute landing | ✅ | `/last-minute-kenya-gifts-jkia` |
| Treasure atelier browse | ✅ | `/treasures` (+ 26 detail pages) |
| Custom box builder | ✅ | `/build` |
| Safari souvenirs Nairobi | ✅ | `/premium-safari-souvenirs-nairobi` |
| TikTok / short video | ⬜ External | "Departure Drop to Terminal 1A in 3 hours" narrative |

---

## 7. Seven-day launch sequence

| Day | Workstream | Blueprint intent | In-repo status |
|---|---|---|---|
| **1** | Digital real estate | Domains, social handles, logo, Paystack application | ⬜ **External** — user-owned |
| **2** | Tech pivot — tenant | Postgres tenant `hazina-nomads`, env prep | ✅ **`scripts/seed_hazina_nomads.py`** — 5 collections, 26 treasures, ~33 KB chunks |
| **2–3** | Tech pivot — frontend | Standalone Hazina portal | ✅ `hazina-portal/` — 5 collections + 26 treasures + `/build` (see §9) |
| **3** | Physical prototyping | Source coffee, beadwork, rigid boxes; assemble prototype | ⬜ **External** |
| **3** | WhatsApp + AI tools | Hazina menus, delivery fields on orders | ✅ See §10–§11 |
| **4** | Media production | Product photography → WA Catalog + website | ✅ **43 photos** in `public/treasures/`; ⬜ Meta Catalog sync |
| **4** | Paystack USD | Checkout links for international guests | ✅ Router wired; add live keys on Render |
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

### 9.1 Routes (41 static pages at build)

| Route | Status | File | Purpose |
|---|---|---|---|
| `/` | ✅ | `app/page.tsx` | Editorial homepage — hero, atelier preview, collections, JKIA CTA |
| `/treasures` | ✅ | `app/treasures/page.tsx` | All 26 treasures; category filter via `?category=` |
| `/treasures/[id]` | ✅ | `app/treasures/[id]/page.tsx` | Item detail — origin, lead time, add to box |
| `/collections` | ✅ | `app/collections/page.tsx` | Asymmetric grid of 5 curated boxes |
| `/collections/[id]` | ✅ | `app/collections/[id]/page.tsx` | What's inside — linked treasure grid |
| `/build` | ✅ | `app/build/page.tsx` | Custom pack builder (`PackBuilder` client component) |
| `/last-minute-kenya-gifts-jkia` | ✅ | `app/last-minute-kenya-gifts-jkia/page.tsx` | JKIA SEO — split layout, Flight Coordinates |
| `/about` | ✅ | `app/about/page.tsx` | Brand story |
| `/api/chat` | ✅ | `app/api/chat/route.ts` | Proxy to backend `/mock/message` |
| `/premium-safari-souvenirs-nairobi` | ⬜ | — | Blueprint only |

**Error boundaries:** `app/error.tsx`, `app/global-error.tsx` (required for stable Next.js dev).

No `/cafes`, `/map`, or `/owners` — those remain Gen-Eat-only in `gen-eat-portal/`.

### 9.2 Components & data

| Asset | Path |
|---|---|
| Curated collections | `lib/products.ts` → `GIFT_BOXES` (with `itemIds[]` per box) |
| Individual treasures | `lib/treasures.ts` → `TREASURES`, `CATEGORY_LABELS` |
| Format helpers | `lib/format.ts` → `formatKES`, `whatsappLink` |
| Collection card | `components/CollectionCard.tsx` — See inside + Reserve CTAs |
| Treasure card | `components/TreasureCard.tsx` — category chip, luxury border |
| Pack builder | `components/PackBuilder.tsx` — select items, total, WhatsApp handoff |
| Product image | `components/ProductImage.tsx` |
| Nav | `components/Nav.tsx` — Treasures, Collections, Build, JKIA, About |
| Footer | `components/Footer.tsx` — obsidian editorial footer |
| Chat widget | `components/ChatWidget.tsx` — `business_slug=hazina-nomads` |
| Styles | `tailwind.config.ts`, `app/globals.css` — `.btn-dark`, `.card-luxury`, `.section-dark` |
| Metadata | `app/layout.tsx` |

### 9.3 Image library

| Location | Files | Notes |
|---|---|---|
| `docs/pictures/` | 43 | Master archive (original filenames) |
| `public/treasures/` | 43 | Slug-renamed copies for Next.js `Image` |
| `public/products/` | 5 | Curated collection hero shots |
| `public/brand/` | 3 | `hero-bg.jpg`, `hero-gift-box.png`, `safari-sunset.jpg` |

**Mapping:** Python copy script in repo history maps e.g. `coffee-beans-variety.jpg` ← `variety cofrfee beans .jpg`. All 43 source photos are available on the portal; 5 collection cards use dedicated product composites.

### 9.4 Local dev

From repo root (`scripts/dev-hazina.sh`):

1. Stops listeners on ports **3000–3002** (and orphaned `next dev` processes)
2. Clears `hazina-portal/.next` (unless `--no-clean`)
3. Starts Next.js on **3001**, or **3002/3003** if 3001 is stuck (common with Cursor-managed processes)
4. Waits for HTTP 200 before printing URLs

```bash
make dev-hazina                    # foreground
./scripts/dev-hazina.sh --background
cd hazina-portal && npm run dev:clean

# If port 3001 shows "missing required error components":
fuser -k 3001/tcp                  # run in a normal terminal
make dev-hazina

# Production preview (stable styling):
cd hazina-portal && npm run build && npx next start -p 3003
# http://localhost:3003
```

API for chat widget: `make dev` in another terminal (:8000).

**Known dev issue:** Deleting `.next` while `next dev` is still running on 3001 causes CSS to fail (page looks like unstyled HTML). Always stop the dev server first, or use `make dev-hazina`.

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

### 10.3 End-to-end customer journeys (implemented)

**Web — browse collection**

1. Land on `/` or `/collections`
2. Tap **See inside** → `/collections/kenya-edit` shows 4 linked treasures
3. **Reserve as-is** → WhatsApp with collection name

**Web — build custom box**

1. `/treasures` or `/build` → filter by category
2. Select 2+ items; optional packaging
3. **Send to concierge** → WhatsApp with SKU list + estimated total

**WhatsApp — fast automation (no LLM)**

1. Guest says hi → main menu (Shop | Corporate | Concierge | Track)
2. Shop → product list (5 collections)
3. Tap product → `gift_automation` asks delivery location
4. JKIA → asks departure time → `create_order` + M-Pesa STK
5. Track → order status from DB

**WhatsApp — AI + automation handoff**

1. Free-form: *"Do you deliver to Hemingways Karen?"* → RAG + AI answer
2. Guest: *"I'll take the Kenya Edit for room 412"* → AI calls `create_order`
3. `finalize_checkout_from_ai` → same STK path as menu automation

### 10.4 Hybrid automation architecture (Lily Pond pattern)

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

### 10.5 Café tenants (unchanged)

Default menu when slug ≠ `hazina-nomads`: Order, See menu, Pay, Track, My orders, Talk to staff, Exit.

### 10.6 Tests

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
| `payment_currency` | `KES` \| `USD` | `order.details.payment_currency` |
| `amount_usd` | float | `order.details.amount_usd` (when USD checkout) |

**Composed notes example:** `Location: JKIA Terminal 1A | Departure: 2026-06-15T18:00:00+03:00`

### 11.2 `calculate_dhl_shipping` (stub)

| Input | `destination_country`, `box_weight_kg` (default 1.5) |
| Output | `estimate_usd`, `lead_days`, `stub: true` |
| Weight bands | ≤2 kg → $45; ≤5 kg → $78; else $78 + $12/kg over 5 |

### 11.3 `request_mpesa_payment` (hybrid)

| Input | `amount_kes`, `order_reference`, `msisdn`, optional `currency` (`KES`\|`USD`), `amount_usd` |
| Routing | `resolve_payment_service(currency=…)` — IntaSend for KES, Paystack for USD |
| Output | `redirect_url` when Paystack/simulator; `payment_currency`, `amount_usd` for USD |

Guests can type **resend STK** (KES) or **resend link** (USD) — handled deterministically in `app/channels/base.py` via `request_order_payment`.

### 11.4 Other tools (tenant-scoped)

`knowledge_lookup`, `request_mpesa_payment`, `escalate_to_human`, `send_location_pin`, `send_menu_photo`, `update_customer_name`.

---

## 12. Implementation file map (DONE vs TODO)

| Area | Path | Status |
|---|---|---|
| **Tenant seed + KB** | `scripts/seed_hazina_nomads.py` | ✅ 5 collections, 26 treasures, ~33 KB chunks |
| **Gift automation** | `app/services/gift_automation.py` | ✅ Menus, Redis checkout, STK, track |
| **WhatsApp menus** | `app/services/whatsapp_menus.py` | ✅ Hazina branch |
| **Channel dispatch** | `app/channels/base.py` | ✅ Fast path + AI STK handoff + resend STK/link |
| **AI tools** | `app/ai/tools.py` | ✅ `create_order` delivery + USD fields; hybrid `request_mpesa_payment` |
| **Order persistence** | `app/services/cafe_automation.py` | ✅ Shared with café tenants |
| **Render cutover** | `render.yaml` | ✅ `DEFAULT_BUSINESS_SLUG=hazina-nomads`, `hazina-portal` service |
| **Standalone portal** | `hazina-portal/` | ✅ Full Next.js app |
| **Collections data** | `hazina-portal/lib/products.ts` | ✅ 5 boxes + `itemIds` |
| **Treasures data** | `hazina-portal/lib/treasures.ts` | ✅ 26 items, 9 categories |
| **Pack builder UI** | `hazina-portal/components/PackBuilder.tsx` | ✅ |
| **Treasure / collection pages** | `app/treasures/`, `app/collections/[id]/`, `app/build/` | ✅ |
| **Image library** | `public/treasures/` (43), `docs/pictures/` (43) | ✅ |
| **Luxury UI** | `globals.css`, `tailwind.config.ts`, editorial components | ✅ |
| **Dev launcher** | `scripts/dev-hazina.sh`, `Makefile` target | ✅ Port fallback |
| **Error boundaries** | `app/error.tsx`, `app/global-error.tsx` | ✅ |
| **Menu tests** | `tests/test_whatsapp_menus.py` | ✅ |
| **Automation tests** | `tests/test_gift_automation.py` | ✅ |
| **Gen-Eat separation** | `hazina-portal/` vs `gen-eat-portal/` | ✅ Separate domains |
| Paystack USD checkout | `app/integrations/payments/factory.py` | ✅ Hybrid router (KES→IntaSend, USD→Paystack); needs live keys |
| WA treasure catalog | `gift_automation.py` + `hazina_catalog.py` | ✅ Custom box handoff from `/build`; collections via menu |
| `profile.menu_photos` / Meta Catalog | `app/catalog/hazina_catalog.py` | ✅ Seeded via `build_hazina_menu_photos()`; Meta sync pending |
| Host affiliate ledger | — | ⬜ TODO |
| Safari SEO landing | `hazina-portal/app/premium-safari-souvenirs-nairobi/` | ✅ |
| Real DHL API | `calculate_dhl_shipping` | ⬜ Stub only |

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
| 7 | **Terracotta hex alignment** seed `#B85C38` vs portal bronze `#A67C52` | Design | Brand consistency |
| 8 | ~~**Sync 26 treasures to seed/RAG**~~ | Eng | ✅ Done — `app/catalog/hazina_catalog.py` |
| 9 | **Stuck dev server on :3001** | Eng | Use `fuser -k 3001/tcp` or port 3003 prod preview |

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
