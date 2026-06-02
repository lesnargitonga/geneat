# SYSTEM — single source of truth

**Scope:** Gen-Eat platform + Hazina Nomads + shared API (`api.lesnarai.co.ke`).  
**Maintain:** edit this file first when product, routing, catalog, deploy, or gaps change. Code wins if docs drift.  
**Verified:** 2026-06-02 · `git log -1 --oneline` · `git status -sb`  
**Security:** [SECURITY.md](../SECURITY.md)

**Legend:** ✅ shipped in code · 🟢 verified live · ⬜ not done · ◐ partial

---

## 1. Status matrix

| Area | Code | Live | Blocker / note |
|---|---|---|---|
| Shared API | ✅ | 🟢 | `api.lesnarai.co.ke`; `make doctor-hazina-live` passed on 2026-06-01 |
| Dedicated Hazina API service | ✅ | ◐ | `hazina-api.onrender.com` is same code; schema/pgvector repaired, but existing service is still Frankfurt while Hazina DB/Redis are Oregon, so latency gate fails |
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
| RAG / menu_photos | ✅ | 🟢 | Shared API has pgvector + KB rows; dedicated Hazina DB now has pgvector + Hazina KB after 2026-06-01 repair |
| Resilience contracts (Sections 1-4) | ✅ | 🟢 | Routing, payload boundary, AI timeout/input budget, and user-facing error sanitization are enforced by pytest suites + pre-commit |
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
  → FastAPI → `whatsapp.inbound` durable job (ACK within 3s) → tenant resolve → Redis lock/idempotency
  → [Hazina] ops_automation → gift_automation → pay resend
  → [Café] cafe_automation
  → else LangGraph + RAG + tools
  → Postgres (+ pgvector) · Redis (gift_checkout:*)
  → IntaSend (KES M-Pesa + card-link fallback) · Paystack (preferred USD card)
```

**No separate Hazina codebase.** The dedicated `hazina-api` Render service runs
the same FastAPI app and must pass the same `/health/deep` + Hazina doctor
checks before it becomes the public API target.

**Current API target:** keep Hazina portal and WhatsApp on
`https://api.lesnarai.co.ke` until the dedicated Hazina API service is recreated
in Oregon or otherwise co-located with its DB/Redis. `hazina-api` is functional
after migration, but cross-region DB/Redis latency makes it unsuitable as the
primary public endpoint.

**Resilience armor in code (current):**
- Meta webhook ACK is decoupled via durable `whatsapp.inbound` jobs.
- AI turn execution is bounded with `asyncio.wait_for` and one retry window.
- Inbound AI text is truncated to `2000` chars before inference (`_bounded_ai_input`).
- User-facing 500 responses are sanitized by global exception handler (no traceback leakage).
- Public order tracking requires tokenized access (`/api/public/orders/{ref}?token=...`).

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
5. **Observability (mandatory on API service):** `SENTRY_DSN` · `sentry_traces_sample_rate=0.2` · log drain to your aggregator (Render → Axiom/Datadog/etc.)
* `omni_ai_input_truncated_total` (Counter): Tracks how frequently inbound user messages exceed the `2000` character limit and are truncated before LLM inference. High spikes indicate potential prompt-stuffing attacks or bot spam.

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
| `SENTRY_DSN` | API | Error tracking — **required P0** |
| `SENTRY_TRACES_SAMPLE_RATE` | API | `0.2` recommended at launch |
| `ADMIN_API_TOKEN` | API + portal (server) | Admin console; **portal `/api/chat` proxy** in prod |
| `BACKEND_URL` | Portal | `https://api.lesnarai.co.ke` |
| `NEXT_PUBLIC_HAZINA_WHATSAPP` | Portal | CTA |

Full: `.env.example` · [README.md §19](../README.md).

### Tests

`test_routing_contract` · `test_payload_contract` · `test_resilience_contract` · `test_resiliency_user_facing` · `test_gift_automation` · `test_order_tracking` · `test_ops_automation` · `test_payment_routing` · `test_channel_fallbacks`

