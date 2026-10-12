#!/usr/bin/env bash
# Pull the sealed Run 2 world and telemetry from the evidence branch into src/,
# refusing to continue if either differs from the sealed hash.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd); repo=${LESNARAI_REPO:-$HOME/workspace/LesnarAI}
B="evidence/sitl-run-px4_teacher_20260930_074210_d1:evidence/runs/px4_teacher_20260930_074210_d1"
mkdir -p "$here/src"
git -C "$repo" show "$B/world_used.sdf" > "$here/src/world_used.sdf"
git -C "$repo" show "$B/telemetry_live_0.csv" > "$here/src/telemetry_live_0.csv"
check() { [[ $(sha256sum "$1" | cut -c1-64) == "$2" ]] || { echo "hash mismatch: $1" >&2; exit 1; }; }
check "$here/src/world_used.sdf" b7a272e47e5a43cb7ebd78e513d855bb2a2fc56df50fc84c64e3f3ae7b060b07
check "$here/src/telemetry_live_0.csv" 4d685cf14bde60f8d8dee74f6aae78a31a0ab9d03f2fd5898b56841343534af1
echo "  sealed world and telemetry in src/, hashes verified"
