# Hazina Nomads — appendix

**Live status / gaps / flaws:** [SYSTEM.md](SYSTEM.md) only.  
**This file:** brand, SKU tables, logistics, launch playbook, portal troubleshooting.

> **This file:** brand, SKUs, launch playbook, portal troubleshooting only.

---

## 0. Index (live status → SYSTEM.md)

| Need | Document |
|---|---|
| **What exists, gaps, flaws, P0 actions** | [SYSTEM.md](SYSTEM.md) §1 §9 §10 |
| Brand, positioning, persona | §1 below |
| Full SKU / pricing table | §2 below |
| Logistics, payments, GTM | §3–§8 below |
| Portal routes, dev, CSS QA | §9 below |
| File map | §12 below |
| Release checklist | §15 below |

Do not duplicate inventory here — it goes stale.

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
| **Individual treasures** | 33 | `HAZINA_TREASURES` | `lib/treasures.ts` → `TREASURES` | ✅ Custom box SKU parser | ✅ 33 chunks after re-seed |
| **Custom box / private brief** | 2+ items + optional packaging + monograms | `MIN_CUSTOM_ITEMS`, `PACKAGING_FEE_*`, `ENGRAVING_FEE_*` | `PackBuilder.tsx` | ✅ Brief + bespoke block | ✅ policy chunks |

**Constants (shared backend):**

| Constant | Value |
|---|---|
| `MIN_CUSTOM_ITEMS` | 2 |
| `PACKAGING_FEE_USD` / `KES` | 45 / 5,800 |
| `ENGRAVING_FEE_USD` / `KES` | 15 / 1,950 (per line with monogram text) |
| Packaging SKU | `HN-T-070` (`premium-packaging`) |

**Open-ended curation:** guests use **Bespoke Requests** on `/build` or free-form WhatsApp; corporate / high-budget one-offs → human escalation (`looks_like_hazina_corporate`).

### 2.1 Curated collections (detail)

#### The Kenya Edit

| | |
|---|---|
| **ID / SKU** | `kenya-edit` / `HN-KE-001` |
| **Price** | USD 249 · KES 32,400 |
| **Target** | Safari tourists, European/US visitors |
| **Contents** | Premium Kenyan coffee (250g), handmade Maasai beadwork (bracelet or necklace), small artisan soapstone carving, printed brand story card |
| **Lead time** | 24h |
| **Personalization** | No |
| **Portal itemIds** | `premium-coffee-250g`, `maasai-bracelet`, `soapstone-big-five`, `premium-packaging` |
| **Hero image** | Provisional direct product/context photo; replace with exact no-watermark finished-box photography before premium launch |

#### The Highland Treasure

| | |
|---|---|
| **ID / SKU** | `highland-treasure` / `HN-HT-002` |
| **Price** | USD 199 · KES 25,900 |
| **Target** | General gifting, diaspora, colleagues |
| **Contents** | Export-grade Kenyan coffee, premium Kenyan loose-leaf tea, local raw honey, carved wooden tasting spoon |
| **Lead time** | 24h |
| **Portal itemIds** | `premium-coffee-250g`, `loose-leaf-tea`, `raw-honey`, `wooden-combs`, `premium-packaging` |
| **Hero image** | Provisional direct product/context photo; replace with exact no-watermark finished-box photography before premium launch |

#### The Nomad Leather Set

| | |
|---|---|
| **ID / SKU** | `nomad-leather-set` / `HN-NL-003` |
| **Price** | USD 329 · KES 42,800 |
| **Target** | Business travellers, wealthy tourists |
| **Contents** | Handmade leather passport holder, luggage tag, travel notebook |
| **Lead time** | 24h |
| **Personalization** | Yes — **engraving requires 24-hour notice** |
| **Portal itemIds** | `leather-passport`, `leather-luggage-tag`, `premium-packaging` |
| **Hero image** | Provisional direct product/context photo; replace with exact no-watermark finished-box photography before premium launch |

#### The Safari Romance Box

| | |
|---|---|
| **ID / SKU** | `safari-romance-box` / `HN-SR-004` |
| **Price** | USD 449 · KES 58,400 |
| **Target** | Honeymooners, anniversary trips |
| **Contents** | Matching couple's beadwork, premium treats (chocolate/coffee), framed minimalist safari route map, leather luggage tags |
| **Lead time** | 48h (assembly); leather tag engraving +24h notice |
| **Personalization** | Yes |
| **Portal itemIds** | `maasai-necklace`, `maasai-bracelet`, `premium-coffee-250g`, `big-five-print`, `leather-luggage-tag` |
| **Hero image** | Provisional direct product/context photo; replace with exact no-watermark finished-box photography before premium launch |

#### The Departure Drop

| | |
|---|---|
| **ID / SKU** | `departure-drop` / `HN-DD-005` |
| **Price** | USD 349 · KES 45,400 |
| **Target** | Last-minute JKIA departures |
| **Contents** | Pre-packed fast movers: coffee, tea, un-personalized leather, beadwork |
| **Lead time** | **4h** (JKIA-optimised) |
| **Flag** | `jkia_only: true` in seed/profile |
| **Portal itemIds** | `premium-coffee-250g`, `loose-leaf-tea`, `leather-passport`, `maasai-bracelet`, `premium-packaging` |
| **Hero image** | Provisional direct product/context photo; replace with exact no-watermark finished-box photography before premium launch |

### 2.2 Individual treasures (33 items — full table)

**Backend:** `app/catalog/hazina_catalog.py` → `HAZINA_TREASURES`  
**Portal:** `hazina-portal/lib/treasures.ts`  
**Images:** `hazina-portal/public/treasures/` — **33/33 treasures mapped** in `HAZINA_TREASURE_IMAGES` (coastal SKUs reuse provisional assets until dedicated shoots).

**Swahili Coast (new):**

| ID | SKU | Name | USD | KES | Engravable |
|---|---|---|---:|---:|---|
| `lamu-keepsake-box` | HN-T-071 | Lamu Carved Wood Keepsake Box | 65 | 8,450 | ✅ |
| `coastal-kikoi` | HN-T-072 | Hand-loomed Coastal Kikoi Textile | 45 | 5,900 | — |
| `mombasa-brass-scoop` | HN-T-073 | Mombasa Antiqued Brass Coffee Scoop | 35 | 4,600 | — |

