"""Collapse each frame's camera sub-samples into one motion-blurred frame.

Samples are averaged in LINEAR light: averaging sRGB values darkens bright
edges as they smear, which is the tell of fake blur.

usage: python accumulate.py <raw_dir> <out_dir> <real-0321.png>
"""
import base64, glob, io, json, sys
import numpy as np
from PIL import Image

raw_dir, out_dir, real_path = sys.argv[1], sys.argv[2], sys.argv[3]


def to_linear(u8):
    c = u8.astype(np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(lin):
    c = np.clip(lin, 0, 1)
    s = np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)
    return np.clip(np.rint(s * 255), 0, 255).astype(np.uint8)


files = sorted(glob.glob(f"{raw_dir}/r*.json"))
if not files:
    raise SystemExit(f"no raw frames in {raw_dir}")
for f in files:
    shots = json.load(open(f))
    acc = sum(to_linear(np.asarray(Image.open(io.BytesIO(base64.b64decode(b))).convert("RGB"))) for b in shots)
    n = f.split("/")[-1][1:4]
    Image.fromarray(to_srgb(acc / len(shots))).save(f"{out_dir}/f{n}.png")
print(f"  accumulated {len(files)} frames x {len(shots)} samples")
real = np.asarray(Image.open(real_path).convert("RGB"), dtype=np.int16)
f0 = np.asarray(Image.open(f"{out_dir}/f000.png").convert("RGB"), dtype=np.int16)
print(f"  frame 0 vs real 0321: max diff {np.abs(f0 - real).max()}")
