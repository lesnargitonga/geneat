# Operation Sentinel, visual capture plan

Status on 29 September 2026: **blocked, one command away.**

## The blocker

Gazebo cannot render on the Precision right now. No NVIDIA kernel module is
built for the running kernel `7.0.0-34-generic`, so OpenGL falls back to
llvmpipe and the sensor pipeline dies: ogre2 aborts on a material datablock
collision, ogre v1 segfaults. This was isolated properly. A world containing
one box and one camera crashes identically, so it is the render stack, not the
world and not the SDF.

The Gazebo **server** is healthy. It loads `obstacles.sdf`, runs dartsim
physics for 500 iterations and exits clean. Headers for the running kernel are
installed, so:

```
sudo dkms install -m nvidia -v 580.173.02 -k 7.0.0-34-generic
sudo modprobe nvidia_drm
nvidia-smi
```

Offscreen EGL does not need the display server, so capture can begin as soon as
`nvidia-smi` answers. No reboot expected. If that command fails, stop at its
actual error. Do not start swapping graphics packages.

## Order of work once the GPU answers

1. Smallest possible case first: the one box, one camera world already written
   to the scratchpad. Confirm frames land on disk.
2. Then the real world with observation cameras.
3. Only then a watched run.

## The factual reference

Sealed run `px4_teacher_20260929_082014_d1`, on branch
`evidence/sitl-run-px4_teacher_20260929_082014_d1` of `lesnargitonga/lesnarai`:
608 telemetry samples, 126 seconds, 99 m flown against a 100 m planned box,
25 m sides, 10 m planned altitude, max altitude 9.6 m, mission completed,
landed. Bridge commit `3ba2677c`.

Any frames produced by a **new** watched run must be labelled as a separate
visual capture run. They may not be presented as depicting the sealed run
unless they are literally from it.

## Instrumentation, and what stays untouched

Observation cameras are added to a **copy** of the world only. The canonical
`~/workspace/LesnarAI/obstacles.sdf` is not edited. Unchanged in the copy:
geometry (5 walls, about 100 trees, 300 cylinders, 60 boxes, 2 ground planes),
the single directional light, ode physics at 250 Hz with a 0.004 step, the
spherical coordinates, the vehicle model, and the mission.

Cameras are presentation instrumentation. They observe; they do not alter.
This must be stated in the provenance of every frame produced.

## The eight required frames

Mission geometry is a 25 m box at 10 m altitude, so poses are sized to that.

| # | frame | camera pose, x y z roll pitch yaw | note |
|---|---|---|---|
| 1 | grounded establishing | -14 -14 2.2, 0 0.12 0.78 | aircraft on the ground, obstacle field behind |
| 2 | takeoff three-quarter | -10 -10 3.0, 0 0.16 0.78 | low, looking up the climb |
| 3 | wide mission flight | -38 -34 16, 0 0.30 0.72 | whole box and the tree field in frame |
| 4 | lateral / trailing | follows vehicle, 12 m behind, 6 m up | needs a pose publisher tracking the airframe |
| 5 | elevated geometry | -26 -26 30, 0 0.62 0.78 | the box reads as a shape |
| 6 | top-down | 12.5 12.5 55, 0 1.5707 0 | plan view, box centred |
| 7 | landing | -10 -10 2.6, 0 0.14 0.78 | descent and touchdown |
| 8 | operator and telemetry | not Gazebo, see below | real UI |

Resolution 1920x1080 minimum per frame, 2560x1440 preferred, PNG, via
`<save enabled="true">` on each camera sensor. No text, no telemetry overlay
and no presentation graphics baked into any Gazebo frame.

## Frame 8, the operator surface

Captured from the real React frontend at `~/workspace/LesnarAI/frontend`, with
Playwright, not from Gazebo. Components available: `DroneMap`, `Dashboard`,
`Analytics`, `DiagnosticTerminal`, `TacticalHotkeys`, `HealthStatusIndicator`,
`RuntimeOrchestratorBlock`.

Note already verified: the fabricated boot banner is gone. `DiagnosticTerminal.js`
now logs real socket state and there are zero occurrences of `AES-256` or
`SYSTEM STATUS: OPTIMAL` anywhere in `frontend/src`. The console is safe to show
on that count. It still carries a neon, all-caps register that does not match
the site, which is a design question rather than an honesty one.

## Naming rules, binding on any published use

- The model is PX4 Gazebo `x500_base`, BSD 3-Clause, Copyright 2022 Rudis
  Laboratories, author Benjamin Perseghetti. It models the NXP HoverGames
  development kit KIT-HGDRONEK66. Meshes: `NXP-HGD-CF.dae` 21.9 MB,
  `5010Bell.dae`, `5010Base.dae`, `1345_prop_cw.stl`, `1345_prop_ccw.stl`.
- It must not be described as a physical LESNAR AI aircraft.
- The world uses PX4's Zurich default spherical coordinates, latitude
  47.397971, longitude 8.546164. Nothing may imply this flight happened in
  Kenya, visually or in text.
- No physical airframe has been flown. No `.ulg` or `.ulog` flight log exists
  anywhere in the workspace.
