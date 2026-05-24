# Omnichannel AI Business Agent / Gen-Eat Platform

This file is the single source of truth for the whole repository.

All other Markdown files in this repo should stay short and point back here.
If the code or hosted setup changes, update this README first. The code is the
final authority, but this document is the canonical human map of:

- what the system is,
- how it works,
- what is live right now,
- how to run it locally,
- how it is currently deployed,
- what is still demo-only,
- and what still needs hardening before anyone promises enterprise-grade uptime.

Last reconciled with the codebase and live checks: **2026-05-23**.

## Table Of Contents

1. Product In One Page
2. Current Truth And Verification
3. Repository Map
4. System Architecture
5. Runtime Request Flow
6. Data Model And Migrations
7. Tenant Model And Routing
8. AI Brain, RAG, Tools, And Playbooks
9. Channels
10. Payments
11. Durable Jobs
12. Event Bus, SSE, And Webhooks
13. Admin Console
14. Frontends
15. Gen-Eat USIU Pilot
16. Security, Privacy, And Safety
17. Observability And Operations
18. Local Development
19. Production Deployment Runbook
20. API Surface
21. Scripts, Seeds, And Utilities
22. Testing
23. Scaling Notes And Known Gaps
24. Documentation Policy

## 1. Product In One Page

This repository contains a multi-tenant AI operations platform for small
businesses, with Gen-Eat as the flagship live demo.

The platform receives inbound customer traffic from WhatsApp, voice, and mock
/ web channels, resolves the correct tenant, runs a tenant-scoped AI assistant
with retrieval and tools, persists the conversation and business objects, and
then responds through the correct outbound transport.

The current demo story is food ordering for USIU-Africa cafés:

- students browse a café page,
- click through to WhatsApp or chat on the web,
- ask questions about the menu,
- request pictures,
- place an order,
- receive an IntaSend-backed M-Pesa STK push,
- pay,
- and receive a follow-up confirmation message.

Current important public endpoints:

| Thing | Current truth |
| --- | --- |
| Customer portal | `https://geneat.lesnarai.co.ke` |
| Lily Pond page | `https://geneat.lesnarai.co.ke/cafes/lily-pond-cafe` |
| API | `https://api.lesnarai.co.ke` |
| API liveness | `https://api.lesnarai.co.ke/healthz` |
| API readiness | `https://api.lesnarai.co.ke/readyz` |
| Deep health | `https://api.lesnarai.co.ke/health/deep` |
| GitHub repo | `https://github.com/lesnargitonga/geneat` |

Current demo tenants:

| Business | Slug | Role in demo |
| --- | --- | --- |
| Lily Pond Café | `lily-pond-cafe` | flagship live café |
| Library Bites | `library-bites` | snacks / study fuel |
| Pavilion Grill | `pavilion-grill` | heavier lunch / group orders |
| Block A Express | `block-a-express` | quick bites / delivery vibe |

Current Lily Pond live-demo path:

- default tenant slug is `lily-pond-cafe`,
- current Meta Cloud API test number maps to Lily Pond,
- the public WhatsApp CTA points to `+1 555-657-8220`,
- the demo proof item is `Demo Espresso` at `KES 10`,
- the doctor check now passes end-to-end on the hosted stack.

The most important product truths:

- There is no separate customer app.
- The same backend supports multiple business tenants.
- The same assistant infrastructure supports multiple channels.
- The same tenant data powers portal content, AI replies, payment routing,
  admin operations, and outbound events.

## 2. Current Truth And Verification

This section is the operational truth as of the latest local and hosted
verification pass.

### 2.1 Repository truth

| Check | Current truth |
| --- | --- |
| Git repository | present |
| Tracked remote | `origin -> https://github.com/lesnargitonga/geneat.git` |
| Deployment branch | `main`, auto-deployed by Render |
| Root README role | single source of truth |

Notes:

- Use `git log --oneline -1` for the exact current commit.
- Do not treat screenshots, old local terminals, or stale `.env` values as
  canonical if they disagree with code + hosted checks.

### 2.2 Hosted live verification

Fresh live checks run from this workspace on **2026-05-23**:

| Check | Result |
| --- | --- |
| `GET /healthz` | `{"status":"ok"}` |
| `GET /readyz` | DB and Redis healthy |
| `GET /health/deep` | `status=ok`, db/redis/pgvector/whatsapp/payments/llm all reachable |
| `make doctor-live` | `20/20 configured checks passed` |
| Portal live price check | passed without generic fallback |
| Portal live photo check | passed |
| Meta webhook verify handshake | passed |
| OpenAI provider health | passed |
| OpenAI breaker state | closed |

Current `make doctor-live` truth:

```text
20/20 configured checks passed
```

What that means in plain English:

- the hosted API is up,
- the hosted DB is healthy,
- the hosted Redis/Valkey is healthy,
- live mode skips direct local DB introspection and relies on hosted health,
  chat, and photo checks,
- the hosted chat proxy path works,
- the live demo tenant exists,
- the `Demo Espresso` price answer works without the generic fallback,
- a photo request returns an image,
- Meta webhook verification works,
- the primary OpenAI provider is reachable and not tripped open.

### 2.3 Local verification

Fresh local checks run during this reconciliation:

| Check | Result |
| --- | --- |
| Fast focused backend suite | `71 passed, 1 warning` via `make test-fast` |
| Admin UI production build | passed |
| Gen-Eat portal production build | passed |
| Logging crash regression test | passed |
| Local explicit price path smoke | passed |

Command results:

```bash
make test-fast
cd admin-ui && npm run build
cd gen-eat-portal && npm run build
```

### 2.4 Current demo-vs-real split

This is important and should stay honest.

Currently real:

- hosted API,
- hosted Postgres,
- hosted Redis/Valkey,
- PC-independent WhatsApp handling through the hosted backend,
- portal -> backend chat,
- Meta webhook verification,
- WhatsApp message handling,
- photo replies over the web-chat path,
- IntaSend-backed STK path,
- durable job framework,
- live doctor tooling.

Still demo-oriented:

- most menu photos are representative demo images, not merchant-owned photos,
- the WhatsApp assistant is live but still undergoing response-quality tuning,
- the Meta number is still the test/display number unless changed in Meta,
- Render is currently used in a pilot/beta way rather than a fully hardened
  production plan,
- public admin UI deployment is optional and not assumed by the doctor unless
  `GENEAT_ADMIN_URL` is set.

## 3. Repository Map

Top-level structure:

```text
ai model/
  README.md
  requirements.txt
  pytest.ini
  alembic.ini
  docker-compose.yml
  Dockerfile
  render.yaml
  Makefile
  start.sh
  app/
  admin-ui/
  gen-eat-portal/
  docs/
  deploy/
  scripts/
  tests/
```

Backend:

