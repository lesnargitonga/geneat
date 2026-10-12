#!/usr/bin/env bash
# Final render of the true-3D shot: 156 frames, 1920x1080, 32 samples, 6 workers on interleaved chunks.
cd "$(dirname "$0")"
W=6; N=156; CH=6
for w in $(seq 0 $((W-1))); do
  ( for ((a=w*CH; a<N; a+=W*CH)); do
      b=$((a+CH-1)); (( b>=N )) && b=$((N-1))
      python3 shot.py "jobs/j_$a.json" 1920 32 $a $b >/dev/null
      timeout 3600 node render.mjs "jobs/j_$a.json" out_final "exposure=0.45" >> "logs/w$w.txt" 2>&1
    done ) &
done
wait
echo "done $(ls out_final | wc -l) frames"
