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

Last reconciled with the codebase and local checks: **2026-05-25**.
Hosted live checks were last verified on **2026-05-24**.

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

Fresh live checks run from this workspace on **2026-05-24**:

| Check | Result |
| --- | --- |
| `GET /healthz` | `{"status":"ok"}` |
| `GET /readyz` | DB and Redis healthy |
| `GET /health/deep` | `status=ok`, db/redis/pgvector/whatsapp/payments/llm all reachable |
| `make doctor-live` | `21/22 configured checks passed` from this workspace |
| Portal live price check | passed without generic fallback |
| Portal live photo check | passed |
| Meta webhook verify handshake | `403` with this workspace's local verify token |
| OpenAI provider health | passed |
| Live LLM provider/model | `/health/deep` reports `provider=openai`, `model=gpt-5.4-mini` |
| OpenAI breaker state | not stuck open |

Current `make doctor-live` truth:

```text
21/22 configured checks passed
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
- the local `.env` `META_WA_VERIFY_TOKEN` does not currently match the hosted
  API verify token; webhook POST traffic can still work, but the workspace
  doctor handshake will fail until the token is reconciled,
- IntaSend is configured for live mode, not test mode,
- the primary OpenAI provider is reachable as `gpt-5.4-mini` and not tripped
  open.

### 2.3 Local verification

Fresh local checks run during this reconciliation:

| Check | Result |
| --- | --- |
| Fast focused backend suite | `103 passed, 1 warning` via `make test-fast` |
| Durable job TTL regression | `4 passed` via `pytest tests/test_job_runner.py -q` |
| Redis prod fail-closed regression | covered by `tests/test_redis_client.py` |
| Payment race regression | covered by `tests/test_payments_hardening.py` |
| Bandit medium/high scan | passed via `bandit -r app -q --severity-level medium` |
| Dependency audit | `pip-audit` found 23 vulnerabilities across 12 packages |
| Admin UI production build | passed |
| Gen-Eat portal production build | passed |
| Logging crash regression test | passed |
| Local explicit price path smoke | passed |

Command results:

```bash
make test-fast
./.venv/bin/python -m pytest tests/test_job_runner.py -q
./.venv/bin/python -m pytest tests/test_redis_client.py -q
./.venv/bin/bandit -r app -q --severity-level medium
./.venv/bin/pip-audit
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

### 2.5 CI and monitoring

Continuous integration now has two checked-in workflows:

- `.github/workflows/ci.yml` runs ruff plus the default non-Postgres pytest
  suite with Postgres and Redis service containers available.
- `.github/workflows/ci-alembic-pgvector.yml` boots pgvector Postgres, runs
  `alembic upgrade head`, validates `knowledge_base.embedding` dimensions, and
  can optionally check a configured metrics endpoint.

Monitoring assets live under `deploy/monitoring/`:

- Prometheus scrape example,
- Alertmanager rules,
- Grafana dashboard sample.

Use `scripts/check_metrics.py`, `scripts/check_pgbouncer.py`,
`scripts/check_pgvector_dim.py`, and `scripts/run_smoke_tests.py` for quick
local or post-deploy validation.

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
  lesnarai-landing/
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
    quick_replies.py
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
    outbox_runner.py
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
    outbox.py
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

lesnarai-landing/
  static Lesnar AI landing page deployable on Vercel
```

Deployment and ops:

```text
deploy/
  monitoring/
    prometheus.yml
    alertmanager_rules.yml
    grafana_dashboard.json
  pgbouncer/
    README.md
    pgbouncer.ini
    pgbouncer.service
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
  ops smoke / monitoring / pgbouncer checks
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
| `outbox` | durable outbound delivery rows for webhooks and other side effects |

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
| `0011_payment_locking_and_job_ttl` | optimistic payment status versioning and background job TTL |
| `0012_add_outbox_table` | durable outbox table for outbound webhook delivery |

Current schema truth:

- `knowledge_base.embedding` is `vector(768)`,
- `orders.business_id` exists and is part of payment callback scoping,
- `orders.payment_version` guards payment-status transitions against stale or
  racing provider callbacks,
- `background_jobs` exists and is required for delayed internal work,
- `background_jobs.expires_at` lets stale jobs fail closed instead of retrying
  forever,
- `outbox` exists for durable outbound webhook delivery attempts,
- doctor DB introspection expects the current Alembic head when local DB checks
  are enabled.

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
| `AI_TURN_TIMEOUT_SECONDS` / `ai_turn_timeout_seconds` | `30.0` |
| `AI_TURN_RETRY_TIMEOUT_SECONDS` / `ai_turn_retry_timeout_seconds` | `10.0` |

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

- obvious café facts use deterministic tenant data before the model,
- open-ended or ambiguous customer turns go to the model,
- deterministic recovery still exists for provider timeout, sanitizer failure,
  or degraded fallback,
- the generic human-handoff fallback should be rare.

Current explicit happy-path fast-paths:

- **Factual menu questions**, such as:
  - `How much is a flat white?`
  - `Do you have croissants?`
  - `What else do you sell?`
  - `I need the full menu`
  are answered from tenant menu chunks before calling the model or embedding
  the user query. Vector retrieval remains as a compatibility fallback when
  menu chunks are unavailable.
- **Photo requests only**, such as:
  - `show me a photo of the flat white`
  - `send me a picture of the croissant`
  - `picha ya avocado toast`
  short-circuit directly into `send_menu_photo` without waiting for the LLM
  to decide whether to use a tool.
- **The live KES 10 Demo Espresso order**, such as
  `I want the KES 10 demo espresso. My name is Lesnar`, is handled in the
  channel layer before the model. It captures the customer name, creates or
  reuses the pending order, and starts the IntaSend STK path immediately.

Current model-led happy path:

- ambiguous menu follow-ups after deterministic menu data cannot answer,
- multi-item order-building turns,
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
- customer messages like `send STK`, `send M-Pesa`, or `tuma stk` are also
  treated as STK resend intents,
- repeated matching order messages with an old pending STK automatically send
  a fresh STK after 90 seconds instead of silently pointing at a stale prompt,
- customer claims like `Paid` or `nimelipa` are treated as status checks only;
  they cannot mark an order paid without a provider callback/poll,
- pickup / queue-skip timing questions are gated behind provider-confirmed
  payment state,
- payment callbacks use optimistic status transitions via `orders.payment_version`
  so late failed/cancelled callbacks cannot overwrite paid money,
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

- each AI turn is bounded by `AI_TURN_TIMEOUT_SECONDS`, currently 30 seconds
  unless overridden by env,
- one quiet retry is attempted for transient provider/tool failures; timeout
  retries use `AI_TURN_RETRY_TIMEOUT_SECONDS`, currently 10 seconds, so stuck
  turns do not drag on,
- deterministic quick replies answer obvious price, hours, recommendation,
  item-availability, and full-menu questions before the model when tenant menu
  chunks are available, and can run again after the model path fails,
- price quick replies choose the first price after the matched item phrase, so
  `Espresso KES 120 ... Flat White KES 220 (oat/almond +KES 40)` answers
  `Flat White is KES 220`, not `KES 120` or `KES 40`,
- full-menu requests such as `I need the full menu` are answered
  deterministically from menu chunks instead of waiting on the model or an
  embedding call when menu rows are available, with vector retrieval kept as a
  compatibility fallback,
- generic photo follow-ups such as `send a picture` ask which item to send
  instead of guessing and returning the wrong café/menu image,
- JSON/tool-call-looking model output is treated as malformed customer copy;
  the channel layer first tries to recover with a menu quick reply, then falls
  back to a short plain-language formatting-error message,
- keyword KB fallback is tried before generic handoff, but internal/demo
  operator notes such as `DEMO FLOW` are filtered out of customer replies,
- degraded fallback replies are marked and filtered out of future model
  history so the assistant does not imitate old emergency copy,
- the generic handoff text is now a last resort, not the normal café voice.