```text
app/
  main.py
  api/
    admin.py
    admin_auth.py
    admin_console.py
    catalog.py
    deps.py
    health.py
    metrics.py
    mock.py
    payments.py
    privacy.py
    voice.py
    voice_at.py
    whatsapp.py
    whatsapp_twilio.py
  ai/
    graph.py
    llm.py
    ollama_embed.py
    playbooks/
    prompts.py
    rag.py
    safety.py
    state.py
    tools.py
  channels/
    base.py
    mock.py
    voice.py
    voice_registry.py
    whatsapp.py
  core/
    auth.py
    circuit_breaker.py
    config.py
    config_validator.py
    event_bus.py
    exceptions.py
    logging.py
    rate_limit.py
    redis_client.py
    security.py
    sentry_setup.py
  db/
    base.py
    models.py
    session.py
  integrations/
    calendar_client.py
    elevenlabs_client.py
    mpesa_client.py
    transcription.py
    twilio_whatsapp.py
    voice_vad.py
    whatsapp_client.py
    payments/
      base.py
      daraja.py
      factory.py
      intasend.py
      paystack.py
      simulator.py
      stripe.py
  jobs/
    handlers.py
    order_ready_notifier.py
    runner.py
  services/
    admin_seed.py
    business_config.py
    business_service.py
    conversation_service.py
    event_handlers.py
    language.py
    media.py
    menu_photos.py
    output_sanitizer.py
    session_manager.py
    slash_commands.py
    staff_dispatch.py
    webhook_dispatcher.py
  static/
    admin.html
```

Consumer and operator frontends:

```text
admin-ui/
  Vite + React + TypeScript + Tailwind admin SPA

gen-eat-portal/
  Next.js 14 customer-facing café portal
  app/api/chat/route.ts -> backend /mock/message proxy
  lib/cafes.ts -> portal-side canonical demo café data
  public/menu/ -> optional local menu photography
```

Deployment and ops:

```text
deploy/
  render/
    README.md
  truehost/
    README.md
    docker-compose.api.yml
    cloudflared/

scripts/
  seeders
  health / doctor tools
  provider smoke tests
  backup utilities
  photo publishing utilities
```

## 4. System Architecture

High-level architecture:

```text
Customer traffic
  -> Meta WhatsApp / Twilio WA / Twilio voice / Africa's Talking voice / portal / mock
  -> FastAPI route
  -> tenant resolution
  -> customer resolution
  -> redis lock + idempotency + channel guard
  -> deterministic safety checks
  -> conversation persistence
  -> LangGraph AI turn
  -> tools / retrieval / payments / media / escalation
  -> output safety + sanitization
  -> message persistence
  -> event publish
  -> channel-specific outbound response
```

Stateful dependencies:

| Component | Role |
| --- | --- |
| Postgres | source of truth for tenants, customers, conversations, messages, orders, knowledge, admin users, memberships, webhooks, broadcasts, audit, background jobs |
| pgvector | vector search on `knowledge_base.embedding` |
| Redis / Valkey | locks, idempotency, rate limits, cache, event bus, token bucket, session coordination |
| Durable job runner | request-detached internal work that survives process restarts |
| Redis Pub/Sub event bus | cross-worker notifications, SSE fan-out, webhook triggers |

External providers:

| Provider | Purpose |
| --- | --- |
| Meta WhatsApp Cloud API | live WhatsApp ingress and outbound |
| Twilio | voice media streams and optional WhatsApp path |
| Africa's Talking | voice callback integration |
| IntaSend | current live payment provider for M-Pesa/STK demos |
| Daraja | direct Safaricom adapter still supported in code |
| Paystack | hosted payment callback support |
| Stripe | hosted payment callback support |
| OpenAI | primary chat and embeddings |
| Gemini | fallback/provider supported by code |
| Groq | fallback/provider supported by code and used for vision |
| Ollama | local fallback chat / local embeddings |
| Google Calendar | appointment booking tool |
| Cloudflare R2 | media storage and backups |
| Sentry | optional error reporting |

## 5. Runtime Request Flow

### 5.1 Inbound text flow

1. A route receives a provider payload:
   - `app/api/whatsapp.py`
   - `app/api/whatsapp_twilio.py`
   - `app/api/mock.py`
2. Signature or verification runs where supported.
3. The route converts provider payload into a normalized `InboundTurn`.
4. `app/channels/base.py` resolves:
   - business,
   - customer,
   - channel presence,
   - idempotency,
   - session lock,
   - safety state.
5. The user message is persisted.
6. `app/ai/graph.py` runs the turn.
7. The AI reply is sanitized and checked.
8. The AI/system/staff reply is persisted.
9. Events are emitted for SSE and webhooks.
10. The channel transport sends the reply back.

### 5.2 Voice flow

Twilio voice:

1. `POST /webhooks/voice/inbound`
2. TwiML response connects a websocket:
   - `WS /webhooks/voice/stream`
3. 8 kHz mu-law audio frames arrive.
4. Audio is converted to WAV.
5. VAD and utterance serialization prevent overlapping turns.
6. STT -> AI -> TTS cycle runs.
7. Voice session commands can be injected cross-worker through the event bus.

Africa's Talking voice:

1. `POST /webhooks/at/voice`
2. `POST /webhooks/at/voice/events`
3. Provider-specific callbacks feed into the same general orchestration model.

### 5.3 Payment callback flow

1. Provider callback hits the appropriate route.
2. Signature/source validation runs.
3. Checkout reference and status are normalized.
4. Matching `Order` row is found.
5. `payment_status` and receipts are updated.
6. `payment.completed` may be published.
7. Customer confirmation / receipt-style follow-up is attempted.

## 6. Data Model And Migrations

Core ORM models live in [app/db/models.py](/home/lesnar/Documents/ai model/app/db/models.py).

Important enums:

| Enum | Values |
| --- | --- |
| `Channel` | `whatsapp`, `voice`, `sms`, `mock` |
| `ConvStatus` | `active`, `resolved`, `human_escalated`, `abandoned` |
| `Sender` | `user`, `ai`, `system`, `agent` |
| `PaymentStatus` | `pending`, `paid`, `failed`, `cancelled`, `timeout` |
| `AdminRole` | `superadmin`, `owner`, `staff`, `viewer` |
| `BroadcastStatus` | `draft`, `sending`, `done`, `failed`, `cancelled` |
| `JobStatus` | `queued`, `running`, `done`, `failed`, `cancelled` |

Important tables:

| Table | Purpose |
| --- | --- |
| `businesses` | tenant record, voice/brand/profile JSON, Meta phone mapping |
| `customers` | normalized customer identity, language, safety score, block state |
| `conversations` | per-channel, per-tenant conversation state |
| `messages` | persisted thread history |
| `orders` | order/payment rows, direct `business_id`, checkout references |
| `knowledge_base` | tenant-scoped RAG chunks with embeddings |
| `tool_invocations` | tool audit trail including `send_menu_photo` |
| `audit_events` | admin/security audit stream |
| `admin_users` | local operators |
| `tenant_memberships` | operator access per tenant |
| `broadcasts` | outbound campaign records |
| `webhook_endpoints` | tenant outbound integration endpoints |
| `background_jobs` | durable in-app queue |

Current Alembic head:

| Revision | Purpose |
| --- | --- |
| `0001_init` | initial schema |
| `0002_embed_768` | vector dimension alignment |
| `0003_businesses` | tenant table |
| `0004_conversations_business_id` | tenant-scoped conversations |
| `0005_business_geo` | business latitude/longitude |
| `0006_admin_console` | admin users, memberships, broadcasts, webhooks |
| `0007_customer_safety` | abuse/blocking fields |
| `0008_orders_business_id` | direct tenant scope on orders |
| `0009_background_jobs` | durable jobs |
| `0010_enforce_embedding_768` | enforces `vector(768)` |

Current schema truth:

- `knowledge_base.embedding` is `vector(768)`,
- `orders.business_id` exists and is part of payment callback scoping,
- `background_jobs` exists and is required for delayed internal work,
- the hosted doctor confirms the current Alembic head is recorded.

