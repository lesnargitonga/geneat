#!/usr/bin/env bash
set -euo pipefail
# Setup helper for local pgbouncer deployment (dev only).
OUT_DIR="deploy/pgbouncer"
mkdir -p "$OUT_DIR"
cat > "$OUT_DIR/userlist.txt" <<'EOF'
# userlist left intentionally empty when using auth_type = trust
EOF
echo "Wrote $OUT_DIR/userlist.txt"
