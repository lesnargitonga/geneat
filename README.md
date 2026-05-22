# Omnichannel AI Business Agent / Gen-Eat Platform

This file is the single source of truth for the whole repository.

All project Markdown files now point back here. If the code changes, update
this README first. The code is the final authority, but this document is the
canonical human map of how the system works, how it is supposed to work, how
to run it, how to deploy it, and where the current risks are.

Last reconciled with the codebase: 2026-05-21.

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

The repository contains a production-oriented, multi-tenant AI platform for
small businesses. One backend receives customer messages from WhatsApp, voice,
SMS-style channels, and mock/web clients, resolves the business tenant, runs a
LangGraph assistant with business-specific RAG and tools, persists the
conversation, and sends the response back through the correct channel.

The flagship demo is Gen-Eat at USIU-Africa:

- Student-facing Next.js portal in `gen-eat-portal/`.
- Four cafe tenants seeded by `scripts/seed_geneat_demo.py`.
- Students browse cafes, open a chat widget, and talk to the same backend
  through `/mock/message` via the portal's `/api/chat` proxy.
- The real platform also supports WhatsApp Business, Twilio voice streams,
  Africa's Talking voice callbacks, M-Pesa-style payments, admin takeover,
  broadcasts, outbound merchant webhooks, usage metrics, and privacy exports.

Live/demo values currently documented in the repo:

| Thing | Value |
| --- | --- |
| Portal | `https://gen-eat-portal.vercel.app` |
| API | `https://api.lesnarai.co.ke` |
| API health | `https://api.lesnarai.co.ke/healthz` |
| Gen-Eat cafes | Lily Pond Cafe, Library Bites, Pavilion Grill, Block A Express |
| Portal backend env | `BACKEND_URL=https://api.lesnarai.co.ke` in `gen-eat-portal/vercel.json` |

Core promise:

- No new customer app.
- Businesses manage knowledge, conversations, broadcasts, webhooks, members,
  prompts, profile JSON, safety state, and usage through the admin console.
- The same customer can move across channels while conversation state remains
  tied to the customer and tenant.

## 2. Current Truth And Verification

The codebase is not a git repository in this workspace, so there is no commit
history available from local `git`.

Latest local verification run:

| Check | Result |
| --- | --- |
| Python compile | `./.venv/bin/python -m compileall -q app scripts tests` passed |
| Backend tests | `./.venv/bin/python -m pytest -q -m "not pg" --maxfail=5` -> `70 passed, 4 deselected` |
| Focused durable job tests | `tests/test_job_runner.py` -> `2 passed` |
| Admin UI build | `cd admin-ui && npm run build` passed |
| Gen-Eat portal build | `cd gen-eat-portal && npm run build` passed |
| Alembic head | single head: `0010_enforce_embedding_768` |
| Requirements dry-run | previously resolved after dependency pin correction |

The four deselected tests are marked `pg` and need a real Postgres plus
pgvector service. They were not run locally in the latest verification pass.

Current important migrations:

| Migration | Purpose |
| --- | --- |
| `0001_init` | customers, conversations, messages, orders, KB, audit/tool tables, base enums |
| `0002_embed_768` | aligns vector dimension with local Ollama embeddings |
| `0003_businesses` | tenant/business table |
| `0004_conversations_business_id` | tenant-scoped conversations |
| `0005_business_geo` | business geolocation fields |
| `0006_admin_console` | admin users, memberships, broadcasts, webhooks, takeover columns |
| `0007_customer_safety` | customer abuse/blocking fields |
| `0008_orders_business_id` | direct tenant scope on orders |
| `0009_background_jobs` | durable in-app job queue |
| `0010_enforce_embedding_768` | idempotently repairs long-lived DBs still on `vector(1536)` |

Deploy rule: run `alembic upgrade head` before restarting the backend after
pulling this version. The `background_jobs` table is required for broadcasts,
order-ready follow-ups, simulator confirmation, and unpaid-payment reminders.

## 3. Repository Map

Top-level shape:

```text
ai model/
  README.md
  requirements.txt
  pytest.ini
  alembic.ini
  docker-compose.yml
  Dockerfile
  start.sh
  app/
  alembic/versions/
  admin-ui/
  gen-eat-portal/
  docs/
  scripts/
  tests/
  logs/
```

Backend:

```text
app/
  main.py
  api/
    admin.py
    admin_auth.py
    admin_console.py
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

Frontend and docs:

```text
admin-ui/
  Vite + React + TypeScript + Tailwind admin SPA

gen-eat-portal/
  Next.js 14 customer-facing Gen-Eat portal
  app/api/chat/route.ts proxies chat to backend /mock/message
  lib/cafes.ts is the portal data source mirrored from the seed script
  public/menu/ can hold local menu photography

docs/
  thin compatibility pointers back to this README

scripts/
  seeders, provider smoke tests, backup scripts, local dev helper, admin user tool

tests/
  unit/integration tests plus provider mocks
```

## 4. System Architecture

High-level architecture:

```text
Customer channel
  WhatsApp Meta / Twilio WA / Twilio voice / Africa's Talking voice / mock UI / portal
        |
        v
FastAPI route
        |
        v
Tenant and customer resolution
        |
        v
Session lock and channel-presence guard
        |
        v
Safety pre-filter
        |
        v
Conversation persistence
        |
        v
LangGraph AI turn
  - prompt composed with tenant profile and playbook
  - LLM selected through provider/failover layer
  - tools can read KB, create orders, request payment, book calendar,
    escalate, send location, send menu photo, update customer name
        |
        v
Safety post-filter and output sanitization
        |
        v