Current load/connection-pool behavior:

- the channel layer commits the saved customer turn and loaded history before
  entering the slower RAG / LLM / tool loop, so a checked-out DB connection is
  not pinned while waiting on a provider;
- the graph releases read transactions after tenant-profile and RAG lookups,
  and commits tool writes before the next model follow-up turn;
- Redis session-lock contention now returns a short "still processing" reply
  instead of falling through to Postgres advisory locks; PG advisory fallback
  is reserved for Redis-unavailable cases.

Monitoring and UX improvements
--------------------------------

- New Prometheus metrics: `omni_llm_invoke_duration_seconds`,
  `omni_rag_retrieval_duration_seconds`, `omni_embed_query_remote_duration_seconds`,
  and `omni_embed_query_cache_hits_total` record LLM/RAG/embed latencies and
  cache behaviour. Scrape `/metrics` as normal.
- The app now publishes an `agent.typing` event on the cross-worker event bus
  at the start of AI processing so dashboards/UIs can show a typing indicator
  while the turn is being composed.

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
- repeated query embeddings are cached in-process for five minutes, capped at
  256 normalized queries per worker,
- explicit photo requests skip retrieval entirely before the deterministic
  `send_menu_photo` path,
- price, availability, recommendation, and full-menu quick replies fetch
  likely menu chunks directly, without embedding the user query when menu rows
  are available, and only fall back to vector retrieval if no menu-style
  chunks are found,
- menu quick replies ignore policy/playbook/operator chunks and instruction
  phrases such as `If a customer asks...` so internal setup notes cannot show
  up as fake menu items,
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
- optimistic `orders.payment_version` checks on status changes,
- no already-paid order downgrade.

## 11. Durable Jobs

Durable jobs live in:

- [app/jobs/runner.py](/home/lesnar/Documents/ai model/app/jobs/runner.py)
- [app/jobs/handlers.py](/home/lesnar/Documents/ai model/app/jobs/handlers.py)
- `BackgroundJob` model
- migration `0009_background_jobs`
- migration `0011_payment_locking_and_job_ttl`

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
| `payment.intasend_poll` | bounded IntaSend status polling after STK request |

Operational truth:

- jobs are durable in DB,
- claim/retry/lease logic exists,
- jobs now carry an optional `expires_at` TTL and stale queued/running jobs are
  failed instead of retrying indefinitely,
- a separate outbox runner also runs in-process to deliver queued outbound
  webhook rows from the `outbox` table,
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
- event dispatch is deduped through Redis,
- delivery is queued into the durable `outbox` table by
  [app/services/outbox.py](/home/lesnar/Documents/ai model/app/services/outbox.py),
- [app/jobs/outbox_runner.py](/home/lesnar/Documents/ai model/app/jobs/outbox_runner.py)
  claims pending rows, delivers with bounded retries, updates endpoint health,
  and marks rows sent or failed,
- delivery concurrency is bounded,
- `failure_count >= 20` auto-disables dead endpoints.

Important limitation:

- the event bus itself is **not durable**,
- so SSE can still miss events during Redis or listener gaps,
- outbound webhook delivery is durable after an event has been received and
  enqueued into `outbox`,
- if no worker receives the Redis event in the first place, the outbox row is
  never created; the complete future fix is a transactional event/outbox write
  at the producer boundary or Redis Streams.

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

- quoted env-value normalization, so values accidentally saved as `'false'`
  or `"false"` do not crash Pydantic before validation can run,
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
- `PAYMENT_PROVIDER=intasend` with `INTASEND_TEST_MODE=true` is forbidden in
  prod because real phones will not receive live STK prompts,
- `WHATSAPP_PROVIDER=meta` requires `META_WA_APP_SECRET` in prod and only
  warns outside prod,
- GPT-5 with the OpenAI Responses API requires `OPENAI_STORE_RESPONSES=true`
  in prod,
- OpenAI embeddings must remain `768` dimensions in prod until the pgvector
  schema is migrated.