## 7. Tenant Model And Routing

The app is multi-tenant all the way down.

Tenant identity:

- `Business.slug` is the human-stable identifier,
- `Business.meta_wa_phone_number_id` maps a Meta number to a tenant,
- `Business.profile` carries operational JSON such as hours, menu photos,
  timezone, prep-time hints, and other tenant-level settings.

Current routing order:

1. explicit `business_id`
2. explicit `business_slug`
3. Meta phone number ID
4. sticky active conversation
5. `DEFAULT_BUSINESS_SLUG`
6. oldest active business fallback

Isolation rules:

- KB retrieval is tenant-scoped,
- orders are tenant-scoped,
- conversations are tenant-scoped,
- admin access is membership-checked,
- SSE is tenant-filtered,
- outbound webhook rows are tenant-specific.

Current default tenant truth:

- `DEFAULT_BUSINESS_SLUG=lily-pond-cafe`
- so manual/unscoped demo traffic lands on Lily Pond unless another tenant is
  resolved explicitly.

## 8. AI Brain, RAG, Tools, And Playbooks

Primary files:

| File | Role |
| --- | --- |
| [app/ai/graph.py](/home/lesnar/Documents/ai model/app/ai/graph.py) | turn orchestration |
| [app/ai/llm.py](/home/lesnar/Documents/ai model/app/ai/llm.py) | provider construction and failover |
| [app/ai/prompts.py](/home/lesnar/Documents/ai model/app/ai/prompts.py) | system prompt assembly |
| [app/ai/rag.py](/home/lesnar/Documents/ai model/app/ai/rag.py) | vector retrieval, keyword fallback, KB price extraction |
| [app/ai/tools.py](/home/lesnar/Documents/ai model/app/ai/tools.py) | tools exposed to the assistant |
| [app/ai/safety.py](/home/lesnar/Documents/ai model/app/ai/safety.py) | deterministic safety layer |
| `app/ai/playbooks/` | vertical-specific rules |

### 8.1 Provider truth

Settings-layer defaults:

| Setting | Current code default |
| --- | --- |
| `LLM_PROVIDER` | `openai` |
| `OPENAI_MODEL` | `gpt-5.4-mini` |
| `OPENAI_USE_RESPONSES_API` | `true` |
| `OPENAI_STORE_RESPONSES` | `true` |
| `EMBED_PROVIDER` | `openai` |
| `OPENAI_EMBED_MODEL` | `text-embedding-3-large` |
| `OPENAI_EMBED_DIMENSIONS` | `768` |
| `llm_fallback_providers` in `Settings` | `gemini,local` |

Important nuance:

- The repository default fallback order is `gemini,local`.
- The checked-in [render.yaml](/home/lesnar/Documents/ai model/render.yaml)
  overrides that to `groq` in the desired Render blueprint.
- The live Render service can still differ because it is environment-driven.
- Therefore the **environment is the final runtime truth**, not just the code
  default.

### 8.2 Current turn logic

The assistant is not a single raw LLM call. It is a layered system:

1. deterministic safety pre-check,
2. tenant profile load,
3. recent conversation history load,
4. RAG retrieve step,
5. tool-capable model turn,
6. tool loop when necessary,
7. output sanitizer,
8. output safety filter,
9. persistence and events.

### 8.3 Current happy path and rescue path

The assistant must feel like a real café operator, not a pile of canned
messages. The current rule is:

- normal text goes to the model first,
- deterministic replies are reserved for explicit media handling or degraded
  fallback,
- the generic human-handoff fallback should be rare.

Current explicit happy-path fast-path in [app/ai/graph.py](/home/lesnar/Documents/ai model/app/ai/graph.py):

- **Photo requests only**, such as:
  - `show me a photo of the flat white`
  - `send me a picture of the croissant`
  - `picha ya avocado toast`
  short-circuit directly into `send_menu_photo` without waiting for the LLM
  to decide whether to use a tool.

Current model-led happy path:

- prices,
- menu questions,
- budget recommendations,
- opening-hours questions,
- order-building turns,
- clarification turns,
- payment turns.

Current order/payment hardening:

- duplicate pending orders in the same tenant conversation are reused instead
  of creating a second order,
- duplicate STK requests for the same pending order are treated as
  `in_flight` instead of pushing the customer twice,
- repeated customer order messages while an STK is pending get a status reply
  instead of re-running the whole order flow,
- customer messages like `cancel payment` deterministically cancel the local
  pending order, stop queued payment/ready jobs, and tell the customer to
  ignore any old STK prompt,
- customer messages like `resend STK` deterministically try a fresh STK for
  the pending order,
- the assistant must not say `pickup ready`, `ready by`, `paid`, or
  `confirmed` until a payment callback or payment poll confirms money landed,
- ready notifications are scheduled only after paid payment state,
- payment failure/cancel messages use the customer's language instead of
  forcing Swahili into English conversations,
- failed callbacks after a customer-cancelled order are ignored so old payment
  provider events do not keep interrupting the chat,
- if the model or output sanitizer produces malformed payment copy after a
  successful tool call, the channel layer replaces it with a safe payment
  status message.

Current degraded fallback behavior in [app/channels/base.py](/home/lesnar/Documents/ai model/app/channels/base.py):

- each AI turn is bounded by `AI_TURN_TIMEOUT_SECONDS`,
- one quiet retry is attempted for transient provider/tool failures; timeout
  retries use a smaller window so stuck turns do not drag on,
- deterministic quick replies can answer obvious price, hours, or menu
  recommendation questions only after the model path fails,
- deterministic quick replies can answer item-availability questions such as
  `Do you have croissants?` from menu chunks,
- keyword KB fallback is tried before generic handoff, but internal/demo
  operator notes such as `DEMO FLOW` are filtered out of customer replies,
- degraded fallback replies are marked and filtered out of future model
  history so the assistant does not imitate old emergency copy,
- the generic handoff text is now a last resort, not the normal café voice.

Current safety calibration:

- normal café language is allowed through to the model, including phrases like
  `you are open now`, `can you act fast and send the STK`, and menu-photo
  requests,
- the deterministic jailbreak guard now targets actual role/instruction
  hijacks instead of broad everyday wording,
- menu-photo language is not treated as off-topic image generation,
- the conversation turn cap was raised to give real ordering threads more
  room before human escalation.

### 8.4 Tool surface

| Tool | Purpose |
| --- | --- |
| `knowledge_lookup` | tenant-scoped KB search |
| `create_order` | create order row linked to customer/conversation/tenant |
| `request_mpesa_payment` | payment adapter request |
| `book_appointment` | calendar booking |
| `escalate_to_human` | pause AI and hand over |
| `send_location_pin` | send location |
| `send_menu_photo` | send actual photo/media reference |
| `update_customer_name` | persist customer name |

### 8.5 RAG truth

Current retrieval behavior:

- vector search uses pgvector when embeddings are available,
- keyword fallback exists for degraded conditions,
- tenant scoping is enforced by `business_id`,
- price redaction uses KB-derived allowed prices,
- the doctor confirms live KB rows for Lily Pond.

### 8.6 Known current nuance

Photo delivery works, but the fuzzy matched `photo_item` label can still come
back a little strangely in some demo-photo cases because the catalog includes
caption-derived aliases. The image delivery itself works; the label polish is
still a cleanup item.

## 9. Channels

### Mock channel

Routes:

- `POST /mock/message`
- `POST /mock/image`

Uses:

