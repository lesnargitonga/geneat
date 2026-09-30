# Sentinel Film 001 — "Flight Through the System"

Treatment issued by the owner, 30 September 2026, under
[MOTION-SYSTEM.md](MOTION-SYSTEM.md).

This is a **source audit**, not a production record. It maps each beat of the
treatment to the truth-layer assets that actually exist, measured against the
committed frames rather than against the capture notes. Source collection is
closed, so any beat marked GAP has to be solved by re-cutting the film, not by
capturing more.

## Headline finding

**There is no usable ascent anywhere in the committed Sentinel imagery.** The
film opens on "the aircraft lifts from the real Run 2 simulation environment".
No such frame exists.

Measured across every committed Gazebo frame (airframe isolated as dark,
achromatic pixels — the backdrop is teal `(0,153,153)`, pale sky `(231,231,243)`,
a mid-grey structure `(87,87,87)` and a dark-red spire, so the airframe is the
only near-black achromatic object):

| Sequence | Frames | Frames with a readable airframe |
|---|---|---|
| `visual-run-2-20260930/takeoff-land-seq/` | 165 | **5 hero + 3 marginal** |
| `visual-run-2-20260930/leg-seq/` | 23 | 8, all bottom-of-frame |
| `visual-run-20260930/takeoff-seq/` | 103 | **0 at usable scale** |
| `visual-run-20260930/angle-stills/` | 6 | **0 at usable scale** |

"Readable" here means an airframe of at least 1,500 px. Run 1 needs a precise
statement rather than a zero: the aircraft is *present* in 101 of its 103
`takeoff-seq` frames, but at a peak of only **698 px (84×62)** against Run 2's
**16,706 px (381×350)** — about 24× smaller in area, a speck rather than a
subject. Run 1's own note agrees, recording 932 px (59×48) and calling it
usable only "marginally".

The one continuous readable event in the accepted run is a **descent**:

| Frame | Airframe area (px) | Vertical position (frame height 1080) |
|---|---|---|
| 0315 | 4,248 | y 0..161 |
| 0317 | 15,343 | y 0..332 |
| 0319 | 16,191 | y 153..513 |
| 0321 | 16,706 | y 356..705 |
| 0323 | 17,699 | y 593..911 |
| 0325 | 19,597 | y 789..1079 |
| 0327 | 1,569 | y 1011..1079 |

The airframe crosses the frame top to bottom while growing — the aircraft
descending toward the camera. At 4 Hz this is **about two seconds of material**.

Frame 0003 holds a 1,831 px sliver at the very top edge. It is not an ascent
and is not usable.

**The touchdown is not in frame either.** The aircraft exits the bottom of the
frame at 0325–0327; there is no ground contact shot.

This corrects the Run 2 capture note, which states that the
`close-takeoff-land` camera "covers both ascent and descent, so takeoff and
landing are both usable from this angle". The descent is usable. The ascent is
not present, and the landing contact is not present.

## Beat-by-beat

| # | Beat | Layer | Status | Asset |
|---|---|---|---|---|
| 1 | Opens in real Gazebo footage; aircraft lifts | Truth | **GAP** | none exists |
| 2 | Airframe becomes visually clear, motion slows | Truth | **OK** | `angle-peaks/close-takeoff-land-peak-0321.png`, airframe 381×350 px, arms, motors, propellers and landing legs all readable |
| 3 | Camera approaches real `x500_base` geometry | Truth → Spatial | **OK** | geometry and licence in `sentinel/MODEL-ATTRIBUTION.md`; PX4-Autopilot `885fe14ee6` |
| 4 | Reality breaks; airframe separates into planes (Gazebo world, PX4 SITL, MAVSDK teacher, telemetry, operator) | Spatial | To generate | must be built on the real `x500_base` mesh, not a substitute airframe |
| 5 | Run 2 telemetry moves through the planes: position, altitude, velocity, heading | Truth + Editorial | **OK** | sealed CSV, 608 samples, sha256 `4d685cf1…`; columns `lat`/`lon`, `rel_alt`, `ground_speed_mps`, `yaw`. Values are **editorial**, never generated |
| 6 | Resolves into the real Sentinel operator surface | Truth | **OK** | `operator-replay/stills/` (8 at 3840×2160), `operator-replay/video/` (2 at 1920×1080) |
| 7 | External label `Recorded mission replay · PX4 SITL` | Editorial | Required | see disclosure below |
| 8 | Layers collapse toward the aircraft | Spatial | To generate | — |
| 9 | Returns to real Gazebo imagery; aircraft descends | Truth | **OK** | `takeoff-land-seq/` 0315–0327, ~2 s |
| 10 | …and lands; end in reality | Truth | **PARTIAL** | no touchdown frame; aircraft leaves frame mid-descent |

## Operator surface: what must not be given prominence

All three appear in the committed stills. They are product behaviour, recorded
in `operator-replay/PROVENANCE.md`, and must not be edited out of the product or
recaptured — they are cropped or contextualized externally.

| Element | Where it appears | Why |
|---|---|---|
| `ARMED UNITS 00` | `op-01-dashboard-asset-recognized@2x.png` | `armed` is absent from the sealed CSV; the tile is a product default, **not** Run 2 data |
| `DEGRADED LINK MODE`, `SIGNAL STABILITY DEGRADED` | dashboard and all map stills | replay freshness, **not** a Run 2 link fault |
| `LIVE OPS TRACKING`, `REAL-TIME FEED`, `STATUS LIVE`, `SYNC ACTIVE`, `1 ACTIVE` | throughout | hardcoded product wording; this is a replay, not a live feed |

`battery` is **sourced**: `battery_remaining_pct` is present in the sealed CSV
and reads 50.0 during cruise, so the visible 50 % is real. Altitude, velocity,
heading, latitude and longitude are likewise sourced.

**Do not use** `visual-run-2-20260930/operator/operator-signin-1600x900.webm`
as operator footage. It is the auth-blocked attempt from Run 2 and contains no
telemetry — only `SECURE OPERATOR SIGN-IN`. The operator beat is served solely
by `operator-replay/`.

## Source classes — never describe one as another

| Class | Directory |
|---|---|
| Gazebo capture (simulation imagery, visual Run 2) | `visual-run-2-20260930/{takeoff-land-seq,leg-seq,angle-peaks,validation}/`, `world-frames/` |
| Operator capture (real frontend, after-action replay) | `operator-replay/{stills,video}/` |
| Sealed telemetry (recorded source data) | run evidence branch, `px4_teacher_20260930_074210_d1` |

## Standing disclosure constraints

- No fictional aircraft. The airframe is PX4 Gazebo `x500` wrapping `x500_base`,
  BSD 3-Clause, Copyright 2022 Rudis Laboratories, derived from the NXP
  HoverGames kit. **It is not a LESNAR AI aircraft.**
- No invented dashboard, no fake telemetry.
- No implication of physical flight. No physical airframe has ever been flown.
- No implication of Kenya. The world uses PX4's Zurich default coordinates.
- Label externally as **Recorded mission replay · PX4 SITL**.

## Consequence for the cut — resolved

The treatment's bookends could not both be truth, so the structure was re-cut.
The locked replacement is [FILM-001-TREATMENT.md](FILM-001-TREATMENT.md):

**reality → reveal → impossible access → system logic → recorded consequence → reality**

Opening on `world-frames/` (verified to contain zero airframe pixels), revealing
through the descent, anchoring the spatial breakout on frame 0321, and cutting
at **0323** — the last frame in which the airframe is fully inside the frame.
No takeoff is asserted and no touchdown is implied.