- production `SECRET_KEY` and `PHONE_HASH_PEPPER` must not be empty or default
  placeholders; short/non-default pilot values start with explicit warnings so
  a hardening commit does not brick an otherwise working beta deploy,
- `JWT_SECRET` should be a separate high-entropy 64+ character value, but if
  it is missing the admin JWT layer falls back to `SECRET_KEY` with a startup
  warning,
- weak `ADMIN_API_TOKEN` values are logged as warnings so beta deploys are
  not silently misconfigured,
- Redis idempotency claims fail closed in production if Redis is unavailable,
  instead of treating provider/webhook work as fresh.

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
- init start/disabled/enabled events are logged without exposing the DSN,
- PII scrubbing is built in.

### 17.3 Metrics

Route:

- `GET /metrics`

Current metrics include:

- request counts and latency,
- webhook delivery metrics,
- safety counters,
- event/tool metrics,
- SQLAlchemy DB pool gauges: `omni_db_pool_size`,
  `omni_db_pool_checked_out`, `omni_db_pool_checked_in`,
  `omni_db_pool_overflow`.

### 17.4 Health endpoints

| Route | Purpose |
| --- | --- |
| `/healthz` | process liveness |
| `/readyz` | DB + Redis readiness |
| `/health/deep` | DB + Redis + pgvector + WhatsApp + payment-provider reachability + LLM reachability + breaker snapshot |

Current `/health/deep` truth:

- includes `checks.llm`,
- includes `checks.payments.test_mode` for IntaSend so hosted live/test mode
  is visible without exposing secrets,
- includes breaker snapshots,
- is now part of the live doctor story.

### 17.5 Doctor and smoke tooling

Current developer/operator commands:

```bash
make doctor-local
make doctor-live
make smoke-providers
make test-fast
```

Meaning:

- `doctor-local` checks local stack and safe chat/photo flows
- `doctor-live` checks hosted stack and safe chat/photo flows; hosted HTTP
  probes retry briefly so Render warm-up or one-off edge timeouts do not
  create false alarms, and a slow `/readyz` response is tolerated when
  `/health/deep` proves DB and Redis are healthy
- `smoke-providers` probes provider credential/path sanity
- `test-fast` includes the focused payment-race, Redis fail-closed, safety,
  fallback, and webhook-signature regressions that protect the live demo path

### 17.6 Operational watch points

- Redis health affects locks, idempotency, rate limits, event bus, and some
  caching.
- Postgres health affects everything persistent.
- If DB pool gauges show checked-out connections near
  `DB_POOL_SIZE + DB_MAX_OVERFLOW`, check for long LLM latency and
  `redis_lock_timeout_busy` logs before increasing pool size.
- `scripts/load_test_mock.py` uses unique phone numbers by default; pass
  `--same-phone` only when intentionally testing per-customer serialization.
- Admin routes are rate-limited by Redis; in production, Redis failure returns
  a 503 instead of silently allowing unlimited admin traffic.
- Requests larger than `REQUEST_MAX_BODY_BYTES` are rejected before route
  handlers read the body; the current default is 10 MB.
- PgBouncer examples live in `deploy/pgbouncer/`; local `docker-compose.yml`
  includes a pgbouncer service for pooled-connection testing, but production
  must use real auth instead of local trust-mode examples.
