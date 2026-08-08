# Wave E — status verification

Every status the flagship publishes, with what proves it and what it does not.
Re-verified during the visual acceptance pass.

## Verified 2026-08-09

| Status | Claim | Probe | Result |
|---|---|---|---|
| **LIVE · PILOT** | Gen-Eat storefront reachable | `https://geneat.lesnarai.co.ke` | HTTP 200 (2026-08-07) |
| **LIVE** | Hazina Nomads storefront reachable | `https://hazina.lesnarai.co.ke` | HTTP 200 (2026-08-07) |
| **LIVE** | Two independent product APIs | `geneat-api…/healthz`, `hazina-api…/healthz` | both `{"status":"ok"}` HTTP 200 |
| **NOT CURRENTLY REACHABLE** | Model-backed conversation | deployed configuration | no external language-model credential |

DNS for both API hostnames resolves consistently at the authoritative
Cloudflare nameserver, `1.1.1.1` and `8.8.8.8`. Requests succeed without
`--resolve`.

## What the health endpoints prove

Only this: the process answers an unauthenticated request over TLS at the
stated hostname.

## What they do not prove

- that model-backed conversation works — **it does not**
- that orders or payments function end to end
- any customer count, traffic volume, revenue or adoption
- uptime over any period
- that historical operational data was migrated — **it was not**

## Public surface policy, verified at capture time

`/admin/*`, `/openapi.json`, `/docs`, `/redoc`, `/mock/*` and `/health/deep`
all return **404** from both public hostnames by design. Only `/healthz` is
linked from the page. Administrative capability is unchanged over localhost.

## Deliberately absent from the page

No uptime percentage. No response-time figure. No order, customer or revenue
count. No "trusted by" claim. No fabricated screenshot.

## Known non-canonical DNS, recorded not actioned

`api.geneat.lesnarai.co.ke` and `api.hazina.lesnarai.co.ke` still exist as DNS
records. They are **not** canonical, are absent from the tunnel ingress, and
return 404. Deleting the records requires dashboard access and is queued as a
cleanup item, not a Wave E blocker.