Message persistence, event publish, channel response
```

Stateful services:

| Service | Role |
| --- | --- |
| Postgres | system of record for tenants, customers, conversations, messages, orders, KB chunks, admin users, broadcasts, jobs, webhooks, audit |
| pgvector | vector search on `knowledge_base.embedding` |
| Redis | locks, idempotency, cached results, rate limits, token cache, Pub/Sub event bus |
| Durable job runner | DB-backed worker inside FastAPI workers for request-detached work |
| Event bus | Redis Pub/Sub for cross-worker notifications and SSE/webhook fan-out |

External providers:

| Provider | Use |
| --- | --- |
| Meta WhatsApp Cloud API | WhatsApp webhook and outbound messages |
| Twilio | WhatsApp fallback route and voice Media Streams |
| Africa's Talking | voice callback support |
| Safaricom Daraja | M-Pesa STK push and callbacks |
| IntaSend | hosted/M-Pesa payment provider |
| Paystack | hosted checkout callback support |
| Stripe | hosted checkout callback support |
| OpenAI | primary chat and primary 768-d embeddings |
| Groq | chat fallback/provider |
| Gemini | chat fallback/provider |
| Ollama | local chat and zero-cost 768-d embedding fallback |
| Google Calendar | booking tool |
| Cloudflare R2 | media and database backups |
| Sentry | error reporting with PII scrubber |

## 5. Runtime Request Flow

Inbound text path:

1. A route receives a provider payload:
   - `app/api/whatsapp.py` for Meta WhatsApp.
   - `app/api/whatsapp_twilio.py` for Twilio WhatsApp.
   - `app/api/mock.py` for local/portal mock messages.
   - `app/api/voice.py` for Twilio voice.
   - `app/api/voice_at.py` for Africa's Talking voice.
2. Provider signature or verification is applied where available.
3. The route creates a normalized channel turn and hands it to
   `app/channels/base.py`.
4. Tenant resolution runs:
   - explicit `business_id`
   - explicit `business_slug`
   - Meta phone number id
   - sticky active conversation
   - default business slug
   - oldest active business fallback
5. Customer is resolved by normalized MSISDN.
6. Redis locking prevents concurrent turns for the same phone hash.
7. Channel-presence guard detects interleaving across channels and publishes
   a `conversation.interleaved` event with a hashed phone target.
8. Deterministic safety checks can block, score, or short-circuit harmful
   input before any LLM call.
9. User message is appended to the conversation.
10. LangGraph runs the assistant and tools.
11. Output is checked for forbidden phrases and unsupported prices.
12. AI/staff/system message is saved.
13. `message.created` and related events are published for SSE/webhooks.
14. The provider-specific channel sends the response.

Voice path:

1. Twilio calls `POST /webhooks/voice/inbound`.
2. The app returns TwiML that connects a Media Stream websocket at
   `/webhooks/voice/stream`.
3. The websocket receives 8 kHz mu-law frames.
4. The code converts mu-law audio to WAV before transcription.
5. WebRTC VAD and utterance serialization avoid overlapping STT/LLM/TTS
   work.
6. Voice sessions are registered in `app/channels/voice_registry.py`; aliases
   map temporary stream IDs to real conversation IDs.
7. Cross-worker `voice.say` and `voice.hangup` events can reach the worker
   holding the websocket.

Payment callback path:

1. Provider callback route receives a payload.
2. Signature/source checks run:
   - Daraja source-IP check in production.
   - IntaSend HMAC verification.
   - Paystack callback verification.
   - Stripe `Stripe-Signature` HMAC verification with timestamp tolerance.
3. Callback is parsed into checkout reference, status, amount, and receipt.
4. The matching order is found by checkout ID.
5. `orders.business_id` is used directly; older rows are backfilled from
   conversation where possible.
6. Paid callbacks publish `payment.completed` with tenant context.
7. Customer notification is best effort.

## 6. Data Model And Migrations

Core SQLAlchemy models live in `app/db/models.py`.

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

Tables:

| Table/model | Purpose |
| --- | --- |
| `businesses` / `Business` | tenant record, WhatsApp phone id, profile JSON, location, brand voice |
| `customers` / `Customer` | customer phone, name, language, safety/block state |
| `conversations` / `Conversation` | channel thread, tenant scope, status, takeover state |
| `messages` / `Message` | persisted user/AI/system/staff messages with safety flags |
| `orders` / `Order` | order/payment/booking row, direct `business_id`, checkout id, receipt |
| `knowledge_base` / `KnowledgeChunk` | RAG chunks and vector embeddings |
| `tool_invocations` / `ToolInvocation` | audit trail for AI tool calls |
| `audit_events` / `AuditEvent` | security/compliance/admin audit stream |
| `admin_users` / `AdminUser` | local admin identity, bcrypt hash, token version |
| `tenant_memberships` / `TenantMembership` | user-to-business membership and role |
| `broadcasts` / `Broadcast` | outbound broadcast campaign metadata/progress |
| `webhook_endpoints` / `WebhookEndpoint` | tenant outbound webhook destinations and secrets |
| `background_jobs` / `BackgroundJob` | durable queue for delayed/retryable internal jobs |

Embedding truth:

- `EMBED_DIM = 768`.
- The default embedding path is OpenAI `text-embedding-3-large` with
  `OPENAI_EMBED_DIMENSIONS=768`.
- The zero-cost fallback embedding path is Ollama `nomic-embed-text`.
- The database migration and model now agree on `vector(768)`.
- OpenAI's v3 embedding models support the `dimensions` parameter, so the app
  can use OpenAI embeddings without migrating the vector column as long as the
  configured dimension remains 768.

Order tenant truth:

- Orders now carry direct nullable `business_id`.
- New orders created by the AI set `Order.business_id`.
- Payment callbacks use `orders.business_id`.
- Older rows can be backfilled from `conversations.business_id` by migration
  `0008_orders_business_id`.

Background job truth:

- `background_jobs.payload` uses generic JSON for SQLite compatibility in
  tests and Postgres compatibility in production.
- Claiming uses `FOR UPDATE SKIP LOCKED` on Postgres.
- Stale `running` jobs are reclaimable after their lease expires.

## 7. Tenant Model And Routing

The system is multi-tenant from the data model upward.

Tenant record:

- `Business.slug` is the human/API stable identifier.
- `Business.meta_wa_phone_number_id` maps a Meta WABA phone number to a tenant.
- `Business.profile` stores operational JSON like hours, menu policy,
  currency, average prep minutes, timezone, and other tenant-specific details.
- `Business.brand_voice` and `Business.greeting_template` tune the assistant.
- Latitude/longitude support location-pin features and portal maps.

Tenant resolution order for inbound turns:

1. Explicit `business_id`.
2. Explicit `business_slug`.
3. Meta phone number id from provider payload.
4. Existing active conversation for that customer.
5. `DEFAULT_BUSINESS_SLUG`.
6. Oldest active business fallback.

Isolation rules:

- Conversations are scoped by `business_id`.
- Orders are scoped by `business_id`.
- KB retrieval is scoped by `business_id`.
- Admin console routes require membership or superadmin/machine access.
- SSE tenant filtering drops events without tenant context for tenant users.
- Safety customer blocking is per customer row, but operational actions expose
  masked phone plus hash rather than raw phone in sensitive views.

## 8. AI Brain, RAG, Tools, And Playbooks

Primary AI modules:

| File | Role |
| --- | --- |
| `app/ai/graph.py` | LangGraph orchestration |
| `app/ai/llm.py` | provider selection and failover chain |
| `app/ai/prompts.py` | system prompt construction |
| `app/ai/rag.py` | vector and keyword retrieval |
| `app/ai/tools.py` | tool definitions exposed to the assistant |
| `app/ai/safety.py` | deterministic pre/post safety filters |
| `app/ai/ollama_embed.py` | local embedding client |
| `app/ai/playbooks/` | industry-specific response rules |

LLM provider truth:

- `LLM_PROVIDER` can be `groq`, `gemini`, `openai`, or `local`.
- The best-provider default is `LLM_PROVIDER=openai`.
- The practical OpenAI default is `OPENAI_MODEL=gpt-5.4-mini`; set
  `OPENAI_MODEL=gpt-5.5` when maximum intelligence is worth the higher latency
  and cost.
- OpenAI runs through the Responses API via `OPENAI_USE_RESPONSES_API=true`.
- `OPENAI_STORE_RESPONSES=true` is required for Responses API tool loops such
  as "send photo, then reply"; if this must be disabled for policy reasons,
  use `OPENAI_USE_RESPONSES_API=false` instead.
- `LLM_FALLBACK_PROVIDERS` is a comma-separated ordered fallback list.
- Recommended fallback order is `gemini,local`.
- Circuit breakers prevent repeated calls to unhealthy providers.
- Local LLM mode uses an OpenAI-compatible Ollama base URL.

Embedding provider truth:

- `EMBED_PROVIDER=openai` is the quality default.
- `OPENAI_EMBED_MODEL=text-embedding-3-large`.
- `OPENAI_EMBED_DIMENSIONS=768` must stay aligned with `vector(768)`.
- `EMBED_PROVIDER=local` remains the no-cost fallback path.

Tools exposed to the assistant:

| Tool | Purpose |
| --- | --- |
| `knowledge_lookup` | tenant-scoped RAG lookup |
| `create_order` | creates an order linked to customer, conversation, business |
| `request_mpesa_payment` | asks the active payment adapter to request payment |
| `book_appointment` | creates calendar bookings |
| `escalate_to_human` | pauses AI and escalates to staff/owner |
| `send_location_pin` | sends a business location pin |
| `send_menu_photo` | sends menu item image/media |
| `update_customer_name` | stores customer name |

Order tool safeguards:

- Per-customer, per-business velocity bucket prevents order spam.
- New orders set tenant context.
- Order-ready follow-up is scheduled through durable jobs, not an in-memory
  task.

Payment tool safeguards:

- Normalizes MSISDNs.
- Uses a Redis idempotency key based on conversation, MSISDN, order reference,
  and amount.
- Attaches checkout ID only to the latest pending order in the same
  conversation/business.
- Simulator auto-confirmation is scheduled through durable jobs.

RAG behavior:

- Vector search uses pgvector when available.
- Keyword fallback exists for graceful degradation.
- Post-LLM price checks can redact unsupported prices unless the price is in
  tenant knowledge.

## 9. Channels

### Mock Channel

Routes:

- `POST /mock/message`
- `POST /mock/image`

The mock channel is the easiest end-to-end path for local tests, portal chat,
and demos without provider credentials.

### WhatsApp - Meta Cloud API

Routes:

- `GET /webhooks/whatsapp` for verification.
- `POST /webhooks/whatsapp` for inbound messages.

Capabilities:

- Signature verification via `META_WA_APP_SECRET`.
- Text, image, voice-note/media handling.
- Meta outbound text, image, location, and template paths.
- Rate limiting through Redis token bucket.

Important env:

- `WHATSAPP_PROVIDER=meta`
- `META_WA_PHONE_NUMBER_ID`
- `META_WA_ACCESS_TOKEN`
- `META_WA_VERIFY_TOKEN`
- `META_WA_APP_SECRET`

### WhatsApp - Twilio

Routes:

- `POST /webhooks/whatsapp/twilio/inbound`
- `POST /webhooks/whatsapp/twilio/status`

Used as a Twilio-backed WhatsApp path where configured.

### Voice - Twilio Media Streams

Routes:

- `POST /webhooks/voice/inbound`
- `WS /webhooks/voice/stream`

Capabilities:

- Twilio signature verification when `TWILIO_AUTH_TOKEN` is configured.
- Mu-law audio conversion to WAV before transcription.
- WebRTC VAD.
- Serialized utterance handling to avoid overlapping AI turns.
- ElevenLabs streaming TTS.
- Cross-worker voice session commands through Redis Pub/Sub.

Python caveat:

- The current mu-law conversion uses `audioop`, which works on Python 3.12
  but is deprecated for Python 3.13. Replace it before upgrading runtime to
  Python 3.13.

### Voice - Africa's Talking

Routes:

- `POST /webhooks/at/voice`
- `POST /webhooks/at/voice/events`

Used for Africa's Talking voice callbacks and status events.

### SMS

The enum and some architecture refer to SMS. The primary shipped customer
paths in this repository are WhatsApp, voice, mock, and portal. Treat SMS as
a channel type prepared in the model rather than a fully documented provider
flow here.

## 10. Payments

Payment modules live under `app/integrations/payments/`.

Adapters:

| Adapter | File | Notes |
| --- | --- | --- |
| Daraja | `daraja.py` and legacy `app/integrations/mpesa_client.py` | M-Pesa STK push and callback |
| IntaSend | `intasend.py` | M-Pesa/hosted style callback with HMAC |
| Paystack | `paystack.py` | hosted checkout callback support |
| Stripe | `stripe.py` | Stripe-signature webhook verification |
| Simulator | `simulator.py` | local/demo fake payment provider |

Provider selection:

- `PAYMENT_PROVIDER` supports `daraja`, `intasend`, `paystack`, `stripe`.
- `PAYMENT_SIMULATOR=true` makes the factory use the internal simulator and
  skips real provider credential validation.

Routes:

- `POST /payments/stk-push`
- `POST /payments/callback`
- `POST /payments/intasend/callback`
- `POST /payments/paystack/callback`
- `POST /payments/stripe/callback`

Callback behavior:

- Daraja callback checks source IP in production.
- Daraja validates amount and receipt before marking paid.
- Receipt idempotency prevents duplicate replay.
- IntaSend verifies callback HMAC; empty secret is allowed only outside prod.
- Paystack rejects missing/empty secret key for callback verification.
- Stripe verifies `Stripe-Signature` using HMAC SHA-256 and timestamp
  tolerance.
- Stripe parser prefers checkout session `id` so it can match
  `Order.mpesa_checkout_id`.
- Hosted callbacks do not mark pending callback states as terminal
  idempotency wins.
- Already-paid orders are not downgraded to failed.

Order lifecycle:

```text
create_order tool
  -> Order(payment_status=pending, business_id set)
  -> optional order.ready durable job

