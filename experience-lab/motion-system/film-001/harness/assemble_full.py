"""Film 001, complete cut.

  Shot 001            real 0321 + generated system-space, real x500 composited
  Shot 002            deterministic architecture, sealed telemetry
  Shot 003            real operator replay, cropped, film-layer disclosure
  Shot 004            camera withdraws while the explanation collapses
  ending              real 0321 -> real 0323 -> black

Shot 004 is not Shot 002 reversed. The event does not travel backwards and no
value counts down: the layers compress onto the world plane and the explanatory
detail leaves, because the representation is being withdrawn, not replayed.
The final beat is the literal source file, so nothing interpretive survives it.
"""
import glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SP  = "/tmp/claude-1000/-home-lesnar-Documents-ai-model/7722fc33-2819-4ccd-a3f9-f2e78a299164/scratchpad"
OUT = f"{SP}/assembly/full"
W, H = 1920, 1080
DISSOLVE = 7
CX0, CY0, CX1, CY1 = 878, 110, 1909, 690
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
f_lab, f_att = ImageFont.truetype(MONO, 25), ImageFont.truetype(MONO, 16)

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

def save(arr, n):
    Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8)).save(f"{OUT}/f{str(n).zfill(4)}.png")

n = 0; marks = {}
# ---- Shot 001 --------------------------------------------------------------
marks['s1'] = n
for f in sorted(glob.glob(f"{SP}/shot001/comp4/c*.png")):
    Image.open(f).convert("RGB").save(f"{OUT}/f{str(n).zfill(4)}.png"); n += 1
# ---- Shot 002, direct cut --------------------------------------------------
marks['s2'] = n
s2 = sorted(glob.glob(f"{SP}/shot002/graded/g*.png"))
for f in s2:
    Image.open(f).convert("RGB").save(f"{OUT}/f{str(n).zfill(4)}.png"); n += 1
last2 = np.asarray(Image.open(s2[-1]).convert("RGB"), dtype=np.float32)
# ---- Shot 003, real operator replay, 7-frame dissolve ----------------------
marks['s3'] = n
ops = sorted(glob.glob(f"{SP}/assembly/op/o*.png"))
for i, f in enumerate(ops):
    lab = min(1.0, max(0.0, (i - DISSOLVE - 4) / 14.0))
    o = operator(f, lab)
    if i < DISSOLVE:
        a = (i + 1) / (DISSOLVE + 1); o = last2 * (1 - a) + o * a
    save(o, n); n += 1
# ---- Shot 004a, the consequence holds --------------------------------------
marks['s4'] = n
conts = sorted(glob.glob(f"{SP}/assembly/opcont/o*.png"))
for f in conts:
    save(operator(f, 1.0), n); n += 1
lastop = operator(conts[-1], 1.0)
# ---- Shot 004b, the explanation collapses ----------------------------------
col = sorted(glob.glob(f"{SP}/shot004/frames/f*.png"))
real21 = np.asarray(Image.open(f"{SP}/shot004/real-0321.png").convert("RGB"), dtype=np.float32)
RESOLVED = 46                      # once reality is uncovered, use the literal source
for i, f in enumerate(col):
    if i >= len(col) - RESOLVED:
        c = real21.copy()           # reality fully restored, nothing interpretive left
    else:
        c = np.asarray(Image.open(f).convert("RGB"), dtype=np.float32)
        if i < DISSOLVE:            # labels leave with the surface they belong to
            a = (i + 1) / (DISSOLVE + 1)
            c = lastop * (1 - a) + c * a
    save(c, n); n += 1
# ---- ending: real 0321 -> real 0323 -> black -------------------------------
marks['end'] = n
real23 = np.asarray(Image.open(f"{SP}/shot004/real-0323.png").convert("RGB"), dtype=np.float32)
for _ in range(12): save(real21, n); n += 1      # 0321 holds
marks['f0323'] = n
for _ in range(24): save(real23, n); n += 1      # 0323, the final real descent frame
marks['black'] = n
for _ in range(16): save(np.zeros((H, W, 3), np.float32), n); n += 1

print(f"  Shot 001 {marks['s1']:4d}-{marks['s2']-1:4d}  {(marks['s2']-marks['s1'])/24:5.2f}s")
print(f"  Shot 002 {marks['s2']:4d}-{marks['s3']-1:4d}  {(marks['s3']-marks['s2'])/24:5.2f}s   direct cut")
print(f"  Shot 003 {marks['s3']:4d}-{marks['s4']-1:4d}  {(marks['s4']-marks['s3'])/24:5.2f}s   {DISSOLVE}-frame dissolve")
print(f"  Shot 004 {marks['s4']:4d}-{marks['end']-1:4d}  {(marks['end']-marks['s4'])/24:5.2f}s   {DISSOLVE}-frame dissolve into the collapse")
print(f"  0321 restored at frame {marks['end']-RESOLVED} (t={(marks['end']-RESOLVED)/24:.2f}s)")
print(f"  0323 at frame {marks['f0323']} (t={marks['f0323']/24:.2f}s), held {marks['black']-marks['f0323']} frames = {(marks['black']-marks['f0323'])/24:.2f}s")
print(f"  black at frame {marks['black']} (t={marks['black']/24:.2f}s), {n-marks['black']} frames")
print(f"  TOTAL {n} frames = {n/24:.2f}s")
