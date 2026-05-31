# Hazina Nomads — Master Blueprint & Implementation

**Canonical launch document** for Hazina Nomads (premium tourist gift concierge).  
Merges the user master blueprint with in-repo implementation status.  
**Target launch:** Q3 2026 · **Model:** Premium tourist gift concierge · **Stack:** WhatsApp AI + Next.js portal on existing multi-tenant platform.

> Platform architecture remains in [README.md](../README.md). This doc owns Hazina-specific product, ops, and cutover truth.  
> **Last doc sync:** 2026-05-31 · **Branch:** `main` (8 commits ahead of `origin/main`) · **Latest Hazina commit:** `e078793`

---

## 0. Current system snapshot (what exists today)

Hazina Nomads is a **live multi-tenant configuration** on the existing Gen-Eat / Omni AI stack — not a separate backend rewrite. Production routing defaults to `hazina-nomads`; Gen-Eat café tenants remain in the database for demo and legacy use.

### 0.1 Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CUSTOMER TOUCHPOINTS                                                   │
├──────────────────────────┬──────────────────────────────────────────────┤
│  hazina-portal/          │  WhatsApp (Meta Cloud API)                   │
│  hazina.lesnarai.co.ke   │  Business number → hazina-nomads tenant      │
│  Next.js 14 · port 3001  │  Interactive menus + free-form chat          │
└────────────┬─────────────┴──────────────────┬───────────────────────────┘
             │  /api/chat proxy               │  POST /webhooks/meta/wa
             ▼                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SHARED API (Render) · api.lesnarai.co.ke                               │
│  FastAPI · app/channels/base.py                                         │
│    ├─ Tenant resolve: phone_number_id → slug → DEFAULT_BUSINESS_SLUG  │
│    ├─ gift_automation.py — fast paths (menus, checkout, pay, track)     │
│    ├─ Resend STK / Paystack link — base.py payment resend helpers      │
│    └─ LangGraph + RAG + tools — Q&A, then handoff back to automation   │
├──────────────────────────┬──────────────────────────────────────────────┤
│  Postgres                │  Redis                                      │
│  businesses, orders,     │  gift_checkout:{conv_id} — WA checkout state│
│  knowledge_base (RAG)    │  Payment idempotency keys                   │
├──────────────────────────┴──────────────────────────────────────────────┤
│  PAYMENTS (hybrid)                                                        │
│    KES M-Pesa STK  → IntaSend (resolve_payment_service currency=KES)    │
│    USD card link   → Paystack (resolve_payment_service currency=USD)    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 0.2 Product surface (customer-facing)

| Layer | What the customer gets | Status |
|---|---|---|
| **5 curated collections** | Fixed gift boxes (Kenya Edit → Departure Drop) | ✅ Portal + WhatsApp menu + seed + RAG |
| **30 individual treasures** | Coffee, beadwork, leather, carvings, textiles, art, baskets, homeware, packaging | ✅ Portal + RAG + WhatsApp custom box |
| **Build your box** | Pick 2+ treasures + optional packaging → WhatsApp handoff → automated checkout | ✅ `/build` + `gift_automation` SKU parser |
| **Collection detail** | See exactly which treasures are inside each box | ✅ `/collections/[id]` |
| **Treasure detail** | Photo, origin, lead time, add to custom box | ✅ `/treasures/[id]` |
| **JKIA express landing** | Departure Drop SEO page, flight coordinates copy | ✅ `/last-minute-kenya-gifts-jkia` |
| **Safari souvenirs landing** | SEO page for safari tourists in Nairobi | ✅ `/premium-safari-souvenirs-nairobi` |
| **WhatsApp concierge** | Menu taps (instant) + catalog/menu text + AI for open questions + payment after order | ✅ `gift_automation.py` + hybrid pay |
| **USD card checkout** | Paystack hosted link sent over WhatsApp | ✅ Wired — needs live `PAYSTACK_SECRET_KEY` |
| **Payment resend** | "resend STK" (KES) or "resend link" (USD) on pending orders | ✅ `base.py` → `request_order_payment` |

### 0.3 Media & assets

| Asset pool | Count | Location | Used for |
|---|---|---|---|
| Source photography | 49+ (6 new sources untracked) | `docs/pictures/` | Master archive (original filenames preserved) |
| Portal treasure images | 58 | `hazina-portal/public/treasures/` | Slug-renamed copies for web |
| Collection hero shots | **5 / 5** | `lib/products.ts` + `HAZINA_COLLECTION_IMAGES` | All collections have dedicated hero photography |
| Brand atmosphere | 1 direct brand image + reused treasure context images | `hazina-portal/public/brand/`, `public/treasures/` | Safari banner, atelier room, market context |
| **menu_photos (seeded)** | **108** id/name/sku keys | `profile.menu_photos` via `build_hazina_menu_photos()` | Meta Catalog sync prep; items without images omitted |
| AI composites (unused) | — | `public/treasures/generated/` | Optional `scripts/compose_packs.py` output — **not referenced by portal** |

### 0.4 Repositories & services map

| Component | Path / service | Role |
|---|---|---|
| **Catalog source of truth (backend)** | `app/catalog/hazina_catalog.py` (263 lines) | Collections, treasures, KB chunks, image maps, `menu_photos` |
| **Tenant seed + RAG** | `scripts/seed_hazina_nomads.py` | Business row upsert, KB re-embed, profile |
| **Gift automation** | `app/services/gift_automation.py` (886 lines) | Deterministic WA: collections, custom box, catalog menu, pay, track |
| **WhatsApp menus** | `app/services/whatsapp_menus.py` | Hazina main menu + 5-product list |
| **Channel router** | `app/channels/base.py` | Hazina branch before LLM; resend pay; AI → payment handoff |
| **Order + payment** | `app/services/cafe_automation.py` | Shared order creation, hybrid `request_order_payment` |
| **Payment router** | `app/integrations/payments/factory.py` | `resolve_payment_service(currency=…)` |
| **AI tools** | `app/ai/tools.py` | `create_order` (USD fields), hybrid `request_mpesa_payment`, DHL stub |
| **Customer portal** | `hazina-portal/` | Standalone Next.js — **not** `gen-eat-portal/` |
| **Gen-Eat portal** | `gen-eat-portal/` + `geneat.lesnarai.co.ke` | Separate café demo (Vercel) |
| **API** | `render.yaml` → `geneat-api` | Shared multi-tenant backend |
| **Portal deploy** | `render.yaml` → `hazina-portal` | `hazina.lesnarai.co.ke` |
| **Dev launcher** | `scripts/dev-hazina.sh`, `make dev-hazina` | Kill stale ports, clear `.next`, start dev |
| **Preview launcher** | `scripts/preview-hazina.sh`, `make preview-hazina` | Rebuild + production `next start` (stable CSS) |
| **Asset checker** | `scripts/check_asset_images.py` | Verify portal image refs vs `public/treasures/` |
| **Pack compositor** | `scripts/compose_packs.py` | Optional AI pack composites → `generated/` |
| **This doc** | `docs/HAZINA_NOMADS.md` | Single source of truth |

### 0.5 Git history (Hazina commits on `main`)

| Commit | Summary |
|---|---|
| `a133dc4` | Launch gift concierge tenant, portal, WhatsApp automation |
| `467150a` | Treasure catalog, custom box builder, system docs |
| `947946b` | Sync catalog to RAG, hybrid payments, custom box checkout, Safari landing, AI USD wiring |
| `2fca0a9` | Expand master blueprint with full system state |
| `d86c507` | Portal image fixes + editorial typography |
| `49ad6c1` | WhatsApp catalog menu intent + Groq LLM fallback |
| `9857589` | Fix menu_photos test assertions for new treasure images |
| `e078793` | Load fonts via `next/font`, ESLint config, dev CSS health check |

