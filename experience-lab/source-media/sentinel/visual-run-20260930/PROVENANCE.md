# Sentinel visual capture run, 30 September 2026

## Identity

| field | value |
|---|---|
| visual run ID | `px4_teacher_20260930_071703_d1` |
| evidence branch | `evidence/sitl-run-px4_teacher_20260930_071703_d1` |
| evidence commit | `80e429516` |
| drone | `x500_0` |
| outcome | **completed**, landed yes |
| mission dispatched | 2026-09-30T04:17:37Z |
| samples with a position | 607 |
| duration | 126 s |
| distance flown | 100 m |
| peak relative altitude | 9.6 m |
| time above 2 m | about 101 s |
| telemetry csv sha256 | `4847cb10cfc995a544bfa1d858e7aff6450b0d427d8fb8af9385d12c05675c5a` |

**This is not the sealed reference run.** That is
`px4_teacher_20260929_082014_d1`. No frame here depicts that run. This is a
separate visual capture run flown for source media.

## World

| field | value |
|---|---|
| source | `obstacles.sdf` |
| source_sha256 | `9340b64c4b4cea09652d08d8de6263c8c3bdc0d28788a884ad0cd0b2d2e36f3b` |
| canonical unchanged | yes, hashed before and after |
| derived world | `world_visual.sdf` |
| used_sha256 | `6bcfdf5028e9780e...` (full value in `visual_world_info.json`) |
| added models | six static observation cameras |
| added plugins | none |
| added spherical coordinates | no |

The source hash matches the `world.source_sha256` recorded in the sealed run's
own `mission.json`, so this run flew the same world plus cameras.

Delivered through the project's supported `LESNAR_GZ_WORLD_SDF` hook. The
script confirmed the canonical world needed no PX4 additions and left the
pre-exported path in place. `GZ_IP=127.0.0.1` throughout, matching what the
sealed run recorded. Mission geometry, obstacles, lighting, physics and the
vehicle model were not touched.

Cameras are the only instrumentation. Poses and fields of view are in
`visual_world_info.json`, and the exact added XML is reproducible from
`world_visual.sdf` in the sibling `visual-run/` directory.

## Result: the flight succeeded, most angles did not

The flight is real and complete. The problem is scale. The x500 is roughly
0.5 m across and the cameras were placed to frame the 25 m mission box, which
put every one of them too far away.

Measured airframe size, taken as the strongest colour difference against the
first frame of each sequence:

| camera | airframe pixels | bounding box | share of frame | usable |
|---|---|---|---|---|
| `takeoff` | 932 | 59 x 48 | 0.045% | yes, marginally |
| `close3q` | 224 | 34 x 23 | 0.011% | no |
| `lateral` | 181 | spread | 0.009% | no |
| `elevated` | 51 | spread | 0.002% | no |
| `topdown` | 48 | 8 x 9 | 0.002% | no |
| `wide` | 36 | 11 x 8 | 0.002% | no |

Strongest angle: **`takeoff`**, at (-9, -9, 2.0) looking at (0, 0, 6). It is
the only sequence where the airframe reads as an aircraft rather than a speck.

Second best: **`close3q`**, at 34 x 23 px. Recognisable only when magnified.

Not useful: `wide`, `elevated`, `topdown`, and `lateral` as framed. On
`elevated` and `lateral` the largest frame-to-frame differences are the sun's
shadows drifting across the ground, not the aircraft at all.

A correction worth recording: a first pass ranked the angles by counting
changed pixels, which put `elevated` first at 2585. That was shadow drift
spread over the whole frame. Looking at the frames disproved it. The table
above uses a stronger threshold and reports the compact blob.

## What is here

- `takeoff-seq/` : 103 frames, the flight interval of the one usable angle,
  every second frame from index 70 to 275, 1920x1080 PNG
- `angle-stills/` : one representative frame per angle at its own peak
- `run.log` : the full run log including the sealed-run summary
- `visual_world_info.json` : derived-world identity and camera poses

Full capture was 1674 frames across six cameras, 147 MB. Only the usable
material is committed.

## Classification

Everything here is **simulation imagery**. It is not real UI capture, and it
is not generated explanatory media. Any later use must keep those three apart.

The airframe is PX4 Gazebo `x500`, a wrapper including `x500_base`, BSD
3-Clause, Copyright 2022 Rudis Laboratories, derived from the NXP HoverGames
kit. It is not a LESNAR AI aircraft. The world uses PX4's Zurich default
coordinates; nothing here may imply Kenya. No physical airframe has been flown.

## Not captured

Operator interface and telemetry state. `sentinel_run.sh` seals the run with
`/kill-all`, which stops the whole stack, so there was no live stack left to
photograph once the flight ended. That is a property of the tool that should
have been anticipated. Both still need a stack that is up with the React
frontend running and telemetry flowing.
