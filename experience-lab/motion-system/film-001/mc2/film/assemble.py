"""Film 001, Master Candidate 2.

  true-3D         the sealed world and the real x500 asset, flown on the recorded
                  descent; recorded time stops at 0321 as the camera settles on the
                  real close-takeoff-land camera; dissolves into the real frame
  reality opens   the real 0321 frame separating into the surfaces it is made of
  Shot 002        deterministic architecture, sealed telemetry (MC1, from its frame 24)
  Shot 003        real operator replay, cropped, film-layer disclosure
  Shot 004        camera withdraws while the explanation collapses
  ending          real 0321 -> real 0323 -> black

Nothing generated appears anywhere in this cut.

usage: python assemble.py <film_dir> <x3d_frames_dir>
writes <film_dir>/full/f0000.png..., <film_dir>/edit.json
"""
import glob, json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FILM, X3D = sys.argv[1], sys.argv[2]
OUT = f"{FILM}/full"
W, H = 1920, 1080
X3D_LAST, X3D_DISSOLVE = 139, 16          # 3D frames used; the last 16 dissolve into the real frame
X3D_RAMP = (3.6, 5.0)                     # shot.py: recorded time decelerates, then stops at 0321
S2_TRIM = 24                              # Shot 002 held still for 27 frames; keep 3
S2_SEAM = 8                               # its vignette, border and label fade in over the seam
DISSOLVE = 14
CX0, CY0, CX1, CY1 = 878, 110, 1909, 690
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
f_lab, f_att = ImageFont.truetype(MONO, 25), ImageFont.truetype(MONO, 16)
os.makedirs(OUT, exist_ok=True)
for f in glob.glob(f"{OUT}/f*.png"): os.remove(f)

rgb = lambda p: np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)

def tracked(d, xy, text, font, fill, track=3):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill); x += d.textlength(ch, font=font) + track

def operator(path, label_alpha):
    a = Image.open(path).convert("RGB").crop((CX0, CY0, CX1, CY1)).resize((W, H), Image.LANCZOS)
    if label_alpha > 0:
        d = ImageDraw.Draw(a); v = int(216 * label_alpha)
        tracked(d, (96, H - 96), "RECORDED MISSION REPLAY  ·  PX4 SITL", f_lab, (v, v, int(v * 1.02)))
        t = "© OpenStreetMap contributors"; wpx = d.textlength(t, font=f_att)
        d.text((W - 96 - wpx, H - 88), t, font=f_att, fill=(int(130 * label_alpha),) * 3)
    return np.asarray(a, dtype=np.float32)

n = 0; starts = {}
def save(arr):
    global n
    Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8)).save(f"{OUT}/f{n:04d}.png"); n += 1

real21, real23 = rgb(f"{FILM}/real-0321.png"), rgb(f"{FILM}/real-0323.png")
# ---- true-3D: the reconstruction resolves into the real frame ---------------
starts["x3d"] = n
x3d = sorted(glob.glob(f"{X3D}/f*.png"))[:X3D_LAST + 1]
assert len(x3d) == X3D_LAST + 1, f"3D render incomplete: {len(x3d)} frames"
for i, f in enumerate(x3d):
    a = rgb(f)
    k = i - (len(x3d) - X3D_DISSOLVE)
    if k >= 0:
        w = (k + 1) / X3D_DISSOLVE; w = w * w * (3 - 2 * w)
        a = a * (1 - w) + real21 * w
    save(a)
assert np.array_equal(np.asarray(Image.open(f"{OUT}/f{n-1:04d}.png")), real21.astype(np.uint8)), "3D must end on the real frame"
# ---- reality opens: frame 0 is the real 0321 ------------------------------------
starts["ro"] = n
ro = sorted(glob.glob(f"{FILM}/ro/f*.png"))
for f in ro: save(rgb(f))
last_ro = rgb(ro[-1])
# ---- Shot 002, seam dissolve ----------------------------------------------------
starts["s2"] = n
s2 = sorted(glob.glob(f"{FILM}/shot002/graded/g*.png"))
for i, f in enumerate(s2):
    a = rgb(f)
    if i < S2_SEAM:
        w = (i + 1) / (S2_SEAM + 1); a = last_ro * (1 - w) + a * w
    save(a)
last2 = rgb(s2[-1])
# ---- Shot 003, real operator replay -------------------------------------------
starts["op"] = n
ops = sorted(glob.glob(f"{FILM}/op/o*.png"))
for i, f in enumerate(ops):
    lab = min(1.0, max(0.0, (i - DISSOLVE - 4) / 14.0))
    o = operator(f, lab)
    if i < DISSOLVE:
        a = (i + 1) / (DISSOLVE + 1); o = last2 * (1 - a) + o * a
    save(o)
# ---- Shot 004a, the consequence holds; 004b, the explanation collapses --------
starts["s4"] = n
conts = sorted(glob.glob(f"{FILM}/opcont/o*.png"))
for f in conts: save(operator(f, 1.0))
lastop = operator(conts[-1], 1.0)
col = sorted(glob.glob(f"{FILM}/shot004/frames/f*.png"))
RESOLVED = 46
for i, f in enumerate(col):
    if i == len(col) - RESOLVED: starts["real"] = n
    if i >= len(col) - RESOLVED:
        c = real21.copy()
    else:
        c = rgb(f)
        if i < DISSOLVE:
            a = (i + 1) / (DISSOLVE + 1); c = lastop * (1 - a) + c * a
    save(c)
# ---- ending ----------------------------------------------------------------------
starts["end"] = n
for _ in range(12): save(real21)
starts["f0323"] = n
for _ in range(24): save(real23)
starts["black"] = n
for _ in range(16): save(np.zeros((H, W, 3), np.float32))

edit = {"total": n, "fps": 24, "starts": starts, "x3d_ramp": list(X3D_RAMP), "s2_trim": S2_TRIM}
json.dump(edit, open(f"{FILM}/edit.json", "w"), indent=1)
order = ["x3d", "ro", "s2", "op", "s4", "end", "f0323", "black"]
for a, b in zip(order, order[1:] + [None]):
    e = starts[b] if b else n
    print(f"  {a:6s} f{starts[a]:04d}-f{e-1:04d}  {starts[a]/24:6.2f}s  {(e-starts[a])/24:5.2f}s")
print(f"  real 0321 restored at {starts['real']/24:.2f}s;  TOTAL {n} frames = {n/24:.2f}s")