| ID | SKU | Name | Category | USD | KES | Lead (h) | Personalization |
|---|---|---|---|---|---|---|---|
| `premium-coffee-250g` | HN-T-001 | Premium Kenyan Coffee | coffee-tea | 35 | 4,600 | 12 | — |
| `loose-leaf-tea` | HN-T-002 | Highland Loose-Leaf Tea | coffee-tea | 28 | 3,600 | 12 | — |
| `raw-honey` | HN-T-003 | Local Raw Honey | food | 30 | 3,900 | 24 | — |
| `maasai-bracelet` | HN-T-010 | Maasai Beaded Bracelet | beadwork | 45 | 5,900 | 12 | — |
| `maasai-necklace` | HN-T-011 | Maasai Beaded Necklace | beadwork | 85 | 11,000 | 24 | — |
| `maasai-earrings` | HN-T-012 | Maasai Earrings | beadwork | 42 | 5,500 | 12 | — |
| `leather-passport` | HN-T-020 | Leather Passport Holder | leather | 95 | 12,300 | 24 | ✅ embossing |
| `leather-luggage-tag` | HN-T-021 | Leather Luggage Tag | leather | 45 | 5,900 | 24 | ✅ embossing |
| `soapstone-big-five` | HN-T-030 | Soapstone Big Five Carving | art-sculpture | 75 | 9,700 | 24 | — |
| `antelope-carving` | HN-T-031 | Antelope Wood Carving | wood-carving | 85 | 11,000 | 24 | — |
| `wood-carving-set` | HN-T-032 | Artisan Wood Carving | wood-carving | 75 | 9,700 | 24 | — |
| `swahili-drums` | HN-T-033 | Swahili Drum Set (3) | wood-carving | 120 | 15,600 | 48 | — |
| `rungu-clubs` | HN-T-034 | Beaded Rungu Club Set | wood-carving | 110 | 14,300 | 24 | — |
| `woven-basket` | HN-T-040 | Hand-Woven Basket | baskets | 95 | 12,300 | 48 | — |
| `sisal-basket-small` | HN-T-041 | Small Woven Keepsake Basket | baskets | 60 | 7,800 | 48 | — |
| `kitenge-fabric` | HN-T-050 | Kitenge Fabric Length | textiles | 70 | 9,100 | 24 | — |
| `beaded-market-bag` | HN-T-051 | Beaded Market Bag | textiles | 120 | 15,600 | 24 | — |
| `maasai-sandals` | HN-T-052 | Maasai Leather Sandals | leather | 85 | 11,000 | 48 | size confirm |
| `wooden-combs` | HN-T-053 | Carved Wooden Combs | wood-carving | 38 | 4,900 | 12 | — |
| `african-wall-art` | HN-T-060 | Contemporary African Art Print | art-sculpture | 150 | 19,500 | 48 | — |
| `sculpture-piece` | HN-T-061 | Africa-Inspired Sculpture | art-sculpture | 180 | 23,400 | 48 | — |
| `kitenge-umbrella` | HN-T-062 | Kitenge Umbrella | textiles | 85 | 11,000 | 24 | — |
| `pottery-vessel` | HN-T-063 | Hand-Thrown Pottery | art-sculpture | 95 | 12,300 | 48 | — |
| `big-five-print` | HN-T-064 | Big Five Safari Print | art-sculpture | 85 | 11,000 | 24 | — |
| `maasai-market-tote` | HN-T-065 | Maasai Market Tote | textiles | 110 | 14,300 | 24 | — |
| `african-woven-mat` | HN-T-066 | African Woven Mat | homeware | 85 | 11,000 | 24 | — |
| `african-hand-broom` | HN-T-067 | African Hand Broom | homeware | 45 | 5,900 | 24 | — |
| `beaded-wood-containers` | HN-T-068 | Beaded Wood Container Set | wood-carving | 140 | 18,200 | 48 | — |
| `coconut-shell-plates-spoons` | HN-T-069 | Coconut Shell Plate & Spoon Set | homeware | 90 | 11,700 | 24 | — |
| `premium-packaging` | HN-T-070 | Premium Gift Box & Tissue | packaging | 45 | 5,800 | 12 | — |
| `lamu-keepsake-box` | HN-T-071 | Lamu Carved Wood Keepsake Box | swahili-coast | 65 | 8,450 | 48 | ✅ engrave |
| `coastal-kikoi` | HN-T-072 | Hand-loomed Coastal Kikoi Textile | swahili-coast | 45 | 5,900 | 24 | — |
| `mombasa-brass-scoop` | HN-T-073 | Mombasa Antiqued Brass Coffee Scoop | swahili-coast | 35 | 4,600 | 24 | — |

**Category counts:** Coffee & Tea 2 · Beadwork 3 · Leather 3 · Wood & Carvings 7 · **Swahili Coast 3** · Textiles 4 · Art & Sculpture 5 · Food 1 · Baskets 2 · Homeware 3 · Packaging 1