Branch is **8 commits ahead** of `origin/main` before this doc commit — not pushed.

### 0.6 Catalog sync rules (do not drift)

| Layer | File | What to update when prices/SKUs change |
|---|---|---|
| **Backend canonical** | `app/catalog/hazina_catalog.py` | `HAZINA_COLLECTIONS`, `HAZINA_TREASURES`, image maps |
| **Portal collections** | `hazina-portal/lib/products.ts` | `GIFT_BOXES`, `itemIds[]`, images |
| **Portal treasures** | `hazina-portal/lib/treasures.ts` | `TREASURES`, categories, images |
| **WhatsApp product list** | `app/services/whatsapp_menus.py` | `_HAZINA_PRODUCTS` tuple (titles/prices in menu) |
| **Gift automation collections** | `app/services/gift_automation.py` | Derived from `HAZINA_COLLECTIONS` at import — auto if catalog updated |
| **RAG** | Re-run seed | `PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py` |

**Rule:** Change backend catalog first, mirror to TypeScript, re-seed KB, rebuild portal.

### 0.7 What is NOT built yet

| Gap | Notes |
|---|---|
| Paystack **live** keys on Render | Routing wired; needs merchant approval + `PAYSTACK_SECRET_KEY` |
| Meta WhatsApp Catalog **sync** | `profile.menu_photos` seeded with absolute URLs; Meta merchant setup pending |
| Real DHL rate API | `calculate_dhl_shipping` is weight-band stub only |
| Host affiliate ledger | `REF-HOST-*` config in seed; no IntaSend payout automation |
| Physical fulfillment automation | Courier status updates, dispatch webhooks |
| Real email in production | Placeholder remains `concierge@hazina-nomads.com` |
| Terracotta vs bronze hex alignment | Seed profile `#B85C38` vs portal bronze `#A67C52` |

---

## 1. Brand & positioning

You are **not** a souvenir shop — you are a **premium travel concierge**. Value = time, curation, convenience.

| Field | Value |
|---|---|
| **Name** | Hazina Nomads (*Hazina* = treasure, Swahili) |
| **Tagline** | Curated treasures for the modern nomad. |
| **Vision** | Pan-African brand; **MVP collection is strictly Kenyan** |
| **Industry slug** | `gift-concierge` |
| **Tenant slug** | `hazina-nomads` |
| **Voice** | Professional, calm, high-end hotel concierge. 1–3 sentences. Zero campus-café slang. Confirm delivery location + departure before promising dispatch. |
| **Custom orders** | ✅ **On** — custom box from 2+ treasures via `/build` + WhatsApp SKU handoff; corporate / high-budget → human escalation |

### Visual identity (portal — editorial luxury)

Implemented in `hazina-portal/tailwind.config.ts` and `app/globals.css`:

| Token | Hex | Usage |
|---|---|---|
| Sand | `#FAF8F5` | Page background |
| Obsidian | `#1C1A17` | Headlines, dark sections, primary buttons |
| Bronze | `#A67C52` | Accent, prices, italic wordmark |
| Ink mute | `#5C564E` | Body secondary |
| Border | `#EAE6DF` | Card edges, dividers |

**Typography (`next/font` via `app/layout.tsx` — self-hosted, no external `<link>` tags):**

| Role | Font | CSS variable |
|---|---|---|
| Headlines / display | Cormorant Garamond (serif) | `--font-cormorant` |
| Body | Inter | `--font-inter` |
| Labels, prices, nav | DM Mono (uppercase, wide tracking) | `--font-dm-mono` |

Theme init runs via inline `<script>` in `<body>` (before paint) — not `next/script beforeInteractive` (invalid in App Router).

**UI patterns:** `card-luxury` bordered cards, asymmetric 12-column grids, alternating sand/obsidian sections, outline CTAs. Not the earlier terracotta/sage campus-café palette.

Seed profile still has legacy hex `#B85C38` — align at design lock if needed.

### AI persona (seeded)

- **Brand voice:** `scripts/seed_hazina_nomads.py` → `BRAND_VOICE`
- **Greeting:** `GREETING_TEMPLATE` — mentions collections, custom box, delivery, concierge
- **Playbook:** retail vertical via `profile.vertical = "retail"` → `app/ai/playbooks/retail.py`

---

## 2. Product catalog

### 2.0 Overview

| Catalog type | Count | Backend source | Portal source | WhatsApp | RAG |
|---|---|---|---|---|---|
| **Curated collections** | 5 | `HAZINA_COLLECTIONS` | `lib/products.ts` → `GIFT_BOXES` | ✅ Menu + automation | ✅ 5 chunks |
| **Individual treasures** | 30 | `HAZINA_TREASURES` | `lib/treasures.ts` → `TREASURES` | ✅ Custom box SKU parser | ✅ 30 chunks |
| **Custom box builder** | 2+ items + packaging | `MIN_CUSTOM_ITEMS=2`, `PACKAGING_FEE_*` | `PackBuilder.tsx` | ✅ Full checkout flow | ✅ 1 policy chunk |

**Constants (shared backend):**

| Constant | Value |
|---|---|
| `MIN_CUSTOM_ITEMS` | 2 |
| `PACKAGING_FEE_USD` | 25 |
| `PACKAGING_FEE_KES` | 3,200 |
| Packaging SKU | `HN-T-070` (`premium-packaging`) |

**No bespoke one-off boxes** unless guest mentions corporate gifting or high budget → escalate human.

### 2.1 Curated collections (detail)

#### The Kenya Edit

| | |
|---|---|
| **ID / SKU** | `kenya-edit` / `HN-KE-001` |
| **Price** | USD 89 · KES 11,500 |
| **Target** | Safari tourists, European/US visitors |
| **Contents** | Premium Kenyan coffee (250g), handmade Maasai beadwork (bracelet or necklace), small artisan soapstone carving, printed brand story card |
| **Lead time** | 24h |
| **Personalization** | No |
| **Portal itemIds** | `premium-coffee-250g`, `maasai-bracelet`, `soapstone-big-five`, `premium-packaging` |
| **Hero image** | `/treasures/curated-gift-box.png` from `gift box with cofee, rungu, earings, leather passport.png` |

#### The Highland Treasure

| | |
|---|---|
| **ID / SKU** | `highland-treasure` / `HN-HT-002` |
| **Price** | USD 59 · KES 7,600 |
| **Target** | General gifting, diaspora, colleagues |
| **Contents** | Export-grade Kenyan coffee, premium Kenyan loose-leaf tea, local raw honey, carved wooden tasting spoon |
| **Lead time** | 24h |
| **Portal itemIds** | `premium-coffee-250g`, `loose-leaf-tea`, `raw-honey`, `wooden-combs` |
| **Hero image** | `/treasures/highland-treasure-hero.png` |

#### The Nomad Leather Set

| | |
|---|---|
| **ID / SKU** | `nomad-leather-set` / `HN-NL-003` |
| **Price** | USD 129 · KES 16,600 |
| **Target** | Business travellers, wealthy tourists |
| **Contents** | Handmade leather passport holder, luggage tag, travel notebook |
| **Lead time** | 24h |
| **Personalization** | Yes — **engraving requires 24-hour notice** |
| **Portal itemIds** | `leather-passport`, `leather-luggage-tag`, `premium-packaging` |
| **Hero image** | `/treasures/nomad-leather-set-studio.png` |

