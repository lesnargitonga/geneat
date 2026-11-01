"""MediMatch command moment: the encoder's source frames, rebuilt from the recording cut.

Takes the 145 frames sample_frames.mjs cuts from the product recording
(o000.png..o144.png, 1920x1080, t = 4.3 s + i/24) and applies the loop's 8-frame
linear fade to black at each end, so the loop restarts black to black with no
seam. Writes c000.png..c144.png (RGB) for encode_master.sh and check_decode.py.

The original c-frames of the 1600x900 master were not kept. This fade is the
one COMMAND-MOMENT.md describes ("an 8-frame linear fade at each end"),
confirmed against the master: frames 0 and 144 decode to pure black, and gain
min(1, i/8, (144 - i)/8) matches the master's fade frames better than a 7- or
9-frame ramp wherever picture outweighs the decoder's black-level offset.

usage: python3 make_frames.py <cut_dir> <out_dir>
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

FADE_FRAMES = 8
EXPECTED_FRAMES = 145
EXPECTED_SIZE = (1920, 1080)


def gain(index: int, count: int) -> float:
    return min(1.0, index / FADE_FRAMES, (count - 1 - index) / FADE_FRAMES)


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("usage: make_frames.py <cut_dir> <out_dir>")
    cut_dir, out_dir = sys.argv[1], sys.argv[2]
    cut = sorted(glob.glob(os.path.join(cut_dir, "o[0-9][0-9][0-9].png")))
    if len(cut) != EXPECTED_FRAMES:
        sys.exit(f"expected {EXPECTED_FRAMES} cut frames o000..o144 in {cut_dir}, found {len(cut)}")
    os.makedirs(out_dir, exist_ok=True)
    stale = glob.glob(os.path.join(out_dir, "*.png"))
    if stale:
        sys.exit(f"{out_dir} already holds {len(stale)} png files; give an empty directory")
    for i, path in enumerate(cut):
        expected = os.path.join(cut_dir, f"o{i:03d}.png")
        if path != expected:
            sys.exit(f"cut sequence has a gap: expected {expected}, found {path}")
        frame = Image.open(path).convert("RGB")
        if frame.size != EXPECTED_SIZE:
            sys.exit(f"{path} is {frame.size[0]}x{frame.size[1]}, expected {EXPECTED_SIZE[0]}x{EXPECTED_SIZE[1]}")
        pixels = np.asarray(frame, dtype=np.float64) * gain(i, len(cut))
        Image.fromarray(np.clip(np.rint(pixels), 0, 255).astype(np.uint8)).save(os.path.join(out_dir, f"c{i:03d}.png"))
    print(f"  {len(cut)} frames, {FADE_FRAMES}-frame fade to black at each end -> {out_dir}")


if __name__ == "__main__":
    main()
