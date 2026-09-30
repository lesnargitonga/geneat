#!/usr/bin/env python3
"""Import Run 2's sealed telemetry into a throwaway capture database.

Real samples only. Any dashboard field with no counterpart in the sealed CSV is
left NULL rather than invented.
"""
import csv, os, sys, hashlib
from datetime import datetime, timezone

csv_path, db_path, drone_id = sys.argv[1], sys.argv[2], sys.argv[3]
os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
os.environ["LESNAR_REQUIRE_AUTH"] = "0"
sys.path.insert(0, os.path.expanduser("~/workspace/LesnarAI/backend"))
os.chdir(os.path.expanduser("~/workspace/LesnarAI/backend"))

from app import app                              # noqa: E402
from db import db, TelemetrySample               # noqa: E402

rows = list(csv.DictReader(open(csv_path)))
sha = hashlib.sha256(open(csv_path, "rb").read()).hexdigest()
print(f"  source rows {len(rows)}  sha256 {sha[:16]}")

def f(v):
    try: return float(v)
    except (TypeError, ValueError): return None

with app.app_context():
    db.create_all()
    TelemetrySample.query.delete()               # throwaway db, capture only
    n = 0
    for r in rows:
        ts = f(r.get("timestamp"))
        when = datetime.fromtimestamp(ts, tz=timezone.utc).replace(tzinfo=None) if ts else None
        db.session.add(TelemetrySample(
            drone_id=drone_id,
            latitude=f(r.get("lat")),
            longitude=f(r.get("lon")),
            altitude=f(r.get("rel_alt")),
            heading=f(r.get("yaw")),                      # already degrees in this schema
            speed=f(r.get("ground_speed_mps")),
            battery=f(r.get("battery_remaining_pct")),    # real, from the run
            armed=None,                                   # not present in the sealed CSV
            mode=None,                                    # not present in the sealed CSV
            source_timestamp=when,
            created_at=when,                              # history orders on this
        ))
        n += 1
    db.session.commit()
    total = TelemetrySample.query.count()
    first = TelemetrySample.query.order_by(TelemetrySample.created_at.asc()).first()
    last = TelemetrySample.query.order_by(TelemetrySample.created_at.desc()).first()
    print(f"  imported {n}, table now {total}")
    print(f"  first {first.source_timestamp}  alt {first.altitude}  spd {first.speed}  batt {first.battery}")
    print(f"  last  {last.source_timestamp}  alt {last.altitude}  spd {last.speed}  batt {last.battery}")
