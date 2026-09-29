#!/usr/bin/python3
"""Capture PNG frame sequences from gz camera topics for a fixed duration.
Observation only: subscribes to published images, changes nothing."""
import sys, time, threading, json
from gz.transport13 import Node
from gz.msgs10.image_pb2 import Image
from PIL import Image as PILImage

topics  = sys.argv[1].split(',')
outdir  = sys.argv[2]
seconds = float(sys.argv[3])
FMT = {3: 'RGB', 2: 'L'}
counts, lock = {t: 0 for t in topics}, threading.Lock()
t0 = time.time()
log = []

def make_cb(topic):
    name = topic.strip('/').replace('/', '-')
    def cb(msg: Image):
        with lock:
            counts[topic] += 1
            n = counts[topic]
        try:
            mode = FMT.get(msg.pixel_format_type, 'RGB')
            img = PILImage.frombytes(mode, (msg.width, msg.height), bytes(msg.data))
            path = f"{outdir}/{name}-{n:04d}.png"
            img.save(path)
            log.append({"topic": topic, "seq": n, "t_rel": round(time.time()-t0, 2)})
        except Exception as e:
            print(f"  {topic} frame {n} failed: {e}", flush=True)
    return cb

node = Node()
for t in topics:
    ok = node.subscribe(Image, t, make_cb(t))
    print(f"  subscribe {t}: {'ok' if ok else 'FAILED'}", flush=True)

end = t0 + seconds
last = 0
while time.time() < end:
    time.sleep(1.0)
    el = int(time.time() - t0)
    if el != last and el % 15 == 0:
        print(f"  t+{el}s frames: {dict(counts)}", flush=True)
        last = el
print(f"  done. totals: {dict(counts)}", flush=True)
json.dump(log, open(f"{outdir}/frame_log.json", "w"))