request_mpesa_payment tool or /payments/stk-push
  -> adapter request
  -> checkout id attached to matching pending order
  -> unpaid follow-up job scheduled where applicable

provider callback
  -> verify
  -> match order by checkout id
  -> mark paid/failed/cancelled/timeout
  -> publish payment.completed if paid
  -> notify customer best effort
```

## 11. Durable Jobs

Durable jobs are implemented in:

- `app/jobs/runner.py`
- `app/jobs/handlers.py`
- `app/jobs/order_ready_notifier.py`
- `BackgroundJob` model in `app/db/models.py`
- migration `0009_background_jobs`

Why it exists:

- Request-local `asyncio.create_task` work is lost on process restart.
- Broadcasts, delayed reminders, order-ready nudges, and simulator callbacks
  need to survive request completion and worker churn.
- A full Celery/RQ stack is not necessary for the current beta footprint.

How it works:

1. Code calls `enqueue_job(db, kind=..., payload=..., run_at=...)`.
2. The row is committed with the surrounding transaction.
3. FastAPI lifespan imports `app.jobs.handlers` to register handlers.
4. FastAPI lifespan starts the runner.
5. Runner polls due queued jobs.
6. Runner claims jobs with row locks and a lease.
7. Handler runs.
8. Success marks `done`.
9. Failure marks `queued` with exponential backoff or `failed` after
   `max_attempts`.
10. Jobs stuck in `running` past `locked_until` can be reclaimed.

Current job kinds:

| Kind | Handler | Purpose |
| --- | --- | --- |
| `broadcast.send` | `run_broadcast_send` | sends tenant broadcast recipients |
| `order.ready` | `run_order_ready` | sends pickup-ready WhatsApp follow-up |
| `payment.simulator_confirm` | `run_simulated_payment_confirm` | auto-confirms simulator payments |
| `payment.unpaid_followup` | `run_unpaid_payment_followup` | reminds customer if payment still pending |

Operational note:

- For very large campaigns, this table-runner can be replaced or augmented
  with external workers. The job table gives a clean migration path because
  work is already durable and typed by `kind`.

## 12. Event Bus, SSE, And Webhooks

Event bus:

- File: `app/core/event_bus.py`.
- Redis channel: `omni:events`.
- Each FastAPI worker starts one listener.
- Handlers register through `@on_event(...)`.
- Pub/Sub is fire-and-forget. If Redis is down or a subscriber is offline,
  events during that gap can be missed.

Known event types:

| Event | Purpose |
| --- | --- |
| `payment.completed` | an order became paid |
| `voice.hangup` | close active voice websocket |
| `voice.say` | inject speech into active voice stream |
| `escalation.opened` | user was escalated to human |
| `conversation.interleaved` | second channel arrived while another channel is active |
| `message.created` | message persisted |
| `conversation.takeover` | staff took over conversation |
| `conversation.released` | staff released conversation back to AI |
| `broadcast.progress` | broadcast progress changed |

SSE:

- Route: `GET /admin/stream`.
- Used by admin UI live stream.
- Supports named event listeners in the React UI.
- Tenant users only receive events with allowed tenant context.
- Events are enriched with `business_slug` and `conversation_id` where
  possible.

Outbound webhooks:

- File: `app/services/webhook_dispatcher.py`.
- Driven by event bus events.
- Tenant endpoint model: `WebhookEndpoint`.
- Body is HMAC-SHA256 signed with endpoint secret.
- Header: `X-Omni-Signature: sha256=<hex>`.
- Extra headers: `X-Omni-Event-Id`, `Content-Type`, `User-Agent`.
- Retries: 3 attempts with backoff.
- Permanent 4xx responses other than 408/429 are not retried.
- Cross-worker dedup uses Redis `SET NX EX`.
- Per-worker concurrency cap: `asyncio.Semaphore(16)`.
- Endpoints auto-disable after `failure_count >= 20`.

Important truth:

- Webhook delivery has bounded HTTP retries after the event reaches a worker.
- The source event bus is Redis Pub/Sub, not a durable stream. If guaranteed
  webhook delivery becomes a hard requirement, add an outbox table or Redis
  Streams layer.

## 13. Admin Console

Backend files:

- `app/api/admin_auth.py`
- `app/api/admin_console.py`
- `app/api/admin.py` legacy/admin-token routes
- `app/api/deps.py`
- `app/services/staff_dispatch.py`

Frontend:

- `admin-ui/`
- Vite + React + TypeScript + Tailwind
- React Query for data fetching
- React Router for navigation

Auth model:

- Local admin users with bcrypt password hashes.
- Access and refresh JWTs.
- Token version invalidates all sessions on password change/logout-all.
- Machine/legacy token routes still exist where supported.

Roles:

| Role | Scope |
| --- | --- |
| `superadmin` | cross-tenant control |
| `owner` | full control inside tenant |
| `staff` | takeover, staff messages, operational work |
| `viewer` | read-only tenant access |

Admin features:

- Login, refresh, logout-all, password change.
- User management.
- Tenant membership management.
- Business create/list/detail.
- Conversation list/detail/resolve.
- Staff takeover/release.
- Staff-authored messages.
- Escalation queue.
- KB list/add/edit/delete/re-embed.
- Business profile JSON editor.
- Prompt/brand voice editor.
- Outbound webhook CRUD and secret rotation.
- Usage dashboard.
- Broadcast campaign create/list/send/cancel.
- Safety flagged queue, block, unblock.
- Audit log.
- SSE live event feed.

Admin UI routes:

| UI route | Purpose |
| --- | --- |
| `/login` | JWT login |
| `/` | dashboard |
| `/live` | SSE live event feed |
| `/businesses` | tenant list |
| `/businesses/:slug` | tenant detail shell |
| `/businesses/:slug/conversations` | tenant conversations |
| `/businesses/:slug/profile` | profile JSON |
| `/businesses/:slug/prompt` | prompt/brand voice |
| `/businesses/:slug/kb` | knowledge base |
| `/businesses/:slug/broadcasts` | broadcasts |
| `/businesses/:slug/webhooks` | webhooks |
| `/businesses/:slug/usage` | usage |
| `/businesses/:slug/members` | members |
| `/conversations/:id` | live thread/takeover |
| `/audit` | audit log |

Token storage:

- Access token: `localStorage["omni.access"]`.
- Refresh token: `localStorage["omni.refresh"]`.
- API helper auto-refreshes on 401 and deduplicates concurrent refreshes.

Admin UI local commands:

```bash
cd admin-ui
npm install
npm run dev
npm run build
npm run preview
```

## 14. Frontends

### Admin UI

Location: `admin-ui/`.

Purpose:

- Operational staff/admin control plane.
- Talks directly to FastAPI `/admin/*`.
- Dev server defaults to Vite on `http://localhost:5173`.

Build truth:

```bash
cd admin-ui
npm run build
```

Latest local build passed.

### Gen-Eat Portal

Location: `gen-eat-portal/`.

Purpose:

- Student-facing cafe directory.
- Cafe detail pages with menus, story, map, and chat.
- Owner/school sales page.
- Server-side chat proxy to backend.

Runtime:

- Next.js 14.
- Dev server: `npm run dev` on port 3000.
- Production build: `npm run build`.
- Start: `npm run start`.

Important files:

| File | Purpose |
| --- | --- |
| `app/page.tsx` | home |
| `app/cafes/page.tsx` | cafe list |
| `app/cafes/[slug]/page.tsx` | cafe detail |
| `app/map/page.tsx` | campus map |
| `app/owners/page.tsx` | owner/school sales page |
| `app/api/chat/route.ts` | server-side proxy to backend `/mock/message` |
| `components/ChatWidget.tsx` | floating chat UI |
| `lib/cafes.ts` | portal cafe/menu data |
| `vercel.json` | Vercel config and `BACKEND_URL` |

Chat flow:

```text
ChatWidget
  -> POST /api/chat
  -> Next route handler
  -> POST {BACKEND_URL}/mock/message
  -> FastAPI handle_inbound
  -> AI reply
  -> portal renders assistant response
```

Portal env:

| Var | Purpose |
| --- | --- |
| `BACKEND_URL` | server-side backend target for `/api/chat` |
| `NEXT_PUBLIC_BACKEND_URL` | optional fallback, not preferred for browser exposure |

Menu photography:

- Put local images in `gen-eat-portal/public/menu/<cafe-slug>/`.
- Reference them from `gen-eat-portal/lib/cafes.ts` as
  `/menu/<cafe-slug>/<file>.jpg`.
- When no image exists, the portal falls back to a styled emoji/brand color
  card.
- Recommended image size: around 1200 x 1200 JPEG, quality 80, below 200 KB.

Latest local build passed.

## 15. Gen-Eat USIU Pilot

Gen-Eat is the campus food-ordering pilot built on top of the platform.

One-paragraph pitch:

Students at USIU lose time in cafe queues during peak meal windows. Gen-Eat
lets a student message a cafe from their phone, ask about the menu, place an
order, pay or prepare for pickup, and walk to the counter when the order is
ready. For cafes, it captures demand that is currently lost when students
avoid the queue.

Pilot scope:

| Item | Truth |
| --- | --- |
| Campus | USIU-Africa |
| Pilot length | 90 days |
| Initial cafes | 4 |
| Customer app | none; web/WhatsApp-style chat |
| Merchant cost during pilot | KES 0 |
| Target proof | usage, fulfillment, repeat orders, cafe conversion |

The four seeded/demo cafes:

| Cafe | Slug | Theme |
| --- | --- | --- |
| Lily Pond Cafe | `lily-pond-cafe` | coffee, brunch, outdoor seating |
| Library Bites | `library-bites` | grab-and-go, snacks, exam fuel |
| Pavilion Grill | `pavilion-grill` | grill, lunch, group orders |
| Block A Express | `block-a-express` | quick bites, delivery to dorms |

Current live Lily Pond demo truth:

- Lily Pond is the flagship live demo tenant.
- The portal WhatsApp CTA for Lily Pond points at the configured Meta test
  display number: `+1 555-657-8220`.
- `DEFAULT_BUSINESS_SLUG` defaults to `lily-pond-cafe`, so unscoped local
  WhatsApp/demo traffic lands on Lily Pond unless the webhook resolves a more
  specific tenant.
- `scripts/seed_geneat_demo.py` maps the configured
  `META_WA_PHONE_NUMBER_ID` onto Lily Pond when the env value exists. This is
  the preferred Meta Cloud API routing path.
- The Lily Pond menu/KB includes `Demo Espresso` at `KES 10`. The AI is
  instructed to treat "10 bob", "ten bob", "demo espresso", and "demo order"
  as this item, then trigger the normal order + M-Pesa STK flow after name
  capture.
- For a real WhatsApp Cloud API test, the student's handset must be allowed by
  the Meta app/test-number setup, and the Meta webhook must point to
  `/webhooks/whatsapp`.

Budget from the original pilot plan:

| Bucket | KES | Purpose |
| --- | ---: | --- |
| WhatsApp Business API | 4,500 | student-facing number/conversations |
| AI model usage | 5,200 | model tokens for real conversations |
| Cloud server for 3 months | 2,400 | platform hosting |
| Domain | 1,600 | professional pilot domain |
| Printed table tents / QR posters | 3,300 | cafe activation |
| Buffer | 3,000 | contingency |
| Total | 20,000 | pilot launch cost |

90-day plan:

1. Days 1-14: sign 4 cafes, upload menus, print/place table tents.
2. Days 15-60: launch one cafe at a time, track orders/fulfillment/complaints.
3. Days 61-90: show cafes their numbers and convert at least 2 of 4.

Post-pilot revenue assumptions from the original plan:

- Cafe subscription: KES 5,000/month per cafe.
- Optional per-order fee: 1.5% capped at KES 10.
- Conservative subscription-only target:
  - Month 3: 2 cafes, KES 10,000/month.
  - Month 6: 6 cafes, KES 30,000/month.
  - Month 9: 10 cafes, KES 50,000/month.
  - Month 12: 15 cafes, KES 75,000/month.

Original investor ask from the plan:

- Total ask: KES 20,000.
- KES 13,000 as stake: 8% of net profit.
- KES 7,000 as loan: repaid from first profits, no interest.
- Monthly reporting and shared expense visibility.

## 16. Security, Privacy, And Safety

### Secrets

Real secrets exist in local `.env`-style files in this workspace. Do not paste
or commit them. Documentation must refer to variable names, not values.

### Startup validation

`app/core/config_validator.py` validates important settings at boot.

Examples:

- LLM provider must match available credentials or local mode.
- Meta WhatsApp values must exist when `WHATSAPP_PROVIDER=meta`.
- Daraja production values must exist when Daraja is used in production.
- Real payment credential checks are skipped when `PAYMENT_SIMULATOR=true`.
- Local LLM/STT/TTS settings are guarded for production.

### Phone and PII handling

- MSISDNs are normalized before use.
- Redis lock keys use hashed MSISDNs rather than raw phones.
- Interleaving events use `msisdn_hash`, not raw phone numbers.
- Safety/admin outputs expose masked phone plus hash where appropriate.
- Privacy forget audits store phone hash, not raw phone.
- Sentry scrubber redacts phone-like substrings before sending events.

### Customer safety

The safety layer includes:

- Pre-LLM deterministic filter for jailbreak, abuse, off-topic patterns, PII
  fishing, and brand-safety categories.
- Post-LLM filter for forbidden phrasing and unsupported prices.
- Per-customer abuse score and block state.
- Admin safety routes to review flagged customers and block/unblock.

### Provider verification

- Meta WhatsApp verifies signatures when app secret is set.
- Twilio voice verifies `X-Twilio-Signature` when auth token is configured.
- Daraja production callback checks source IP.
- IntaSend/Paystack/Stripe callbacks verify signatures/secrets.

### Admin security

- JWT access/refresh tokens.
- Token version invalidates existing tokens.
- Superadmin routes are protected.
- Tenant routes enforce role membership.
- Audit events are written for sensitive operations.

## 17. Observability And Operations

Logging:

- `app/core/logging.py` uses structured logging.
- Context variables add request, tenant, and conversation context.
- Important contexts: `request_id`, `conversation_id`, `business_id`,
  `tenant_slug`.

Sentry:

- Initialized in `app/core/sentry_setup.py`.
- No-op if `SENTRY_DSN` is empty.
- PII scrubber is enabled.

Metrics:

- Route: `GET /metrics`.
- Prometheus text format.
- Metrics include request counts/latency, events, tools, safety verdicts, and
  webhook delivery records.

Health:

| Route | Purpose |
| --- | --- |
| `/healthz` | process liveness |
| `/readyz` | DB and Redis readiness |
| `/health/deep` | deeper dependency/config/provider checks |

Backups:

- `scripts/backup_to_r2.py` and `scripts/backup_to_r2.sh`.
- Intended for Cloudflare R2.

Operational watch points:

- Redis health matters for locks, idempotency, rate limits, event bus, and
  token/cache behavior.
- Postgres health matters for all persistent state and durable jobs.
- If job rows pile up in `queued` or `running`, inspect `last_error`,
  `locked_until`, and worker logs.
- If outbound webhooks stop, inspect Redis Pub/Sub, endpoint failure counts,
  and `webhook_dispatcher` logs.

## 18. Local Development

Prerequisites:

- Python 3.12.
- Docker with Postgres/pgvector and Redis.
- Node/npm for frontends.
- Optional Ollama for local LLM/embedding.

Common backend setup:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
docker-compose up -d postgres redis
alembic upgrade head
```

Run backend:

```bash
PYTHONPATH=. ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The helper script:

```bash
./scripts/run_dev.sh
```

`start.sh` is a heavier local launcher that:

- starts Docker services,
- checks Ollama models,
- runs migrations,
- seeds alpha data,
- pre-warms Ollama,
- validates Meta WA token,
- starts uvicorn.

Use it only when that full local stack is desired.

Admin user:

```bash
PYTHONPATH=. ./.venv/bin/python scripts/create_admin.py \
  --email admin@example.com \
  --password 'change-me' \
  --name 'Ops Lead' \
  --role superadmin
```

Seed Gen-Eat demo:

```bash
PYTHONPATH=. ./.venv/bin/python scripts/seed_geneat_demo.py
```

Lily Pond live demo path:

1. Apply migrations: `alembic upgrade head`.
2. Seed the four cafes: `PYTHONPATH=. ./.venv/bin/python scripts/seed_geneat_demo.py`.
3. Start the backend: `PYTHONPATH=. ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`.
   The default provider stack is OpenAI primary with Gemini/local fallback.
   For a lower-cost local rehearsal, override with `LLM_PROVIDER=gemini
   LLM_FALLBACK_PROVIDERS=local`.
4. Start the portal: `cd gen-eat-portal && npm run dev`.
5. Open `/cafes/lily-pond-cafe`.
6. Click `Order KES 10 on WhatsApp`.
7. Send the prefilled "KES 10 demo espresso" message, or type "10 bob".
8. Give the AI a cup name when asked.
9. Accept the M-Pesa STK push on the phone being charged.
10. Verify the admin console shows the conversation, order, payment state, and
    any ready-notification job.

For simulator-only local rehearsals, use `PAYMENT_PROVIDER=daraja` with
`PAYMENT_SIMULATOR=true` and `PAYMENT_SIMULATOR_AUTOCONFIRM=true`. For a real
pitch payment, use the production provider credentials and keep the amount at
`KES 10` until the live path has been proven.

Before walking into the cafe, run:

```bash
PYTHONPATH=. ./.venv/bin/python scripts/lily_pond_demo_check.py --chat
```

The check is no-secrets and non-charging. It verifies the Lily Pond tenant,
Meta routing, admin availability, portal CTA, backend health, webhook verify
handshake, and a safe "how much is the demo espresso?" chat turn.

Run admin UI:

```bash
cd admin-ui
npm install
npm run dev
```

Run portal:

```bash
cd gen-eat-portal
npm install
npm run dev
```

## 19. Production Deployment Runbook

This section replaces the old standalone beta deploy document.

### 19.1 Infrastructure

Reference server bundle:

- `deploy/truehost/README.md`
- `deploy/truehost/docker-compose.api.yml`
- `deploy/truehost/cloudflared/config.yml.example`
- `deploy/render/README.md`
- `render.yaml`

Postgres:

- Use Postgres 16 or compatible.
- Enable pgvector.
- Use a `postgresql+asyncpg://...` URL for the app.
- Check `max_connections`.
- With 2 Uvicorn workers and pool sizing 10 + overflow 20, budget up to
  60 connections.

Redis:

- Redis 7+.
- Prefer TLS/`rediss://` if hosted.
- Required for idempotency, locks, rate limits, event bus, and cache.

Object storage:

- Cloudflare R2 bucket for media.
- Separate bucket for backups if using backup scripts.

Sentry:

- Configure `SENTRY_DSN` for production/beta.
- Set environment tags outside this app if the deployment platform supports it.

DNS/TLS:

- Point API domain to host.
- Ensure websocket pass-through for Twilio voice streams.
- If using Cloudflare, avoid features that break websocket handshakes.

### 19.2 Required environment categories

Never commit env values. Configure them in the host secret manager.

Core:

| Variable | Notes |
| --- | --- |
| `APP_ENV` | `prod` for production |
| `LOG_LEVEL` | usually `INFO` |
| `DATABASE_URL` | async SQLAlchemy URL |
| `DATABASE_URL_SYNC` | sync URL for tools/migrations if needed |
| `REDIS_URL` | Redis connection |
| `SECRET_KEY` | app secret |
| `PHONE_HASH_PEPPER` | never rotate casually; used for stable phone hashes |
| `ADMIN_API_TOKEN` | legacy/machine admin token |
| `JWT_SECRET` | admin JWT signing |
| `ADMIN_CORS_ORIGINS` | comma-separated admin origins or `*` |

LLM:

| Variable | Notes |
| --- | --- |
| `LLM_PROVIDER` | `groq`, `gemini`, `openai`, or `local` |
| `LLM_FALLBACK_PROVIDERS` | comma-separated fallback order |
| `OPENAI_API_KEY` | required for OpenAI provider |
| `OPENAI_MODEL` | default `gpt-5.4-mini`; use `gpt-5.5` for highest quality |
| `OPENAI_REASONING_EFFORT` | default `low`; raise only for complex workflows |
| `OPENAI_USE_RESPONSES_API` | keep `true` for GPT-5 class models and tools |
| `OPENAI_STORE_RESPONSES` | keep `true` when Responses API tool loops are enabled |
| `GROQ_API_KEY` | required for Groq provider |
| `GEMINI_API_KEY` | required for Gemini provider |
| `USE_LOCAL_LLM` | keep false in production unless intentionally self-hosting |

Embeddings:

| Variable | Notes |
| --- | --- |
| `EMBED_PROVIDER` | default `openai`; use `local` for zero-cost rehearsals |
| `OPENAI_EMBED_MODEL` | default `text-embedding-3-large` |
| `OPENAI_EMBED_DIMENSIONS` | must be `768` while DB column is `vector(768)` |
| `LOCAL_LLM_BASE_URL` | Ollama/OpenAI-compatible URL |

WhatsApp/voice:

| Variable | Notes |
| --- | --- |
| `WHATSAPP_PROVIDER` | `meta`, `twilio`, `africastalking`, or `mock` |
| `META_WA_PHONE_NUMBER_ID` | Meta WABA phone id |
| `META_WA_ACCESS_TOKEN` | long-lived token |
| `META_WA_VERIFY_TOKEN` | verification token |
| `META_WA_APP_SECRET` | signature verification |
| `TWILIO_ACCOUNT_SID` | Twilio |
| `TWILIO_AUTH_TOKEN` | Twilio signature verification |
| `TWILIO_PHONE_NUMBER` | Twilio sender |
| `AT_USERNAME`, `AT_API_KEY`, `AT_SHORTCODE`, `AT_VOICE_PHONE` | Africa's Talking |

Payments:

| Variable | Notes |
| --- | --- |
| `PAYMENT_PROVIDER` | `daraja`, `intasend`, `paystack`, or `stripe` |
| `PAYMENT_SIMULATOR` | use true only for dev/demo |
| `PAYMENT_SIMULATOR_AUTOCONFIRM` | demo convenience |
| `MPESA_ENV` | `sandbox` or `production` |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL` | Daraja |
| `INTASEND_API_TOKEN`, `INTASEND_PUBLISHABLE_KEY`, `INTASEND_WEBHOOK_SECRET` | IntaSend |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | Paystack |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe |

Storage and backup:

| Variable | Notes |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | R2 key |
| `R2_SECRET_ACCESS_KEY` | R2 secret |
| `R2_BUCKET` | media bucket |
| `R2_PUBLIC_URL_BASE` | public object base URL if used |
| `BACKUP_BUCKET` | backup bucket used by scripts |
| `BACKUP_RETENTION_DAYS` | backup retention |

### 19.3 Migration and seed

From a production shell:

```bash
alembic upgrade head
```

Expected:

- Alembic applies through `0010_enforce_embedding_768`.
- `knowledge_base.embedding` is `vector(768)`.
- `orders.business_id` exists.
- `background_jobs` exists.

Create a business through admin API or seed script. For Gen-Eat:

```bash
PYTHONPATH=. ./.venv/bin/python scripts/seed_geneat_demo.py
```

### 19.4 Provider callback URLs

Meta WhatsApp:

- Verify: `GET https://<api-domain>/webhooks/whatsapp`
- Inbound: `POST https://<api-domain>/webhooks/whatsapp`

Twilio voice:

- Incoming call webhook:
  `POST https://<api-domain>/webhooks/voice/inbound`
- Media stream URL:
  `wss://<api-domain>/webhooks/voice/stream`

Africa's Talking:

- Voice webhook: `POST https://<api-domain>/webhooks/at/voice`
- Events webhook: `POST https://<api-domain>/webhooks/at/voice/events`

Payments:

- Daraja: `POST https://<api-domain>/payments/callback`
- IntaSend: `POST https://<api-domain>/payments/intasend/callback`
- Paystack: `POST https://<api-domain>/payments/paystack/callback`
- Stripe: `POST https://<api-domain>/payments/stripe/callback`

### 19.5 Smoke tests

```bash
BASE=https://<api-domain>

curl -sf "$BASE/healthz"
curl -sf "$BASE/readyz"
curl -sf "$BASE/health/deep"
curl -i "$BASE/admin/businesses"
curl -sf "$BASE/metrics" | head
```

Expected:

- `/healthz` returns process OK.
- `/readyz` returns DB/Redis readiness.
- `/health/deep` reports critical dependencies.
- `/admin/businesses` without auth returns 401.
- `/metrics` returns Prometheus text.

After provider setup:

- Send a WhatsApp test message.
- Place a mock/portal order.
- Trigger a test payment callback.
- Confirm `payment.completed` logs/events.
- Confirm admin SSE receives events.
- Confirm outbound webhooks receive signed events if configured.

## 20. API Surface

This list is generated from the current FastAPI app and grouped for humans.

Health/observability:

| Method | Path |
| --- | --- |
| GET | `/healthz` |
| GET | `/readyz` |
| GET | `/health/deep` |
| GET | `/metrics` |

Mock and channel ingress:

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

Payments:

| Method | Path |
| --- | --- |
| POST | `/payments/stk-push` |
| POST | `/payments/callback` |
| POST | `/payments/intasend/callback` |
| POST | `/payments/paystack/callback` |
| POST | `/payments/stripe/callback` |

Admin auth:

| Method | Path |
| --- | --- |
| POST | `/admin/auth/login` |
| POST | `/admin/auth/refresh` |
| GET | `/admin/auth/me` |
| POST | `/admin/auth/logout-all` |
| POST | `/admin/auth/password` |

Admin users and memberships:

| Method | Path |
| --- | --- |
| POST | `/admin/users` |
| GET | `/admin/users` |
| PATCH | `/admin/users/{user_id}` |
| DELETE | `/admin/users/{user_id}` |
| POST | `/admin/businesses/{slug}/members` |
| GET | `/admin/businesses/{slug}/members` |
| DELETE | `/admin/businesses/{slug}/members/{user_id}` |

Admin business/conversations:

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

Admin KB/profile/prompt:

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

Admin webhooks/usage/broadcasts/safety/audit:

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

Privacy:

| Method | Path |
| --- | --- |
| GET | `/privacy/customers/{phone}/export` |
| POST | `/privacy/customers/{phone}/forget` |
| GET | `/privacy` |
| GET | `/privacy/` |

Static/root:

| Method | Path |
| --- | --- |
| GET | `/admin` |
| GET | `/` |

Note: some admin business/KB/conversation routes exist twice because
`admin_console_router` is registered before the legacy `admin_router`. FastAPI
first-match ordering gives the JWT console routes priority where paths overlap.

## 21. Scripts, Seeds, And Utilities

Scripts:

| Script | Purpose |
| --- | --- |
| `scripts/create_admin.py` | create/update admin user |
| `scripts/seed_alpha.py` | alpha seed data |
| `scripts/seed_demo.py` | demo seed |
| `scripts/seed_demo_tenant.py` | tenant demo seed |
| `scripts/seed_geneat_demo.py` | Gen-Eat four-cafe seed |
| `scripts/seed_palm_cafe.py` | Palm cafe seed |
| `scripts/backup_to_r2.py` | Python backup utility |
| `scripts/backup_to_r2.sh` | shell wrapper for backup |
| `scripts/run_dev.sh` | local dev runner |
| `scripts/smoke_providers.py` | provider smoke checks |
| `scripts/audit_battery.sh` | audit/test battery helper |

Test mocks:

| Mock | Purpose |
| --- | --- |
| `tests/mocks/mpesa_mock.py` | M-Pesa mock service |
| `tests/mocks/africastalking_mock.py` | Africa's Talking mock |
| `tests/mocks/run_all.py` | run mocks together |

## 22. Testing

Primary command:

```bash
./.venv/bin/python -m pytest -q -m "not pg" --maxfail=5
```

Latest result:

```text
70 passed, 4 deselected, 1 warning
```

Focused commands:

```bash
./.venv/bin/python -m pytest tests/test_job_runner.py -q
./.venv/bin/python -m pytest tests/test_payments_hardening.py -q
./.venv/bin/python -m pytest tests/test_llm_failover.py -q
```

Compile:

```bash
./.venv/bin/python -m compileall -q app scripts tests
```

Frontend builds:

```bash
cd admin-ui && npm run build
cd gen-eat-portal && npm run build
```

PG tests:

- Tests marked `pg` require real Postgres plus pgvector.
- They are intentionally deselected by the default local command above.

Known warning:

- LangGraph/LangChain emits a pending deprecation warning about
  `allowed_objects`.

## 23. Scaling Notes And Known Gaps

Things already improved:

- Tenant leakage risks in payment callbacks were reduced by adding
  `orders.business_id`.
- Checkout ID attachment is conversation/business scoped.
- Payment hosted callbacks are implemented for IntaSend, Paystack, Stripe.
- Order-ready, unpaid-payment, simulator-confirm, and broadcast work is now
  durable through `background_jobs`.
- Admin UI/backend contract gaps were patched.
- Voice inbound has Twilio signature verification and proper mu-law to WAV
  conversion.
- Sensitive Redis/event keys use phone hashes instead of raw MSISDNs.

Current honest gaps:

| Gap | Impact | Likely fix |
| --- | --- | --- |
| Pub/Sub event bus is not durable | outbound webhooks/SSE can miss events during Redis/listener outage | add outbox table or Redis Streams |
| PG migration tests not run locally | migrations are not continuously verified against real Postgres in this workspace | add CI service with Postgres + pgvector |
| `audioop` deprecation | Python 3.13 will need different mu-law decoder | replace with maintained audio codec path |
| Built-in job runner is modest | very large campaigns may need more throughput/isolation | add external worker pool reading `background_jobs` or move to queue |
| RAG embedding dimension is fixed | OpenAI embedding dimensions must match DB | keep `OPENAI_EMBED_DIMENSIONS=768` or migrate vector column |
| No local git repo | cannot provide commit diff/history locally | initialize/use git in project workspace |
| Ruff not installed locally | lint was not run in latest verification | add ruff/dev tooling to requirements or CI |

Scaling path:

1. Add Postgres/pgvector CI and run `pytest -m pg`.
2. Add a durable event outbox for webhooks and merchant integrations.
3. Move heavy background work to dedicated workers if broadcast volume grows.
4. Add per-tenant outbound rate buckets, not only global provider buckets.
5. Add OpenTelemetry traces if debugging multi-provider latency becomes hard.
6. Add k6/load tests for high-concurrency campus traffic.
7. Store production secrets only in a secret manager, never `.env` files.

## 24. Documentation Policy

This README is the canonical system document.

Other project Markdown files are intentionally small pointers:

- `docs/BETA_DEPLOY.md`
- `docs/business_plan_geneat_usiu_pilot.md`
- `admin-ui/README.md`
- `gen-eat-portal/README.md`
- `gen-eat-portal/public/menu/README.md`

Do not reintroduce duplicated long-form docs in those files. Add or correct
truth here, then link to the relevant section from any local README that needs
orientation.
