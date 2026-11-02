#!/usr/bin/env python3
"""Cut the frame-exact MediMatch road capture into the site's two pieces.

    python3 make_frames.py <raw_dir> <out_root>

raw_dir holds f0000.png.. from capture.mjs: 1600x900 CSS px at DPR 1.5 (2400x1350), 24 fps.
Writes:
  <out_root>/film/c000.png..   1280x720 case film: the national shot (globe, tap on Kenya,
                               routes on roads), then a crossfade into the Nairobi close-up,
                               cropped above the panel's survey strip (withdrawn from the site)
  <out_root>/loop/c000.png..   960x720 hero loop: a 4:3 window that sits right of the app's own
                               headline during the globe, then eases left as the map lands so the
                               whole of Kenya stays in frame; the tail crossfades into the head
Every output pixel is resampled (Lanczos) from a captured frame. Nothing is drawn or composited
except the crossfades and the touch ring the capture script records with the click.
"""
import sys
from pathlib import Path
from PIL import Image

raw, out = Path(sys.argv[1]), Path(sys.argv[2])
frame = lambda i: Image.open(raw / f"f{i:04d}.png").convert("RGB")

def blend_tail(seq, n):
    """Crossfade the last n frames of seq into its first n (for a seamless loop)."""
    head, tail = seq[:n], seq[-n:]
    body = seq[n:-n]
    fades = [Image.blend(t, h, (k + 1) / (n + 1)) for k, (t, h) in enumerate(zip(tail, head))]
    return body + fades

def write(seq, d):
    d.mkdir(parents=True, exist_ok=True)
    for k, im in enumerate(seq):
        im.save(d / f"c{k:03d}.png")
    print(d, len(seq), "frames")

# ── case film ──
A = list(range(10, 325))            # 0.42 s – 13.50 s: globe, tap, landing, routes, the tap on "Nairobi research base"
B = list(range(342, 468))           # 14.25 s – 19.46 s: Nairobi close-up, settled
NAI = (390, 290, 2008, 1200)        # stats, road map and steps; stops above the survey strip
XF = 8
film = [frame(i).resize((1280, 720), Image.LANCZOS) for i in A]
nai = [frame(i).crop(NAI).resize((1280, 720), Image.LANCZOS) for i in B]
for k in range(XF):
    film[-XF + k] = Image.blend(film[-XF + k], nai[k], (k + 1) / (XF + 1))
film += nai[XF:]
write(film, out / "film")
if "--film-only" in sys.argv: sys.exit()

# ── hero loop ──
L = list(range(10, 313))            # globe through the routes, 12.6 s
W, H = 1340, 1005
def x0(i):
    a, b = 148, 172                 # the map lands between these frames
    t = 0 if i <= a else 1 if i >= b else (i - a) / (b - a)
    t = t * t * (3 - 2 * t)         # smoothstep
    return round(1060 + (700 - 1060) * t)
loop = [frame(i).crop((x0(i), 150, x0(i) + W, 150 + H)).resize((960, 720), Image.LANCZOS) for i in L]
write(blend_tail(loop, 12), out / "loop")