- portal chat,
- local testing,
- scripted doctor checks,
- seed/demo rehearsals without provider ingress.

### WhatsApp - Meta Cloud API

Routes:

- `GET /webhooks/whatsapp`
- `POST /webhooks/whatsapp`

Capabilities:

- webhook verification,
- signature verification when `META_WA_APP_SECRET` is set,
- inbound text/media handling,
- outbound text/image/location/template sends,
- status callback logging,
- live mapping of current Meta phone number to tenant.

### WhatsApp - Twilio

Routes:

- `POST /webhooks/whatsapp/twilio/inbound`
- `POST /webhooks/whatsapp/twilio/status`

Supported in code as an alternate WhatsApp ingress/outbound path.

### Voice - Twilio Media Streams

Routes:

- `POST /webhooks/voice/inbound`
- `WS /webhooks/voice/stream`

Current truth:

- Twilio signature verification is supported,
- audio is received as mu-law and converted to WAV,
- VAD is in place,
- cross-worker voice control exists,
- current codec path still relies on `audioop`.

Python caveat:

- `audioop` works on Python 3.12,
- it is deprecated for Python 3.13,
- do not upgrade this runtime to Python 3.13 without replacing that path.

### Voice - Africa's Talking

Routes:

- `POST /webhooks/at/voice`
- `POST /webhooks/at/voice/events`

### SMS

The model and enums mention SMS, but the primary shipped customer paths in
this repository are:

- Meta WhatsApp,
- Twilio voice,
- Africa's Talking voice,
- portal/mock chat.

Treat SMS as prepared model vocabulary, not the main shipped surface here.

## 10. Payments

Payment adapters live under [app/integrations/payments](/home/lesnar/Documents/ai model/app/integrations/payments).

Current adapters:

| Adapter | File | Truth |
| --- | --- | --- |
| Daraja | `daraja.py` | supported in code |
| IntaSend | `intasend.py` | current live payment path |
| Paystack | `paystack.py` | callback support present |
| Stripe | `stripe.py` | callback support present |
| Simulator | `simulator.py` | local/demo fallback |

Current live truth:

- `PAYMENT_PROVIDER=intasend`
- `PAYMENT_SIMULATOR=false`
- STK push has already been proven in the WhatsApp demo path
- `make doctor-live` confirms payment provider reachability

Important nuance on `/health/deep`:

- the payment check is a lightweight provider reachability probe,
- it currently treats any non-5xx provider response as “reachable,”
- so a `403` from the provider root still means “network path is alive,” not
  “we just proved a transaction.”

Current callback routes:

- `POST /payments/stk-push`
- `POST /payments/callback`
- `POST /payments/intasend/callback`
- `POST /payments/paystack/callback`
- `POST /payments/stripe/callback`

Callback safeguards:

- signature/source verification where supported,
- idempotency protections,
- orders matched by checkout reference,
- direct `orders.business_id` tenant scope,
- no already-paid order downgrade.

## 11. Durable Jobs

Durable jobs live in:

- [app/jobs/runner.py](/home/lesnar/Documents/ai model/app/jobs/runner.py)
- [app/jobs/handlers.py](/home/lesnar/Documents/ai model/app/jobs/handlers.py)
- `BackgroundJob` model
- migration `0009_background_jobs`

Why they exist:

- request-local background tasks die on restart,
- broadcasts and delayed follow-ups need durability,
- payment simulator confirm and unpaid follow-up need retryable state.

Current job kinds:

| Kind | Purpose |
| --- | --- |
| `broadcast.send` | tenant broadcast send loop |
| `order.ready` | order-ready notification |
| `payment.simulator_confirm` | simulator auto-confirm |
| `payment.unpaid_followup` | pending-payment reminder |

Operational truth:

- jobs are durable in DB,
- claim/retry/lease logic exists,
- huge campaign scale would still outgrow the in-process runner before too
  long.

## 12. Event Bus, SSE, And Webhooks

Current event bus:

- file: [app/core/event_bus.py](/home/lesnar/Documents/ai model/app/core/event_bus.py)
- transport: Redis Pub/Sub
- channel: `omni:events`

Known event types include:

- `payment.completed`
- `voice.hangup`
- `voice.say`
- `escalation.opened`
- `conversation.interleaved`
- `message.created`
- `conversation.takeover`
- `conversation.released`
- `broadcast.progress`

Current SSE route:

- `GET /admin/stream`

Current outbound webhook truth:

- tenant-configured,
- HMAC-signed with `X-Omni-Signature`,
- deduped through Redis,
- limited concurrency,
- retry logic exists once a worker receives the event.

Important limitation:

- the event bus itself is **not durable**,
- so SSE and outbound webhooks can miss events during Redis or listener gaps,
- the correct future fix is an outbox table or Redis Streams layer.

## 13. Admin Console

Backend routes live in:

- [app/api/admin_auth.py](/home/lesnar/Documents/ai model/app/api/admin_auth.py)
- [app/api/admin_console.py](/home/lesnar/Documents/ai model/app/api/admin_console.py)
- [app/api/admin.py](/home/lesnar/Documents/ai model/app/api/admin.py)

Frontend lives in:

- [admin-ui/](/home/lesnar/Documents/ai model/admin-ui)

Current auth model:

- local admin users,
- bcrypt password hashes,
- JWT access/refresh tokens,
- token-version invalidation,
- legacy machine/admin token routes still exist.

Roles:

| Role | Meaning |
| --- | --- |
| `superadmin` | cross-tenant control |
| `owner` | full tenant control |
| `staff` | operational interaction / takeover |
| `viewer` | read-only |

Current admin capabilities:

- login / refresh / me / password change / logout-all,
- admin user CRUD,
- tenant membership CRUD,
- business CRUD,
- conversation list/detail/resolve,
- takeover / release / staff send,
- escalations queue,
- KB CRUD / re-embed,
- business profile and prompt editing,
- menu-photo catalog inspection / replacement / upload,
- webhook CRUD / rotation,
- usage and analytics views,
- broadcast create / send / cancel,
- safety flagged customer queue,
- audit search,
- SSE live stream,
- HTTPS demo bootstrap endpoint.

Important newer admin routes:

- `POST /admin/bootstrap/geneat-demo`
- `GET /admin/businesses/{slug}/menu-photos`
- `PUT /admin/businesses/{slug}/menu-photos`
- `POST /admin/businesses/{slug}/menu-photos`
- `POST /admin/businesses/{slug}/menu-photos/upload`

Current public-admin truth:

- a public admin URL is optional,
- the live doctor only checks it if `GENEAT_ADMIN_URL` is set,
- local admin operation remains a valid workflow.

## 14. Frontends

### 14.1 Admin UI

Location: [admin-ui/](/home/lesnar/Documents/ai model/admin-ui)

Stack:

- Vite
- React
- TypeScript
- Tailwind

Current local commands:

```bash
cd admin-ui
npm install
npm run dev
npm run build
npm run preview
```

Latest local build: passed.

### 14.2 Gen-Eat portal

Location: [gen-eat-portal/](/home/lesnar/Documents/ai model/gen-eat-portal)

Stack:

- Next.js 14
- app router
- server-side proxy route for chat

Important files:

| File | Purpose |
| --- | --- |
| `app/page.tsx` | home |
| `app/cafes/page.tsx` | café directory |
| `app/cafes/[slug]/page.tsx` | café detail page |
| `app/map/page.tsx` | campus map |
| `app/owners/page.tsx` | owner-facing sales page |
| `app/api/chat/route.ts` | server-side proxy to backend `/mock/message` |
| `components/ChatWidget.tsx` | embedded web chat |
| `components/MenuItemThumb.tsx` | menu image rendering |
| `lib/cafes.ts` | portal-side demo café content |

