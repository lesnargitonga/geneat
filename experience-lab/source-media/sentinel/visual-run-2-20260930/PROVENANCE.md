# Sentinel visual capture run 2, 30 September 2026

## Identity

| field | value |
|---|---|
| visual run ID | `px4_teacher_20260930_074210_d1` |
| evidence branch | `evidence/sitl-run-px4_teacher_20260930_074210_d1` |
| evidence commit | `511dc9b3d` |
| drone | `x500_0` |
| outcome | **completed**, landed yes |
| mission dispatched | 2026-09-30T04:42:42Z |
| samples with a position | 608 |
| duration | 126 s |
| distance flown | 99 m |
| peak relative altitude | 9.6 m |
| time above 2 m | about 101 s |
| telemetry csv sha256 | `4d685cf14bde60f8d8dee74f6aae78a31a0ab9d03f2fd5898b56841343534af1` |

A new visual capture run. Not the sealed reference run
`px4_teacher_20260929_082014_d1`, and not run 1
`px4_teacher_20260930_071703_d1`. Both of those remain untouched.

## World

| field | value |
|---|---|
| source | `obstacles.sdf` |
| source_sha256 | `9340b64c4b4cea09652d08d8de6263c8c3bdc0d28788a884ad0cd0b2d2e36f3b` |
| canonical unchanged | yes, hashed before and after the run |
| derived world | `world_flight2.sdf` |
| used_sha256 | `b7a272e47e5a43cb...` (full value in `flight2_world_info.json`) |
| added | three static observation cameras, nothing else |
| added plugins | none |
| added spherical coordinates | no |

Delivered through the supported `LESNAR_GZ_WORLD_SDF` hook; the script again
reported `obstacles.sdf already has what PX4 needs; flying it unchanged` and
left the pre-exported path in place. `GZ_IP=127.0.0.1`. Mission geometry,
obstacles, physics, lighting and vehicle behaviour untouched.

## Camera design and pre-flight validation

Cameras were placed against the aircraft path and the phase each must catch,
not against the box centre. Positions derive from the sealed mission geometry:
waypoints at (0,25), (25,25), (25,0), (0,0) at 10 m, home at (0,0).

Validation was run before flying, in a separate non-canonical world holding the
real `x500_base` geometry at each camera's intended capture point, rendered
twice, with and without the airframe, so the difference isolates it exactly.

| camera | distance | fov | predicted | **measured** | margin to frame edge | backdrop tones | verdict |
|---|---|---|---|---|---|---|---|
| `close-takeoff-land` | 6.65 m | 0.577 | 250 px | **335 px** | 411 px | 46 | pass |
| `close-leg` | 7.28 m | 0.528 | 250 px | **351 px** | 413 px | 49 | pass |
| `close-corner` | 9.18 m | 0.418 | 250 px | **341 px** | 412 px | 77 | pass |

All three passed, inside the 200 to 400 px target, well clear of frame edges,
with real depth behind them rather than a flat wall face. The validation frames
are in `validation/`.

## What the flight actually produced

Capture rate 4 Hz on three cameras, 340 frames each, 1020 total.

| camera | frames | MB | peak airframe px | usable frames | interval | verdict |
|---|---|---|---|---|---|---|
| `close-takeoff-land` | 340 | 14 | 25,484 | 18 | 2..326 | **strongest** |
| `close-leg` | 340 | 7 | 15,629 | 8 | 14..20 | second, marginal |
| `close-corner` | 340 | 14 | 626 | 6 | 130..134 | not useful |

**Strongest: `close-takeoff-land`.** The airframe is large, centred and sharp,
with arms, motors, propellers and landing legs all readable, against a teal
wall, grey structure, red spire and sky. It covers both ascent and descent, so
takeoff and landing are both usable from this angle.

**Second: `close-leg`.** The aircraft is large and detailed but sits in the
bottom-left corner, already leaving frame. Eight usable frames.

**Not useful: `close-corner`.** The aircraft appears as a speck near the bottom
edge.

## Why validation passed and two cameras still underdelivered

The validation probe sat at the commanded altitude, 10.0 to 10.5 m. The
aircraft's achieved peak was **9.6 m**, and it is below that for much of each
leg. With a frame height of about 2.2 m at these distances, roughly a metre of
altitude error pushes the aircraft from centre frame to the bottom edge, which
is exactly what `close-corner` shows.

The lesson is specific and should carry into any third attempt: aim at the
**achieved** altitude from the telemetry of a previous run, not the commanded
altitude from the mission file, and widen the vertical field so a metre of
altitude error cannot empty the frame.

`close-takeoff-land` was unaffected because it aims at the climb near the
ground, where the aircraft passes through a wide band of altitude regardless.

## Source classes, kept separate

- `takeoff-land-seq/`, `leg-seq/`, `angle-peaks/`, `validation/` :
  **Gazebo simulation imagery**
- `operator/operator-signin-1600x900.webm` : **real Sentinel operator UI**
- `telemetry.jsonl` and the sealed run CSV : **run telemetry and data**

No telemetry overlay was added to any Gazebo frame.

## Operator and telemetry: what was and was not captured

The operator interface was recorded continuously for the whole flight, so the
recording survived the stack shutdown, which was the failure in the previous
session. The recording is real and is the genuine Sentinel operator surface:
title `Lesnar AI - Drone Control Dashboard`, showing `SECURE OPERATOR SIGN-IN`
and `SESSION TOKEN REQUIRED FOR THIS DEPLOYMENT`.

**It does not contain changing telemetry.** `AuthGate` requires a session
token, and obtaining one needs operator credentials, which were not used and
should not be. The dashboard behind the gate was never reached.

The separate telemetry poll ran for 229 samples across five endpoints and every
one returned an HTTP error, for the same reason: the backend requires
authentication. `telemetry.jsonl` is preserved as the honest record of that
attempt and contains no telemetry values.

Real run telemetry is preserved where it always is, sealed in the run's own
evidence branch: 608 samples with a position, csv sha256 `4d685cf1...`.

To capture the live operator dashboard, someone with credentials needs to seed
a session token before the flight. That is the only missing piece.

## Naming rules

The airframe is PX4 Gazebo `x500`, wrapping `x500_base`, BSD 3-Clause,
Copyright 2022 Rudis Laboratories, derived from the NXP HoverGames kit. It is
not a LESNAR AI aircraft. The world uses PX4's Zurich default coordinates, so
nothing here may imply Kenya. No physical airframe has been flown.
