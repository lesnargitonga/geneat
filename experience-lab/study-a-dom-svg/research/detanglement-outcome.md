# Detanglement outcome — verified 2026-08-07

Execution record for the Gen-Eat / Hazina separation. Every figure below was
measured on the host, not estimated. CarePro was never modified.

## Result

| | Gen-Eat | Hazina |
|---|---|---|
| Source | `/home/lesnar/Documents/lesnar-products/geneat` | `.../hazina` |
| Host path | `/opt/apps/geneat` | `/opt/apps/hazina` |
| Service | `geneat-api` active, enabled | `hazina-api` active, enabled |
| Bind | `127.0.0.1:8001` | `127.0.0.1:8002` |
| Database | `geneat_prod`, user `geneat` | `hazina_prod`, user `hazina` |
| Redis | `redis://127.0.0.1:6379/0` | `redis://127.0.0.1:6379/1` |
| Migrations | 13 applied, head `0013_repair_pgvector_extension`, 15 tables | identical count, own history |
| Tests | **178 passed, 5 skipped, 0 failed** | **279 passed, 5 skipped, 0 failed** |
| Health | `/healthz` → 200 | `/healthz` → 200 |
| Public | **not reachable — no DNS** | **not reachable — no DNS** |

## Isolation, proven not assumed

Database, both directions:

```
geneat -> geneat_prod: CONNECT OK      geneat -> hazina_prod: DENIED
hazina -> hazina_prod: CONNECT OK      hazina -> geneat_prod: DENIED
```

Failure domains:

```
stop geneat-api  ->  geneat 502 | hazina 200 | carepro 200
stop hazina-api  ->  hazina 502 | geneat 200 | carepro 200
```

Both restarted to 200. No service left stopped.

## What the split actually cost

The services-level map understated the coupling. Tracing imports showed
Hazina logic inside code both products depend on:

- `app/channels/base.py` — 2774 lines, 8 Hazina imports, ~40 call sites
- `app/api/catalog.py`, `app/ai/tools.py` — generic routers importing Hazina
- `is_hazina_slug()` lived in `gift_automation.py`, so core depended on a
  product module
- `order_tracking.py` and `public_orders.py` declared themselves Hazina-owned
  in their own docstrings despite reading as generic

Every call site was guarded by `if is_hazina_slug(...)`, which made removal
provably safe for a Gen-Eat tenant rather than behaviour-changing.

**1113 lines** were removed from the Gen-Eat copy by AST-precise stripping.

### Two defects the stripping introduced, both caught

1. **Orphaned decorator.** Removing a route handler left its
   `@router.get(".../hazina")` attached to the *next* function, silently
   registering `get_menu_photos` at the Hazina path. Invisible to the AST
   (stacked decorators are valid) — caught by the blank-line gap that real
   stacked decorators never have. Two instances found and removed.
2. **Over-matched regex.** `menu_photos` also matched Hazina's own
   `build_hazina_menu_photos`, deleting a function Hazina needs. Caught by
   running the suite against the source repo first to prove the failure was
   mine and not pre-existing, then restored.

## Known limitations

- **No language-model credential.** Both APIs run with `LLM_PROVIDER=local`,
  which satisfies config validation but points at an Ollama runtime that is not
  installed and is out of budget on 1 vCPU. Health, catalog, order and payment
  surfaces work; **conversational replies do not.** Supplying a real API key is
  the only fix — none was invented.
- **Generic modules are duplicated, not shared.** Deliberate, per instruction.
  This duplication will drift.
- **No public DNS.** Verified over loopback with `Host` headers only.
- **No historical data recovered.** The Render database is still suspended and
  unreachable. Both databases start empty. Nothing was fabricated to fill them.
- Only `hazina-portal/lib/products.ts` was copied into the Hazina product, to
  satisfy a catalog contract test. The portal itself was not moved.

## Capacity after deployment

```
ram 1967MB · used 953MB · available 1014MB · swap 69MB · load 0.04 · disk 39G free
geneat-api 147.0MB · hazina-api 121.9MB · redis 3.3MB · nginx 8.9MB · carepro ~372MB
health probe: 10/10 on both ports, 13.4ms and 12.0ms average
```

**Verdict: HEALTHY PILOT CAPACITY.** 1 vCPU remains the binding constraint;
`MemoryHigh=280M` / `MemoryMax=380M` / `CPUWeight=50` on both APIs keep CarePro
(default weight 100) ahead of them.

## Rollback

- Postgres tuning: delete `/etc/postgresql/16/main/conf.d/10-lesnar-small-host.conf`, restart.
- Redis tuning: delete `/etc/redis/conf.d/local.conf` and its `include` line, restart.
- Either API: `systemctl disable --now {geneat,hazina}-api`.
- Nginx: `rm /etc/nginx/sites-enabled/{geneat,hazina}-api`, reload. CarePro's
  block is backed up at `/root/carepro-vps.nginx.bak` and was never edited.
- The monorepo is untouched and remains the migration source of record.

---

# Post-reboot verification — 2026-08-08

The VPS rebooted at 2026-08-08 11:14:59 EAT (a provider resize attempt that did
not apply — the hypervisor still allocated 1 vCPU / 2 GB / 50 GB). The reboot
was unplanned from the application's point of view, which made it a genuine
test of the persistence configuration.

## Everything recovered unattended

All five units returned `active` + `enabled` with no manual intervention;
CarePro's PM2 process came back via `pm2-root`. No failed units. CarePro,
Gen-Eat and Hazina all 200; `nginx -t` passed; both product hostnames routed
correctly.

## Independence proven beyond the health check

`/healthz` returning 200 on both ports proves very little. Stronger evidence:

