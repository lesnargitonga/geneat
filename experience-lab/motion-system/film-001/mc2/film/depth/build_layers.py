"""Split the real 0321 Gazebo frame into the depth layers it is made of.

Rules, each learned from a visible defect:
  * a surface is its real connected polygon on its own tight colour, so blended
    edges from a neighbour (red+teal ~ grey) are not filed under it
  * the aircraft is every non-surface pixel in its region, not only its largest
    piece, so detached propeller tips travel with it
  * a layer owns its own pixels plus its blended anti-aliased fringe, and NEVER
    another surface's clean pixels - wall seen between landing-gear struts
    belongs to the wall, not the aircraft
  * a surface's own anti-aliased edge is not aircraft just because it crosses
    the aircraft's region rectangle
  * a surface is completed only behind objects that actually overlap it, from
    its own pixels only, never from zeroed or foreign neighbours
  * the stack recomposites to the source exactly; frame 0 is the source

usage: python build_layers.py <real-0321.png> <out_dir>
"""
import sys
import numpy as np
from PIL import Image
from collections import deque

SRC, OUT = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(SRC).convert("RGB"), dtype=np.int16)
H, W, _ = a.shape
R, G, B = a[..., 0], a[..., 1], a[..., 2]


def largest_cc(mask):
    lab = np.zeros(mask.shape, np.int32); cur = 0; best = (0, 0)
    for sy in range(0, H, 2):
        for sx in range(0, W, 2):
            if mask[sy, sx] and lab[sy, sx] == 0:
                cur += 1; n = 0; q = deque([(sy, sx)]); lab[sy, sx] = cur
                while q:
                    y, x = q.popleft(); n += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = cur; q.append((ny, nx))
                if n > best[1]: best = (cur, n)
    return lab == best[0]


def dilate(mask, r):
    out = mask.copy()
    for _ in range(r):
        o = out.copy(); o[1:] |= out[:-1]; o[:-1] |= out[1:]; o[:, 1:] |= out[:, :-1]; o[:, :-1] |= out[:, 1:]; out = o
    return out


def grow_fill(rgb, valid, hole):
    """Fill `hole` with the colour of the NEAREST valid pixel, by multi-source
    breadth-first propagation. Never averages: a flat-shaded wall behind an
    object is filled with that wall's own colour, not a blend of the wall and
    whatever else happened to border the hole."""
    img = rgb.astype(np.float32).copy(); v = valid.copy(); h = hole & ~valid
    q = deque()
    ys_, xs_ = np.nonzero(v & dilate(h, 1))
    q.extend(zip(ys_.tolist(), xs_.tolist()))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and h[ny, nx]:
                img[ny, nx] = img[y, x]; v[ny, nx] = True; h[ny, nx] = False; q.append((ny, nx))
    return img, v


def near(c, t): return (np.abs(R - c[0]) <= t) & (np.abs(G - c[1]) <= t) & (np.abs(B - c[2]) <= t)


# clean surface pixels: unambiguous membership of one flat surface
clean = near((231, 231, 243), 6) | near((0, 153, 153), 6) | near((0, 158, 158), 3) | near((0, 159, 159), 3) \
      | near((0, 160, 160), 3) | near((0, 161, 161), 3) | near((87, 87, 87), 6) | near((153, 0, 0), 12) | near((0, 0, 162), 12)
bg = (((R < 40) & (G > 120) & (G < 200) & (np.abs(G - B) < 12)) | ((R > 200) & (G > 200) & (B > 200))
      | near((87, 87, 87), 13) | ((R > 110) & (G < 60) & (B < 60)) | ((R < 40) & (G < 40) & (B > 120)))