#### The Safari Romance Box

| | |
|---|---|
| **ID / SKU** | `safari-romance-box` / `HN-SR-004` |
| **Price** | USD 199 · KES 25,600 |
| **Target** | Honeymooners, anniversary trips |
| **Contents** | Matching couple's beadwork, premium treats (chocolate/coffee), framed minimalist safari route map, leather luggage tags |
| **Lead time** | 48h (assembly); leather tag engraving +24h notice |
| **Personalization** | Yes |
| **Portal itemIds** | `maasai-necklace`, `maasai-bracelet`, `premium-coffee-250g`, `big-five-print`, `leather-luggage-tag` |
| **Hero image** | `/treasures/safari-romance-box-hero.png` |

#### The Departure Drop

| | |
|---|---|
| **ID / SKU** | `departure-drop` / `HN-DD-005` |
| **Price** | USD 149 · KES 19,200 |
| **Target** | Last-minute JKIA departures |
| **Contents** | Pre-packed fast movers: coffee, tea, un-personalized leather, beadwork |
| **Lead time** | **4h** (JKIA-optimised) |
| **Flag** | `jkia_only: true` in seed/profile |
| **Portal itemIds** | `premium-coffee-250g`, `loose-leaf-tea`, `leather-passport`, `maasai-bracelet`, `premium-packaging` |
| **Hero image** | `/treasures/departure-pack.png` from `package with coffee, leather passport and beadwoowen bracelet.png` |

### 2.2 Individual treasures (30 items — full table)

**Backend:** `app/catalog/hazina_catalog.py` → `HAZINA_TREASURES`  
**Portal:** `hazina-portal/lib/treasures.ts`  
**Images:** `hazina-portal/public/treasures/` — **30/30 treasures mapped** in `HAZINA_TREASURE_IMAGES`; `CatalogImage.tsx` shows a blank frame only if a path is missing at runtime.

| ID | SKU | Name | Category | USD | KES | Lead (h) | Personalization |
|---|---|---|---|---|---|---|---|
| `premium-coffee-250g` | HN-T-001 | Premium Kenyan Coffee | coffee-tea | 18 | 2,300 | 12 | — |
| `loose-leaf-tea` | HN-T-002 | Highland Loose-Leaf Tea | coffee-tea | 14 | 1,800 | 12 | — |
| `raw-honey` | HN-T-003 | Local Raw Honey | food | 16 | 2,100 | 24 | — |
| `maasai-bracelet` | HN-T-010 | Maasai Beaded Bracelet | beadwork | 22 | 2,800 | 12 | — |
| `maasai-necklace` | HN-T-011 | Maasai Beaded Necklace | beadwork | 38 | 4,900 | 24 | — |
| `maasai-earrings` | HN-T-012 | Maasai Earrings | beadwork | 18 | 2,300 | 12 | — |
| `leather-passport` | HN-T-020 | Leather Passport Holder | leather | 45 | 5,800 | 24 | ✅ embossing |
| `leather-luggage-tag` | HN-T-021 | Leather Luggage Tag | leather | 15 | 1,900 | 24 | ✅ embossing |
| `soapstone-big-five` | HN-T-030 | Soapstone Big Five Carving | art-sculpture | 32 | 4,100 | 24 | — |
| `antelope-carving` | HN-T-031 | Antelope Wood Carving | wood-carving | 36 | 4,600 | 24 | — |
| `wood-carving-set` | HN-T-032 | Artisan Wood Carving | wood-carving | 28 | 3,600 | 24 | — |
| `swahili-drums` | HN-T-033 | Swahili Drum Set (3) | wood-carving | 55 | 7,100 | 48 | — |
| `rungu-clubs` | HN-T-034 | Beaded Rungu Club Set | wood-carving | 42 | 5,400 | 24 | — |
| `woven-basket` | HN-T-040 | Hand-Woven Basket | baskets | 34 | 4,400 | 48 | — |
| `sisal-basket-small` | HN-T-041 | Small Woven Keepsake Basket | baskets | 22 | 2,800 | 48 | — |
| `kitenge-fabric` | HN-T-050 | Kitenge Fabric Length | textiles | 28 | 3,600 | 24 | — |
| `beaded-market-bag` | HN-T-051 | Beaded Market Bag | textiles | 40 | 5,100 | 24 | — |
| `maasai-sandals` | HN-T-052 | Maasai Leather Sandals | leather | 35 | 4,500 | 48 | size confirm |
| `wooden-combs` | HN-T-053 | Carved Wooden Combs | wood-carving | 16 | 2,100 | 12 | — |
| `african-wall-art` | HN-T-060 | Contemporary African Art Print | art-sculpture | 48 | 6,200 | 48 | — |
| `sculpture-piece` | HN-T-061 | Africa-Inspired Sculpture | art-sculpture | 52 | 6,700 | 48 | — |
| `kitenge-umbrella` | HN-T-062 | Kitenge Umbrella | textiles | 30 | 3,900 | 24 | — |
| `pottery-vessel` | HN-T-063 | Hand-Thrown Pottery | art-sculpture | 38 | 4,900 | 48 | — |
| `big-five-print` | HN-T-064 | Big Five Safari Print | art-sculpture | 24 | 3,100 | 24 | — |
| `maasai-market-tote` | HN-T-065 | Maasai Market Tote | textiles | 26 | 3,300 | 24 | — |
| `african-woven-mat` | HN-T-066 | African Woven Mat | homeware | 30 | 3,900 | 24 | — |
| `african-hand-broom` | HN-T-067 | African Hand Broom | homeware | 18 | 2,300 | 24 | — |
| `beaded-wood-containers` | HN-T-068 | Beaded Wood Container Set | wood-carving | 46 | 5,900 | 48 | — |
| `coconut-shell-plates-spoons` | HN-T-069 | Coconut Shell Plate & Spoon Set | homeware | 32 | 4,100 | 24 | — |
| `premium-packaging` | HN-T-070 | Premium Gift Box & Tissue | packaging | 25 | 3,200 | 12 | — |

**Category counts:** Coffee & Tea 2 · Beadwork 3 · Leather 3 · Wood & Carvings 7 · Textiles 4 · Art & Sculpture 5 · Food 1 · Baskets 2 · Homeware 3 · Packaging 1

### 2.3 Custom box rules (`/build`)

- Minimum **2** treasures (`MIN_CUSTOM_ITEMS`)
- Optional premium packaging (+KES 3,200 / USD 25) — SKU `HN-T-070`
- Running total in sidebar; **Send to concierge** opens WhatsApp with formatted message:

```
Hello Hazina Nomads — I'd like to build a custom gift box:

• Premium Kenyan Coffee (HN-T-001)
• Maasai Beaded Bracelet (HN-T-010)
• Premium packaging & story card

Estimated total: KES 8,300 (~USD 64)

Please confirm availability and delivery to my hotel / JKIA.
```

- Deep link: `/build?add=premium-coffee-250g` pre-selects from treasure detail page
- **WhatsApp automation** parses `(HN-T-xxx)` SKU lines via `_SKU_LINE_RE`, detects "Premium packaging", starts `custom_delivery` checkout in Redis

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
**Automation:** JKIA in location text → asks departure time → stores in `order.details.departure_time_iso`.

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

### 4.1 Hybrid payment router

**File:** `app/integrations/payments/factory.py` → `resolve_payment_service(currency=…, method=…)`

