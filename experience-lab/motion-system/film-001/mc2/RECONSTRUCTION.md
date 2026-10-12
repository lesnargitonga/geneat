# Film 001 MC2 — the true-3D opening: what is real, what is reconstruction

The opening shot is a **deterministic reconstruction**, not captured footage. It
is rendered from recorded inputs only; nothing in it is generated. It resolves into
the real Run 2 frame 0321, which is captured simulation imagery.

## Recorded inputs

| input | source | identity |
|---|---|---|
| world geometry, colours, sun direction, sky colour | `world_used.sdf` from evidence branch `evidence/sitl-run-px4_teacher_20260930_074210_d1` | sha256 `b7a272e47e5a43cb…` (matches `visual-run-2-20260930/flight2_world_info.json`) |
| aircraft position and attitude over time | `telemetry_live_0.csv`, same evidence branch | sha256 `4d685cf14bde60f8…` (the sealed run) |
| airframe | PX4 `x500_base`: frame, motor, bell and prop meshes, textures, SDF assembly | BSD 3-Clause, Copyright 2022 Rudis Laboratories |
| rotor speed | x500 `model.sdf`: mass 2.064 kg, motorConstant 8.54858e-6 → hover 769.5 rad/s | derived, not measured |
| final camera | `obs_close_takeoff_land`: pose `-4 -4 1 0 -0.5541 0.7854`, hfov 0.577 | `validation/cam_plan.json` |
| the frame it resolves into | `angle-peaks/close-takeoff-land-peak-0321.png` | sha256 `9806bceb4dbc274a…`, identical to sequence frame 0321 |

## Validation against the real frames

- From the recorded camera pose, the reconstructed world lines up with frame 0321:
  tower edges, the grey wall's diagonal top, the red spire and the navy block fall
  where the capture has them, with no adjustment.
- Aircraft pose at 0321 solved from the frame's own silhouette (Nelder–Mead, then a
  global scan of each propeller angle): intersection-over-union **0.944** at
  1920×1080. Solved x −1.117, y −0.945 against telemetry −1.13, −0.94; heading
  within 0.7°; roll and pitch under 0.2°, as recorded.
- Frame 0323, solved independently, is 0.344 m lower: **0.69 m/s** over 0.5 s at the
  4 Hz capture rate, against 0.70–0.71 m/s in the sealed telemetry.
- 0321 corresponds to telemetry time 120.977 s. The anchor that makes the recorded
  track land exactly on the solved pose is 5 mm, 0.71° yaw, 0.27° pitch, 0.05° roll.

## What is interpretive (cinematography, stated as such)

- **The camera move.** A free camera arcs 90° from a close backlit three-quarter
  view onto the real camera's pose, arriving at 5.6 s. Only the final pose is real.
- **Time.** Recorded time runs at 1× until 3.6 s, then decelerates smoothly to a stop
  at the 0321 instant at 5.0 s. The aircraft's motion is the recorded descent; its
  speed on screen is an editorial choice.
- **Light and lens.** The world's own sun direction and sky colour, physically based
  shading, image-based light captured from the reconstructed world at the aircraft,
  Khronos PBR Neutral tone mapping at exposure 0.45 (calibrated so the towers match
  the capture's values), aerial haze (exponential fog, 0.0035/m), 180° shutter motion
  blur and f/4 depth of field, both by sub-frame sampling (32 samples per frame).
  Gazebo itself renders flat ambient light; this is a camera's view of the same world.
- **Spinning props.** Above a full turn per exposure, each prop is drawn as its exact
  time-average: a disc whose opacity at each radius is the measured fraction of that
  annulus the real blade covers. Below a quarter turn, the sampled blades show directly.
  At the freeze the blades sit at the angles solved from frame 0321.

## Reproduce

`x3d/` holds the scene, the flight model, the pose solver and the shot generator.
`python3 shot.py jobs.json 1920 32 <a> <b>` then `node render.mjs jobs.json out
"exposure=0.45"` renders frames a..b; `render_final.sh` renders all 156.
