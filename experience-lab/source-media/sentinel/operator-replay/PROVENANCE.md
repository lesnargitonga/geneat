# Sentinel — operator replay capture (Run 2)

Attempt to recover the missing operator capture from Run 2's sealed telemetry
without flying a third mission.

**Outcome: the replay works; the operator capture does not.** The telemetry
replay is real and verified end to end, but the operator UI cannot display it.
Two independent blockers are recorded below. Nothing was faked to work around
either one, and no product code was modified.

## Source

| | |
|---|---|
| Run | `px4_teacher_20260930_074210_d1` (Run 2, accepted visual source run) |
| Artifact | `evidence/sitl-run-px4_teacher_20260930_074210_d1:evidence/runs/px4_teacher_20260930_074210_d1/telemetry_live_0.csv` |
| sha256 | `4d685cf14bde60f8d8dee74f…` |
| Samples | 608 |
| Span | 2026-09-30 04:42:26.855 → 04:44:32.698 UTC (125.84 s) |

No other telemetry source was used. The stock simulated demo fleet
(`LESNAR-DEMO-01/02/03`) was never seeded — `LESNAR_ENABLE_DEMO_FLEET` stayed 0
and the fleet was confirmed empty before and after the replay.

## Capture configuration — NOT the production security configuration

Isolated throwaway environment, separate from every real and dev database:

| Setting | Value | Why |
|---|---|---|
| `DATABASE_URL` | `sqlite:///…/capture_replay.sqlite` | throwaway; schema built by the backend's own alembic migrations |
| `LESNAR_REQUIRE_AUTH` | `0` | **capture only.** Run 2's operator capture failed because `AuthGate` needed a session token |
| `REACT_APP_REQUIRE_SESSION_AUTH` | `0` | **capture only** |
| `LESNAR_ENFORCE_AUDIT_CHAIN` | `0` | capture only |
| `LESNAR_EXTERNAL_ONLY` | `1` | the product's own "empty fleet, wait for real telemetry" mode |
| `LESNAR_ENABLE_DEMO_FLEET` | `0` | no demo seed |
| `REDIS_PORT` | `6399` | throwaway Redis container, isolated from the dev one |

These are capture settings. They are not a recommendation for any deployed
configuration.

## Field mapping — sealed CSV → `TelemetrySample` (`backend/db.py:131`)

| Column | CSV source | Note |
|---|---|---|
| `drone_id` | — | `x500_0`, the Gazebo model name |
| `latitude` / `longitude` | `lat` / `lon` | |
| `altitude` | `rel_alt` | relative altitude |
| `heading` | `yaw` | already degrees in this schema |
| `speed` | `ground_speed_mps` | 0.00 – 1.87 |
| `battery` | `battery_remaining_pct` | real, 100.0 → 50.0 |
| `source_timestamp`, `created_at` | `timestamp` | history orders on `created_at` |
| `armed` | **absent** | left NULL |
| `mode` | **absent** | left NULL |

`flight_phase` does exist in the CSV (phase 0 = 84 grounded samples at
0.00–0.05 m, phase 1 = the 524-sample flight) and was deliberately **not**
mapped onto `armed`. The mapping would be plausible and it would still be
inference, not source data.

Verified after import and again after the full replay session: 608 rows,
`armed` NULL in all 608, `mode` NULL in all 608, `max(created_at)` =
2026-09-30 04:44:32.698 — no row carries today's capture wall-clock.

## How the replay reaches the product

Run 2's aircraft reached the dashboard over Redis: the Sentinel agent published
to the `telemetry` channel and `redis_bridge_loop` (`backend/app.py:2417`)
ingested it, registering the aircraft as an **external** drone with
`start_simulation=False` plus an explicit `stop_simulation()`. The replay
republishes the sealed CSV onto that same channel at the cadence the original
timestamps describe, so ingestion follows the identical code path the live
flight used. Every packet is a real Run 2 sample; nothing is interpolated.

Verified live: `/api/drones` returned `count=1`, `drone_id=x500_0`,
`source=external`, altitude 9.44 m at mission t=36.9 s against the sealed value
of 9.45 m.