```
Guest / order context
        │
        ├─ currency=KES (default) ──► IntaSendAdapter (M-Pesa STK push)
        │
        └─ currency=USD or method=card/paystack ──► PaystackAdapter (hosted checkout URL)
                │
                └─ redirect_url sent in WhatsApp reply
```

| Condition | Provider | Guest experience |
|---|---|---|
| `currency=KES` + IntaSend keys configured | IntaSend | STK push to phone |
| `currency=USD` + Paystack keys configured | Paystack | Checkout link in chat |
| `PAYMENT_SIMULATOR=true` | Simulator | Demo auto-confirm optional |
| USD requested, no Paystack keys | — | `UpstreamError` with setup instructions |

**Legacy:** `get_payment_service()` still exists — delegates to `resolve_payment_service(currency="KES")`.

**Call sites:**

| Caller | Behaviour |
|---|---|
| `cafe_automation.request_order_payment` | Reads `order.details.payment_currency`, passes to resolver |
| `gift_automation._finalize_order` / `_finalize_custom_order` | KES default; USD if guest says "card", "USD", "$", etc. |
| `ai/tools.request_mpesa_payment` | Accepts `currency`, `amount_usd`; returns `redirect_url` |
| `channels/base._resend_pending_payment_reply` | Re-reads pending order currency; resends STK or fresh Paystack link |

### 4.2 Order payment fields (`order.details`)

| Field | Set by | Purpose |
|---|---|---|
| `payment_currency` | `create_order` tool, gift automation | `KES` or `USD` |
| `amount_usd` | USD checkout path | Paystack charge amount |
| `items` | All order paths | Line items with `sku_or_name`, `qty`, `unit_price` |
| `delivery_location` | Automation / AI | Hotel or JKIA terminal |
| `departure_time_iso` | JKIA flow | Flight departure capture |
| `fulfillment_status` | Checkout | `pending_payment` → dispatch states |
| `order_type` | Custom box | `custom_box` |
| `treasure_skus` | Custom box | List of `HN-T-xxx` SKUs |
| `product_id` | Collection checkout | e.g. `kenya-edit` |
| `fast_path` | Automation | `hazina_gift_checkout`, `hazina_custom_box`, `llm_tool` |

### 4.3 Phase 1 — Day 1–30 (Hybrid stack)

| Rail | Provider | Status | Notes |
|---|---|---|---|
| KES M-Pesa STK | IntaSend | ✅ | `PAYMENT_PROVIDER=intasend` on Render |
| USD cards | Paystack | ✅ Code wired | Add `PAYSTACK_SECRET_KEY` + `PAYSTACK_PUBLIC_KEY` on Render |
| Resend payment | Both | ✅ | "resend STK", "resend link", "checkout link", etc. |
| Callback | `/payments/paystack/callback` | ✅ Adapter exists | Verify webhook in Paystack dashboard |

### 4.4 Phase 2 — Scale ($5k–$10k/mo)

| Rail | Provider | Status |
|---|---|---|
| International travel payments | DPO Group | ⬜ Apply after volume proof |

### 4.5 Global shipping

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
- [x] Upload to portal — **58 files in `public/treasures/`** (30 treasures + 5 collection heroes mapped)
- [x] `profile.menu_photos` seeded with absolute URLs for Meta Catalog prep
- [ ] Meta WhatsApp Catalog live sync

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
| Safari souvenirs Nairobi | ✅ | `/premium-safari-souvenirs-nairobi` |
| Treasure atelier browse | ✅ | `/treasures` (+ 30 detail pages) |
| Custom box builder | ✅ | `/build` |
| TikTok / short video | ⬜ External | "Departure Drop to Terminal 1A in 3 hours" narrative |

---

## 7. Seven-day launch sequence

| Day | Workstream | Blueprint intent | In-repo status |
|---|---|---|---|
| **1** | Digital real estate | Domains, social handles, logo, Paystack application | ⬜ **External** — user-owned |
| **2** | Tech pivot — tenant | Postgres tenant `hazina-nomads`, env prep | ✅ Seed: 5 collections, 30 treasures, 44 KB chunks, `menu_photos` |
| **2–3** | Tech pivot — frontend | Standalone Hazina portal | ✅ `hazina-portal/` — 48 routes at build |
| **3** | Physical prototyping | Source coffee, beadwork, rigid boxes; assemble prototype | ⬜ **External** |
| **3** | WhatsApp + AI tools | Hazina menus, delivery fields, hybrid pay | ✅ See §10–§12 |
| **4** | Media production | Product photography → WA Catalog + website | ✅ 58 portal assets, 108 `menu_photos` keys; ⬜ Meta Catalog sync |
| **4** | Paystack USD | Checkout links for international guests | ✅ Router wired; add live keys |
| **5** | AI calibration | RAG rules, eval matrix for terminals/times | ✅ RAG seeded; run `make eval-whatsapp-local` |
| **6** | Logistics lock | Vet courier/driver; packaging workflow | ⬜ **External** |
| **6** | Host affiliate | `REF-HOST-*` tracking + commission ledger | ⬜ Config in seed only |
| **7** | Soft launch | Render deploy, live USD rehearsal, 50 Airbnb QR cards | ✅ `DEFAULT_BUSINESS_SLUG=hazina-nomads` in `render.yaml` |

---

## 8. Technical tenant configuration

### 8.1 Tenant record

| Field | Value |
|---|---|
| **Slug** | `hazina-nomads` |
| **Name** | Hazina Nomads |
| **Industry** | `gift-concierge` |
| **Location** | Nairobi — Westlands, Kilimani, Karen & JKIA delivery |
| **Phone** | `+1 555 657 8220` |
| **Email** | `concierge@hazina-nomads.com` |
| **Languages** | `en` primary, `sw` secondary |
| **Coords** | -1.2921, 36.7853 (Nairobi) |
| **Timezone** | `Africa/Nairobi` |

### 8.2 Profile schema (`business.profile` JSON)

| Key | Type | Contents |
|---|---|---|
| `vertical` | string | `"retail"` |
| `tagline` | string | Curated treasures… |
| `brand` | object | name, meaning, legacy color hexes |
| `currency` | string | `"KES"` |
| `usd_pricing` | bool | `true` |
| `payment_methods` | array | M-Pesa (IntaSend), Paystack USD |
| `custom_orders` | bool | `true` |
| `corporate_gifting` | bool | `true` |
| `delivery_zones` | array | Westlands, Kilimani, Karen, JKIA |
| `jkia_delivery_window_hours` | int | 4 |
| `late_dispatch_fee_usd` | int | 15 |
| `late_dispatch_after` | string | `"20:00 EAT"` |
| `products` | array | Full `HAZINA_COLLECTIONS` with `item_ids` |
| `treasures` | array | Full `HAZINA_TREASURES` |
| `menu_photos` | dict | id/name/sku → absolute portal image URL |
| `affiliate` | object | commission %, referral prefix |

### 8.3 Seed command

```bash
# Full tenant + KB re-embed (requires EMBED_PROVIDER + Postgres in .env)
PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py

# Business row only (no OpenAI embed call)
PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py --skip-kb
```

**KB output:**

| Source | Chunks | Contents |
|---|---|---|
| `KB_CATALOG` | **36** | 5 collections + 1 custom-box policy + 30 treasures |
| `KB_POLICIES` | **8** | Delivery, JKIA, hotel, late dispatch, custom boxes, payments, brand, contact |
| **Total** | **44** | Re-embed deletes old chunks for tenant before ingest |

