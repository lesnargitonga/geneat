"""Shot generator for the true-3D Sentinel x500 shot.

Shot time t (24 fps) -> recorded flight time tau(t): real time until T1, then a
smooth deceleration to a stop at the 0321 instant (tau*) at T2. The camera arcs
from a close backlit three-quarter view onto the exact pose of the real
close-takeoff-land observation camera, arriving at TC and holding. Every frame is
the average of S samples spread across a 180-degree shutter and a lens aperture.

usage: python shot.py <jobs.json> <width> <samples> [first_frame] [last_frame]
"""
import json, math, sys
import numpy as np
import flight

FPS, DUR = 24, 6.5
T1, T2 = 3.6, 5.0                     # real time until T1; time stops at T2 (frame 0321)
TC = 5.6                              # camera arrives on the real camera pose; holds after
REAL_CAM = {"pos": [-4.0, -4.0, 1.0], "rpy": [0.0, -0.5541, 0.7854], "hfov": 0.577}   # world_used.sdf obs_close_takeoff_land
HFOV = 0.577                          # the real camera's lens, held for the whole move
F_NUMBER = 4.0                        # aperture for depth of field; focal length equivalent to hfov on 36 mm
FOCAL = 0.018 / math.tan(HFOV / 2)    # metres, full-frame equivalent
APERTURE_R = FOCAL / F_NUMBER / 2

def smoother(u):
    u = min(1.0, max(0.0, u)); return u * u * u * (u * (u * 6 - 15) + 10)

_us = np.linspace(0, 1, 2001); _cum = np.concatenate([[0], np.cumsum((1 - np.array([smoother(u) for u in _us]))[1:] * np.diff(_us))])
RAMP = (T2 - T1) * _cum[-1]           # flight time that passes during the deceleration

def tau(t):
    if t <= T1: return flight.TAU_STAR - RAMP - (T1 - t)
    if t >= T2: return flight.TAU_STAR
    u = (t - T1) / (T2 - T1); return flight.TAU_STAR - RAMP + (T2 - T1) * float(np.interp(u, _us, _cum))

def rot(rpy):
    r, p, y = rpy; cr, sr, cp, sp, cy, sy = math.cos(r), math.sin(r), math.cos(p), math.sin(p), math.cos(y), math.sin(y)
    return np.array([[cy*cp, cy*sp*sr - sy*cr, cy*sp*cr + sy*sr], [sy*cp, sy*sp*sr + cy*cr, sy*sp*cr - cy*sr], [-sp, cp*sr, cp*cr]])

C_STAR = np.array(flight.state(flight.TAU_STAR)["pos"])
END_REL = np.array(REAL_CAM["pos"]) - C_STAR
END_R = float(np.linalg.norm(END_REL)); END_AZ = math.atan2(END_REL[1], END_REL[0]); END_EL = math.asin(END_REL[2] / END_R)
END_LOOK = np.array(REAL_CAM["pos"]) + rot(REAL_CAM["rpy"]) @ np.array([1.0, 0, 0]) * 6.0   # a point on the real optical axis
START = dict(r=2.6, az=END_AZ - math.radians(90), el=math.radians(-12), roll=math.radians(3.0))

def _aim(pos, target):
    d = np.asarray(target) - np.asarray(pos)
    return math.atan2(d[1], d[0]), math.atan2(d[2], math.hypot(d[0], d[1]))          # yaw, pitch-up

# The real camera's framing of the aircraft, as angles from the line of sight to it.
_END_YAW, _END_PITCH = REAL_CAM["rpy"][2], -REAL_CAM["rpy"][1]
_aim_y, _aim_p = _aim(REAL_CAM["pos"], C_STAR)
D_YAW, D_PITCH = _END_YAW - _aim_y, _END_PITCH - _aim_p

def camera(t):
    """Camera pose in Gazebo convention (x forward, z up; pitch positive looks down)."""
    s = smoother(t / TC)
    c = np.array(flight.state(tau(t))["pos"])
    r = START["r"] + (END_R - START["r"]) * s
    az = START["az"] + (END_AZ - START["az"]) * s
    el = START["el"] + (END_EL - START["el"]) * s
    pos = c + r * np.array([math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)])
    # aim at the aircraft, then ease its framing from centre to exactly where the real
    # camera holds it: no detour, and at s = 1 this is the real camera's rpy
    ay, ap = _aim(pos, c)
    yaw, pitch_up = ay + D_YAW * s, ap + D_PITCH * s
    return {"pos": pos.tolist(), "rpy": [START["roll"] * (1 - s), -pitch_up, yaw], "hfov": HFOV,
            "focus": float(np.linalg.norm(c - pos))}

def rate(t):
    """d tau / d t: how fast recorded time runs in shot time."""
    if t <= T1: return 1.0
    if t >= T2: return 0.0
    return 1.0 - smoother((t - T1) / (T2 - T1))

def disc_weight(t):
    """How completely a rotor sweeps its disc during one exposure (180-degree shutter):
    0 below a quarter turn (sampled blades resolve it), 1 beyond a full turn."""
    sweep = flight.OMEGA * rate(t) * (0.5 / FPS)
    u = min(1.0, max(0.0, (sweep - math.pi / 2) / (2 * math.pi - math.pi / 2)))
    return u * u * (3 - 2 * u)

def samples(n, S):
    out = []
    for k in range(S):
        dt = ((k + 0.5) / S - 0.5) * 0.5 / FPS              # 180-degree shutter, stratified
        t = n / FPS + dt
        cam = camera(t)
        g = (k + 0.5) / S; ang = k * 2.39996323             # golden-angle disc: even aperture coverage
        cam["aperture"] = [APERTURE_R * math.sqrt(g) * math.cos(ang), APERTURE_R * math.sqrt(g) * math.sin(ang)] if S > 1 else [0, 0]
        out.append({"camera": cam, "aircraft": {**flight.state(tau(t)), "disc": disc_weight(n / FPS)}})
    return out

if __name__ == "__main__":
    path, W, S = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    N = round(DUR * FPS); a = int(sys.argv[4]) if len(sys.argv) > 4 else 0; b = int(sys.argv[5]) if len(sys.argv) > 5 else N - 1
    jobs = [{"name": f"f{n:03d}", "states": samples(n, S)} for n in range(a, b + 1)]
    json.dump(jobs, open(path, "w"))
    end = camera(DUR)
    print(f"  {len(jobs)} frames x {S} samples; flight {tau(0):.3f}..{flight.TAU_STAR:.3f} s (ramp {RAMP:.2f} s); "
          f"aperture radius {APERTURE_R*1000:.1f} mm (f/{F_NUMBER:g}); end camera {np.round(end['pos'], 4).tolist()}")