# Surfaces first, by geometry: the slab is the one large grey polygon, not every
# grey pixel. Some of the aircraft's own parts (motor housings, hubs) render at
# almost exactly the slab's grey, so colour alone cannot separate them.
slab = largest_cc(near((87, 87, 87), 9))
spire = largest_cc((R > 110) & (G < 70) & (B < 70))
navy = largest_cc((R < 50) & (G < 50) & (B > 120))
core = largest_cc(~bg); ys, xs = np.nonzero(core); M = 44
region = np.zeros((H, W), bool); region[max(0, ys.min() - M):ys.max() + M, max(0, xs.min() - M):xs.max() + M] = True
teal_clean = near((0, 153, 153), 6) | near((0, 158, 158), 3) | near((0, 159, 159), 3) | near((0, 160, 160), 3) | near((0, 161, 161), 3)
sky_clean = near((231, 231, 243), 6)
# A surface's own anti-aliased edge is not aircraft just because it crosses the
# aircraft's region rectangle. The slab's top edge cuts through the rectangle's
# lower corner; filed as aircraft, those grey-teal blend pixels rode with the
# aircraft layer and floated off the slab as a teal hairline once parallax
# opened. This holds only while the aircraft keeps clear of the surface, so the
# clearance is checked, never assumed.
CLEAR = 6
rings = np.zeros((H, W), bool)
for name, s in (("slab", slab), ("spire", spire), ("navy", navy)):
    ring = dilate(s, 3) & ~s & ~teal_clean & ~sky_clean & region
    if not ring.any(): continue
    body = region & ~teal_clean & ~sky_clean & ~slab & ~spire & ~navy & ~ring
    if (dilate(s, CLEAR) & body).any():
        raise SystemExit(f"aircraft within {CLEAR}px of the {name}: its edge cannot be separated by geometry")
    rings |= ring
    print(f"  {name} edge inside the aircraft region: {int(ring.sum())} px, returned to the {name}")
# inside the aircraft's region, anything that is not a known surface or a
# surface's own edge IS aircraft
drone = region & ~teal_clean & ~sky_clean & ~slab & ~spire & ~navy & ~rings
band = ((np.abs(G - 160) <= 2) & (R < 20) & (np.abs(G - B) < 4)) & ~drone
# Every blended (non-clean) pixel is the anti-aliased edge OF something. Grow
# each object outward through blended pixels only; the first object to reach a
# pixel owns it.
cores = [("x500", drone), ("slab", slab), ("spire", spire), ("navy", navy), ("band", band)]
owner = np.full((H, W), -1, np.int32)
q = deque()
for i, (k, m) in enumerate(cores):
    ys_, xs_ = np.nonzero(m & (owner < 0))
    owner[ys_, xs_] = i
    q.extend(zip(ys_.tolist(), xs_.tolist()))
blended = ~clean
while q:
    y, x = q.popleft(); i = owner[y, x]
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and owner[ny, nx] < 0 and blended[ny, nx]:
            owner[ny, nx] = i; q.append((ny, nx))
own = {k: (owner == i) for i, (k, _) in enumerate(cores)}
taken = owner >= 0
plate, _ = grow_fill(a, ~taken, taken)


def complete(k, behind):
    yy, xx = np.nonzero(own[k])
    box = np.zeros((H, W), bool); box[yy.min():yy.max() + 1, xx.min():xx.max() + 1] = True
    occ = np.zeros((H, W), bool)
    for j in behind: occ |= own[j]
    return grow_fill(a, own[k], occ & box)


layers = {"x500": (a.astype(np.float32), own["x500"]),
          "spire": (a.astype(np.float32), own["spire"]),     # touches nothing: no completion
          "navy": (a.astype(np.float32), own["navy"]),
          "slab": complete("slab", ["x500"]),
          "band": complete("band", ["x500", "slab"])}
P = 0.30; py, px = int(H * P), int(W * P)


def write(rgb, alpha, name, edge=True):
    # Alpha bleed: transparent pixels take the colour of the layer's own nearest
    # opaque pixel, so bilinear filtering at an edge blends a surface only with itself.
    if not alpha.all():
        rgb, _ = grow_fill(rgb, alpha, ~alpha)
    img = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)])
    pad = np.pad(img, ((py, py), (px, px), (0, 0)), mode="edge" if edge else "constant")
    if edge:
        pa = np.pad(alpha, ((py, py), (px, px)), mode="edge"); pad[..., 3] = (pa * 255).astype(np.uint8)
    Image.fromarray(pad, "RGBA").save(f"{OUT}/{name}_pad.png")


write(plate, np.ones((H, W), bool), "L0_back")
write(*layers["band"], "L2_band"); write(*layers["navy"], "L3_navy")
write(*layers["spire"], "L4_spire"); write(*layers["slab"], "L5_slab")
write(*layers["x500"], "L6_x500", edge=False)
comp = np.clip(plate, 0, 255).copy()
for k in ["band", "navy", "spire", "slab", "x500"]:
    rgb, al = layers[k]; m = al[..., None].astype(np.float32); comp = comp * (1 - m) + rgb * m
print(f"  recomposite vs real 0321: max diff {np.abs(comp - a).max():.0f}")
xm = own["x500"]
print(f"  surface-edge pixels carried by the aircraft layer: {int((xm & rings).sum())}")
print(f"  aircraft layer {int(xm.sum())} px  ·  slab completed +{int(layers['slab'][1].sum() - own['slab'].sum())}  ·  band +{int(layers['band'][1].sum() - own['band'].sum())}")
