"""Deterministic luminance bridge for Shot 002.

The shot is graded as one continuous descent from the luminance of its own first
frame (the previous shot's last frame, carried in as the world plane) to a target
just above the operator replay, rather than given a flat exposure lift. Gain never
exceeds 1.0 so nothing clips, frame 0 is left untouched so the cut stays seamless,
and each frame is held at or below the previous one so the trajectory cannot dip
and brighten again.

usage: python grade.py <frames_dir> <out_dir> <first_frame_index> [L1=44.0]
"""
import glob, sys
import numpy as np
from PIL import Image

SRC, DST, FIRST = sys.argv[1], sys.argv[2], int(sys.argv[3])
L1 = float(sys.argv[4]) if len(sys.argv) > 4 else 44.0
ease = lambda t: t * t * (3 - 2 * t)

fs = sorted(glob.glob(f"{SRC}/f*.png"))[FIRST:]
N = len(fs); out = []; prev = None
L0 = float(np.asarray(Image.open(fs[0]).convert("RGB"), dtype=np.float32).mean())
for i, f in enumerate(fs):
    a = np.asarray(Image.open(f).convert("RGB"), dtype=np.float32)
    cur = a.mean()
    tgt = L0 + (L1 - L0) * ease(i / (N - 1))
    if prev is not None:
        tgt = min(tgt, prev)                 # never brighten again
    g = min(1.0, tgt / max(cur, 1e-6))
    # Rounding after a <1 gain biases the mean slightly upward, which would
    # ratchet the running cap upward frame by frame. Correct it so each frame
    # lands at or below its predecessor.
    for _ in range(4):
        b = np.clip(np.rint(a * g), 0, 255).astype(np.uint8)
        m = float(b.astype(np.float32).mean())
        if prev is None or m <= prev + 1e-9:
            break
        g *= prev / max(m, 1e-6)
    Image.fromarray(b).save(f"{DST}/g{str(i).zfill(3)}.png")
    out.append(m); prev = m
print(f"  graded {N} frames from f{FIRST:03d}: L0 {L0:.2f} -> L1 {L1:.2f}")
print(f"    first {out[0]:6.2f}   min {min(out):6.2f}   last {out[-1]:6.2f}   rises > 0.2: {sum(1 for i in range(1, N) if out[i] > out[i-1] + 0.2)}")