Current chat flow:

```text
ChatWidget
  -> POST /api/chat
  -> Next server route
  -> POST {BACKEND_URL}/mock/message
  -> FastAPI
  -> AI reply
  -> portal renders reply / image_url
```

Current photo flow:

1. Portal page loads static café/menu content from `lib/cafes.ts`.
2. It fetches live overrides from:
   - `GET /catalog/businesses/{slug}/menu-photos`
3. It overlays tenant photo URLs onto menu items.
4. The same backend photo catalog is used by the AI `send_menu_photo` tool.

That means the portal and AI now share one photo truth path.

### 14.3 Menu photography truth

There are now three layers of image truth:

1. **Portal static/demo images**
   - fallback images and hardcoded showcase media
2. **Backend static fallback map**
   - [app/services/menu_photos.py](/home/lesnar/Documents/ai model/app/services/menu_photos.py)
3. **Tenant-owned photo map**
   - `Business.profile["menu_photos"]`

Resolution order:

- tenant-owned `menu_photos`
- backend static fallback map

Current live demo truth:

- the image reply path works,
- the published demo photo catalog is live,
- many images are still representative Unsplash-style demo media,
- real merchant-owned photos can now be uploaded later without changing code.

Current photo publishing utility:

```bash
./.venv/bin/python scripts/publish_demo_menu_photos.py --dry-run
./.venv/bin/python scripts/publish_demo_menu_photos.py
```

Most recent dry-run coverage that informed this setup:

| Tenant | Coverage |
| --- | --- |
| Lily Pond | `51/51` |
| Library Bites | `23/23` |
| Pavilion Grill | `28/28` |
| Block A Express | `27/27` |

## 15. Gen-Eat USIU Pilot

Gen-Eat is the campus café ordering pilot built on top of the platform.

Pitch in one paragraph:

Students at USIU-Africa lose time in lunch and coffee queues. Gen-Eat lets a
student browse a café, ask the menu assistant questions, request pictures,
place a small order, pay on M-Pesa, and arrive when the item is ready. For the
merchant, it is a queue-compression and lost-demand capture tool.

Pilot scope:

| Item | Current truth |
| --- | --- |
| Campus | USIU-Africa |
| Pilot length | 90 days |
| Initial cafés | 4 |
| Merchant cost during pilot | KES 0 |
| Customer app | none |
| Core proof target | live usage + fulfillment + reduced queue friction |

Current flagship demo: Lily Pond

| Item | Current truth |
| --- | --- |
| Slug | `lily-pond-cafe` |
| Default tenant | yes |
| Live demo item | `Demo Espresso` |
| Demo price | `KES 10` |
| Current Meta display number | `+1 555-657-8220` |
| Live doctor status | passes |

Current Lily Pond demo rules in the system:

- `10 bob`
- `ten bob`
- `demo espresso`
- `demo order`

all resolve to the `Demo Espresso KES 10` flow.

Current “real enough for a pilot” truth:

- the hosted stack is live,
- the student can browse the portal,
- the student can click through to WhatsApp,
- the AI can answer a price question,
- the AI can send a picture,
- the order/payment path is wired,
- the current blocker is conversation polish: the assistant must handle a
  longer WhatsApp order/payment thread without late fallback copy, duplicate
  payment prompts, or premature pickup promises.

Still not yet “merchant-perfect”:

- images are still demo media unless replaced per tenant,
- the WhatsApp number is still the currently configured Meta number,
- the café flow still needs repeated real WhatsApp rehearsal before a first
  client meeting,
- infrastructure is still beta-grade, not SLA-grade.

Original budget / business-plan assumptions retained from the pilot concept:

| Bucket | KES | Purpose |
| --- | ---: | --- |
| WhatsApp API / messaging | 4,500 | customer conversations |
| AI usage | 5,200 | token cost |
| Server / hosting | 2,400 | pilot runtime |
| Domain | 1,600 | branded domain |
| Printed QR collateral | 3,300 | table tents / posters |
| Buffer | 3,000 | contingency |
| Total | 20,000 | pilot budget |

## 16. Security, Privacy, And Safety

### 16.1 Secrets

Rules:

- never commit real secrets,
- documentation only references env variable names,
- if a secret is pasted into chat, logs, or a screenshot, treat it as exposed
  and rotate it.

### 16.2 Startup validation

[app/core/config_validator.py](/home/lesnar/Documents/ai model/app/core/config_validator.py)
enforces startup checks such as:

- provider/key coherence,
- payment/provider coherence,
- required production safety rails,
- database presence,
- phone hash pepper presence,
- admin token and warning paths,
- worker vs Postgres connection warnings.

Current production fail-fast rules include:

- `PAYMENT_SIMULATOR=true` is forbidden in `APP_ENV=prod`,
- `PAYMENT_PROVIDER=intasend` requires `INTASEND_WEBHOOK_SECRET` in prod,
- `WHATSAPP_PROVIDER=meta` requires `META_WA_APP_SECRET` in prod and only
  warns outside prod,
- GPT-5 with the OpenAI Responses API requires `OPENAI_STORE_RESPONSES=true`
  in prod,
- OpenAI embeddings must remain `768` dimensions in prod until the pgvector
  schema is migrated.

### 16.3 PII handling

- phones are normalized before use,
- Redis/session keys use hashes instead of raw phones,
- interleaving and safety flows use `msisdn_hash`,
- privacy forget audits use hashed phone references,
- Sentry scrubber redacts phone-like values.

### 16.4 Customer safety

Current safety layers:

- deterministic pre-LLM filter,
- brand-safety hard refuse,
- jailbreak detection,
- PII-fishing detection,
- off-topic exploitation detection,
- post-LLM forbidden phrase stripping,
- unsupported price redaction,
- customer abuse score,
- admin block/unblock controls.

### 16.5 Provider verification

- Meta webhook signature verification when configured,
- Twilio signature verification when configured,
- IntaSend HMAC verification,
- Stripe webhook signature verification,
- Paystack secret verification,
- Daraja source/IP production guard.

### 16.6 Admin security

- JWT access/refresh,
- token version invalidation,
- tenant role checks,
- superadmin-only actions,
- audit events for sensitive actions.

## 17. Observability And Operations

### 17.1 Logging

Logging lives in [app/core/logging.py](/home/lesnar/Documents/ai model/app/core/logging.py).

Current truth:

- local development can use a color console renderer,
- production defaults to structured logs,
- logger names, levels, timestamps, and request/business/conversation context
  are included,
- startup logging crash caused by logger-factory mismatch was fixed on
  2026-05-22.

Important context keys:

- `request_id`
- `conversation_id`
- `business_id`
- `tenant`

### 17.2 Sentry

- initialized during app import,
- no-op when `SENTRY_DSN` is empty,
- PII scrubbing is built in.

### 17.3 Metrics

Route:

- `GET /metrics`

Current metrics include:

- request counts and latency,
- webhook delivery metrics,
- safety counters,
- event/tool metrics.

### 17.4 Health endpoints

| Route | Purpose |
| --- | --- |
| `/healthz` | process liveness |
| `/readyz` | DB + Redis readiness |
| `/health/deep` | DB + Redis + pgvector + WhatsApp + payment-provider reachability + LLM reachability + breaker snapshot |