**Seed side effects:**

- Upserts `businesses` row by slug
- Sets `meta_wa_phone_number_id` from env if present
- Builds `menu_photos` from `PUBLIC_HAZINA_PORTAL_URL` (default `https://hazina.lesnarai.co.ke`)

### 8.4 Environment variables (cutover)

Documented in `.env.example`. **Do not flip production secrets until Day 7 decision.**

```bash
# ── Tenant routing ──
DEFAULT_BUSINESS_SLUG=hazina-nomads          # render.yaml + config default
DEMO_BUSINESS_SLUG=lily-pond-cafe            # KES 10 demo espresso — café tenant only

# ── LLM / embeddings ──
LLM_PROVIDER=openai
LLM_FALLBACK_PROVIDERS=groq
OPENAI_MODEL=gpt-5.4-mini
OPENAI_REASONING_EFFORT=low
OPENAI_USE_RESPONSES_API=true
OPENAI_STORE_RESPONSES=true
OPENAI_EMBED_MODEL=text-embedding-3-large
OPENAI_EMBED_DIMENSIONS=768
GROQ_API_KEY=

# ── WhatsApp ──
META_WA_PHONE_NUMBER_ID=<Hazina Meta number>
META_WA_ACCESS_TOKEN=
META_WA_VERIFY_TOKEN=
META_WA_APP_SECRET=

# ── URLs ──
PUBLIC_HAZINA_PORTAL_URL=https://hazina.lesnarai.co.ke
PUBLIC_API_URL=https://api.lesnarai.co.ke
ADMIN_CORS_ORIGINS=https://hazina.lesnarai.co.ke,https://geneat.lesnarai.co.ke,...

# ── Payments (hybrid) ──
PAYMENT_PROVIDER=intasend
PAYMENT_SIMULATOR=false
INTASEND_API_TOKEN=
INTASEND_PUBLISHABLE_KEY=
INTASEND_TEST_MODE=false
INTASEND_WEBHOOK_SECRET=
PAYSTACK_SECRET_KEY=                         # Required for USD checkout
PAYSTACK_PUBLIC_KEY=

# ── hazina-portal/ (Render hazina-portal service) ──
NEXT_PUBLIC_HAZINA_WHATSAPP=15556578220
NEXT_PUBLIC_HAZINA_PHONE=+15556578220
NEXT_PUBLIC_BACKEND_URL=https://api.lesnarai.co.ke
BACKEND_URL=https://api.lesnarai.co.ke
```

**Render secrets (`sync: false`):** `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, all Meta WA keys, IntaSend keys, `NEXT_PUBLIC_HAZINA_*`.

### 8.5 Pre-flight checklist

```bash
# 1. Seed tenant (needs Postgres + embedder)
PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py

# 2. Go-live gate
python scripts/tenant_go_live_check.py --slug hazina-nomads --chat
python scripts/tenant_go_live_check.py --slug hazina-nomads --live --chat

# 3. Hazina unit tests
make test-hazina

# 4. WhatsApp reply matrix
make eval-whatsapp-local

# 5. Portal build (48 routes)
cd hazina-portal && npm run build
```

### 8.6 Production cutover (Day 7)

**In-repo (done):**

- `render.yaml` → `DEFAULT_BUSINESS_SLUG=hazina-nomads`
- `hazina-portal` service on `hazina.lesnarai.co.ke`
- `gift_automation.py` — full checkout paths
- Hybrid payment router + resend
- Seed script with full catalog + `menu_photos`

**You must set on Render:**

1. `META_WA_PHONE_NUMBER_ID` — Hazina Meta Cloud API phone id
2. `META_WA_ACCESS_TOKEN`, `META_WA_VERIFY_TOKEN`, `META_WA_APP_SECRET`
3. `ADMIN_CORS_ORIGINS` — include `https://hazina.lesnarai.co.ke`
4. `NEXT_PUBLIC_HAZINA_WHATSAPP` / `NEXT_PUBLIC_HAZINA_PHONE` on `hazina-portal`
5. `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` for USD
6. Re-run `scripts/seed_hazina_nomads.py` after Meta phone id is set

**Smoke test after cutover:**

1. Greet → Hazina main menu (Shop | Corporate | Concierge | Track)
2. Shop → 5 collections → tap Kenya Edit → delivery prompt → STK
3. `/build` handoff message with 2+ SKUs → delivery → STK or Paystack link
4. "resend STK" / "resend link" on pending order
5. Free-form Q&A → AI `create_order` → automatic payment handoff

### 8.7 Tenant swap model

No app rewrite — **multi-tenant swap**:

```
Meta WA webhook → resolve business by phone_number_id or DEFAULT_BUSINESS_SLUG
               → RAG scoped to business_id
               → WhatsApp menus branch on business_slug
               → gift_automation if slug=hazina-nomads (before LLM)
               → create_order writes to orders.details for that tenant
```

Gen-Eat café tenants (`lily-pond-cafe`, etc.) remain in DB; demo path stays on `DEMO_BUSINESS_SLUG`.

---

## 9. Website implementation (`hazina-portal/`)

**Standalone Next.js app** — not part of `gen-eat-portal/`. Gen-Eat café demo stays at `geneat.lesnarai.co.ke`; Hazina deploys to **`hazina.lesnarai.co.ke`**.

### 9.0 Deployment

| Layer | Gen-Eat (reference) | Hazina Nomads |
|---|---|---|
| Customer portal | `geneat.lesnarai.co.ke` via **Vercel** | `hazina.lesnarai.co.ke` via **Render** (`render.yaml` → `hazina-portal`) |
| Backend API | `api.lesnarai.co.ke` on Render | **Same shared API** |
| Portal → API | `BACKEND_URL` → `/api/chat` proxy | Same pattern |
| DNS | Cloudflare on `lesnarai.co.ke` | `hazina` CNAME → Render |

**Render `hazina-portal` service env:**

- `NODE_ENV=production`
- `BACKEND_URL` / `NEXT_PUBLIC_BACKEND_URL` → `https://api.lesnarai.co.ke`
- `NEXT_PUBLIC_HAZINA_WHATSAPP`, `NEXT_PUBLIC_HAZINA_PHONE` (secrets)

### 9.1 Routes (48 routes at build)

| Route | Status | File | Purpose |
|---|---|---|---|
| `/` | ✅ | `app/page.tsx` | Editorial homepage |
| `/treasures` | ✅ | `app/treasures/page.tsx` | All 30 treasures; search, sort, category, photo, and lead-time filters |
| `/treasures/[id]` | ✅ | `app/treasures/[id]/page.tsx` | Item detail + add to box |
| `/collections` | ✅ | `app/collections/page.tsx` | 5 curated boxes |
| `/collections/[id]` | ✅ | `app/collections/[id]/page.tsx` | Inside-the-box treasure grid |
| `/build` | ✅ | `app/build/page.tsx` | `PackBuilder` — custom box |
| `/last-minute-kenya-gifts-jkia` | ✅ | `app/last-minute-kenya-gifts-jkia/page.tsx` | JKIA SEO landing |
| `/premium-safari-souvenirs-nairobi` | ✅ | `app/premium-safari-souvenirs-nairobi/page.tsx` | Safari SEO landing |
| `/about` | ✅ | `app/about/page.tsx` | Brand story |
| `/api/chat` | ✅ | `app/api/chat/route.ts` | Proxy to backend `/mock/message` |
| `/api/catalog` | ✅ | `app/api/catalog/route.ts` | Portal catalog JSON + backend media-key probe |
| `/api/health` | ✅ | `app/api/health/route.ts` | Backend `/healthz` proxy for live status |

