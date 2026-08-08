# Wave E — proof inventory

Machine-readable form: `evidence/wave-e/proof-inventory.json`.

Each visible claim, its source, verification date, maturity, the public-safe
evidence behind it, and its limitations.

| Claim | Maturity | Verified | Evidence | Key limitation |
|---|---|---|---|---|
| Gen-Eat storefront reachable, real product content | live-pilot | 2026-08-07 | public screenshot + HTTP 200 | reachability only |
| Hazina storefront reachable, real product content | live | 2026-08-07 | public screenshot + HTTP 200 | reachability only |
| Two products separated into independent runtimes | verified on host **and** in public | 2026-08-09 | cross-DB denial both directions; Redis namespaces mutually invisible; 183 + 284 tests; public-edge failure isolation | infrastructure shared, runtime not; no historical data migrated |
| Independent replacements are live behind their own addresses | live | 2026-08-09 | two health endpoints over HTTPS, agreeing across three resolvers | health ≠ product works |
| Model-backed conversation unavailable | not operational | 2026-08-09 | stated as its own status band | a current limitation, not an outage |

## Media

Two images, both real public screenshots of storefronts the studio operates.
No fabricated screenshots, no invented numbers, no customer or private data,
no admin surfaces, no transaction records. Each carries `type`, `source`,
`verified` and `limit`, and the argument survives with every image removed —
asserted by the media-failure test.

## Explicitly not claimed

Historical data migration · working AI conversation · Cloud VPS 2 delivery ·
any traffic, adoption, revenue or uptime figure.
