#!/usr/bin/env bash
# Labelled Sentinel VISUAL CAPTURE run. Not a sealed evidence run, and not
# px4_teacher_20260929_082014_d1.
#
# Flies the project's own tools/sentinel_run.sh with a derived world carrying
# six static observation cameras, through the supported LESNAR_GZ_WORLD_SDF
# hook. Canonical obstacles.sdf is never edited.
#
# Prerequisite, because the stack needs ports 5432 and 6379:
#   docker stop aimodel-postgres-1 aimodel-redis-1
# and afterwards, to put them back:
#   docker start aimodel-postgres-1 aimodel-redis-1
#
# Usage:  bash launch-visual-capture.sh
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
OUT="${SENTINEL_VISUAL_OUT:-$HOME/sentinel-visual-frames}"
mkdir -p "$OUT"

export GZ_IP=127.0.0.1
export LESNAR_GZ_WORLD_SDF="$HERE/world_visual.sdf"
export SENTINEL_GZ_HEADLESS_RENDERING=1

echo "world:  $LESNAR_GZ_WORLD_SDF"
echo "frames: $OUT"

bash "$HERE/sentinel_run.sh" &
RUN=$!

# Wait for the cameras to appear, then record sequences for the flight.
for i in $(seq 1 240); do
  if gz topic -l 2>/dev/null | grep -q '^/obs/'; then echo "cameras up after ${i}s"; break; fi
  sleep 1
done
GZ_IP=127.0.0.1 /usr/bin/python3 "$HERE/grab_seq.py" \
  "obs/takeoff,obs/close3q,obs/lateral,obs/wide,obs/elevated,obs/topdown" \
  "$OUT" "${SENTINEL_VISUAL_SECONDS:-240}"

wait $RUN
echo "run finished; frames in $OUT"