**Error boundaries:** `app/error.tsx`, `app/global-error.tsx`

No `/cafes`, `/map`, or `/owners` — Gen-Eat-only in `gen-eat-portal/`.

### 9.2 Navigation & footer links

**Nav (`components/Nav.tsx`):** Treasures · Collections · Build · Safari · JKIA · About · Concierge (WhatsApp), mobile menu, API status, day/night theme toggle

**Footer (`components/Footer.tsx`):** All collections · Safari souvenirs · JKIA departure · Our story · email · phone · dispatch hours

### 9.3 Components & data

| Asset | Path |
|---|---|
| Curated collections | `lib/products.ts` → `GIFT_BOXES` (with `itemIds[]`) |
| Individual treasures | `lib/treasures.ts` → `TREASURES`, `CATEGORY_LABELS` |
| Brand constants | `lib/products.ts` → `BRAND`, `BRAND_IMAGES`, `DELIVERY_ZONES` |
| Format helpers | `lib/format.ts` → `formatKES`, `whatsappLink` |
| Collection card | `components/CollectionCard.tsx` |
| Treasure card | `components/TreasureCard.tsx` |
| Treasure explorer | `components/TreasureExplorer.tsx` — search, sort, filters, inspect/add/ask actions |
| Pack builder | `components/PackBuilder.tsx` |
| Product image | `components/ProductImage.tsx` |
| Catalog image | `components/CatalogImage.tsx` — blank frame for products with no direct image yet |
| Catalog sync badge | `components/CatalogSyncBadge.tsx` — hits `/api/catalog` |
| API status | `components/ApiStatus.tsx` — hits `/api/health` (shows "API degraded" when backend :8000 is down) |
| Theme controls | Inline script in `app/layout.tsx`, `components/ThemeToggle.tsx` |
| Concierge CTA | `components/ConciergePromptButton.tsx` |
| Nav / Footer | `components/Nav.tsx`, `components/Footer.tsx` |
| Chat widget | `components/ChatWidget.tsx` — `business_slug=hazina-nomads` |
| ESLint | `.eslintrc.json` — `next/core-web-vitals` |
| Styles | `tailwind.config.ts`, `app/globals.css` |

### 9.4 Image library

| Location | Files | Notes |
|---|---|---|
| `docs/pictures/` | 49+ | Master archive (+ 6 new source photos untracked) |
| `public/treasures/` | 58 | Slug-renamed for Next.js `Image` |
| `public/products/` | 0 | Removed to avoid stale duplicate collection images |
| `public/brand/` | 1 | `safari-sunset.jpg`; other brand context reuses direct treasure photography |
| `public/treasures/generated/` | — | Optional AI composites — **not used by portal routes** |

Image paths mirrored in `HAZINA_COLLECTION_IMAGES` and `HAZINA_TREASURE_IMAGES` in Python catalog for `menu_photos`. Verify refs:

```bash
python scripts/check_asset_images.py
```

### 9.5 Local dev

**Recommended commands:**

```bash
# Dev mode (hot reload) — clears .next, kills stale ports
make dev-hazina

# Production preview (stable styling) — preferred when dev looks broken
make preview-hazina
# → http://localhost:3004  (override: HAZINA_PREVIEW_PORT=3003)

# Manual equivalents
cd hazina-portal && npm run dev:clean     # → scripts/dev-hazina.sh
cd hazina-portal && npm run preview       # build + next start on :3003
```

**Dev script behaviour (`scripts/dev-hazina.sh`):**

1. Stops listeners on ports 3000–3002 (+ repo `next dev` processes)
2. Clears `hazina-portal/.next` (unless `--no-clean`)
3. Starts Next.js on 3001; fallback 3002/3003/3004 if 3001 stuck
4. Waits for HTTP 200 and **warns if CSS returns non-`text/css`** (unstyled-page signal)

**Preview script behaviour (`scripts/preview-hazina.sh`):**

1. Kills stale `next dev` / `next start` on ports 3001–3005
2. Deletes `.next`, runs `npm run build`, starts `next start` on **3004**

API for chat widget + health badges: `make dev` in another terminal (:8000). Without it, nav shows **"API degraded"** — expected, not a styling bug.

### 9.6 Troubleshooting — portal looks like unstyled HTML

**Symptom:** Default browser fonts, blue underlined links, Times/serif body text — images may still load.

**Root causes (in order of likelihood):**

| Cause | How to tell | Fix |
|---|---|---|
| **CSS hash mismatch** | HTML references `/_next/static/css/OLD.css`; curl returns **400/404 HTML** not `text/css` | Stop all `next start`/`next dev`, run `make preview-hazina` |
| **Stale zombie dev server** | Port listens but curl **hangs** or never completes (often :3001) | Kill in Cursor terminal (Ctrl+C) or `fuser -k 3001/tcp`, then `make dev-hazina` |
| **`.next` deleted while dev running** | Next.js error loop / missing chunks (`Cannot find module './682.js'`) | Stop server, `rm -rf .next`, restart |
| **Wrong port** | Bookmarked old port from earlier session | Use URL printed by `make dev-hazina` or `make preview-hazina` |

**Quick verify CSS is healthy:**

```bash
CSS=$(curl -s http://localhost:3004/ | grep -oE '/_next/static/css/[^"]+\.css' | head -1)
curl -sI "http://localhost:3004$CSS" | grep -i content-type
# Expect: Content-Type: text/css
```

**Rule:** Never run `npm run build` while an old `next start` is still serving — rebuild changes CSS filenames; the old server keeps serving HTML with dead CSS links.

Hard refresh after fix: **Ctrl+Shift+R** (Cmd+Shift+R on Mac).

---

## 10. WhatsApp implementation

### 10.1 Menu structure (`app/services/whatsapp_menus.py`)

**Hazina main menu** (`business_slug=hazina-nomads`):

| Button | Interactive ID | Action |
|---|---|---|
| Shop The Kenya Edit | `lp:shop` | Opens 5-product list |
| Corporate Gifting | `lp:corp` | Escalates human concierge |
| Talk to Concierge | `lp:concierge` | `CMD_STAFF` escalation |
| Track Delivery | `lp:track` | Order status (no LLM) |
| My orders | `lp:orders` | Recent orders |
| Exit | `lp:exit` | End chat |

**Product list** (`product_list_payload`):

| Row ID | Product |
|---|---|
| `lp:prod:kenya-edit` | The Kenya Edit — USD 89 |
| `lp:prod:highland-treasure` | Highland Treasure — USD 59 |
| `lp:prod:nomad-leather-set` | Nomad Leather Set — USD 129 |
| `lp:prod:safari-romance-box` | Safari Romance Box — USD 199 |
| `lp:prod:departure-drop` | Departure Drop — USD 149 · 4h JKIA |

Tap → `order {product}` → `gift_automation` checkout.

### 10.2 Gift automation (`app/services/gift_automation.py`)

**Redis checkout state:**

| Key | TTL | Purpose |
|---|---|---|
| `gift_checkout:{conv_id}` | 3600s | In-progress collection or custom box checkout |

**Checkout steps:**

| `step` | Meaning |
|---|---|
| `delivery` | Collection order — awaiting hotel/JKIA location |
| `departure` | JKIA — awaiting flight time |
| `custom_delivery` | Custom box — awaiting location |

**Key functions:**