- Job backlogs mean `background_jobs` and runner state need inspection.
- Outbox backlogs mean `outbox` rows, endpoint health, and
  `app.jobs.outbox_runner` need inspection.
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
# start Postgres, Redis and pgbouncer for local pooled testing
docker-compose up -d postgres redis pgbouncer
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
export GENEAT_LIVE_ADMIN_API_TOKEN="current-token-from-render-or-secret-manager"
make bootstrap-demo
```

Important token nuance:

- `make bootstrap-demo` intentionally does **not** source `.env`.
- The live admin token is rotated outside the repo, so local `.env` may be
  stale by design.
- For hosted bootstrap, export the current hosted `ADMIN_API_TOKEN` as
  `GENEAT_LIVE_ADMIN_API_TOKEN`.
- A `401` or `403` from this script means token drift, not a seed/code bug.
- For non-live targets, the script can still use `ADMIN_API_TOKEN`.

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
- live IntaSend mode through `INTASEND_TEST_MODE=false`

with a cleaner managed setup than the manual beta cutover.

### 19.3 Alternative server path

Truehost server-side bundle exists here:

- [deploy/truehost/README.md](/home/lesnar/Documents/ai model/deploy/truehost/README.md)
- [deploy/truehost/docker-compose.api.yml](/home/lesnar/Documents/ai model/deploy/truehost/docker-compose.api.yml)

That path is currently a prepared alternative, not the current live path.

### 19.3.1 PgBouncer and monitoring assets

Prepared operational assets now exist for the next hardening pass:

- [deploy/pgbouncer/README.md](/home/lesnar/Documents/ai model/deploy/pgbouncer/README.md)
- [deploy/pgbouncer/pgbouncer.ini](/home/lesnar/Documents/ai model/deploy/pgbouncer/pgbouncer.ini)
- [deploy/pgbouncer/pgbouncer.service](/home/lesnar/Documents/ai model/deploy/pgbouncer/pgbouncer.service)
- [deploy/monitoring/prometheus.yml](/home/lesnar/Documents/ai model/deploy/monitoring/prometheus.yml)
- [deploy/monitoring/alertmanager_rules.yml](/home/lesnar/Documents/ai model/deploy/monitoring/alertmanager_rules.yml)
- [deploy/monitoring/grafana_dashboard.json](/home/lesnar/Documents/ai model/deploy/monitoring/grafana_dashboard.json)

Current truth:

- local `docker-compose.yml` includes a pgbouncer service for pooled testing,
- `deploy/pgbouncer/userlist.txt` is a local/dev trust-mode helper and must
  not be treated as a production secret source,
- production should use managed secrets, real PgBouncer auth, and tuned pool
  limits based on worker count and Postgres `max_connections`,
- monitoring examples are starter assets, not proof that hosted alerting is
  already wired.

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
| `DB_POOL_SIZE` | SQLAlchemy pool size per app process; default `10` |
| `DB_MAX_OVERFLOW` | extra temporary DB connections per process; default `20` |
| `DB_POOL_PRE_PING` | validates pooled connections before use; default `true` |
| `REDIS_URL` | Redis / Valkey URL |
| `SECRET_KEY` | app secret |
| `PHONE_HASH_PEPPER` | stable phone-hash secret |
| `ADMIN_API_TOKEN` | machine/legacy admin token |
| `JWT_SECRET` | admin JWT signing |
| `ADMIN_CORS_ORIGINS` | admin origins |
| `DEFAULT_BUSINESS_SLUG` | default tenant |

Operator-only local variables:

| Variable | Purpose |
| --- | --- |
| `GENEAT_LIVE_ADMIN_API_TOKEN` | current hosted admin token used by `make bootstrap-demo`; not a deployed runtime variable |

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
| `AI_TURN_TIMEOUT_SECONDS` | normal model-turn timeout; current default `30` |
| `AI_TURN_RETRY_TIMEOUT_SECONDS` | shorter quiet retry timeout; current default `10` |
| `REQUEST_MAX_BODY_BYTES` | maximum inbound HTTP request body; default `10485760` |
| `RL_ADMIN_PER_MIN` | per-IP admin route rate limit; default `30` |
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
| `INTASEND_TEST_MODE` | must be `false` for real customer STK prompts |
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

As of 2026-05-24:

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

Current scripts and helpers:

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
| `scripts/bootstrap_geneat_demo_live.py` | HTTPS demo bootstrap helper that uses an explicit live operator token |
| `scripts/generate_lily_pond_training.py` | synthetic Lily Pond SFT golden-path JSONL generator |
| `scripts/build_render_env.py` | local helper that writes an ignored Render env bundle from `.env` |
| `scripts/audit_battery.sh` | audit helper |
| `scripts/check_metrics.py` | checks `/metrics` reachability and non-empty output |
| `scripts/check_payments.py` | payment webhook secret sanity check |
| `scripts/check_pgbouncer.py` | DB/PgBouncer connection sanity check |
| `scripts/check_pgvector_dim.py` | verifies pgvector embedding dimension |
| `scripts/check_sentry.py` | verifies Sentry initialization when DSN is set |
| `scripts/check_webhook_handshake.py` | webhook secret/handshake env sanity check |
| `scripts/ci_prepare.sh` | CI prep helper |
| `scripts/flush_outbox.py` | one-shot outbox row processor |
| `scripts/list_tables.py` | lists public Postgres tables using `DATABASE_URL_SYNC` or `DATABASE_URL` |
| `scripts/load_test_mock.py` | concurrent `/mock/message` load test helper |
| `scripts/load_test_sample.py` | small local load-test helper |
| `scripts/post_deploy_smoke.py` | post-deploy smoke wrapper |
| `scripts/run_smoke_tests.py` | runs pgvector, pgbouncer, metrics, and Sentry checks |
| `scripts/setup_pgbouncer.sh` | writes local PgBouncer helper config |

Current high-value scripts:

- `lily_pond_demo_check.py` is the single best “is the demo alive?” script
- `publish_demo_menu_photos.py` is the current bulk image hydration tool
- `bootstrap_geneat_demo_live.py` is the safe hosted bootstrap path; it uses
  `GENEAT_LIVE_ADMIN_API_TOKEN` instead of assuming local `.env` is live truth
- `smoke_providers.py` is the credential sanity probe
- `generate_lily_pond_training.py` creates OpenAI-style chat fine-tuning JSONL
  examples for Lily Pond, including tool schemas and tool-call turns
- `run_smoke_tests.py` is the compact post-deploy ops check bundle
- `flush_outbox.py` is the manual escape hatch for draining pending outbox
  rows during maintenance
- `load_test_mock.py` is the quickest local latency sanity check for the
  mock/web-chat path after tuning LLM and RAG timeouts; it uses unique phones
  by default and has `--same-phone` for session-lock stress tests

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

CI: A lightweight CI workflow was added at `.github/workflows/ci-alembic-pgvector.yml` which boots a `pgvector` Postgres image, runs `alembic upgrade head`, and validates the `knowledge_base.embedding` column dimension via `scripts/check_pgvector_dim.py`.


### 22.1 Current fast suite

```bash
make test-fast
```

Current result:

```text
103 passed, 1 warning
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
21/22 configured checks passed
```

This is still the main high-signal smoke test for the hosted demo stack. A
`403` on the Meta verify handshake means this workspace's
`META_WA_VERIFY_TOKEN` is stale or differs from the hosted Render/Meta value.

### 22.4 Other useful tests

```bash
./.venv/bin/python -m pytest tests/test_job_runner.py -q
./.venv/bin/python -m pytest tests/test_payments_hardening.py -q
./.venv/bin/python -m pytest tests/test_redis_client.py -q
./.venv/bin/python -m pytest tests/test_whatsapp_webhook.py -q
./.venv/bin/python -m pytest tests/test_llm_failover.py -q
./.venv/bin/python -m pytest tests/test_logging.py -q
./.venv/bin/python -m pytest tests/test_outbox.py -q
./.venv/bin/python -m pytest tests/test_db_pooling.py -q
./.venv/bin/python -m pytest tests/test_pgvector_dim.py -q
./.venv/bin/python -m pytest tests/test_check_metrics.py tests/test_check_pgbouncer.py -q
```

Most recent focused job-runner result:

```text
4 passed
```

Current security scan truth:

```bash
./.venv/bin/bandit -r app -q --severity-level medium
./.venv/bin/pip-audit
```

Bandit has no current medium/high app findings; the full scan still reports
36 low-severity findings. `pip-audit` still reports 23 vulnerabilities across
12 packages, mainly in the LangChain/LangGraph/Starlette stack, request
parsing dependencies, and local tooling packages, so dependency upgrades remain
a production blocker before real customer money.

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
- open-ended WhatsApp text remains model-led, while factual menu, price,
  availability, hours, photo, and payment-control turns use deterministic
  tenant data before the model
- the flagship KES 10 Demo Espresso order path now bypasses the model and
  goes straight to order creation + STK so the live proof feels fast
- safety rules now let normal café wording and photo requests reach the model
  while still blocking real prompt-injection attempts
- order/payment turns now guard against duplicate pending orders, duplicate
  STK pushes, premature pickup-ready promises, and wrong-language payment
  failure messages
- customer `Paid` messages no longer count as proof of payment; only provider
  callbacks/polls can mark money landed
- pickup and queue-skip promises are now blocked until payment is confirmed
- full-menu, price, availability, recommendation, and vague photo follow-ups
  are handled deterministically so the assistant does not send random images,
  code-like copy, or slow generic fallbacks for basic café facts
- price parsing now chooses the first price after the matched item phrase,
  preventing answers like `Flat White is KES 120` or `Flat White is KES 40`
- explicit photo and obvious menu-info turns now avoid unnecessary RAG
  embedding calls, and repeated RAG query embeddings are cached briefly per
  worker
- JSON/tool-call-looking model output is sanitized before it reaches WhatsApp,
  with menu quick-reply recovery when the customer asked a factual menu
  question
- long AI waits no longer keep the initial request transaction checked out;
  channel, RAG, and tool phases release DB connections between provider waits
- Redis session-lock contention no longer falls through to Postgres advisory
  locks, which prevents same-phone bursts from exhausting the DB pool
- `load_test_mock.py` now uses unique phone numbers by default and handles
  client-side failures without crashing its summary output
- payment callbacks now use optimistic status versioning to prevent stale
  provider events from downgrading paid orders
- stale pending STKs can be resent explicitly with `send STK` / `resend STK`,
  and repeated matching orders auto-resend after 90 seconds
- production startup validation now fails fast on live-payment, Meta webhook,
  GPT-5 Responses, embedding-dimension, and default/empty core-secret
  misconfigurations
- weak non-default pilot secrets are logged as explicit production warnings so
  operators can rotate them without bricking an otherwise live deploy
- production idempotency fails closed when Redis is unavailable
- durable jobs now have TTLs to avoid infinite retry loops
- outbound webhook delivery now has a Postgres outbox and in-process outbox
  runner, so delivery retries survive worker restarts after enqueue
- local PgBouncer, monitoring, CI, and smoke-check assets are present for the
  next operational hardening pass
- Sentry initialization emits clear enabled/disabled startup logs
- DB pool gauges are exposed in `/metrics` so connection pressure can be
  alerted before requests start failing
- all configured LLM providers use bounded 30-second client timeouts and a
  single provider retry before failover/rescue behavior
- admin routes have Redis-backed per-IP throttling, and production fails
  closed when that limiter is unavailable
- inbound HTTP request bodies are capped at 10 MB by middleware before route
  handlers process them
- Lily Pond seed data now includes a customer-facing menu summary and no
  longer stores the old internal `DEMO FLOW` tool instruction as customer
  retrievable KB
- menu quick-reply parsing now excludes policy/playbook/operator chunks so
  internal instructions cannot be rendered as customer menu rows
- committed test webhook secrets are no longer static strings; tests generate
  per-run Meta webhook secrets/tokens
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
| Event bus is not fully durable | SSE can miss events, and outbound webhook rows are only durable after a worker receives and enqueues the Redis event | move event creation to a transactional outbox or Redis Streams producer path |
| Public admin deployment is optional, not standardized | ops may still depend on local admin in some workflows | deploy and document a stable public admin URL |
| Demo menu photos are mostly representative, not merchant-owned | looks real enough for pilot, not final merchant polish | upload tenant-owned photos per client |
| Photo fuzzy matching can produce odd alias labels | image still arrives, but metadata can look slightly odd | tighten photo alias ranking |
| Dependency audit still has vulnerabilities | vulnerable libraries can become production exposure even if app tests pass | upgrade and retest Starlette/FastAPI-compatible request stack plus LangChain/LangGraph packages |
| Full Bandit cleanup still has 36 low-severity findings | mostly broad best-effort exception catches and asserts, not current medium/high blockers | keep reducing low findings as nearby files are touched |
| Migration CI is new and still lightweight | catches Alembic/pgvector dimension regressions but not all DB behavior | add broader Postgres integration cases over time |
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

### 23.4 Critical production readiness blockers

Status as of 2026-05-24:

Code-level blockers now addressed in this workspace:

- hardcoded Meta webhook test secrets were removed from tests and generated
  per test run instead,
- payment status updates use optimistic transitions with `payment_version` and
  regression coverage for concurrent transition races,
- Redis idempotency fails closed in production with a 503-style app error
  instead of allowing duplicate provider work,
- durable jobs expire by explicit `expires_at`, and legacy rows with no
  `expires_at` expire after the default 24-hour TTL,
- Sentry initialization logs enabled/disabled state,
- `/metrics` exposes DB pool gauges,
- LLM provider clients are bounded to 30-second timeouts with one retry,
- inbound request bodies are capped at 10 MB,
- admin routes have Redis-backed rate limiting.

Still blocking production with real customer money:

- `pip-audit` reports 23 dependency vulnerabilities across 12 packages that
  need package upgrades and compatibility testing,
- alerting and runbooks still need to be wired into the deployed environment,
- secret rotation must be completed in the host secret manager before client
  traffic,
- a full WhatsApp order/payment/cancel/photo rehearsal must pass after the
  hardened commit is deployed.

## 24. Documentation Policy

This README is the canonical system document.

All other Markdown files should stay small and point back here:

- [docs/BETA_DEPLOY.md](/home/lesnar/Documents/ai model/docs/BETA_DEPLOY.md)
- [docs/PRODUCTION_RUNBOOK.md](/home/lesnar/Documents/ai model/docs/PRODUCTION_RUNBOOK.md)
- [docs/RELEASE_CHECKLIST.md](/home/lesnar/Documents/ai model/docs/RELEASE_CHECKLIST.md)
- [docs/business_plan_geneat_usiu_pilot.md](/home/lesnar/Documents/ai model/docs/business_plan_geneat_usiu_pilot.md)
- [docs/logging_rotation.md](/home/lesnar/Documents/ai model/docs/logging_rotation.md)
- [docs/monitoring_RUNBOOK.md](/home/lesnar/Documents/ai model/docs/monitoring_RUNBOOK.md)
- [docs/outbox_architecture.md](/home/lesnar/Documents/ai model/docs/outbox_architecture.md)
- [admin-ui/README.md](/home/lesnar/Documents/ai model/admin-ui/README.md)
- [gen-eat-portal/README.md](/home/lesnar/Documents/ai model/gen-eat-portal/README.md)
- [gen-eat-portal/public/menu/README.md](/home/lesnar/Documents/ai model/gen-eat-portal/public/menu/README.md)
- [deploy/load_test_scenarios.md](/home/lesnar/Documents/ai model/deploy/load_test_scenarios.md)
- [deploy/pgbouncer/PR_SUMMARY.md](/home/lesnar/Documents/ai model/deploy/pgbouncer/PR_SUMMARY.md)
- [deploy/pgbouncer/README.md](/home/lesnar/Documents/ai model/deploy/pgbouncer/README.md)
- [deploy/render/README.md](/home/lesnar/Documents/ai model/deploy/render/README.md)
- [deploy/truehost/README.md](/home/lesnar/Documents/ai model/deploy/truehost/README.md)

Rules:

1. If the system changes, update this README first.
2. Keep package-local READMEs thin.
3. Do not reintroduce a second long-form architecture or deploy guide unless
   there is a compelling, isolated reason.
4. When reality and aspiration differ, document both clearly and label which
   one is live truth.
