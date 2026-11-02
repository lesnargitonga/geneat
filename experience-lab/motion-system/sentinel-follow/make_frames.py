#!/usr/bin/env python3
"""Cut the Operation Sentinel follow-camera flight into the site's flight film.

    python3 make_frames.py <all_frames_dir> <out_dir>

Source: Episode 003 capture `px4_teacher_capture_20261031_013252_follow_bcf9e52-follow.mp4`
(sha256 1496613609824f1d…), a real PX4 SITL + Gazebo flight of the corrected code (bcf9e52) flying
Run 2's sealed mission, the complete successful mission approved by the owner on 31 Oct 2026. Every
frame decoded at 720x1280, 30 fps (frames f0000..f3121 = video seconds × 30).

Three spans of real flight, joined by 10-frame crossfades, nothing else added:
  takeoff to cruise           6.0–13.0 s
  waypoint 1, the old stop point (52.2 s), the turn beside the wall (58.8 s)   44.0–60.0 s
  back over home and touchdown 97.0–104.0 s
The 2 s "stuck → replan" pause at 79.6 s (PROVENANCE.md) falls outside every span, so it is not shown.
"""
import sys
from pathlib import Path
from PIL import Image

src, out = Path(sys.argv[1]), Path(sys.argv[2])
FPS, XF = 30, 10
SPANS = [(6.0, 13.0), (44.0, 60.0), (97.0, 104.0)]
frame = lambda i: Image.open(src / f"f{i:04d}.png").convert("RGB")

seq = []
for a, b in SPANS:
    span = [frame(i) for i in range(round(a * FPS), round(b * FPS))]
    if seq:
        for k in range(XF):
            seq[-XF + k] = Image.blend(seq[-XF + k], span[k], (k + 1) / (XF + 1))
        span = span[XF:]
    seq += span
out.mkdir(parents=True, exist_ok=True)
for k, im in enumerate(seq):
    im.save(out / f"c{k:03d}.png")
print(out, len(seq), "frames,", round(len(seq) / FPS, 2), "s")