| Function | Role |
|---|---|
| `try_hazina_automation` | Main entry — returns reply or None (fall through to AI) |
| `looks_like_hazina_catalog_request` | "menu", "catalog", "what do you sell", "shop", etc. → product list |
| `resolve_product_id` | Text/interactive → collection id |
| `parse_custom_box_handoff` | WhatsApp message → SKU line items |
| `detect_payment_currency` | KES vs USD from guest text |
| `_finalize_order` | Collection → order + payment |
| `_finalize_custom_order` | Custom box → order + payment |
| `finalize_checkout_from_ai` | Post-AI `create_order` → payment |
| `looks_like_hazina_track` | Delivery status queries |
| `looks_like_hazina_corporate` | Escalation trigger |

**Payment currency detection** (`_USD_PAY_RE`): matches `usd`, `dollar`, `$`, `card`, `visa`, `mastercard`, `apple pay`, `paystack`, `international`.

### 10.3 Payment resend (`app/channels/base.py`)

**Trigger regex** (`_PAYMENT_RESEND_RE`): includes:

- `resend STK`, `send again`, `tuma tena`
- `resend link`, `checkout link`, `pay link`, `new link`
- `STK expired`, `link never arrived`, etc.

**Flow:** `_resend_pending_payment_reply` → reads `order.details.payment_currency` → `request_order_payment` → fresh STK or Paystack URL.

Also: auto-resend stale STK after timeout (`_auto_resend_stale_payment_reply`).

### 10.4 End-to-end customer journeys

**Web — browse collection**

1. `/` or `/collections` → **See inside** → `/collections/kenya-edit`
2. **Reserve as-is** → WhatsApp with collection name

**Web — build custom box**

1. `/treasures` or `/build` → select 2+ items + packaging
2. **Send to concierge** → WhatsApp with SKU list
3. Guest replies with delivery location (or pastes same thread)
4. Automation parses SKUs → asks location → creates order → STK or Paystack link

**WhatsApp — catalog request (fast path, no LLM)**

1. Guest: *"What do you sell?"* or *"show me your collections"*
2. Automation returns catalog copy + interactive 5-product list
3. Tap collection → same checkout flow as menu Shop path

**WhatsApp — collection (fast path, no LLM)**

1. Greet → main menu
2. Shop → product list → tap Kenya Edit
3. Ask delivery location → JKIA asks departure
4. `create_order_and_request_payment` → STK (KES) or link (USD)

**WhatsApp — custom box (fast path)**

1. Paste `/build` handoff message (2+ `(HN-T-xxx)` lines)
2. Automation confirms item count + total → asks delivery
3. Same JKIA departure sub-flow if needed
4. Order type `custom_box` in details → payment

**WhatsApp — AI + automation handoff**

1. *"Do you deliver to Hemingways Karen?"* → RAG + AI
2. *"I'll take the Kenya Edit for room 412, pay by card"* → AI `create_order` with `payment_currency=USD`
3. `finalize_checkout_from_ai` → Paystack link in reply

**WhatsApp — payment resend**

1. Pending order exists
2. Guest: *"resend link"* (USD) or *"resend STK"* (KES)
3. Fresh payment prompt

### 10.5 Hybrid automation architecture

```
Inbound WhatsApp (hazina-nomads)
    │
    ├─ Menu tap (lp:shop / lp:prod:*) ──► gift_automation (no LLM)
    ├─ Catalog request ("menu", "shop", …) ► gift_automation → product list (no LLM)
    ├─ Custom box SKU message ──────────► gift_automation (no LLM)
    ├─ Track / Corporate ───────────────► gift_automation (no LLM)
    ├─ Resend STK / link ───────────────► base.py payment resend
    ├─ Greeting ────────────────────────► main menu payload
    │
    └─ Free-form ──► LangGraph + RAG + tools (OpenAI primary, Groq fallback)
            │
            └─ create_order ──► finalize_checkout_from_ai ──► hybrid payment
```

### 10.6 Café tenants (unchanged)

When slug ≠ `hazina-nomads`: Order, See menu, Pay, Track, My orders, Talk to staff, Exit.

---

## 11. AI tools implementation

**File:** `app/ai/tools.py`  
**Order persistence:** `app/services/cafe_automation.py` → `create_pending_order`

### 11.1 `create_order`

| Field | Type | Stored |
|---|---|---|
| `items` | `[{sku_or_name, qty, unit_price}]` | `order.details.items` |
| `delivery_location` | string | `order.details.delivery_location` + composed notes |
| `departure_time_iso` | ISO-8601 | `order.details.departure_time_iso`; sets `appointment_time` |
| `delivery_notes` | string | Appended to composed notes |
| `appointment_time_iso` | ISO-8601 | `order.appointment_time` |
| `payment_currency` | `KES` \| `USD` | `order.details.payment_currency` |
| `amount_usd` | float | `order.details.amount_usd` |

**Composed notes example:** `Location: JKIA Terminal 1A | Departure: 2026-06-15T18:00:00+03:00`

After successful `create_order` on Hazina tenant, `base.py` calls `finalize_checkout_from_ai` automatically (unless deduped).

### 11.2 `request_mpesa_payment` (hybrid — name kept for prompt compatibility)

| Input | Notes |
|---|---|
| `amount_kes` | Required for KES path |
| `order_reference` | First 8 chars of order UUID |
| `msisdn` | Normalized Kenya number |
| `currency` | Optional `KES` (default) or `USD` |
| `amount_usd` | Required for USD Paystack amount |

| Output (success) | Notes |
|---|---|
| `checkout_request_id` | Provider reference |
| `provider` | `intasend`, `paystack`, `simulator`, etc. |
| `redirect_url` | Paystack hosted checkout (USD) |
| `payment_currency` | Echo |
| `amount_usd` | Echo when USD |

Routes through `resolve_payment_service(currency=…)`.

### 11.3 `calculate_dhl_shipping` (stub)

| Input | `destination_country`, `box_weight_kg` (default 1.5) |
| Output | `estimate_usd`, `lead_days`, `stub: true` |
| Weight bands | ≤2 kg → $45; ≤5 kg → $78; else $78 + $12/kg over 5 |

### 11.4 Other tools (tenant-scoped)

`knowledge_lookup`, `escalate_to_human`, `send_location_pin`, `send_menu_photo`, `update_customer_name`.

---

## 12. Implementation file map (DONE vs TODO)

