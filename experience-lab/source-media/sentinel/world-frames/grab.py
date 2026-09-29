#!/usr/bin/python3
"""Subscribe to gz camera topics and write PNG frames. Capture instrumentation
only: it observes published images and changes nothing in the simulation."""
import sys, time, threading
from gz.transport13 import Node
from gz.msgs10.image_pb2 import Image
from PIL import Image as PILImage

topics = sys.argv[1].split(',')
outdir  = sys.argv[2]
per     = int(sys.argv[3]) if len(sys.argv) > 3 else 1
settle  = float(sys.argv[4]) if len(sys.argv) > 4 else 2.0

FMT = {3: 'RGB', 2: 'L'}          # RGB_INT8 = 3, L_INT8 = 2
counts, lock, start = {t: 0 for t in topics}, threading.Lock(), time.time()

def make_cb(topic):
    name = topic.strip('/').replace('/', '-')
    def cb(msg: Image):
        if time.time() - start < settle:      # let exposure and scene settle
            return
        with lock:
            if counts[topic] >= per:
                return
            counts[topic] += 1
            n = counts[topic]
        mode = FMT.get(msg.pixel_format_type, 'RGB')
        img = PILImage.frombytes(mode, (msg.width, msg.height), bytes(msg.data))
        path = f"{outdir}/{name}-{n:02d}.png"
        img.save(path)
        print(f"  wrote {path}  {msg.width}x{msg.height}", flush=True)
    return cb

node = Node()
for t in topics:
    if not node.subscribe(Image, t, make_cb(t)):
        print(f"  FAILED to subscribe {t}", flush=True)

deadline = time.time() + 60
while time.time() < deadline:
    with lock:
        if all(counts[t] >= per for t in topics):
            break
    time.sleep(0.2)
print("  captured:", {k: v for k, v in counts.items()}, flush=True)
