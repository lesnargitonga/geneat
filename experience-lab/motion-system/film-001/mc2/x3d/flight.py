"""The recorded flight, as the reconstruction uses it.

Aircraft state at any telemetry time tau, from the sealed Run 2 CSV, anchored so
that at the 0321 instant it equals the pose solved from the real frame (the
solve and telemetry agree to ~1 cm horizontally and 0.7 deg in yaw; the anchor
removes that residual so the reconstruction lands exactly on the real frame).
"""
import csv, json, math
import numpy as np

HERE = __file__.rsplit("/", 1)[0]
OMEGA = 769.5           # rad/s: hover rotor speed, sqrt(m g / 4 / motorConstant) for the x500 (2.064 kg, 8.54858e-6)
DIRS = [+1, +1, -1, -1]  # rotor_0..3: ccw, ccw, cw, cw (x500 model.sdf turningDirection)

rows = list(csv.DictReader(open(f"{HERE}/src/telemetry_live_0.csv")))
T0 = float(rows[0]["timestamp"]); LAT0 = float(rows[0]["lat"]); LON0 = float(rows[0]["lon"]); RE = 6378137.0
T = np.array([float(r["timestamp"]) - T0 for r in rows])
X = np.array([(float(r["lon"]) - LON0) * math.radians(1) * RE * math.cos(math.radians(LAT0)) for r in rows])
Y = np.array([(float(r["lat"]) - LAT0) * math.radians(1) * RE for r in rows])
Z = np.array([float(r["rel_alt"]) for r in rows])
YAW = np.radians(90.0 - np.array([float(r["yaw"]) for r in rows]))          # NED heading -> ENU yaw
ROLL = np.radians(np.array([float(r["roll_deg"]) for r in rows]))          # FRD -> FLU: roll keeps its sign
PITCH = -np.radians(np.array([float(r["pitch_deg"]) for r in rows]))       # FRD -> FLU: pitch flips

solved = json.load(open(f"{HERE}/pose_0321.json"))
SP, SPROP = solved["pose"], solved["prop"]                                # x, y, z, yaw_deg, pitch_deg, roll_deg
D = math.pi / 180
# tau_star: the telemetry time whose altitude matches the solved height (0.24 m landing-gear offset)
DESCENT = T >= 114.5                                                         # the landing descent: altitude falls monotonically
assert np.all(np.diff(Z[DESCENT]) < 0), "descent altitude must be monotonic to invert"
TAU_STAR = float(np.interp(SP[2] - 0.24, Z[DESCENT][::-1], T[DESCENT][::-1]))


def raw(tau):
    i = lambda a: float(np.interp(tau, T, a))
    return np.array([i(X), i(Y), i(Z) + 0.24]), (i(YAW), i(PITCH), i(ROLL))


P_STAR, A_STAR = raw(TAU_STAR)
OFF_P = np.array(SP[:3]) - P_STAR
OFF_A = (SP[3] * D - A_STAR[0], SP[4] * D - A_STAR[1], SP[5] * D - A_STAR[2])


def state(tau):
    p, (yw, pt, rl) = raw(tau)
    p = (p + OFF_P).tolist()
    rpy = [rl + OFF_A[2], pt + OFF_A[1], yw + OFF_A[0]]
    prop = [SPROP[k] + DIRS[k] * OMEGA * (tau - TAU_STAR) for k in range(4)]
    return {"pos": p, "rpy": rpy, "prop": prop}


if __name__ == "__main__":
    print(f"  tau* = {TAU_STAR:.3f} s (telemetry time of frame 0321); anchor offsets pos {np.round(OFF_P, 3).tolist()} m, "
          f"yaw {math.degrees(OFF_A[0]):+.2f} pitch {math.degrees(OFF_A[1]):+.2f} roll {math.degrees(OFF_A[2]):+.2f} deg")
    for tau in (TAU_STAR - 4.1, TAU_STAR - 2, TAU_STAR):
        s = state(tau); print(f"  tau {tau:7.3f}: pos {np.round(s['pos'], 3).tolist()}")
