# Sentinel world frames, provenance

Captured 29 September 2026 on the Precision, from the real Gazebo world, on
real GPU rendering. Not generated, not illustrated, not a mockup.

## What these are, and what they are not

These are **establishing frames of the world only**. There is no aircraft in
them. They show the environment the x500 flies in: the obstacle field, the
walls, the skyscrapers, the ground and the sun's own shadows.

They are **not** from the sealed run `px4_teacher_20260929_082014_d1` and do
not depict it. Nothing flew while these were taken. Frames showing the aircraft
require a separate visual capture run, which must be labelled as such.

## The world

Canonical `~/workspace/LesnarAI/obstacles.sdf`, sha256
`9340b64c4b4cea09652d08d8de6263c8c3bdc0d28788a884ad0cd0b2d2e36f3b`.

That hash matches the `world.source_sha256` recorded inside the sealed run's
own `mission.json`, so these frames are of the same world, byte for byte,
that the sealed flight used.

The canonical file was **not edited**. Hashes were taken before and after
generating the capture copy and compared; they are identical. The capture copy
is `world-capture.sdf`, committed here beside the frames.

Content, counted from the world: 100 trees spanning roughly 500 m square,
5 walls at 30 m, skyscrapers to 100 m, a 2000 m ground plane, one directional
light.

## Instrumentation

Six static observation cameras were added to the copy. Nothing else changed.
The world already declares its own Sensors system with the ogre2 engine, and
that is used as-is; no plugin was added and no engine was switched. Geometry,
lighting, physics, spherical coordinates, vehicle model and mission are
untouched.

Camera poses are derived, not guessed. The sealed run's `mission.json`
records the mission as a 25 m box at 10 m, and its four waypoints resolve
against the world origin to local x 0..25, y 0..25, centre (12.5, 12.5, 10).
Every camera is aimed at that box or at the aircraft's start point.

| frame | pose (x y z roll pitch yaw) | intent |
|---|---|---|
| `obs-establish` | -18 -18 2.5 0 0.051 0.785 | ground level, looking at the start point |
| `obs-ground3q` | -12 -12 3.5 0 -0.137 0.785 | low three-quarter, looking slightly up |
| `obs-wide` | -45 -45 28 0 0.218 0.785 | whole mission box with the field behind |
| `obs-lateral` | 12.5 -35 12 0 0.042 1.571 | side on, at flight altitude |
| `obs-elevated` | -30 -30 60 0 0.694 0.785 | high oblique, box reads as a shape |
| `obs-topdown` | 12.5 12.5 86 0 1.480 1.571 | near plan view |

All frames 1920x1080 PNG. No text, no telemetry overlay, no presentation
graphics are baked into any frame.

## How they were taken

`gz sim -s -r --headless-rendering` on the capture copy, with frames pulled
off the camera topics by `grab.py` (committed here), which subscribes with
the gz transport Python bindings and writes PNGs. It observes published images
and changes nothing.

Two things had to be solved and are worth recording:

Gazebo transport on this machine must be pinned with `GZ_IP=127.0.0.1` or the
simulation and any client bind to different interfaces and cannot see each
other. The sealed run's own `mission.json` records the same setting under
`gazebo_launch`.

The top-down camera at a pitch of exactly 1.5707 produced an empty image every
time, a degenerate view matrix looking straight down. It is at 1.48 instead,
which is why that frame is a near plan view rather than a true vertical.

## Still outstanding

Frames 2, 4, 7 and 8 of the capture plan: takeoff, trailing view, operator and
telemetry state, and landing. All four need the aircraft, so they need a
separate visual capture run flown through the project's own
`tools/sentinel_run.sh`, whose `LESNAR_GZ_WORLD_SDF` hook can carry the
observation cameras while recording exactly what was added.