**Different applications.** Route sets differ — Gen-Eat exposes
`/catalog/businesses/{slug}/menu-photos`; Hazina exposes
`/catalog/businesses/{slug}/hazina` and `/api/public/orders/{order_id}`.
62 and 63 paths respectively.

**Different databases, live.** `pg_stat_activity` shows two connections to
`geneat_prod` as user `geneat`, and two to `hazina_prod` as user `hazina`.
Neither process holds a connection to the other's database.

**Isolation survived the reboot** — all four cross-access attempts still denied.

**Redis namespaces are mutually invisible** — a key written to db0 is not
visible from db1, and vice versa.

## A real defect the test found: `Requires=postgresql.service`

Test C stopped PostgreSQL to check whether CarePro survived (it did — its
database is remote). The unexpected result: **both product APIs were stopped by
systemd and did not come back when PostgreSQL returned.**

Cause: the units were written with `Requires=postgresql.service`. That
directive propagates a *stop* to dependents but does not propagate the
subsequent *start*. Any routine PostgreSQL restart — a security update, a
config change, `apt` maintenance — would silently take both product APIs down
until a human noticed.

This was a fragility introduced when the units were authored, not a
consequence of the split.

**Fix applied:** `Requires=` replaced with
`Wants=postgresql.service redis-server.service`. Boot ordering is preserved by
the existing `After=`, and `Restart=on-failure` / `RestartSec=5` reconnects once
the database returns.

**Verified after the change:** stopping PostgreSQL left both API units `active`;
restoring PostgreSQL returned both to 200 with no intervention.

Previous unit files preserved as `*.service.pre-depfix` in
`/root/pre-resize-backup-20260808`.

## Post-reboot baseline (still 1 vCPU / 2 GB)

```
ram 1967MB · available 1178MB · swap 0MB · load 0.65 · disk 39G free
geneat 181.4MB · hazina 182.3MB · postgres 146.9MB · redis 9.4MB · nginx 5.8MB
probe 10/10 both APIs — 10.6ms and 11.0ms
ports: 22/80/443 public; 5432, 6379, 8001, 8002 loopback only
```

**HEALTHY PILOT CAPACITY** on the current plan. RSS is higher on a cold boot
than warm (181/182 vs 152/127 MB) and remains well inside `MemoryMax=380M`.

---

# FINAL CANONICAL ARCHITECTURE — qualified 2026-08-09

## Public entry points

| Product | Canonical public API | Repository | Database | Redis |
|---|---|---|---|---|
| **Gen-Eat** | `https://geneat-api.lesnarai.co.ke` | `lesnargitonga/geneat-api` (private) | `geneat_prod` / user `geneat` | db **0** |
| **Hazina Nomads** | `https://hazina-api.lesnarai.co.ke` | `lesnargitonga/hazina-api` (private) | `hazina_prod` / user `hazina` | db **1** |
| **CarePro** | `https://carepro.co.ke` (own Nginx/TLS) | `lesnargitonga/carepro` (private) | **remote managed** — untouched | none |

## Request path

```
Internet -> Cloudflare -> cloudflared connector (VPS)
              -> 127.0.0.1:8101 nginx edge gate -> 127.0.0.1:8001 Gen-Eat
              -> 127.0.0.1:8102 nginx edge gate -> 127.0.0.1:8002 Hazina

Internet -> public Nginx :443 -> 127.0.0.1:3000 CarePro
```

Exactly one public path per product. The direct-origin bypass — where
`api.geneat.lesnarai.co.ke` returned HTTP 200 by addressing the VPS IP with a
Host header — is closed: the product Nginx blocks now bind `127.0.0.1` only.

## Shared *infrastructure* vs shared *runtime*

This distinction is the whole point of the exercise.

**Shared infrastructure** — one instance, logically partitioned:
VPS host · PostgreSQL **engine** · Redis **server** · Nginx host process ·
cloudflared connector.

**Shared application runtime** — **none.** No shared process, database,
credential, migration history, Redis namespace or failure domain. Each product
can be stopped, restarted, redeployed or broken without the other noticing.

## Public surface policy

Denied at the edge on public hostnames (404, so the surface is not advertised):
`/admin/*` · `/mock/*` · `/openapi.json` · `/docs` · `/redoc` · `/health/deep`

Retained: `/healthz` `/readyz` `/version` (200) · `/webhooks/whatsapp`
(422 — route present, rejecting an unsigned request) · `/payments/*/callback`
(405 — route present, POST-only) · public catalog reads.

Admin remains fully functional over localhost / SSH port-forward. No admin
code was removed and no public admin hostname was created.

## Verification, 2026-08-09

- Public HTTPS 200 on both canonical hostnames **without `--resolve`**, with DNS
  agreeing across the authoritative Cloudflare NS, 1.1.1.1, 8.8.8.8 and system.
- **Failure isolation through the public edge:** stopping either API returns 502
  for that product only; the other product and CarePro stay 200; cloudflared
  stays active. Verified in both directions, restored to all-200.
- Cross-database access denied in both directions; Redis db0/db1 mutually
  invisible.
- Public listeners: 22, 80, 443 only. UFW default-deny with no allow rule for
  3000, 5432, 6379, 8001, 8002, 8101 or 8102.
- Four backup generations, each independently checksum-verified.

## Honest limitations

- **Model-backed conversation is not functional.** Both products run
  `LLM_PROVIDER=local` against a runtime that is not installed. Health, catalog,
  order and payment surfaces work; replies do not.
- **No historical operational data was migrated.** Both databases start empty.
  The Render database remains unreachable and nothing was fabricated.
- Capacity is 1 vCPU / 1967 MB / 50 GB. The paid Cloud VPS 2 profile has not
  been delivered.
- Generic modules are duplicated between products; that duplication will drift.