---

## 11. Operational hardening (Hazina OS)

**Purpose:** bulletproof field execution (catalog truth, sourcing, fulfillment, messaging, tracking, and fallbacks), not just backend features.

### 11.1 Core failure modes to prevent

1. Customer sees one thing, receives another.
2. Website/catalog/backend prices drift.
3. AI overpromises availability, delivery, or exact products.
4. Runner sourcing cannot keep pace with demand windows.
5. Quality outcomes are inconsistent.
6. Delivery coordination fails or arrives late.
7. Ops loses lifecycle visibility per order.
8. Premium online brand is not matched by offline execution.

### 11.2 Catalog contract (P0)

Every item/collection should be representable with these canonical fields:

- `id`
- `sku`
- `name`
- `category`
- `price_usd`
- `price_kes`
- `lead_time_hours`
- `is_engravable`
- `is_jkia_allowed`
- `is_custom_allowed`
- `availability_mode`
- `substitution_allowed`
- `image_disclaimer`
- `source_type`
- `included_item_ids`

Required CI checks before deploy:

- Python catalog count must equal portal catalog count.
- Every TS SKU must exist in Python source.
- Collection price must match frontend/backend.
- Every product must have USD and KES price.
- Every collection must have lead time.
- Frontend image paths must resolve.
- Engravable flags must match frontend/backend.
- Deprecated SKUs must not appear in WhatsApp menus.

Minimum contract:

- `HAZINA_COLLECTIONS` and portal `GIFT_BOXES` must match by SKU, name, price, and lead time.

### 11.3 AI promise-control policy (P0)

Rule: AI can collect intent; it cannot guarantee fulfillment until ops confirmation.

Allowed phrasing examples:

- "We can prepare a sourcing brief."
- "Our concierge will confirm availability."
- "Delivery is subject to confirmation of location, timing, and item availability."

Disallowed phrasing examples (unless system-confirmed):

- "Your items are reserved."
- "Delivery is guaranteed."
- "This exact piece is available."
- "We have secured your items."

RAG/brand guardrail requirement:

- Images reflect curation standards, not guaranteed identical stock.
- Final pieces may vary by artisan availability/material/finish.
- Concierge confirms availability before dispatch.

### 11.4 Substitution policy (P0)

Customer-facing baseline:

- Hazina is private sourcing; final pieces can vary slightly by color/finish/pattern/material.
- If a selected item is unavailable, concierge offers equivalent or higher-standard alternative before dispatch.

Internal substitution rules:

- Beadwork: similar pattern/value, same type.
- Coffee/tea: same or higher grade, similar size.
- Leather: same item type/grade, same personalization ability.
- Carvings: similar object/size/value range.
- Textiles: similar quality; customer approves major pattern changes.
- Art: confirm before substitution.
- Engraved items: no substitution after engraving starts.

Pre-dispatch customer check:

- "One item has a sourcing alternative available. Would you like to approve the replacement before we proceed?"

### 11.5 Fulfillment state machine (P0)

Recommended operational states:

1. `brief_received`
2. `awaiting_confirmation`
3. `sourcing_approved`
4. `runner_assigned`
5. `sourcing_in_progress`
6. `quality_check`
7. `packing`
8. `ready_for_dispatch`
9. `out_for_delivery`
10. `delivered`
11. `issue_pending`
12. `cancelled`

Tracking copy should stay premium and human-readable (e.g., "Sourcing in progress", "Quality check", "Ready for dispatch"), not raw internal codes.

### 11.6 Ghost Ops expansion (P0/P1)

Current command set is MVP. Target command set:

- `!orders`
- `!order HN-ORD-...`
- `!accept HN-ORD-...`
- `!runner HN-ORD-... <name> <phone>`
- `!sourcing HN-ORD-...`
- `!qc HN-ORD-...`
- `!packing HN-ORD-...`
- `!ready HN-ORD-...`
- `!dispatch HN-ORD-... <courier> <driver>`
- `!delivered HN-ORD-...`
- `!issue HN-ORD-... <note>`
- `!cancel HN-ORD-... <reason>`

