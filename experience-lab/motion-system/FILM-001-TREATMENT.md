# Sentinel Film 001 — locked editorial structure

Locked by the owner, 30 September 2026, after the source audit. This supersedes
the original treatment's takeoff→system→landing shape.

Governing grammar:

**reality → reveal → impossible access → system logic → recorded consequence → reality**

**Not** takeoff → system → landing. No Sentinel source may be described as
takeoff footage or touchdown footage, because none exists. See
[FILM-001-SOURCE-AUDIT.md](FILM-001-SOURCE-AUDIT.md).

## Beats

### 1. Environment
Open on the real committed `world-frames/` material, before the aircraft is
visually present.

Verified: all six frames contain **zero** airframe pixels.
`obs-establish-01`, `obs-wide-01`, `obs-elevated-01`, `obs-lateral-01`,
`obs-ground3q-01`, `obs-topdown-01`.

### 2. Aircraft reveal
Transition into the strongest real readable Run 2 aircraft material. **The
usable continuous aircraft event is the descent sequence, not a takeoff.**

`visual-run-2-20260930/takeoff-land-seq/`, frames 0315 → 0323. The aircraft
enters through the top of frame and grows as it comes toward the camera.

| Frame | Airframe area (px) | Vertical position (of 1080) | Framing |
|---|---|---|---|
| 0315 | 4,248 | y 0..161 | entering, clipped at top |
| 0317 | 15,343 | y 0..332 | entering, clipped at top |
| 0319 | 16,191 | y 153..513 | fully inside |
| 0321 | 16,706 | y 356..705 | fully inside |
| 0323 | 17,699 | y 593..911 | fully inside |

The reveal may begin on 0315/0317, where the clipping reads correctly as the
aircraft entering frame.

### 3. Hero freeze
Anchor the spatial breakout on **frame 0321**, curated as
`angle-peaks/close-takeoff-land-peak-0321.png` — airframe 381×350 px, centred,
with arms, motors, propellers and landing legs all readable.

Alternate: 0323, the largest fully-inside airframe (17,699 px).

**This is the point at which Higgsfield may leave physical camera reality.**
Everything before it is truth layer.

### 4. System journey
Real `x500` geometry → PX4 SITL → MAVSDK teacher → telemetry → operator system.

Spatial interpretation layer. Must be built on the real `x500_base` mesh
(`sentinel/MODEL-ATTRIBUTION.md`, PX4-Autopilot `885fe14ee6`), never a
substitute airframe.

### 5. Recorded telemetry
Position, altitude, velocity and heading may be used: they exist in the sealed
Run 2 CSV (608 samples, sha256 `4d685cf1…`) as `lat`/`lon`, `rel_alt`,
`ground_speed_mps`, `yaw`.

**Battery is also sourced**, from `battery_remaining_pct` — 100.0 at start,
50.0 through cruise.

These are editorial-layer values. They are typeset deterministically, never
generated.

Not available, and not to be shown as telemetry: `armed`, `mode`, `in_air`.

### 6. Operator
Use **only** `operator-replay/` media — 8 stills at 3840×2160, 2 recordings at
1920×1080.

**Never** use `visual-run-2-20260930/operator/operator-signin-1600x900.webm` as
the operator-system beat. It is the auth-blocked attempt and contains no
telemetry — only `SECURE OPERATOR SIGN-IN`.

Crop or contextualize externally, do not edit the product: `ARMED UNITS 00`
(unsourced), `DEGRADED LINK MODE` / `SIGNAL STABILITY DEGRADED` (replay
freshness, not a Run 2 fault), and `LIVE OPS TRACKING` / `REAL-TIME FEED` /
`STATUS LIVE` / `SYNC ACTIVE` (hardcoded product wording).

External label: **Recorded mission replay · PX4 SITL**.

### 7. Return
Return to the real descent sequence.

### 8. Ending
**Cut at frame 0323.** That is the last frame in which the airframe is fully
inside the frame; at 0325 it is already clipped by the bottom edge (y 789..1079)
and at 0327 only a 1,569 px sliver remains.

Do not imply touchdown. There is no ground-contact frame and none may be
generated. Resolve through editorial timing, black, typography or the LESNAR
mark.

## Cadence note

`takeoff-land-seq/` holds every **other** frame of a 4 Hz capture, so the
committed descent is sampled at 2 Hz: five frames across 0315–0323, about two
seconds of wall time. The intervening even frames were not committed. If
smoother motion is needed they would have to come from the original run output,
not from a new capture.

## Standing constraints

- No recapture.
- No reverse-footage fake ascent.
- No generated touchdown.
- No fictional aircraft. The airframe is PX4 Gazebo `x500` wrapping `x500_base`,
  BSD 3-Clause, Copyright 2022 Rudis Laboratories, derived from the NXP
  HoverGames kit. It is not a LESNAR AI aircraft.
- No invented dashboard, no fake telemetry.
- No implication of physical flight. No physical airframe has ever been flown.
- No implication of Kenya. The world uses PX4's Zurich default coordinates.
- No deployment. No merge.