| Area | Path | Status |
|---|---|---|
| **Catalog (backend)** | `app/catalog/hazina_catalog.py` | ✅ Collections, treasures, KB builder, menu_photos |
| **Tenant seed + KB** | `scripts/seed_hazina_nomads.py` | ✅ 44 KB chunks, full profile |
| **Gift automation** | `app/services/gift_automation.py` | ✅ Collections, custom box, catalog menu, pay, track |
| **WhatsApp menus** | `app/services/whatsapp_menus.py` | ✅ Hazina branch |
| **Channel dispatch** | `app/channels/base.py` | ✅ Fast path + resend + AI payment handoff |
| **Payment router** | `app/integrations/payments/factory.py` | ✅ `resolve_payment_service` |
| **Order + payment** | `app/services/cafe_automation.py` | ✅ Hybrid `request_order_payment` |
| **AI tools** | `app/ai/tools.py` | ✅ USD fields, hybrid payment tool |
| **Render cutover** | `render.yaml` | ✅ `hazina-nomads` default + portal + Paystack env keys |
| **Standalone portal** | `hazina-portal/` | ✅ 48 routes |
| **Collections (portal)** | `hazina-portal/lib/products.ts` | ✅ |
| **Treasures (portal)** | `hazina-portal/lib/treasures.ts` | ✅ |
| **Portal API proxies** | `app/api/chat`, `app/api/catalog`, `app/api/health` | ✅ Chat, catalog/media probe, backend health |
| **Pack builder** | `components/PackBuilder.tsx` | ✅ Search, sort, category filters, WhatsApp handoff |
| **Treasure explorer** | `components/TreasureExplorer.tsx` | ✅ Search, sort, filters, inspect/add/ask |
| **Theme + mobile UX** | `components/Nav.tsx`, `ThemeToggle`, `ApiStatus` | ✅ Responsive nav, live API status, day/night mode |
| **Safari landing** | `app/premium-safari-souvenirs-nairobi/` | ✅ |
| **JKIA landing** | `app/last-minute-kenya-gifts-jkia/` | ✅ |
| **Image library** | `public/treasures/` (58 files) | ✅ All 30 treasures + 5 collection heroes mapped |
| **menu_photos seed** | `build_hazina_menu_photos()` | ✅ 108 absolute URLs in profile |
| **Dev launcher** | `scripts/dev-hazina.sh`, `make dev-hazina` | ✅ CSS health check on startup |
| **Preview launcher** | `scripts/preview-hazina.sh`, `make preview-hazina` | ✅ Rebuild + stable prod server (:3004) |
| **Fonts + layout** | `app/layout.tsx` (`next/font`) | ✅ Self-hosted Inter, Cormorant, DM Mono |
| **ESLint** | `hazina-portal/.eslintrc.json` | ✅ `next/core-web-vitals` |
| **Asset checker** | `scripts/check_asset_images.py` | ✅ Portal image ref audit |
| **Error boundaries** | `app/error.tsx`, `app/global-error.tsx` | ✅ |
| Paystack live checkout | Render secrets | ⬜ Needs merchant keys |
| Meta Catalog sync | External | ⬜ Photos ready in profile |
| Host affiliate ledger | — | ⬜ TODO |
| Real DHL API | `calculate_dhl_shipping` | ⬜ Stub |
| Physical fulfillment | — | ⬜ Blueprint |

---

## 13. Testing

### 13.1 Automated tests

Current local verification on 2026-05-31:

- `make test-hazina` → `54 passed, 1 warning`
- `make test-fast` → `155 passed, 1 warning`
- `cd hazina-portal && npm run typecheck` → passed
- `cd hazina-portal && npm run lint` → passed (1 warning: `ChatWidget.tsx` `<img>`)
- `cd hazina-portal && npm run build` → passed, `48` routes

```bash
make test-hazina

# broader fast confidence suite
make test-fast

# portal
cd hazina-portal && npm run typecheck && npm run lint && npm run build

# stable styled preview (recommended for visual QA)
make preview-hazina
```

| Test file | Covers |
|---|---|
| `test_whatsapp_menus.py` | Hazina main menu, product list, interactive IDs |
| `test_gift_automation.py` | Product resolve, custom box parse, currency detect, **catalog menu intent** |
| `test_payment_routing.py` | KES→IntaSend, USD→Paystack, missing keys error |
| `test_ai_tools_payment.py` | USD redirect_url, create_order USD details, menu_photos builder |
| `test_channel_fallbacks.py` | Resend STK/link, pending order flows |
| `test_payments_hardening.py` | Payment retry, `resolve_payment_service` mocks |

### 13.2 Manual checks

```bash
# Full dev stack
make dev                    # API :8000
make dev-hazina             # Portal dev :3001 (or fallback port)
make preview-hazina         # Portal prod preview :3004 — use for visual QA

# Seed (requires Postgres)
PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py

# WhatsApp reply matrix
make eval-whatsapp-local
```

**Manual WhatsApp checklist:**

- [ ] Greet → Hazina menu (not café menu)
- [ ] "What do you sell?" / "menu" → 5-product list (no LLM)
- [ ] Shop → 5 products → tap → delivery prompt
- [ ] JKIA location → departure time prompt
- [ ] STK arrives (KES) or Paystack link (USD)
- [ ] Custom box message with 2+ SKUs → automated checkout
- [ ] "resend STK" / "resend link" works
- [ ] Track delivery returns order status
- [ ] Corporate → escalation flag

---

## 14. Blockers & decisions needed

| # | Decision | Owner | Blocks |
|---|---|---|---|
| 1 | **Live WhatsApp number** + Meta `phone_number_id` | User | Real customer WA |
| 2 | **Paystack merchant approval** + live keys on Render | User | USD checkout in production |
| 3 | **Domain** `hazina.lesnarai.co.ke` DNS live | User | Public SEO / trust |
| 4 | **Re-seed production KB** after deploy | Eng/Ops | RAG knows 30 treasures |
| 5 | **Product photography** in physical boxes | User | Fulfillment quality |
| 6 | **Courier contract** | User | Last-mile SLA |
| 7 | **Terracotta vs bronze hex** alignment | Design | Brand consistency |
| 8 | **Meta WhatsApp Catalog** merchant setup | User/Ops | In-chat product photos |
| 9 | **Local portal styling** | Eng | Use `make preview-hazina` — see §9.6 if page looks like raw HTML |

**Completed (no longer blockers):**

- ~~Sync 30 treasures to seed/RAG~~ → `app/catalog/hazina_catalog.py`
- ~~Paystack routing code~~ → `resolve_payment_service`
- ~~Custom box WhatsApp automation~~ → SKU parser in `gift_automation.py`
- ~~Safari SEO landing~~ → `/premium-safari-souvenirs-nairobi`
- ~~menu_photos in profile~~ → `build_hazina_menu_photos()` (108 keys)
- ~~WhatsApp catalog menu intent~~ → `looks_like_hazina_catalog_request`
- ~~All 5 collection hero images~~ → `HAZINA_COLLECTION_IMAGES`
- ~~Portal unstyled HTML (CSS mismatch)~~ → `make preview-hazina` + §9.6

---

## 15. Release checklist

Use before any production tag or Hazina cutover (§8.6).

- [ ] Run `alembic upgrade head` in staging
- [ ] Run seed: `PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py`
- [ ] Run Hazina pytest suite (§13.1)
- [ ] Run `make eval-whatsapp-local`
- [ ] `cd hazina-portal && npm run build` — confirm 48 routes
- [ ] `cd hazina-portal && npm run lint` — no errors
- [ ] `make preview-hazina` — confirm CSS loads (§9.6)
- [ ] Set Render secrets: Meta WA, IntaSend, Paystack, `NEXT_PUBLIC_HAZINA_*`
- [ ] Add `https://hazina.lesnarai.co.ke` to `ADMIN_CORS_ORIGINS`
- [ ] Live smoke: menu → order → STK + USD link rehearsal
- [ ] Tag release and publish changelog

---

## 16. Related documents

| Doc | Relationship |
|---|---|
| [README.md](../README.md) | Platform architecture, Gen-Eat demo, deployment & ops |
| [SECURITY.md](../SECURITY.md) | Security audit findings and hardening |
| [hazina-portal/README.md](../hazina-portal/README.md) | Hazina portal quick commands |
| [gen-eat-portal/README.md](../gen-eat-portal/README.md) | Gen-Eat café demo portal (separate) |
| [docs/archive/](../archive/) | Archived Gen-Eat-era and superseded deploy guides |

**Do not maintain a second Hazina blueprint elsewhere.** Update this file when product, ops, or implementation status changes.