Current `/health/deep` truth:

- includes `checks.llm`,
- includes breaker snapshots,
- is now part of the live doctor story.

### 17.5 Doctor and smoke tooling

Current developer/operator commands:

```bash
make doctor-local
make doctor-live
make smoke-providers
```

Meaning:

- `doctor-local` checks local stack and safe chat/photo flows
- `doctor-live` checks hosted stack and safe chat/photo flows; hosted HTTP
  probes retry briefly so Render warm-up or one-off edge timeouts do not
  create false alarms
- `smoke-providers` probes provider credential/path sanity

### 17.6 Operational watch points

- Redis health affects locks, idempotency, rate limits, event bus, and some
  caching.
- Postgres health affects everything persistent.
- Job backlogs mean `background_jobs` and runner state need inspection.
- Webhook issues need Redis event-bus plus webhook dispatcher review.
- OpenAI breaker state in `/health/deep` is now worth checking when the chat
  path feels weird.

## 18. Local Development

### 18.1 Prerequisites

- Python 3.12
- Docker for Postgres + Redis
- Node/npm
- optional Ollama for local fallback

### 18.2 Common setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
docker-compose up -d postgres redis
alembic upgrade head
```

### 18.3 Recommended backend run path

Use:

```bash
./scripts/run_dev.sh
```

Why:

- single worker,
- no reload weirdness,
- proper `PYTHONPATH`,
- default `LOG_FORMAT=console`,
- less memory pain than random uvicorn invocations.

Direct run still works:

```bash
PYTHONPATH=. ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 18.4 Make targets

Current root Makefile commands:

```bash
make dev
make test-fast
make doctor-local
make doctor-live
make smoke-providers
make bootstrap-demo
make publish-demo-photos
make generate-lily-training
```

### 18.5 Demo seed and bootstrap

Local seed:

```bash
PYTHONPATH=. ./.venv/bin/python scripts/seed_geneat_demo.py
```

Hosted bootstrap over HTTPS:

```bash
set -a
. ./.env
curl -X POST https://api.lesnarai.co.ke/admin/bootstrap/geneat-demo \
  -H "Authorization: Bearer $ADMIN_API_TOKEN"
```

### 18.6 Lily Pond local rehearsal

1. run migrations
2. seed Gen-Eat demo
3. start backend
4. start portal
5. open `/cafes/lily-pond-cafe`
6. test web chat
7. test WhatsApp CTA
8. test `KES 10` path
9. test a photo request
10. optionally test payment

### 18.7 Demo photo publishing

To publish the full demo photo catalog to the hosted tenant:

```bash
./.venv/bin/python scripts/publish_demo_menu_photos.py --dry-run
./.venv/bin/python scripts/publish_demo_menu_photos.py
```

### 18.8 Public admin URL behavior

If `GENEAT_ADMIN_URL` is unset:

- `make doctor-live` skips the public admin reachability check,
- this is intentional,
- it prevents false failures when admin remains local/private.

## 19. Production Deployment Runbook

This section covers both:

1. the **current live beta path**, and
2. the **desired codified target path**.

They are not the same thing right now.

### 19.1 Current live beta path

Current hosted shape:

| Layer | Current truth |
| --- | --- |
| Domain registrar | Truehost |
| DNS / edge TLS | Cloudflare |
| Customer portal | Vercel |
| Backend API | Render |
| Live API domain | `api.lesnarai.co.ke` |
| Live portal domain | `geneat.lesnarai.co.ke` |

Current operational nuance:

- the live Render deployment was finalized manually,
- the current service naming in Render may not match `render.yaml`,
- the live beta path should be treated as **working operational truth**,
  while `render.yaml` expresses the cleaner desired managed target.

### 19.2 Desired codified Render target

Checked-in desired deployment config:

- [render.yaml](/home/lesnar/Documents/ai model/render.yaml)
- [deploy/render/README.md](/home/lesnar/Documents/ai model/deploy/render/README.md)

That target declares:

- `geneat-api`
- `geneat-redis`
- `geneat-postgres`

with a cleaner managed setup than the manual beta cutover.

### 19.3 Alternative server path

Truehost server-side bundle exists here:

- [deploy/truehost/README.md](/home/lesnar/Documents/ai model/deploy/truehost/README.md)
- [deploy/truehost/docker-compose.api.yml](/home/lesnar/Documents/ai model/deploy/truehost/docker-compose.api.yml)

That path is currently a prepared alternative, not the current live path.

### 19.4 Production-ish infrastructure requirements

Postgres:

- Postgres 16 or compatible
- pgvector enabled
- enough connection headroom for worker count

Redis / Valkey:

- Redis 7+ compatible
- TLS preferred if hosted
- required for locks, idempotency, rate limits, event bus, and caches

Object storage:

- Cloudflare R2 for media and/or backups

### 19.5 Required environment categories

Never commit values. Use secret managers or host env config.

Core:

| Variable | Purpose |
| --- | --- |
| `APP_ENV` | `prod` for hosted deployment |
| `LOG_LEVEL` | usually `INFO` |
| `LOG_FORMAT` | `json`, `console`, or `auto` |
| `DATABASE_URL` | async DB URL or Render plain Postgres URL |
| `DATABASE_URL_SYNC` | sync DB URL or same Render URL |
| `REDIS_URL` | Redis / Valkey URL |
| `SECRET_KEY` | app secret |
| `PHONE_HASH_PEPPER` | stable phone-hash secret |
| `ADMIN_API_TOKEN` | machine/legacy admin token |
| `JWT_SECRET` | admin JWT signing |
| `ADMIN_CORS_ORIGINS` | admin origins |
| `DEFAULT_BUSINESS_SLUG` | default tenant |

LLM / embeddings:

| Variable | Purpose |
| --- | --- |
| `LLM_PROVIDER` | `openai`, `groq`, `gemini`, or `local` |
| `LLM_FALLBACK_PROVIDERS` | ordered fallback list |
| `OPENAI_API_KEY` | OpenAI auth |
| `OPENAI_MODEL` | current preferred live model is `gpt-5.4-mini` |
| `OPENAI_REASONING_EFFORT` | usually `low` |
| `OPENAI_USE_RESPONSES_API` | keep `true` for current GPT-5 tool loops |
| `OPENAI_STORE_RESPONSES` | keep `true` with Responses API tool loops |
| `OPENAI_EMBED_MODEL` | `text-embedding-3-large` |
| `OPENAI_EMBED_DIMENSIONS` | must remain `768` |
| `GROQ_API_KEY` | Groq provider / vision |
| `GEMINI_API_KEY` | Gemini fallback |

Channels:

| Variable | Purpose |
| --- | --- |
| `WHATSAPP_PROVIDER` | current live path is `meta` |
| `META_WA_PHONE_NUMBER_ID` | live Meta number ID |
| `META_WA_ACCESS_TOKEN` | Meta token |
| `META_WA_VERIFY_TOKEN` | webhook verify token |
| `META_WA_APP_SECRET` | webhook signature verification |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Twilio |
| `AT_USERNAME`, `AT_API_KEY`, `AT_SHORTCODE`, `AT_VOICE_PHONE` | Africa's Talking |

Payments:

| Variable | Purpose |
| --- | --- |
| `PAYMENT_PROVIDER` | current live path is `intasend` |
| `PAYMENT_SIMULATOR` | keep `false` on live path |
| `INTASEND_API_TOKEN` | IntaSend auth |
| `INTASEND_PUBLISHABLE_KEY` | IntaSend frontend/public key where needed |
| `INTASEND_WEBHOOK_SECRET` | IntaSend callback verification |
| `MPESA_*` | Daraja path |
| `PAYSTACK_*` | Paystack path |
| `STRIPE_*` | Stripe path |

Storage / telemetry:

| Variable | Purpose |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | R2 key |
| `R2_SECRET_ACCESS_KEY` | R2 secret |
| `R2_BUCKET` | media bucket |
| `R2_PUBLIC_URL_BASE` | public object base URL |
| `SENTRY_DSN` | telemetry |

### 19.6 Required callback URLs

Meta WhatsApp:

- `GET https://api.lesnarai.co.ke/webhooks/whatsapp`
- `POST https://api.lesnarai.co.ke/webhooks/whatsapp`

Twilio voice:

- `POST https://api.lesnarai.co.ke/webhooks/voice/inbound`
- `wss://api.lesnarai.co.ke/webhooks/voice/stream`

Africa's Talking:

- `POST https://api.lesnarai.co.ke/webhooks/at/voice`
- `POST https://api.lesnarai.co.ke/webhooks/at/voice/events`

Payments:

- `POST https://api.lesnarai.co.ke/payments/callback`
- `POST https://api.lesnarai.co.ke/payments/intasend/callback`
- `POST https://api.lesnarai.co.ke/payments/paystack/callback`
- `POST https://api.lesnarai.co.ke/payments/stripe/callback`

### 19.7 Current live cutover truth

As of 2026-05-23:

- Cloudflare DNS points the API domain at Render,
- Meta webhook points at the hosted API,
- the live doctor passes,
- the laptop-backed API tunnel is no longer the intended live path.

### 19.8 Recommended post-cutover hardening

- move off Render free before promising uptime,
- rotate any exposed keys,
- add real alerting,
- add migration CI,
- add durable event delivery for webhooks.

## 20. API Surface

This is a human-grouped route map based on the current FastAPI app.

### Health and observability

| Method | Path |
| --- | --- |
| GET | `/healthz` |
| GET | `/readyz` |
| GET | `/health/deep` |
| GET | `/metrics` |

### Public catalog

| Method | Path |
| --- | --- |
| GET | `/catalog/businesses/{slug}/menu-photos` |

### Mock and channel ingress

| Method | Path |
| --- | --- |
| POST | `/mock/message` |
| POST | `/mock/image` |
| GET | `/webhooks/whatsapp` |
| POST | `/webhooks/whatsapp` |
| POST | `/webhooks/whatsapp/twilio/inbound` |
| POST | `/webhooks/whatsapp/twilio/status` |
| POST | `/webhooks/voice/inbound` |
| WS | `/webhooks/voice/stream` |
| POST | `/webhooks/at/voice` |
| POST | `/webhooks/at/voice/events` |

### Payments

| Method | Path |
| --- | --- |
| POST | `/payments/stk-push` |
| POST | `/payments/callback` |
| POST | `/payments/intasend/callback` |
| POST | `/payments/paystack/callback` |
| POST | `/payments/stripe/callback` |

### Admin auth and users

| Method | Path |
| --- | --- |
| POST | `/admin/auth/login` |
| POST | `/admin/auth/refresh` |
| GET | `/admin/auth/me` |
| POST | `/admin/auth/logout-all` |
| POST | `/admin/auth/password` |
| POST | `/admin/users` |
| GET | `/admin/users` |
| PATCH | `/admin/users/{user_id}` |
| DELETE | `/admin/users/{user_id}` |

### Admin memberships

| Method | Path |
| --- | --- |
| POST | `/admin/businesses/{slug}/members` |
| GET | `/admin/businesses/{slug}/members` |
| DELETE | `/admin/businesses/{slug}/members/{user_id}` |

### Admin business and conversation operations

| Method | Path |
| --- | --- |
| GET | `/admin/businesses` |
| POST | `/admin/businesses` |
| GET | `/admin/businesses/{slug}` |
| PATCH | `/admin/businesses/{slug}` |
| GET | `/admin/businesses/{slug}/conversations` |
| GET | `/admin/conversations/{conv_id}` |
| POST | `/admin/conversations/{conv_id}/resolve` |
| GET | `/admin/escalations` |
| POST | `/admin/conversations/{conv_id}/takeover` |
| POST | `/admin/conversations/{conv_id}/release` |
| POST | `/admin/conversations/{conv_id}/messages` |

### Admin KB, profile, prompt, media

| Method | Path |
| --- | --- |
| GET | `/admin/businesses/{slug}/kb` |
| POST | `/admin/businesses/{slug}/kb/items` |
| PATCH | `/admin/businesses/{slug}/kb/items/{kb_id}` |
| DELETE | `/admin/businesses/{slug}/kb/items/{kb_id}` |
| POST | `/admin/businesses/{slug}/kb/re-embed` |
| POST | `/admin/businesses/{slug}/kb/csv` |
| DELETE | `/admin/businesses/{slug}/kb` |
| GET | `/admin/businesses/{slug}/profile` |
| PUT | `/admin/businesses/{slug}/profile` |
| PATCH | `/admin/businesses/{slug}/prompt` |
| GET | `/admin/businesses/{slug}/menu-photos` |
| PUT | `/admin/businesses/{slug}/menu-photos` |
| POST | `/admin/businesses/{slug}/menu-photos` |
| POST | `/admin/businesses/{slug}/menu-photos/upload` |

### Admin webhooks, broadcasts, usage, safety, audit

| Method | Path |
| --- | --- |
| POST | `/admin/businesses/{slug}/webhooks` |
| GET | `/admin/businesses/{slug}/webhooks` |
| DELETE | `/admin/businesses/{slug}/webhooks/{hook_id}` |
| POST | `/admin/businesses/{slug}/webhooks/{hook_id}/rotate` |
| GET | `/admin/businesses/{slug}/usage` |
| GET | `/admin/businesses/{slug}/analytics` |
| POST | `/admin/businesses/{slug}/broadcasts` |
| GET | `/admin/businesses/{slug}/broadcasts` |
| POST | `/admin/businesses/{slug}/broadcasts/{bid}/send` |
| POST | `/admin/businesses/{slug}/broadcasts/{bid}/cancel` |
| GET | `/admin/safety/flagged` |
| POST | `/admin/safety/customers/{phone}/block` |
| POST | `/admin/safety/customers/{phone}/unblock` |
| GET | `/admin/audit` |
| GET | `/admin/stream` |

### Demo bootstrap and privacy

| Method | Path |
| --- | --- |
| POST | `/admin/bootstrap/geneat-demo` |
| GET | `/privacy/customers/{phone}/export` |
| POST | `/privacy/customers/{phone}/forget` |
| GET | `/privacy` |
| GET | `/privacy/` |

## 21. Scripts, Seeds, And Utilities

Current tracked scripts:

| Script | Purpose |
| --- | --- |
| `scripts/create_admin.py` | create/update admin user |
| `scripts/seed_alpha.py` | alpha seed data |
| `scripts/seed_demo.py` | generic demo seed |
| `scripts/seed_demo_tenant.py` | tenant demo seed |
| `scripts/seed_geneat_demo.py` | Gen-Eat four-café seed |
| `scripts/seed_palm_cafe.py` | Palm café seed |
| `scripts/backup_to_r2.py` | backup utility |
| `scripts/backup_to_r2.sh` | shell wrapper for backups |
| `scripts/run_dev.sh` | recommended dev launcher |
| `scripts/lily_pond_demo_check.py` | local/live doctor |
| `scripts/smoke_providers.py` | provider sanity check |
| `scripts/publish_demo_menu_photos.py` | bulk demo photo publisher |
| `scripts/generate_lily_pond_training.py` | synthetic Lily Pond SFT golden-path JSONL generator |
| `scripts/build_render_env.py` | local helper that writes an ignored Render env bundle from `.env` |
| `scripts/audit_battery.sh` | audit helper |

Current high-value scripts:

- `lily_pond_demo_check.py` is the single best “is the demo alive?” script
- `publish_demo_menu_photos.py` is the current bulk image hydration tool
- `smoke_providers.py` is the credential sanity probe
- `generate_lily_pond_training.py` creates OpenAI-style chat fine-tuning JSONL
  examples for Lily Pond, including tool schemas and tool-call turns

### 21.1 Lily Pond training data generator

The Lily Pond training generator is for synthetic golden paths:

```bash
make generate-lily-training
./.venv/bin/python scripts/generate_lily_pond_training.py --examples 100 --seed 42
./.venv/bin/python scripts/generate_lily_pond_training.py --examples 50 --sample 2
```

Current behavior:

- writes `lily_pond_training_v1.jsonl` by default,
- uses JSONL with one complete chat-training object per line,
- includes `tools` and `parallel_tool_calls=false`,
- uses only real tool names from the current assistant tool surface,
- avoids the non-existent `cancel_pending_order` tool because cancellation is
  handled deterministically by the channel layer,
- uses the actual Lily Pond seed prices from `scripts/seed_geneat_demo.py`,
- avoids teaching bad payment copy such as `paid`, `confirmed`, `pickup ready`,
  or `ready by` before payment lands,
- generated `lily_pond_training_*.jsonl` files are ignored by git.

## 22. Testing

### 22.1 Current fast suite

```bash
make test-fast
```

Current result:

```text
71 passed, 1 warning
```

### 22.2 Builds

```bash
cd admin-ui && npm run build
cd gen-eat-portal && npm run build
```

Current result:

- admin build passed
- portal build passed

### 22.3 Live system doctor

```bash
make doctor-live
```

Current result:

```text
20/20 configured checks passed
```

This is now the main high-signal smoke test for the hosted demo stack.

### 22.4 Other useful tests

```bash
./.venv/bin/python -m pytest tests/test_job_runner.py -q
./.venv/bin/python -m pytest tests/test_payments_hardening.py -q
./.venv/bin/python -m pytest tests/test_llm_failover.py -q
./.venv/bin/python -m pytest tests/test_logging.py -q
```

### 22.5 Known warning

LangGraph / LangChain still emits a pending deprecation warning around
`allowed_objects`. It is not currently a release blocker.

## 23. Scaling Notes And Known Gaps

This is the honest list, not the flattering list.

### 23.1 Things that are now in much better shape

- hosted API is live on Render
- live doctor passes end to end
- DB and Redis health checks are real
- OpenAI health is visible in `/health/deep`
- photo requests send real media through a deterministic action path
- normal WhatsApp text is model-led first, with deterministic quick replies
  reserved for timeout/failure rescue
- safety rules now let normal café wording and photo requests reach the model
  while still blocking real prompt-injection attempts
- order/payment turns now guard against duplicate pending orders, duplicate
  STK pushes, premature pickup-ready promises, and wrong-language payment
  failure messages
- production startup validation now fails fast on live-payment, Meta webhook,
  GPT-5 Responses, and embedding-dimension misconfigurations
- `doctor-live` now retries transient hosted health/webhook/chat/photo probes
  before failing, so the operator signal is less brittle
- customer cancel/resend payment intents bypass the model and update pending
  order/payment job state directly
- raw KB fallback no longer exposes internal demo/operator policy chunks to
  customers
- durable jobs survive restarts
- payment callbacks scope through `orders.business_id`
- tenant photo catalogs can now be managed and published centrally
- developer UX is better via `make`, `run_dev.sh`, and color console logs

### 23.2 Current honest gaps

| Gap | Impact | Likely fix |
| --- | --- | --- |
| WhatsApp conversation quality still needs live rehearsal after each deploy | late replies, provider lag, or stale deployed code can still break trust during a demo even when local tests pass | run a real WhatsApp order/payment/cancel/photo script after every deploy before a client meeting |
| Render live stack is still beta-grade | free-tier spin-down / manual service drift can make operations annoying | move to paid Render or another always-on managed host |
| Event bus is not durable | SSE / outbound webhooks can miss events during Redis/listener gaps | add outbox table or Redis Streams |
| Public admin deployment is optional, not standardized | ops may still depend on local admin in some workflows | deploy and document a stable public admin URL |
| Demo menu photos are mostly representative, not merchant-owned | looks real enough for pilot, not final merchant polish | upload tenant-owned photos per client |
| Photo fuzzy matching can produce odd alias labels | image still arrives, but metadata can look slightly odd | tighten photo alias ranking |
| PG migration CI is still missing | migration regressions can reach deploy time | add Postgres + pgvector CI step |
| Alerting is still missing | failures may stay silent until someone notices | wire health / webhook / payment alerts |
| `audioop` deprecation remains | Python 3.13 upgrade risk for voice | replace mu-law decoder path |
| Secrets still live in `.env` workflows too often | higher chance of accidental exposure | move fully to host secret managers and rotate exposed values |

### 23.3 What is live, demo-ready, and production-ready

Technically live right now:

- yes

First-client demo-ready right now:

- not until the current hardening commit is deployed and a fresh real
  WhatsApp rehearsal passes

Reason:

- WhatsApp, STK, photos, hosted API, hosted DB, and hosted Redis are live.
- The remaining blocker is no longer basic wiring; it is deployment discipline
  and live rehearsal. The required script is: ask menu availability, request a
  photo, place the KES 10 Demo Espresso order, handle STK pending, cancel once,
  resend STK once, pay once, and confirm receipt/ready behavior.

Production-ready in the “don’t stress me at all” sense:

- not fully yet

The delta is now conversation polish plus operational hardening, not basic
connectivity.

## 24. Documentation Policy

This README is the canonical system document.

All other Markdown files should stay small and point back here:

- [docs/BETA_DEPLOY.md](/home/lesnar/Documents/ai model/docs/BETA_DEPLOY.md)
- [docs/business_plan_geneat_usiu_pilot.md](/home/lesnar/Documents/ai model/docs/business_plan_geneat_usiu_pilot.md)
- [admin-ui/README.md](/home/lesnar/Documents/ai model/admin-ui/README.md)
- [gen-eat-portal/README.md](/home/lesnar/Documents/ai model/gen-eat-portal/README.md)
- [gen-eat-portal/public/menu/README.md](/home/lesnar/Documents/ai model/gen-eat-portal/public/menu/README.md)
- [deploy/render/README.md](/home/lesnar/Documents/ai model/deploy/render/README.md)
- [deploy/truehost/README.md](/home/lesnar/Documents/ai model/deploy/truehost/README.md)

Rules:

1. If the system changes, update this README first.
2. Keep package-local READMEs thin.
3. Do not reintroduce a second long-form architecture or deploy guide unless
   there is a compelling, isolated reason.
4. When reality and aspiration differ, document both clearly and label which
   one is live truth.