Hard requirements:

- Strict admin whitelist enforcement (`ADMIN_WA_NUMBERS`).
- Audit log per command: admin number, command, order ref, previous status, new status, timestamp, note.

### 11.7 Ops dashboard MVP (P1)

Build functional admin UI (not design-heavy) with queues:

- New briefs
- Accepted
- Sourcing
- Quality check
- Ready for dispatch
- Out for delivery
- Issues
- Delivered today

Order card baseline:

- order ref, customer, WhatsApp, location, window/departure, items/SKUs, personalization notes, total, payment status, fulfillment status, runner, courier, internal note, customer-visible note.

Actions baseline:

- Accept, assign runner, mark sourcing/QC/packing/ready/dispatched/delivered/issue, send WhatsApp update.

### 11.8 Fulfillment SOP + sourcing discipline (P0/P1)

Codify and run every order through SOP:

- Brief intake checks (zone, hotel/terminal, timing, feasibility, personalization).
- Accept/escalate gates (JKIA urgency, rare items, high value, outside zone, exact-match requests).
- Runner assignment with sourcing constraints and quality notes.
- Quality checklist before packing.
- Packaging checklist + pre-seal photo.
- Dispatch instructions and closeout (delivery confirmation + review request).

Runner sourcing sheet should exist per SKU with:

- target photo
- acceptable alternatives
- max wholesale cost
- quality floor
- reject conditions
- preferred/back-up vendors
- expected sourcing time

### 11.9 Supplier scorecards (P1)

Track supplier quality/speed/reliability from day one:

- `quality_score`, `speed_score`, `reliability_score`, defects, replacement behavior, last order date.
- Tiering model: A (preferred), B (backup), C (emergency), banned.

### 11.10 Delivery and expectation controls (P0)

Delivery rules must be enforceable in automation and human playbooks:

- No JKIA under 4h without human override.
- No same-day outside-zone promises.
- No engraving under 24h without override.
- No Safari Romance under 48h without override.
- No dispatch after 20:00 without explicit late confirmation.
- No acceptance without reachable WhatsApp contact.
- No hotel delivery without hotel + room/front desk note.
- No terminal delivery without terminal + departure time.

Customer-facing FAQ must explicitly cover:

- photo/stock variance
- substitution approval flow
- urgency windows
- private sourcing model
- human handoff path

### 11.11 Incident taxonomy + message templates (P0/P1)

Track issues by category:

- `item_unavailable`
- `customer_unreachable`
- `delivery_delay`
- `supplier_quality_reject`
- `wrong_location`
- `engraving_error`
- `courier_failed`
- `customer_changed_time`
- `outside_zone_request`
- `substitution_declined`
- `refund_requested`

Each issue should carry internal note, customer-visible note, owner, and resolution status.

Maintain approved customer templates for:

- brief received
- accepted
- substitution request
- quality check
- ready
- dispatched
- delayed
- delivered

### 11.12 Observability + anti-confusion routing (P0)

Minimum watchlist:

- 5xx spike
- webhook durable-job failures
- AI timeout rate
- order creation failures
- catalog mismatch failures
- Ghost Ops unauthorized attempts
- token-invalid tracking spike
- DB latency spike
- Redis unavailability
- portal build/deploy failures

Tenant safety must remain continuously tested:

- Hazina never leaks café menus.
- Demo tenant never leaks Hazina catalog.
- Portal `business_slug` scoping remains strict.
- Stale mappings cannot override cutover intent.
- RAG/order/tracking remain tenant-scoped.

### 11.13 Rehearsal protocol (before real-money scale)

Run recurring operational rehearsals:

- Normal hotel order end-to-end.
- JKIA urgent order in valid window.
- JKIA invalid timing refusal/escalation.
- Item unavailable with substitution approval.
- Customer unreachable -> `issue_pending`.
- Engraving request with lead-time rule.
- Outside-zone request without overpromise.
- Tenant safety under mixed-intent prompts.

