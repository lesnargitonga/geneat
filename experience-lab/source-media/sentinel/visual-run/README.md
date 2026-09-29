# Sentinel visual capture run

**Prepared and verified, not yet flown.** Blocked on one port conflict that
needs a decision, described below.

## What this is

A **new and separate visual capture run**, whose only purpose is source media
showing the aircraft. It is not a sealed evidence run, and it is not
`px4_teacher_20260929_082014_d1`. Frames it produces must never be presented
as depicting that sealed run.

## The blocker

The project's own `sentinel_run.sh` checks its ports before starting anything
and stopped cleanly:

```
STOPPED: these ports are in use by something outside this stack:
   port 5432: container aimodel-postgres-1
   port 6379: container aimodel-redis-1
Stop them, then run this again. Nothing was started.
```

Those are this repository's own dev containers. Stopping running containers is
an interference with live workloads, so it was not done automatically. Nothing
was started and nothing was changed.

To proceed:

```
docker stop aimodel-postgres-1 aimodel-redis-1
bash experience-lab/source-media/sentinel/visual-run/launch-visual-capture.sh
docker start aimodel-postgres-1 aimodel-redis-1
```

## What is already verified

The world hook works. On the aborted attempt the script reported
`obstacles.sdf already has what PX4 needs; flying it unchanged`, which is the
branch that leaves a pre-exported `LESNAR_GZ_WORLD_SDF` in place. The derived
world therefore reaches Gazebo through the supported path, and
`scripts/start_gz_world.sh` is confirmed to read that variable.

`SENTINEL_GZ_HEADLESS_RENDERING=1` installs the script's own gz shim that adds
`--headless-rendering`, giving EGL rendering with no display required.

`GZ_IP=127.0.0.1` is exported, matching what the sealed run recorded under
`gazebo_launch`.

## Derived world provenance

Recorded in `visual_world_info.json`:

| field | value |
|---|---|
| source | `obstacles.sdf` |
| source_sha256 | `9340b64c4b4cea09652d08d8de6263c8c3bdc0d28788a884ad0cd0b2d2e36f3b` |
| canonical_unchanged | true, hashed before and after |
| used_file | `world_visual.sdf` |
| used_sha256 | `6bcfdf5028e9780e...` (full value in the json) |
| added_models | takeoff, close3q, lateral, wide, elevated, topdown |
| added_plugins | none |
| added_spherical_coordinates | false |

The source hash matches the `world.source_sha256` inside the sealed run's own
`mission.json`, so this run flies the same world that run flew, plus cameras.

Cameras are the only instrumentation. No geometry, obstacle, lighting,
physics, spherical-coordinate, vehicle or mission change. Poses are derived
from the sealed `mission.json`: a 25 m box at 10 m, local x 0..25, y 0..25,
centre (12.5, 12.5, 10).

## What it will capture

`grab_seq.py` records PNG sequences at 2 Hz per camera for the flight, so the
material is temporal rather than a set of stills. Six angles: takeoff, close
three-quarter, lateral at flight altitude, wide, high oblique, near plan view.

Operator and telemetry capture are separate and still to do; they come from
the real React frontend and the telemetry stream, not from Gazebo.

## Naming rules that bind any output

- The airframe is PX4 Gazebo `x500`, a wrapper including `x500_base`, BSD
  3-Clause, Copyright 2022 Rudis Laboratories, modelling the NXP HoverGames kit.
  Not a LESNAR AI aircraft.
- The world uses PX4's Zurich default coordinates. Nothing may imply Kenya.
- No physical airframe has been flown. This is simulation imagery.
- Frames from this run are simulation imagery, distinct from real UI capture
  and from any later generated explanatory media.
