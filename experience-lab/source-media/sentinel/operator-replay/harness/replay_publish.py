#!/usr/bin/env python
"""Replay Run 2's sealed telemetry onto the channel the real flight used.

During the actual flight the Sentinel agent published telemetry to the Redis
'telemetry' channel; backend/app.py's redis_bridge_loop ingested it and
registered the aircraft as an EXTERNAL drone (start_simulation=False, then an
explicit stop_simulation()), so the product never generates its own values for
an external asset. This republishes the sealed CSV onto that same channel at
the cadence the original timestamps describe. Every packet is a real Run 2
sample. Nothing is interpolated and nothing is filled in.

The sealed CSV contains no 'armed', 'mode' or 'in_air' column, so:

  * 'mode' is published as the empty string. Omitting it entirely leaves the
    fleet object's constructor default in place, and the operator UI renders
    that default as legible text ("STABILIZE") in the asset popup — a value
    with no source in Run 2. Empty renders the row as unavailable instead.
  * 'in_air' is omitted so the product derives is_flying from the real altitude
    using its own FLYING_ALTITUDE_THRESHOLD.
  * 'armed' is omitted. The bridge coerces it with bool(), so this interface has
    no way to express "unavailable"; it therefore reads False, the product
    default. That is recorded as a known gap, not presented as Run 2 data. The
    operator status badge does not depend on it here — it resolves to AIRBORNE
    from the real altitude.

flight_phase DOES exist in the CSV but is deliberately NOT mapped onto 'armed'.
Phase 0 is 84 grounded samples and phase 1 is the 524-sample flight, so the
mapping would be plausible — and it would still be inference, not source.
"""
import argparse, csv, json, math, os, pathlib, sys, time
import redis

RP = pathlib.Path(__file__).resolve().parent
DRONE_ID = "x500_0"
CHANNEL = "telemetry"

ap = argparse.ArgumentParser()
ap.add_argument("--csv", default=str(RP / "telemetry_live_0.csv"))
ap.add_argument("--port", type=int, default=6399)
ap.add_argument("--speed", type=float, default=1.0, help="cadence multiplier")
ap.add_argument("--loop", action="store_true", help="repeat the sealed run")
ap.add_argument("--status", default=str(RP / "replay_status.json"))
a = ap.parse_args()

def f(v):
    try:
        x = float(v)
        return x if math.isfinite(x) else None
    except (TypeError, ValueError):
        return None

rows = list(csv.DictReader(open(a.csv)))
t0, tN = f(rows[0]["timestamp"]), f(rows[-1]["timestamp"])
print(f"sealed samples {len(rows)}  span {tN - t0:.2f}s  channel '{CHANNEL}' port {a.port}", flush=True)

r = redis.Redis(host="127.0.0.1", port=a.port, db=0)
r.ping()

def publish_pass(pass_no):
    wall0 = time.monotonic()
    for i, row in enumerate(rows):
        due = (f(row["timestamp"]) - t0) / max(0.01, a.speed)
        lag = due - (time.monotonic() - wall0)
        if lag > 0:
            time.sleep(lag)
        pkt = {
            "drone_id":  DRONE_ID,
            "latitude":  f(row["lat"]),
            "longitude": f(row["lon"]),
            "altitude":  f(row["rel_alt"]),
            "heading":   f(row["yaw"]),
            "speed":     f(row["ground_speed_mps"]),
            "battery":   f(row["battery_remaining_pct"]),
            # not in the sealed CSV -> published empty so the UI shows it
            # unavailable rather than the product's "STABILIZE" default
            "mode":      "",
        }
        r.publish(CHANNEL, json.dumps(pkt))
        if i % 24 == 0 or i == len(rows) - 1:
            tmp = a.status + ".tmp"
            with open(tmp, "w") as fh:
                json.dump({"pass": pass_no, "index": i, "total": len(rows),
                           "mission_elapsed_s": round(f(row["timestamp"]) - t0, 2),
                           "altitude": pkt["altitude"], "speed": pkt["speed"],
                           "battery": pkt["battery"], "heading": pkt["heading"],
                           "phase": row["flight_phase"]}, fh)
            os.replace(tmp, a.status)
            print(f"  pass {pass_no} [{i+1}/{len(rows)}] t={f(row['timestamp'])-t0:6.1f}s "
                  f"alt={pkt['altitude']:6.3f} spd={pkt['speed']:5.2f} batt={pkt['battery']:5.1f}",
                  flush=True)

n = 0
while True:
    n += 1
    publish_pass(n)
    if not a.loop:
        break
print("replay finished", flush=True)
