"""Export every visual in the sealed Run 2 world (world_used.sdf) to JSON for
the Three.js reconstruction: geometry, world pose, material colour. Read-only."""
import json, math, sys
import xml.etree.ElementTree as ET
import numpy as np

def rpy(r, p, y):
    cr, sr, cp, sp, cy, sy = math.cos(r), math.sin(r), math.cos(p), math.sin(p), math.cos(y), math.sin(y)
    # SDF: fixed-axis roll(X), pitch(Y), yaw(Z) -> R = Rz(y) Ry(p) Rx(r)
    return np.array([[cy*cp, cy*sp*sr - sy*cr, cy*sp*cr + sy*sr],
                     [sy*cp, sy*sp*sr + cy*cr, sy*sp*cr - cy*sr],
                     [-sp,   cp*sr,            cp*cr]])

def pose(el):
    t = (el.findtext("pose") or "0 0 0 0 0 0").split()
    v = [float(x) for x in t] + [0.0] * (6 - len(t))
    T = np.eye(4); T[:3, :3] = rpy(*v[3:6]); T[:3, 3] = v[:3]
    return T

def color(v):
    m = v.find("material")
    if m is None: return None
    d = m.findtext("diffuse") or m.findtext("ambient")
    return [float(x) for x in d.split()[:3]] if d else None

w = ET.parse("src/world_used.sdf").getroot().find("world")
out = []
for m in w.findall("model"):
    Tm = pose(m)
    for l in m.findall("link"):
        Tl = Tm @ pose(l)
        for v in l.findall("visual"):
            g = v.find("geometry")[0]
            Tv = Tl @ pose(v)
            item = {"model": m.get("name"), "type": g.tag, "color": color(v),
                    "matrix": Tv.T.flatten().tolist()}          # column-major, as THREE.Matrix4.fromArray wants
            if g.tag == "box": item["size"] = [float(x) for x in g.findtext("size").split()]
            elif g.tag == "cylinder": item["radius"] = float(g.findtext("radius")); item["length"] = float(g.findtext("length"))
            elif g.tag == "plane": item["size"] = [float(x) for x in (g.findtext("size") or "100 100").split()]
            out.append(item)
json.dump(out, open("world.json", "w"))
print(f"  exported {len(out)} visuals")

# what the real close-takeoff-land camera sees (centres inside a widened frustum)
cam = np.array([-4.0, -4.0, 1.0]); R = rpy(0, -0.5541, 0.7854)
fwd, left, up = R[:, 0], R[:, 1], R[:, 2]
hf = 0.577 / 2; vf = math.atan(math.tan(hf) * 1080 / 1920)
for it in out:
    M = np.array(it["matrix"]).reshape(4, 4).T; c = M[:3, 3] - cam
    z = c @ fwd
    if z <= 0: continue
    ax, ay = math.atan2(c @ left, z), math.atan2(c @ up, z)
    ext = max(it.get("size", [0, 0, 0])[:3] + [it.get("length", 0), it.get("radius", 0) * 2]) / 2
    marg = math.atan2(ext, z)
    if abs(ax) < hf + marg and abs(ay) < vf + marg and it["type"] != "plane":
        sz = it.get("size") or [it.get("radius"), it.get("length")]
        print(f"  in view: {it['model']:18s} {it['type']:8s} dist {z:6.1f} m  size {sz}  colour {it['color']}  centre {np.round(M[:3,3],2).tolist()}")