**Engraving:** eight SKUs — see [SYSTEM.md §7](SYSTEM.md#7-hazina).

### 2.2.1 Pricing benchmark snapshot

Pricing was raised on 2026-05-31 so Hazina reads as a premium tourist
concierge rather than a low-margin souvenir shop.

Benchmarks checked:

| Market signal | Current public benchmark | Hazina implication |
|---|---:|---|
| Nairobi luxury hampers | The Stems lists gift hampers from about KSh 8,500 to KSh 20,500; FlowerDelivery has a luxury hamper at KSh 30,500 | Curated hotel/JKIA boxes should sit above ordinary hamper pricing when they include curation, packaging, and delivery |
| Coffee gift sets | Purpink coffee hampers appear around KSh 4,200–7,250; premium Kenyan coffee 250g ranges from local KSh 1,200–1,650 to export-facing USD 28 | A Hazina coffee item at USD 35 / KES 4,600 now reflects sourcing, packaging readiness, and concierge margin rather than raw retail |
| Artisan beadwork | Kazuri public prices show bracelets around KSh 2,800–3,200 and necklaces from about KSh 4,500–5,250 | Hazina beadwork should price above bare retail to include sourcing assurance and gift presentation |
| Leather travel goods | Kenyan leather passport holders range from KSh 2,150–2,500 locally to USD 30 for beaded export-facing versions | Hazina leather travel SKUs should not be treated as cheap add-ons; embossing and delivery justify premium pricing |

Reference sources: [The Stems hampers](https://thestemsflowers.co.ke/collections/gift-hampers), [FlowerDelivery Good Times Hamper](https://www.flowerdelivery.co.ke/product/good-times-hamper/), [Purpink Classic Coffee Hamper](https://www.purpink.co.ke/products/the-classic-coffee), [Purpink Coffee Break Treat Hamper](https://www.purpink.co.ke/collections/all-gift-hampers/coffee-lover), [Terrani 250g coffee](https://www.terranicoffee.store/products/fully-washed-medium-roast-250g), [Ethnology Safari Serenity coffee](https://ethnology.world/products/safari-serenity-coffee-250g), [Kazuri Beads collections](https://kazuri.co.ke/collections), [Wazawazi passport holder](https://wazawazi.co.ke/product/uli-leather-passport-holder/), [BeadWORKS Kenya passport holder](https://www.beadworkskenya.com/products/passport-holder).

### 2.3 Private sourcing brief rules (`/build`)

- Page title: **Curate a Private Collection** — Savannah + Swahili Coast copy (§9.1).
- Minimum **2** treasures (`MIN_CUSTOM_ITEMS`).
- Optional premium packaging (+USD 45 / KES 5,800) — SKU `HN-T-070`.
- **Monogram:** per engravable line (+USD 15 / KES 1,950 each when text is present).
- **Bespoke requests:** free-text block; reference photos are collected on **WhatsApp** after submit (not in-browser upload).
- Running total in sidebar includes engraving lines; USD first with KES visible.
- **Start guided checkout** → portal chat collects name, delivery mode, location, timing, payment, contact **one turn at a time**, then posts the full structured payload.
- **Continue in WhatsApp** pre-fills the brief below; automation replies with photo-upload ack then step-by-step checkout.

```
Hello Hazina Nomads — private sourcing brief:

• Leather Passport Holder (HN-T-020) — Monogram: J.K.
• Lamu Carved Wood Keepsake Box (HN-T-071) — Monogram: Amina
• Maasai Beaded Bracelet (HN-T-010)
• Premium packaging & story card

Bespoke requests:
I am looking for a specific type of green malachite stone.

Estimated total: USD 275 / KES 35,750
Guest: Amina
Delivery type: Hotel delivery
Delivery location: Villa Rosa Kempinski room 412
Delivery window: Today 7:30 pm
Contact/payment detail: amina@example.com
Preferred payment: USD card link

Please create the order, confirm availability, and start payment.
```

- Deep link: `/build?add=premium-coffee-250g` pre-selects from treasure detail.
- **Automation** parses SKU lines (`_SKU_QTY_LINE_RE`), `Monogram:` suffixes, `Bespoke requests:` block, premium packaging, structured guest/delivery fields; adds engraving fees to parsed totals; stores monograms/bespoke in order notes on finalize.
- Legacy intro phrases (`automated custom gift box checkout`) still match `_CUSTOM_BOX_INTRO_RE`.

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
        ├─ currency=USD (Hazina default) ──► PaystackAdapter (hosted checkout URL)
        │
        └─ currency=KES or method=mpesa/stk ──► IntaSendAdapter (M-Pesa STK push)
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
| `gift_automation._finalize_order` / `_finalize_custom_order` | USD default for Hazina; KES only when guest asks for M-Pesa/STK/KES |
| `ai/tools.request_mpesa_payment` | Accepts `currency`, `amount_usd`; returns `redirect_url` |
| `channels/base._resend_pending_payment_reply` | Re-reads pending order currency; resends STK or fresh secure card checkout link |

### 4.2 Order payment fields (`order.details`)

| Field | Set by | Purpose |
|---|---|---|
| `payment_currency` | `create_order` tool, gift automation | `KES` or `USD` |
| `amount_usd` | USD/card checkout path | Card checkout charge amount |
| `items` | All order paths | Line items with `sku_or_name`, `qty`, `unit_price` |
| `delivery_location` | Automation / AI | Hotel or JKIA terminal |
| `departure_time_iso` | JKIA flow | Flight departure capture |
| `fulfillment_status` | Checkout | `pending_payment` → dispatch states |
| `order_type` | Custom box | `custom_box` |
| `treasure_skus` | Custom box | List of `HN-T-xxx` SKUs |
| `product_id` | Collection checkout | e.g. `kenya-edit` |
| `fast_path` | Automation | `hazina_gift_checkout`, `hazina_custom_box`, `llm_tool` |
| `public_reference` | `order_tracking.ensure_order_tracking` | Guest-facing `HN-ORD-{uuid8}` |
| `tracking_token` | Same | Magic-link secret; required on portal + public API |
| `courier_note` | Ghost Ops `!dispatch` / future courier webhook | Shown on tracking timeline when `out_for_delivery` |

**Public API:** `GET /api/public/orders/{HN-ORD-…}?token=…` → payload for portal (rate-limited).  
**Portal:** `hazina-portal/app/orders/[id]/page.tsx` server-fetches via `BACKEND_URL`.

### 4.3 Phase 1 — Day 1–30 (Hybrid stack)

| Rail | Provider | Status | Notes |
|---|---|---|---|
| KES M-Pesa STK | IntaSend | ✅ | `PAYMENT_PROVIDER=intasend` on Render |
| USD cards | Paystack first, IntaSend fallback | ✅ Code wired | Use Paystack when approved; IntaSend hosted checkout can carry card links for now |
| Resend payment | Both | ✅ | "resend STK", "resend link", "checkout link", etc. |
| Callback | `/payments/intasend/callback`, `/payments/paystack/callback` | ✅ Adapters exist | Verify webhook secrets in provider dashboards |

### 4.4 Phase 2 — Scale ($5k–$10k/mo)

| Rail | Provider | Status |
|---|---|---|
| International travel payments | DPO Group | ⬜ Apply after volume proof |

### 4.5 Global shipping

| Component | Status | Path |
|---|---|---|
| AI quote tool | ✅ **Stub** | `app/ai/tools.py` → `calculate_dhl_shipping` |
| Real DHL rate API | ⬜ TODO | Replace weight-band stub |
| Frontend option | ✅ | Collection and custom-box checkout workflows include Hotel, JKIA, and DHL/export modes |

**Stub behaviour:** weight bands → USD estimate, `stub: true` in response, 3–5 business day lead. Payment should start only after the guest accepts the courier quote.

---

## 5. Physical sourcing & fulfillment

**Status: blueprint only — no in-repo automation.**

### 5.1 Packaging & photography

- [ ] 10× matte-black rigid magnetic-closure boxes (Industrial Area / packaging suppliers)
- [ ] Branded cream tissue, wax seals or premium logo stickers
- [ ] Product shots: natural light, wood/marble surface — **no stock photos**
- [x] Upload treasure photos to portal — **60 files in `public/treasures/`**, with generated collection composites removed
- [ ] Supply exact collection photos for all 5 curated boxes before hard launch
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
| JKIA express story | ✅ redirect | `/last-minute-kenya-gifts-jkia` → `/collections/departure-drop` |
| Safari souvenirs Nairobi | ✅ | `/premium-safari-souvenirs-nairobi` |
| Treasure browse | ✅ | `/build` (+ 30 `/treasures/[id]` detail pages) |
| Custom box builder | ✅ | `/build` (`PackBuilder`) |
| Hosts B2B (ghost) | ✅ noindex | `/hosts-guides` → `/partners/login` |
| TikTok / short video | ⬜ External | "Departure Drop to Terminal 1A in 3 hours" narrative |

---

## 7. Seven-day launch sequence

| Day | Workstream | Blueprint intent | In-repo status |
|---|---|---|---|
| **1** | Digital real estate | Domains, social handles, logo, Paystack application | ⬜ **External** — user-owned |
| **2** | Tech pivot — tenant | Postgres tenant `hazina-nomads`, env prep | ✅ Seed: 5 collections, 30 treasures, 46 KB chunks, `menu_photos` |
| **2–3** | Tech pivot — frontend | Standalone Hazina portal | ✅ `hazina-portal/` — 51 routes (§9.1) |
| **3** | Physical prototyping | Source coffee, beadwork, rigid boxes; assemble prototype | ⬜ **External** |
| **3** | WhatsApp + AI tools | Hazina menus, delivery fields, hybrid pay | ✅ See §10–§12 |
| **4** | Media production | Product photography → WA Catalog + website | ✅ 60 portal assets and collection/treasure `menu_photos` keys; ⬜ exact no-watermark collection photos + Meta Catalog sync |
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
| **Location** | Nairobi — Westlands, Kilimani, Karen, JKIA delivery, DHL export quote |
| **Phone** | `+1 555 657 8220` (current Meta/AI automation route) |
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
| `currency` | string | `"USD"` |
| `currency_display` | string | `"USD first, KES equivalent"` |
| `usd_pricing` | bool | `true` |
| `payment_methods` | array | M-Pesa (IntaSend), Paystack USD |
| `custom_orders` | bool | `true` |
| `corporate_gifting` | bool | `true` |
| `delivery_zones` | array | Westlands, Kilimani, Karen, JKIA, DHL export quote |
| `international_shipping` | object | enabled, carrier preference, quote-before-payment |
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
| `KB_CATALOG` | **37** | 5 collections + custom-box policy + international-shipping policy + 30 treasures |
| `KB_POLICIES` | **9** | Delivery, JKIA, hotel, late dispatch, international shipping, custom boxes, payments, brand, contact |
| **Total** | **46** | Re-embed deletes old chunks for tenant before ingest |

**Seed side effects:**

- Upserts `businesses` row by slug
- Claims `meta_wa_phone_number_id` from env for Hazina and clears the same id
  from any other tenant before assignment
- Builds `menu_photos` from `PUBLIC_HAZINA_PORTAL_URL` (default `https://hazina.lesnarai.co.ke`)

### 8.4 Environment variables (cutover)

Documented in `.env.example`. **Do not flip production secrets until Day 7 decision.**

```bash
# ── Tenant routing ──
DEFAULT_BUSINESS_SLUG=hazina-nomads          # render.yaml + config default
DEMO_BUSINESS_SLUG=lily-pond-cafe            # KES 10 demo espresso — café tenant only
HAZINA_CLAIMS_META_PHONE=true                # configured Meta phone id routes to Hazina during cutover

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

# ── Ghost Ops (Hazina fulfillment admins) ──
ADMIN_WA_NUMBERS=+2547XXXXXXXX,+2547YYYYYYYY   # E.164; comma-separated; API service only

# ── Payments (hybrid) ──
PAYMENT_PROVIDER=intasend
PAYMENT_SIMULATOR=false
INTASEND_API_TOKEN=
INTASEND_PUBLISHABLE_KEY=
INTASEND_TEST_MODE=false
INTASEND_WEBHOOK_SECRET=
PAYSTACK_SECRET_KEY=                         # Preferred USD/card rail once approved
PAYSTACK_PUBLIC_KEY=

# ── hazina-portal/ (Render hazina-portal service) ──
NEXT_PUBLIC_HAZINA_WHATSAPP=15556578220
NEXT_PUBLIC_HAZINA_PHONE=+15556578220
NEXT_PUBLIC_BACKEND_URL=https://api.lesnarai.co.ke
BACKEND_URL=https://api.lesnarai.co.ke
```

**Render secrets (`sync: false`):** all Meta WA keys, IntaSend keys, Paystack keys when approved, `NEXT_PUBLIC_HAZINA_*`.

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

# 5. Portal build (51 routes — see §9.1)
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
3. `HAZINA_CLAIMS_META_PHONE=true` while Hazina owns the configured Meta number
4. `ADMIN_CORS_ORIGINS` — include `https://hazina.lesnarai.co.ke`
5. `NEXT_PUBLIC_HAZINA_WHATSAPP` / `NEXT_PUBLIC_HAZINA_PHONE` on `hazina-portal`
6. `INTASEND_API_TOKEN` for STK + card-link fallback; `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` once Paystack is approved
7. Re-run `scripts/seed_hazina_nomads.py` after Meta phone id is set

**Smoke test after cutover:**

1. Greet → Hazina main menu (Shop | Corporate | Concierge | Track)
2. Shop → 5 collections → tap Kenya Edit → delivery prompt → STK
3. `/build` handoff message with 2+ SKUs → delivery → STK or secure card checkout link
4. "resend STK" / "resend link" on pending order
5. Photo request during a draft checkout → photo reply, not payment start
6. "cancel checkout" during a draft checkout → draft cleared
7. Free-form Q&A → AI `create_order` → automatic payment handoff

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

### 9.1 Routes (~48 at build, 2026-06-01)

**Permanent redirects** (`next.config.mjs`): `/treasures` → `/build`; `/last-minute-kenya-gifts-jkia` → `/collections/departure-drop`.

| Route | In public nav? | File | Purpose |
|---|---|---|---|
| `/` | — | `app/page.tsx` | Hero + 4 path cards (Safari, Collections, Build, JKIA/Departure Drop) — no full product grid |
| `/collections` | ✅ | `app/collections/page.tsx` | 5 `CollectionCard`s |
| `/collections/[id]` | via cards | `app/collections/[id]/page.tsx` | Inside-the-box + `CollectionCheckout` |
| `/build` | ✅ | `app/build/page.tsx` | **Canonical** treasure browse + `PackBuilder` cart |
| `/treasures` | — | — | **301 → `/build`** (no `page.tsx`) |
| `/treasures/[id]` | via build | `app/treasures/[id]/page.tsx` | Detail; back → `/build`; `?add=` for box |
| `/premium-safari-souvenirs-nairobi` | ✅ Safari | `app/premium-safari-souvenirs-nairobi/page.tsx` | Safari SEO landing |
| `/last-minute-kenya-gifts-jkia` | — | — | **301 → `/collections/departure-drop`** |
| `/about` | ✅ | `app/about/page.tsx` | Brand story |
| `/hosts-guides` | **hidden** | `app/hosts-guides/page.tsx` | B2B pitch; `robots: noindex`; CTAs → `/partners/login` |
| `/partners/login` | **hidden** | `app/partners/login/page.tsx` | Env auth; `noindex` |
| `/partners/dashboard` | **hidden** | `app/partners/dashboard/page.tsx` | Referral code + placeholder earnings |
| `/api/chat` | — | `app/api/chat/route.ts` | Proxy → backend |
| `/api/catalog` | — | `app/api/catalog/route.ts` | Catalog JSON + media probe |
| `/api/health` | — | `app/api/health/route.ts` | Backend health proxy |
| `/api/partners/login` | — | `app/api/partners/login/route.ts` | Partner session cookie |
| `/api/partners/logout` | — | `app/api/partners/logout/route.ts` | Clear session |
| `/orders/[id]` | **hidden** | `app/orders/[id]/page.tsx` + `app/orders/layout.tsx` | Live tracking; `?token=`; obsidian shell; `noindex` |
| `/api/orders/[id]` | — | `app/api/orders/[id]/route.ts` | Proxy → `GET /api/public/orders/{ref}?token=` |

**SSG:** 5 collection slugs + 33 treasure slugs. **Dynamic:** `/orders/[id]` (token query). **Middleware:** `middleware.ts` guards `/partners/dashboard`.

**Removed (do not document as active):** `app/treasures/page.tsx`, `TreasureExplorer`, `TreasureCard`, `TrustRow`, `ConciergePromptButton`, JKIA standalone page.

**Error boundaries:** `app/error.tsx`, `app/global-error.tsx`

No `/cafes`, `/map`, or `/owners` — those live only in `gen-eat-portal/`.

### 9.2 Navigation & footer links

**Nav (`components/Nav.tsx`):** Collections · Build · Safari · About · **Chat in app** · **Order on WhatsApp**. Theme toggle + mobile drawer. **Not linked:** Treasures index, JKIA URL, Hosts, partner pages.

**Footer (`components/Footer.tsx`):** All collections · Safari souvenirs · Kenya Edit · **JKIA Departure Drop** (collection URL, not old JKIA page) · Build custom box · Our story · email · phone · dispatch hours. **No hosts link.**

### 9.3 Components & data (current)

| Asset | Path | Notes |
|---|---|---|
| Curated collections | `lib/products.ts` | `GIFT_BOXES`, `itemIds[]`, `BRAND`, images |
| Individual treasures | `lib/treasures.ts` | 30 SKUs; packaging excluded from build grid |
| Format helpers | `lib/format.ts` | `formatUSD`, `formatKES`, `whatsappLink` |
| Order tracking fetch | `lib/orderTracking.ts`, `lib/backend.ts` | Server fetch → FastAPI public orders API |
| Collection card | `components/CollectionCard.tsx` | Image link + stacked prices + View details / Add to box / Ask concierge |
| Collection checkout | `components/CollectionCheckout.tsx` | Delivery/payment → chat handoff |
| Pack builder | `components/PackBuilder.tsx` | Browse, mobile-safe grid, cart, deferred delivery form, category filters |
| Product image | `components/ProductImage.tsx` | Safari landing imagery |
| Catalog image | `components/CatalogImage.tsx` | Fallback frame |
| Catalog sync badge | `components/CatalogSyncBadge.tsx` | `/api/catalog` |
| Sticky WhatsApp CTA | `components/StickyWhatsAppCTA.tsx` | Mobile fixed CTA where used |
| Partner UI | `PartnerLoginForm.tsx`, `PartnerSignOutButton.tsx` | Login wall |
| Smart back link | `components/SmartBackLink.tsx` | Context-aware back |
| Nav / Footer / Chat | `Nav.tsx`, `Footer.tsx`, `ChatWidget.tsx` | `business_slug=hazina-nomads` |
| Theme | `ThemeToggle.tsx`, `app/layout.tsx` | `next/font` Inter, Cormorant, DM Mono |

### 9.4 Image library

| Location | Files | Notes |
|---|---|---|
| `docs/pictures/` | 49+ | Master archive |
| `public/treasures/` | 60 | Slug-renamed for Next.js image rendering; all referenced collection and treasure images resolve locally |
| `public/products/` | 0 | Removed to avoid stale duplicate collection images |
| `public/brand/` | 1 | `safari-sunset.jpg`; other brand context reuses direct treasure photography |
| `public/treasures/generated/` | 0 | Removed; no generated subfolder is served |

Treasure image paths are mirrored in `HAZINA_TREASURE_IMAGES` in Python catalog for `menu_photos`. `HAZINA_COLLECTION_IMAGES` maps all five collections to optimized JPEG hero derivatives now, while the larger PNGs remain as master/provisional source visuals. Replace them with exact no-watermark finished-box photos before premium launch. Verify refs:

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

**Dev script (`scripts/dev-hazina.sh`):**

1. Kills stale listeners on the target port (default **3004**, override `HAZINA_DEV_PORT`)
2. Optional `--clean` wipes `.next`
3. Runs `next dev` — **hot reload**; refresh browser after saves
4. Optional CSS sanity warning on startup

**Preview script (`scripts/preview-hazina.sh`):**

1. Kills stale Next processes on 3001–3005
2. Deletes `.next`, `npm run build`, `next start` on **3004** (`HAZINA_PREVIEW_PORT`)

API for the chat widget: `make dev` in another terminal (:8000). Backend health is no longer shown in customer navigation; if chat is unavailable, the visible fallback remains the WhatsApp order CTA.

### 9.6 Troubleshooting — portal looks like unstyled HTML

**Symptom:** Default browser fonts, blue underlined links, Times/serif body text — images may still load.

**Root causes (in order of likelihood):**

| Cause | How to tell | Fix |
|---|---|---|
| **CSS hash mismatch** | HTML references `/_next/static/css/OLD.css`; curl returns **400/404 HTML** not `text/css` | Stop all `next start`/`next dev`, run `make preview-hazina` |
| **Stale zombie dev server** | Port listens but curl **hangs** | Kill in terminal (Ctrl+C) or `fuser -k 3004/tcp`, then `make dev-hazina` |
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
| `lp:prod:kenya-edit` | The Kenya Edit — USD 249 |
| `lp:prod:highland-treasure` | Highland Treasure — USD 199 |
| `lp:prod:nomad-leather-set` | Nomad Leather Set — USD 329 |
| `lp:prod:safari-romance-box` | Safari Romance Box — USD 449 |
| `lp:prod:departure-drop` | Departure Drop — USD 349 · 4h JKIA |

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
| `parse_custom_box_handoff` | Brief → SKU lines, monogram fees, bespoke note |
| `ParsedCustomBox` | `bespoke_note`, `monogram_notes` on dataclass |
| `detect_payment_currency` | KES vs USD from guest text |
| `should_pause_checkout_for_customer_request` | Lets photo/status turns escape draft checkout state |
| `looks_like_checkout_cancel` | Clears draft checkout before it can be misread as a delivery address |
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
2. **Order this box** → choose quantity, delivery mode, and payment preference
3. **Start guided checkout** → portal chat asks name, exact delivery point,
   timing, payment contact, and confirmation
4. Only after confirmation does the portal chat send the complete structured
   automation payload to the backend, which creates the order and starts
   Paystack or M-Pesa

**Web — build custom box**

1. `/treasures` or `/build` → select 2+ items + packaging
2. Choose delivery and payment preference in the sidebar
3. **Continue guided checkout** → portal chat asks missing details one at a time
4. Automation receives SKUs + confirmed delivery/payment fields → creates
   order → Paystack URL or STK

**WhatsApp — collection order**

1. Guest taps a collection or says `order Kenya Edit`
2. `gift_automation` stores `gift_checkout:{conv_id}` and asks for one missing
   detail at a time: name → delivery mode → location → window → payment →
   contact → confirm
3. Payment starts only after the final confirmation

**WhatsApp — catalog request (fast path, no LLM)**

1. Guest: *"What do you sell?"* or *"show me your collections"*
2. Automation returns catalog copy + interactive 5-product list
3. Tap collection → same checkout flow as menu Shop path

**WhatsApp — collection (fast path, no LLM)**

1. Greet → main menu
2. Shop → product list → tap Kenya Edit
3. Ask delivery location → JKIA asks departure
4. `create_order_and_request_payment` → STK (KES) or link (USD)

**WhatsApp — private sourcing brief (fast path)**

1. Paste `/build` handoff (2+ SKUs; optional `Monogram:` and `Bespoke requests:`)
2. Automation ack: reference photos welcome → asks name (step-by-step checkout)
3. Same JKIA departure sub-flow if needed
4. Order type `custom_box`; monograms/bespoke in delivery notes → payment → tracking link

**WhatsApp — AI + automation handoff**

1. *"Do you deliver to Hemingways Karen?"* → RAG + AI
2. *"I'll take the Kenya Edit for room 412, pay by card"* → AI `create_order` with `payment_currency=USD`
3. `finalize_checkout_from_ai` → secure card checkout link in reply

**WhatsApp — payment resend**

1. Pending order exists
2. Guest: *"resend link"* (USD) or *"resend STK"* (KES)
3. Fresh payment prompt

**WhatsApp — checkout interruption guard**

1. Draft collection/custom checkout is awaiting delivery details
2. Guest asks for a photo, says `no STK yet`, or cancels checkout
3. Automation does not treat that message as a hotel/JKIA/DHL address; photo/status/cancel paths handle it first

### 10.5 Hybrid automation architecture

```
Inbound WhatsApp (hazina-nomads)
    │
    ├─ Menu tap (lp:shop / lp:prod:*) ──► gift_automation (no LLM)
    ├─ Catalog request ("menu", "shop", …) ► gift_automation → product list (no LLM)
    ├─ Custom box SKU message ──────────► gift_automation (no LLM)
    ├─ Track / Corporate ───────────────► gift_automation (no LLM)
    ├─ Draft checkout interrupt ────────► photo/status/cancel path
    ├─ Resend STK / link ───────────────► base.py payment resend
    ├─ Greeting ────────────────────────► main menu payload
    │
    └─ Free-form ──► LangGraph + RAG + tools (OpenAI primary, Groq fallback)
            │
            └─ create_order ──► finalize_checkout_from_ai ──► hybrid payment
```

### 10.6 Café tenants (unchanged)

When slug ≠ `hazina-nomads`: Order, See menu, Pay, Track, My orders, Talk to staff, Exit.

### 10.7 Ghost Ops & order tracking

**Order in `channels/base.py` (Hazina):**

1. `try_handle_ops_command` — admin `!dispatch` / `!delivered` (silent for non-admins)
2. Gift automation fast paths (menu, catalog, custom brief, track, checkout)
3. Payment resend / stale STK
4. LLM + RAG fallback

**Env:** `ADMIN_WA_NUMBERS` — comma-separated E.164 numbers on the **API** service (`app/core/config.py`).

**Tracking:** every Hazina order creation path should call `ensure_order_tracking` so payment success can include `/orders/HN-ORD-…?token=…`.

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
| `amount_usd` | Required for USD/card checkout amount |

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
| **Standalone portal** | `hazina-portal/` | ✅ 51 routes (see §9.1) |
| **Collections (portal)** | `hazina-portal/lib/products.ts` | ✅ |
| **Treasures (portal)** | `hazina-portal/lib/treasures.ts` | ✅ |
| **KB sync service** | `app/services/hazina_kb.py` | ✅ `sync_hazina_knowledge_base` + treasure chunks |
| **Portal API** | `app/api/chat`, `catalog`, `health`, `partners/*` | ✅ |
| **Collection checkout** | `components/CollectionCheckout.tsx` | ✅ |
| **Pack builder** | `components/PackBuilder.tsx` | ✅ Private brief: monograms, bespoke textarea, engraving totals |
| **Order tracking UI** | `app/orders/`, `lib/orderTracking.ts` | ✅ Magic-link page; noindex; no public nav |
| **Public orders API** | `app/api/public_orders.py` | ✅ Token-gated GET |
| **Ghost Ops** | `app/services/ops_automation.py` | ✅ Admin WA commands; 500-order scan limit |
| **Partner portal** | `app/partners/*`, `middleware.ts` | ✅ Env login; placeholder earnings |
| **Theme + mobile UX** | `Nav.tsx`, `ThemeToggle`, `StickyWhatsAppCTA` | ✅ Bronze concierge CTA; no TrustRow |
| **Safari landing** | `app/premium-safari-souvenirs-nairobi/` | ✅ |
| **JKIA URL** | `next.config.mjs` redirect | ✅ → `/collections/departure-drop` |
| **Hosts landing (ghost)** | `app/hosts-guides/` | ✅ noindex; not in nav |
| **Treasure list page** | — | ❌ Removed; `/treasures` → `/build` |
| **Image library** | `public/treasures/` (65 files) | ✅ All 30 treasures and 5 collection image slots mapped; collection heroes use optimized derivatives of the strongest available provisional pack visuals |
| **menu_photos seed** | `build_hazina_menu_photos()` | ✅ Collection, treasure, menu, and brand absolute URLs in profile |
| **Dev launcher** | `scripts/dev-hazina.sh`, `make dev-hazina` | ✅ CSS health check on startup |
| **Preview launcher** | `scripts/preview-hazina.sh`, `make preview-hazina` | ✅ Rebuild + stable prod server (:3004) |
| **Fonts + layout** | `app/layout.tsx` (`next/font`) | ✅ Self-hosted Inter, Cormorant, DM Mono |
| **Image optimization** | `sharp` dependency in `hazina-portal/package.json` | ✅ Next production image optimizer enabled |
| **ESLint** | `hazina-portal/.eslintrc.json` | ✅ `next/core-web-vitals` |
| **Asset checker** | `scripts/check_asset_images.py` | ✅ Portal image ref audit |
| **Error boundaries** | `app/error.tsx`, `app/global-error.tsx` | ✅ |
| Paystack live checkout | Render secrets | ⬜ Needs merchant keys |
| Meta Catalog sync | External | ⬜ Photos ready in profile |
| Host affiliate ledger / payouts | — | ⬜ Dashboard placeholder only |
| Per-host partner auth | — | ⬜ Single env login only |
| Real DHL API | `calculate_dhl_shipping` | ⬜ Stub |
| Physical fulfillment | — | ⬜ Blueprint |

---

## 13. Testing

### 13.1 Automated tests

Current local verification on **2026-06-01**:

- `make test-hazina` → **76 passed**, 1 warning
- `make test-fast` → **172 passed**, 1 warning (broader suite)
- `make doctor-hazina-live` → passed on 2026-06-01 against `api.lesnarai.co.ke`
  with no payment confirmation; catalog reply, checkout start, and name →
  delivery step all passed
- `make doctor-hazina-api` → after the 2026-06-01 manual migration and Render
  `dockerCommand` repair, deep health is OK and Hazina replies work; the check
  still fails the latency gate because the existing API service is Frankfurt
  while Hazina DB/Redis are Oregon
- `cd hazina-portal && npm run typecheck` → passed
- `cd hazina-portal && npm run lint` → passed
- `cd hazina-portal && npm run build` → passed, **51 routes** (static pages + API routes + middleware)
- live API `/version` after push → commit `43779d8`; live Hazina backend probes for catalog, collection photo, custom checkout, and checkout cancel passed
- `https://hazina.lesnarai.co.ke` DNS did not resolve from this workspace on 2026-06-01; fix DNS / portal deploy before public launch
- `npm audit --omit=dev` → `next@14.2.18` advisories; major upgrade before hardened prod
- `scripts/check_asset_images.py` → image ref audit
- Manual QA pages: `/`, `/collections`, `/collections/kenya-edit`, `/build`, `/premium-safari-souvenirs-nairobi`, `/hosts-guides` (ghost), `/partners/login`; confirm `/treasures` and `/last-minute-kenya-gifts-jkia` redirect

```bash
make test-hazina

# broader fast confidence suite
make test-fast

# safe hosted Hazina checks; these do not trigger STK/card payment
make doctor-hazina-live
make doctor-hazina-api

# portal
cd hazina-portal && npm run typecheck && npm run lint && npm run build

# stable styled preview (recommended for visual QA)
make preview-hazina
```

| Test file | Covers |
|---|---|
| `test_whatsapp_menus.py` | Hazina main menu, product list, interactive IDs |
| `test_gift_automation.py` | Product resolve, custom box parse (qty, monogram, bespoke), currency, catalog intent |
| `test_order_tracking.py` | `ensure_order_tracking`, public payload, token gate |
| `test_ops_automation.py` | `!dispatch` / `!delivered`, admin allowlist |
| `test_payment_routing.py` | KES→IntaSend, USD→Paystack, missing keys error |
| `test_ai_tools_payment.py` | USD redirect_url, create_order USD details, menu_photos builder |
| `test_channel_fallbacks.py` | Resend STK/link, pending order flows |
| `test_menu_photos.py` | Fuzzy photo matching, unknown-specific-photo guard, generic collection photos |
| `test_payments_hardening.py` | Payment retry, `resolve_payment_service` mocks |

### 13.2 Manual checks

```bash
# Full dev stack
make dev                    # API :8000
make dev-hazina             # Portal dev :3004 (hot reload)
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
- [ ] STK arrives (KES) or secure card checkout link arrives (USD/card)
- [ ] Custom box message with 2+ SKUs → automated checkout
- [ ] During a draft checkout, ask for a collection photo → image reply, no payment attempt
- [ ] During a draft checkout, send `cancel checkout` → draft cleared
- [ ] "resend STK" / "resend link" works
- [ ] Track delivery returns order status
- [ ] Corporate → escalation flag
- [ ] `/build` brief with monogram + bespoke → WA photo-upload ack
- [ ] After payment, tracking link opens `/orders/HN-ORD-…?token=…`
- [ ] Admin `!dispatch HN-ORD-… Courier` updates guest tracking timeline

---

## 14. Blockers & decisions needed

| # | Decision | Owner | Blocks |
|---|---|---|---|
| 1 | **Live WhatsApp number** + Meta `phone_number_id` | User | Real customer WA |
| 2 | **Paystack merchant approval** + live keys on Render | User | Preferred USD/card rail; IntaSend checkout link covers interim card payments |
| 3 | **Domain** `hazina.lesnarai.co.ke` DNS live | User | Public SEO / trust |
| 4 | **Re-seed production KB** after deploy | Eng/Ops | RAG knows 33 treasures + brief policies |
| 5 | **`ADMIN_WA_NUMBERS` on production API** | Ops | Ghost Ops dispatch from ops phone |
| 6 | **Commit + push luxury brief + catalog** | Eng | Production `/build` and parser parity |
| 7 | **Push local commits + redeploy** | Eng/Ops | Production may lag until `origin/main` updated |
| 8 | **Product photography** in physical boxes | User | Fulfillment quality |
| 9 | **Courier contract** | User | Last-mile SLA |
| 10 | **Terracotta vs bronze hex** alignment | Design | Brand consistency |
| 11 | **Meta WhatsApp Catalog** merchant setup | User/Ops | In-chat product photos |
| 12 | **Local portal styling** | Eng | Prefer `make dev-hazina` (:3004); use `make preview-hazina` if CSS looks broken (§9.6) |
| 13 | **Next.js security upgrade path** | Eng | Hardened public production; `npm audit --omit=dev` currently wants a major Next upgrade |

**Completed (no longer blockers):**

- ~~Sync treasures to seed/RAG~~ → `app/catalog/hazina_catalog.py` (re-seed when count changes)
- ~~Paystack routing code~~ → `resolve_payment_service`
- ~~Custom box WhatsApp automation~~ → SKU parser in `gift_automation.py`
- ~~Safari SEO landing~~ → `/premium-safari-souvenirs-nairobi`
- ~~Duplicate browse routes~~ → `/build` only; `/treasures` redirects
- ~~JKIA duplicate landing~~ → redirect to Departure Drop collection
- ~~Public hosts nav~~ → ghost page + `/partners/login`
- ~~menu_photos in profile~~ → `build_hazina_menu_photos()` (collection, treasure, menu, and brand keys)
- ~~WhatsApp catalog menu intent~~ → `looks_like_hazina_catalog_request`
- ~~Magic-link order tracking~~ → `/orders/[id]`, `order_tracking.py`, public API
- ~~Ghost Ops manual dispatch~~ → `ops_automation.py` (courier webhook still open)
- ~~Guided portal checkout~~ → `ChatWidget` step machine + `gift_automation` draft checkout
- Collection hero images → mapped to the stronger pack visuals and visible, but still provisional until exact no-watermark Hazina product photos replace them
- ~~Portal unstyled HTML (CSS mismatch)~~ → `make preview-hazina` + §9.6

---

## 15. Release checklist

Use before any production tag or Hazina cutover (§8.6).

- [ ] Run `alembic upgrade head` in staging
- [ ] Run seed: `PYTHONPATH=. ./.venv/bin/python scripts/seed_hazina_nomads.py`
- [ ] Run Hazina pytest suite (§13.1)
- [ ] Run `make doctor-hazina-live`
- [ ] Run `make doctor-hazina-api` before pointing public Hazina traffic at the
      dedicated API service
- [ ] Run `make eval-whatsapp-local`
- [ ] `cd hazina-portal && npm run build` — confirm 51 routes (§9.1)
- [ ] Confirm redirects: `/treasures` → `/build`, JKIA URL → departure-drop
- [ ] Set `PARTNER_PORTAL_*` on Render if using partner dashboard
- [ ] `cd hazina-portal && npm run lint` — no errors
- [ ] `cd hazina-portal && npm audit --omit=dev` — accepted or fixed before hardened production
- [ ] `make preview-hazina` — confirm CSS loads (§9.6)
- [ ] Set Render secrets: Meta WA, IntaSend, Paystack, `NEXT_PUBLIC_HAZINA_*`, `ADMIN_WA_NUMBERS`
- [ ] Smoke `/build` brief with monogram + bespoke → WhatsApp ack + tracking link after pay
- [ ] Add `https://hazina.lesnarai.co.ke` to `ADMIN_CORS_ORIGINS`
- [ ] Live smoke: menu → order → STK + USD link rehearsal
- [ ] Tag release and publish changelog

---

## 17. Status & flaws

Moved to [SYSTEM.md](SYSTEM.md) §1 §9 §10. Do not edit here.

---

## 16. Related documents

| Doc | Relationship |
|---|---|
| [docs/SYSTEM.md](SYSTEM.md) | **Single source of truth** for whole system |
| [README.md](../README.md) | Extended platform reference appendix |
| [SECURITY.md](../SECURITY.md) | Security audit findings and hardening |
| [hazina-portal/README.md](../hazina-portal/README.md) | Hazina portal quick commands |
| [gen-eat-portal/README.md](../gen-eat-portal/README.md) | Gen-Eat café demo portal (separate) |
| [docs/archive/](../archive/) | Archived Gen-Eat-era and superseded deploy guides |

**Status changes** → [docs/SYSTEM.md](SYSTEM.md). **Brand/ops detail** → this file.
