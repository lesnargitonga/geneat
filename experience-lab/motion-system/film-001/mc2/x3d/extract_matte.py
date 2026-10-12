"""Extract the aircraft's silhouette from a real close-takeoff-land frame.

The world in these frames is flat-shaded surfaces (teal faces, sky, the grey wall,
the red spire, the navy block). The aircraft is everything non-surface in the
region around its largest connected piece, plus its grey motor parts that are not
connected to the wall; the wall's own anti-aliased edge ring is excluded (the
aircraft keeps more than 12 px clear of it in 0321 and 0323, checked).

usage: python extract_matte.py <frame.png> <out_1920.png> <out_960.png>
"""
import sys
from collections import deque
import numpy as np
from PIL import Image

src, out_full, out_half = sys.argv[1:4]
a = np.asarray(Image.open(src).convert("RGB"), dtype=np.int16); H, W, _ = a.shape
R, G, B = a[..., 0], a[..., 1], a[..., 2]
grey14 = (np.abs(R - 87) < 14) & (np.abs(G - 87) < 14) & (np.abs(B - 87) < 14)
bg = (((R < 40) & (G > 120) & (G < 200) & (np.abs(G - B) < 12)) | ((R > 200) & (G > 200) & (B > 200))
      | grey14 | ((R > 110) & (G < 60) & (B < 60)) | ((R < 40) & (G < 40) & (B > 120)))
fg = ~bg

lab = np.zeros((H, W), np.int32); cur = 0; best = (0, 0)
for sy in range(0, H, 2):
    for sx in range(0, W, 2):
        if fg[sy, sx] and lab[sy, sx] == 0:
            cur += 1; n = 0; q = deque([(sy, sx)]); lab[sy, sx] = cur
            while q:
                y, x = q.popleft(); n += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and fg[ny, nx] and lab[ny, nx] == 0:
                        lab[ny, nx] = cur; q.append((ny, nx))
            if n > best[1]: best = (cur, n)
core = lab == best[0]; ys, xs = np.nonzero(core); M = 44
region = np.zeros((H, W), bool); region[max(0, ys.min() - M):ys.max() + M, max(0, xs.min() - M):xs.max() + M] = True

# the wall: grey connected to the frame's bottom edge
grey10 = (np.abs(R - 87) < 10) & (np.abs(G - 87) < 10) & (np.abs(B - 87) < 10)
wall = np.zeros((H, W), bool); q = deque([(H - 1, x) for x in range(W) if grey10[H - 1, x]])
for y, x in q: wall[y, x] = True
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and grey10[ny, nx] and not wall[ny, nx]: wall[ny, nx] = True; q.append((ny, nx))


def dilate(m, r):
    for _ in range(r):
        o = m.copy(); o[1:] |= m[:-1]; o[:-1] |= m[1:]; o[:, 1:] |= m[:, :-1]; o[:, :-1] |= m[:, 1:]; m = o
    return m


ring = dilate(wall, 4)
mask = region & (fg | (grey14 & ~wall)) & ~ring
if (mask & dilate(wall, 12) & ~ring).any():
    raise SystemExit("aircraft within 12 px of the wall: the edge ring would cut it")
ys, xs = np.nonzero(mask)
print(f"  matte {mask.sum()} px, bbox x {xs.min()}..{xs.max()} y {ys.min()}..{ys.max()}, centroid ({xs.mean():.1f},{ys.mean():.1f})")
Image.fromarray((mask * 255).astype(np.uint8)).save(out_full)
Image.fromarray((mask * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.BOX).save(out_half)