### 11.14 Roadmap (non-payment hardening)

P0 (before broader pilot):

1. Catalog sync CI contract.
2. AI no-overpromise policy enforcement.
3. Substitution policy published + enforced.
4. Expanded order state machine.
5. Ghost Ops command expansion (`accept/runner/issue/ready` minimum).
6. Premium tracking labels.
7. Sentry + log drain + resilience alerts.
8. Fulfillment SOP in active use.
9. Real sample-box proof assets.

P1 (month one):

1. Functional ops dashboard.
2. Supplier scorecards.
3. Runner sourcing sheets.
4. Admin notes + customer-visible notes.
5. Delivery proof workflow.
6. Message template rollout.
7. Partner/referral capture.

P2 (post-pilot scale):

1. Courier API/webhooks.
2. Partner ledger.
3. RLS completion.
4. Tracking-token rotation.
5. Real DHL integration.
6. Cost/margin automation.
7. Availability dashboard.
8. Multi-city expansion logic.

### 11.15 Execution tracker (daily operating control)

Use this tracker in standups; update `Status`, `Owner`, and `Last update` continuously.

| Workstream | Control | Status | Owner | Last update | Evidence |
|---|---|---|---|---|---|
| Catalog truth | Python/TS parity CI green | ✅ | Eng | 2026-06-02 | `tests/test_catalog_contract.py` + `make check-contracts` |
| AI promise control | No-overpromise policy enforced in prompts/guards | ✅ | Eng + Ops | 2026-06-02 | `app/ai/safety.py` + `tests/test_safety.py` |
| Substitution policy | Public policy published + WA approval flow active | ⬜ | Ops | 2026-06-02 | portal FAQ + sample WA transcript |
| Fulfillment states | 12-state machine mapped to order lifecycle | ◐ | Eng | 2026-06-02 | transition guardrails + premium timeline labels are live; DB-level canonical enum/state table still pending |
| Ghost Ops expansion | `!orders !order !accept !runner !sourcing !qc !packing !ready !dispatch !delivered !issue !cancel` live | ✅ | Eng + Ops | 2026-06-02 | `app/services/ops_automation.py` + `tests/test_ops_automation.py` |
| Tracking UX | Premium labels and customer-safe copy only | ✅ | Eng + Brand | 2026-06-02 | `app/services/order_tracking.py` + `tests/test_order_tracking.py` |
| SOP discipline | SOP actively used on every order | ⬜ | Ops lead | 2026-06-02 | SOP checklist records |
| Runner sourcing | SKU-level sourcing sheets in use | ⬜ | Ops | 2026-06-02 | sourcing sheets |
| Supplier reliability | Scorecards + tiering (A/B/C/Banned) active | ⬜ | Ops | 2026-06-02 | supplier register |
| Observability | Sentry + alert set + log drain verified | ⬜ | Eng | 2026-06-02 | alert config + test alert |
| Tenant safety | Anti-confusion routing tests always green | ✅ | Eng | 2026-06-02 | routing contract suite |
| Rehearsals | 8 scenario drills completed and signed off | ⬜ | Ops + Eng | 2026-06-02 | rehearsal runbook + outcomes |

Daily checklist:

- [ ] Review failures from `check-contracts` and webhook/job logs.
- [ ] Confirm no unresolved `issue_pending` older than SLA.
- [ ] Confirm today’s dispatch plan has assigned runner/courier per order.
- [ ] Confirm customer-visible messages used approved templates.
- [ ] Confirm any substitution had explicit customer approval.

---

## 12. Other docs

| File | Use |
|---|---|
| **SYSTEM.md** | **This file — only status authority** |
| [README.md](../README.md) | Architecture / API / scaling reference |
| [HAZINA_NOMADS.md](HAZINA_NOMADS.md) | Brand, SKU tables, launch, portal troubleshooting |
| [hazina-portal/README.md](../hazina-portal/README.md) | Portal commands only |

Do not add a second master doc.
