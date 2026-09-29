# PX4 Gazebo x500 assets: paths, licence, attribution

For downstream 3D and explanatory work. Verified on the Precision,
29 September 2026.

## What the runs actually spawn

The simulation spawns `x500`. That model is a thin wrapper: its `model.sdf`
contains `<uri>model://x500_base</uri>` and adds the PX4 plugins. All geometry
and texture lives in `x500_base`. For 3D work, `x500_base` is the asset.

Other variants exist in the same directory (`x500_depth`, `x500_lidar_2d`,
`x500_lidar_down`, `x500_gimbal`, `x500_mono_cam`, `x500_vision` and others).
None of them is what these runs used.

## Exact files

Root: `~/PX4-Autopilot/Tools/simulation/gz/models/x500_base/`
PX4-Autopilot at commit `885fe14ee6`, working tree clean, no local changes.

| file | size | sha256 (first 12) |
|---|---|---|
| `meshes/NXP-HGD-CF.dae` | 21,875 KB | `7321861b1138` |
| `meshes/5010Base.dae` | 361 KB | `798396a1945c` |
| `meshes/5010Bell.dae` | 385 KB | `b90a1b2dd63a` |
| `meshes/1345_prop_cw.stl` | 510 KB | `7aa4b61c1ddc` |
| `meshes/1345_prop_ccw.stl` | 511 KB | `ba197e096111` |
| `meshes/CF.png` | 1,531 KB | `3a56ec48eeaa` |
| `materials/textures/CF.png` | 1,531 KB | `3a56ec48eeaa` |
| `materials/textures/nxp.png` | 25 KB | `6c2262c84e0f` |
| `materials/textures/rd.png` | 26 KB | `9d8851c37dc6` |
| `model.sdf` | 17 KB | `e807dca3406f` |
| `model.config` | 1 KB | `4856afbdeb52` |
| `LICENSE` | 1 KB | `cee4ef94e73c` |
| `thumbnails/1.png` to `5.png` | 23 to 51 KB | reference renders |

The airframe body is one 21.9 MB Collada mesh. Motors are two Collada meshes,
propellers two STLs, and there are three textures.

## Licence

BSD 3-Clause. Copyright (c) 2022, Rudis Laboratories. Author Benjamin
Perseghetti, bperseghetti@rudislabs.com. The licence file ships with the model
at the path above.

BSD 3-Clause permits reuse and modification in source and binary form,
including commercially, provided the copyright notice, the condition list and
the disclaimer are retained, and provided the copyright holder's name is not
used to endorse derived work without permission.

Practical consequence: the meshes may be exported, retopologised, re-textured
and rendered, including for commercial use on the site, as long as the notice
travels with any redistribution of the model files themselves and neither
Rudis Laboratories nor its contributors are implied to endorse LESNAR AI.

## Attribution line for downstream use

> Airframe model: PX4 Gazebo `x500_base`, BSD 3-Clause, Copyright (c) 2022
> Rudis Laboratories, author Benjamin Perseghetti. Derived from the NXP
> HoverGames development kit KIT-HGDRONEK66.

## What the model is, and what it is not

`model.config` describes it as a model of the NXP HoverGames Drone development
kit KIT-HGDRONEK66, a PX4-compatible evaluation kit for the RDDRONE-FMUK66
reference design.

It is a third-party simulation asset. It is not a LESNAR AI aircraft, it is not
a photograph of hardware, and LESNAR AI has not flown a physical airframe.
Nothing produced from these meshes may imply otherwise.
