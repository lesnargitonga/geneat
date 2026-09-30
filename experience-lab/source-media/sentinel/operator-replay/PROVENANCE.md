# Sentinel — operator capture (after-action replay of Run 2)

Real Sentinel operator frontend, captured 30 September 2026, replaying the
sealed telemetry recorded during visual Run 2. **No mission was flown for this
capture.**

## The three source classes, kept distinct

These are different things and must never be described as one another:

| Class | What it is |
|---|---|
| **Gazebo capture** | Simulation imagery from visual Run 2. Not in this directory. |
| **Operator capture** | *This directory.* The real Sentinel frontend, captured later, replaying visual Run 2's sealed telemetry while a **non-flying** Gazebo `x500_0` exists solely to satisfy the product's ground-truth model gate. |
| **Sealed telemetry** | The recorded source data from `px4_teacher_20260930_074210_d1`. |

The aircraft visible to Gazebo during this capture was **not executing Run 2**.
It never moved. Every number on the dashboard came from the sealed recording.

## Sealed telemetry source

| | |
|---|---|
| Run | `px4_teacher_20260930_074210_d1` (visual Run 2) |
| Artifact | `evidence/sitl-run-px4_teacher_20260930_074210_d1:evidence/runs/px4_teacher_20260930_074210_d1/telemetry_live_0.csv` |
| sha256 | `4d685cf14bde60f8d8dee74f…` |
| Samples | 608 |
| Span | 2026-09-30 04:42:26.855 → 04:44:32.698 UTC (125.84 s) |

Profile: grounded to t=22.7 s, climb to ~9.5 m, cruise to ~110 s, descent,
last sample above 1 m at t=124.2 s, landed at 0.023 m. Max altitude 9.55 m at
t=73.3 s. Battery 100.0 → 50.0.

## Gazebo state during capture — ground-truth gate only

`frontend/src/context/DroneContext.js:277` — *"Ground-truth: only show what
Gazebo says exists"* — gates the asset list on the runtime orchestrator
reporting a live Gazebo process and an `x500_*` model. That guard was **not**
stubbed, hardcoded, bypassed or patched. It was satisfied honestly:

- The real `gz sim` server, started through the project's own
  `scripts/start_gz_world.sh` with `LESNAR_GZ_HEADLESS=1`.
- The real PX4 `x500` model (which merge-includes `x500_base`), PX4-Autopilot
  at commit `885fe14ee6`, spawned as `x500_0`.
- Canonical `~/workspace/LesnarAI/obstacles.sdf` was **not edited**
  (sha256 `9340b64c4b4cea09`, confirmed clean in git). A derived copy
  (sha256 `07b7ce43e62f7ffe`) adds only the `<include>` for `x500_0`;
  geometry, obstacles, lighting, physics and spherical coordinates unchanged.
- The real `scripts/runtime_orchestrator.py` on port 8765, unmodified.

Orchestrator `/status` throughout the capture:

```
gz_running      = True
px4_running     = False      <- no PX4
teacher_running = False      <- no teacher flight
drone_models    = ['x500_0']
```

`x500_0` pose at start and end of capture: `[0, 0, -0.013]` XYZ, `[0, 0, 0]`
RPY — settled on the ground at spawn, never moved. Nothing publishes
`command/motor_speed`, so the rotors stayed at zero. No PX4, no mission, no
autonomous navigation, no takeoff.

## Replay path

Sealed samples were republished onto the Redis `telemetry` channel that the
Sentinel agent used during the live flight; `redis_bridge_loop`
(`backend/app.py:2417`) ingested them exactly as it did in flight, registering
the aircraft as external with `start_simulation=False` and an explicit
`stop_simulation()`. Telemetry history came from the product's own
`/api/drones/<id>/history` endpoint over the imported 608 rows.

## Unavailable telemetry fields — exact list

The sealed CSV has no `armed`, no `mode` and no `in_air` column.

- **`mode`** — published as the empty string, so the asset popup renders the
  MODE row blank. Omitting it entirely would have left the fleet object's
  constructor default in place and the UI would have printed `STABILIZE`, a
  value with no source in Run 2. Visible as blank in
  `stills/op-03-mid-cruise-readout-t66s@2x.png`.
- **`armed`** — genuinely unavailable and **not** representable as unavailable
  through this interface: the bridge coerces it with `bool()`. It therefore
  reads `False`. **Consequence: the dashboard tile `ARMED UNITS 00` is not
  sourced from Run 2.** It is a product default standing in for a missing
  field. Do not present that tile as Run 2 data.
- **`in_air`** — not published; the product derives `is_flying` from the real
  altitude. Note it is sticky (`drone.is_flying or …`), which is why the sealed
  run is replayed as a single pass. Looping carried the previous pass's
  airborne state into the next pass's grounded start.
- `flight_phase` **does** exist in the CSV (phase 0 = 84 grounded samples,
  phase 1 = the 524-sample flight) and was deliberately **not** mapped onto
  `armed`. Plausible, but inference rather than source.

Everything else on screen is sourced: altitude, velocity, battery, heading
(encoded as marker rotation), latitude/longitude and the replay timestamps.

## Sealed-history protection

`_persist_telemetry_history` (`backend/app.py:785`) coerces absent fields into
concrete values (`armed=False`, `mode=''`) and stamps `created_at=now`. The
capture launcher raises `DB_SYNC_INTERVAL` at runtime so it is never reached.
Verified after every pass: 608 rows, `armed` NULL in all 608, `mode` NULL in
all 608, `max(created_at)` = 2026-09-30 04:44:32.698 — no row carries capture
wall-clock. Nothing under `backend/` or `frontend/` was modified.

## Map tile configuration

Configured through the product's existing mechanism, no code change:

```
REACT_APP_MAP_TILE_URL='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
REACT_APP_MAP_TILE_ATTRIBUTION='© OpenStreetMap contributors'
```

`MAP_TILE_URL` takes precedence over the provider profile and carries its own
attribution (`frontend/src/components/DroneMap.js:204-205`). The attribution
string is rendered in-frame, bottom right of the map, in every map still.

Geography is whatever Run 2 recorded: the PX4 default Zurich simulation origin
(Irchel / Winterthurerstrasse, Zurich). It was not edited, not generated, and
does not imply Kenya.

**Scale note:** Run 2's mission is a ~25 m box. At OpenStreetMap's maximum zoom
(z18, ≈0.40 m/px at this latitude) the sealed path renders ≈63 px across. That
is a true property of the mission's physical scale, not a rendering fault. The
product sets `zoomControl={false}` and Leaflet will not render past the tile
layer's max zoom, so 63 px is the honest ceiling with this basemap.

## Capture configuration — NOT the production security configuration

| Setting | Value |
|---|---|
| `LESNAR_REQUIRE_AUTH` | `0` — capture only |
| `REACT_APP_REQUIRE_SESSION_AUTH` | `0` — capture only |
| `LESNAR_ENFORCE_AUDIT_CHAIN` | `0` — capture only |
| `LESNAR_EXTERNAL_ONLY` | `1` — product's "wait for real telemetry" mode |
| `LESNAR_ENABLE_DEMO_FLEET` | `0` — the `LESNAR-DEMO-01/02/03` seed was never used |
| `DATABASE_URL` | throwaway SQLite, isolated from all real and dev databases |
| `REDIS_PORT` | `6399` — throwaway container, isolated from the dev Redis |

## Hardcoded UI language that could mislead a visitor

The product was **not** altered for the capture. This wording is baked into the
interface and is visible in the media. It describes the surface, not this
recording:

| Wording | Where |
|---|---|
| `LIVE OPS TRACKING` | Tactical HUD subtitle, every map still |
| `REAL-TIME FEED` | Dashboard, above Active Tactical Units |
| `REAL-TIME STRATEGIC OVERVIEW & ASSET MONITORING` | Dashboard subtitle |
| `ACTIVE SORTIES 01` / `STATUS LIVE` | Dashboard KPI tile |
| `1 ACTIVE` | Tactical HUD assets counter |
| `SYNC ACTIVE`, `LINK_ACTIVE` | Header and footer chips |

**The homepage must label this media externally as `Recorded mission replay`.**
None of it is a live feed.

Two further readouts that could be misread:

- `DEGRADED LINK MODE` / `SIGNAL STABILITY DEGRADED` / `telemetry age …` — the
  product's own link-freshness logic reacting to a replay rather than a live
  aircraft. It is **not** evidence of a degraded link during Run 2.
- `ARMED UNITS 00` — see the unavailable-fields section above.

## Contents

`stills/` — 3840×2160 (1920×1080 at 2× device pixel ratio), no overlays added.

| File | What it shows | Sealed state |
|---|---|---|
| `op-01-dashboard-asset-recognized@2x.png` | `TOTAL ASSETS 01`, `X500_0` AIRBORNE | 9.5 m, 1.8 m/s, 50 % |
| `op-02-early-flight-t32s@2x.png` | early flight, just after climb | t=32.11 s, 9.42 m |
| `op-03-mid-cruise-readout-t66s@2x.png` | asset popup; MODE blank (unavailable) | t=66.04 s, 9.50 m, 1.82 m/s, 50 % |
| `op-04-cruise-late-t90s@2x.png` | late cruise | t=90.32 s, 9.51 m |
| `op-05-landing-t124s@2x.png` | descent / landing | t=124.44 s, 0.99 m |
| `op-06-replay-path-start@2x.png` | replay active, scrubber at history start | sealed timestamps |
| `op-07-replay-path-mid@2x.png` | replay mid-history | sealed timestamps |
| `op-08-replay-path-full@2x.png` | full sealed path, scrubber at end | `2026-09-30T04:44:32.698232` |

`video/` — 1920×1080 webm, no overlays added.

| File | What it shows |
|---|---|
| `op-sealed-run-through-operator-surface-1920x1080.webm` | the full 125.84 s sealed run played through the operator surface |
| `op-replay-scrub-1920x1080.webm` | after-action replay: the history scrubber driven end to end across the sealed path |

`harness/` — reproducible: `import_run2.py` (sealed CSV → throwaway DB),
`run_backend_capture.py` (capture backend, external-only, sealed-history
guard), `replay_publish.py` (sealed samples → real Redis ingest),
`capture_operator.mjs` and `capture_path.mjs` (Playwright capture),
`obstacles-x500-static.sdf` (derived world, stationary `x500_0`).

## Evidence that the ground-truth gate is real

`evidence/gate-01-dashboard.png` and `evidence/gate-02-tactical-map.png` were
captured on the first attempt, before Gazebo was started. They show the same
frontend, with the sealed telemetry already flowing into the backend, refusing
to display any asset: `TOTAL ASSETS 00` while the diagnostic console reads
`Syncing Telemetry: 1 assets found`. They are kept because they prove the gate
was satisfied by a real Gazebo rather than bypassed. `gate-02` also shows the
CARTO `API KEY REQUIRED` basemap failure that the OpenStreetMap configuration
above replaced.

## Limits of this media

- The UI's history endpoint is called with `limit=300`, so the drawn path is
  the most recent 300 of 608 sealed samples (≈62 s of the flight). That is the
  product's own limit and was not changed.
- The replay marker encodes heading as rotation and altitude as colour; it
  prints no numeric text. Numeric readouts come from the telemetry path.
- No operator capture exists from *during* Run 2 itself. This is a later
  reconstruction, and the media must be labelled as a replay.
