# System detanglement map — Gen-Eat / Hazina / Lesnar AI

Discovery output for the three-boundary separation. **Analysis only — no code
was moved, no repository was split, and no file outside this lab was touched.**

Method: per-file lexical ownership signal across `app/services/` (counts of
Hazina-domain vs Gen-Eat-domain terms), plus the Wave E architecture reading of
`app/db/models.py`, `business_config.py`, the channel/payment adapters and both
portals' backend resolution.

## Ownership signal (measured)

| Path | Hazina hits | Gen-Eat hits | Current owner | Target owner |
|---|---:|---:|---|---|
| `services/gift_automation.py` | 242 | 59 | shared | **Hazina** |
| `services/whatsapp_menus.py` | 138 | 39 | shared | **Hazina** (Gen-Eat needs its own menu surface) |
| `services/hazina_faq.py` | 142 | 21 | shared | **Hazina** |
| `services/hazina_deterministic_gate.py` | 64 | 10 | shared | **Hazina** |
| `services/business_service.py` | 63 | 8 | shared | **split** — tenant core is generic, Hazina specifics extract |
| `services/hazina_customer_fallbacks.py` | 52 | 5 | shared | **Hazina** |
| `services/hazina_whatsapp_router.py` | 50 | 10 | shared | **Hazina** |
| `services/hazina_kb.py` | 17 | 0 | shared | **Hazina** |
| `services/hazina_recommender.py` | 15 | 0 | shared | **Hazina** |
| `services/state_aware_greeter.py` | 13 | 0 | shared | **Hazina** |
| `services/ops_automation.py` | 11 | 0 | shared | **Hazina** |
| `services/hazina_escalation.py` | 9 | 0 | shared | **Hazina** |
| `services/conversation_context.py` | 9 | 0 | shared | **generic** (strip Hazina references) |
| `services/cafe_automation.py` | 4 | 22 | shared | **Gen-Eat** |
| `services/menu_photos.py` | 2 | 21 | shared | **Gen-Eat** |
| `services/order_tracking.py` | 5 | 0 | shared | **generic** (duplicate per product) |
| `services/fulfillment_status.py` · `fulfillment_notifications.py` | 1–2 | 0 | shared | **generic** (duplicate per product) |
| `services/conversation_service.py` · `session_manager.py` · `language.py` · `outbox.py` · `staff_dispatch.py` · `slash_commands.py` · `event_handlers.py` · `media.py` · `business_config.py` · `admin_seed.py` | 0 | 0 | shared | **generic — duplicate into both, do not extract a package yet** |
| `app/channels/` (base, whatsapp, voice, mock, registry) | — | — | shared | **generic — duplicate** |
| `app/integrations/payments/` (base, factory, daraja, intasend, paystack, stripe, simulator) | — | — | shared | **generic — duplicate** |
| `app/db/models.py` — `Business` tenant model | — | — | shared | **split**: each product keeps the tenant shape it needs |
| `gen-eat-portal/` | — | — | Gen-Eat | **Gen-Eat repo** |
| `hazina-portal/` | — | — | Hazina | **Hazina repo** |
| `lesnarai-landing/` + `experience-lab/` | — | — | Lesnar AI | **Lesnar AI repo** |

## Findings that shape the split

1. **The tenant model is real, not decorative.** `Business` is documented as
   "a tenant — each SME using the platform", with per-business timezone,
   currency, hours, escalation and brand voice in `Business.profile`. Splitting
   means each product keeps *its own* tenant table rather than sharing one.
2. **Hazina is by far the heavier tenant.** Twelve modules carry Hazina-specific
   logic; only two carry Gen-Eat-specific logic (`cafe_automation`,
   `menu_photos`). Gen-Eat's backend is therefore mostly generic core plus a
   small café surface — the cheaper extraction of the two.
3. **`whatsapp_menus.py` is the sharpest conflict.** 138 Hazina hits to 39
   Gen-Eat: today it serves both, and it must become two files.
4. **Controlled duplication is correct here**, per the instruction not to build
   a shared package yet. The generic set (conversation pipeline, channels,
   payments, outbox, dispatch) duplicates into both products. Whether it ever
   becomes `lesnar-core` should be decided from post-separation evidence.

## Data

- `geneat_prod` + `geneat` user; `hazina_prod` + `hazina` user; least
  privilege; neither process holds the other's credentials. CarePro isolated.
- **Recovery dependency:** the Render Postgres is suspended and unreachable. If
  it holds the only copy of production data, that data is currently
  inaccessible. Nothing here assumes it is recoverable, and no live transaction
  data may be fabricated to replace it. Clean databases are safe to create
  because they destroy nothing.

## Migration risk

| Action | Risk |
|---|---|
| Duplicate generic modules into both products | Low — additive; divergence is the accepted cost |
| Extract Hazina modules | Low — already named and separable |
| Extract Gen-Eat café modules | Low — small surface |
| Split `business_service.py` | **Medium** — the only file with substantial logic on both sides |
| Split `Business`/tenant tables | **Medium** — migration histories diverge permanently from here |
| Repository split | Medium — history must be secret-scanned before reuse; a clean baseline beats unsafe history |

## Status

Discovery complete. **No separation executed** — that work requires the VPS
deployment target, which is currently unreachable (see the blocker in the run
report).