Two deliberate handling decisions:

- **`mode` is published as the empty string.** Omitting it entirely leaves the
  fleet object's constructor default in place, and the operator UI renders that
  default as legible text (`STABILIZE`) in the asset popup
  (`frontend/src/components/DroneMap.js:265`) — a value with no source in Run 2.
  Empty renders the row as unavailable instead.
- **`armed` cannot be expressed as unavailable.** The bridge coerces it with
  `bool()`, so it reads `False`, the product default. Recorded as a known gap,
  not presented as Run 2 data. The operator status badge does not depend on it
  here: it resolves to AIRBORNE from the real altitude
  (`frontend/src/utils/droneState.js`).

`in_air` is omitted so the product derives `is_flying` from the real altitude.
Note that `is_flying` is sticky (`drone.is_flying or …`), so the sealed run is
replayed as a **single pass**; looping carried the previous pass's airborne
state into the next pass's grounded start and produced a frame showing
`in_air=True` at 0.038 m.

### Protecting the sealed history

`broadcast_telemetry` calls `_persist_telemetry_history` (`backend/app.py:785`)
every `DB_SYNC_INTERVAL` ticks (`app.py:146`, a hardcoded `3`). That persister
coerces absent fields into concrete values — `armed=False`, `mode=''` — and
stamps `created_at=now`. Left running it would have written invented values on
top of the sealed import and smeared its timestamps to today's wall clock. The
capture launcher raises `DB_SYNC_INTERVAL` at runtime so the persister is never
reached. Nothing under `backend/` was edited.

## Blocker A — asset display is gated on a live Gazebo

`frontend/src/context/DroneContext.js`:

```
277   // Ground-truth: only show what Gazebo says exists.
312   // If Gazebo isn't running, there are no assets to display.
313   if (!gzRunning || gazeboModels.length === 0) { … SET_DRONES [] }
321   // Optional enrichment: overlay backend telemetry, but never invent extra drones.
```

`gzRunning` and the model list come from the runtime orchestrator
(`scripts/runtime_orchestrator.py`, port 8765), which derives `gz_running` from
the actual process list. With no Gazebo process there are no models, so the
operator UI displays **zero assets** regardless of what the backend holds.
There is no environment flag that relaxes this gate.

This is a deliberate anti-fabrication guard, and it is working as designed. The
honest consequence is that Run 2's telemetry cannot be shown in the operator UI
by replay alone. Pointing `REACT_APP_ORCHESTRATOR_URL` at a stub that claimed
`gz_running: true` would fabricate precisely the ground-truth signal this guard
exists to protect, and was not done.

`evidence/gate-01-dashboard.png` shows the result: `TOTAL ASSETS 00` while the
diagnostic console reads `Syncing Telemetry: 1 assets found` — the backend
genuinely holds the replayed asset and the gated display shows none.

## Blocker B — no basemap is available for the tactical map

`MAP_TILE_URL` is unset, so the map falls back to CARTO
(`frontend/src/config.js:36`), which requires an API key. The tactical map
renders as a grey field tiled with `API KEY REQUIRED` —
`evidence/gate-02-tactical-map.png`. No local tile source ships with the repo.
Even with Blocker A resolved, the tactical map would not be usable as visual
source material until a basemap is configured.

## What this record does and does not contain

Contains: a verified sealed-telemetry replay through the product's real ingest
path, a throwaway database holding Run 2's 608 real samples with the two absent
fields left absent, the harness to reproduce it, and two evidence frames
documenting the blockers.

Does **not** contain: any usable operator-UI visual source material. No
operator establishing view, no tactical map with the Run 2 path, no in-flight
replay point, no scrubbed history frames. Those were requested and are not
here, because producing them would have required faking the Gazebo
ground-truth signal.

## What the next run must do

Operator capture has to happen **during** a run, while Gazebo is live and the
orchestrator reports the model — not afterwards from telemetry. Run 2's
operator capture failed on `AuthGate`; this attempt shows that fixing auth
alone would not have been enough. For the next run, before the mission starts:
disable session auth for the capture browser, confirm the orchestrator lists
the model, and configure a basemap.
