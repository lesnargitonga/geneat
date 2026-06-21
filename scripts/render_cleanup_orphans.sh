#!/usr/bin/env bash
# Delete orphaned geneat-1, geneat-2, and hazina-portal services from Render.
# These were superseded by hazina-api (backend) and Vercel (portals).
#
# Usage:
#   RENDER_API_KEY=rnd_xxxx ./scripts/render_cleanup_orphans.sh
#
# Get your key: https://dashboard.render.com/u/settings → API Keys → Create API Key

set -euo pipefail

if [ -z "${RENDER_API_KEY:-}" ]; then
  echo "ERROR: Set RENDER_API_KEY. Get it from https://dashboard.render.com/u/settings"
  exit 1
fi

RENDER_API="https://api.render.com/v1"
HEADERS=(-H "Authorization: Bearer $RENDER_API_KEY" -H "Accept: application/json")

echo "Fetching all services..."
SERVICES=$(curl -fsSL "${HEADERS[@]}" "$RENDER_API/services?limit=50")

# Parse service IDs for the three orphaned services
TARGETS=("geneat-1" "geneat-2" "hazina-portal")

for name in "${TARGETS[@]}"; do
  # Use python for reliable JSON parsing (python is always available here)
  SVC_ID=$(echo "$SERVICES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data:
    svc = item.get('service', item)
    if svc.get('name') == '$name':
        print(svc.get('id', ''))
        break
" 2>/dev/null || echo "")

  if [ -z "$SVC_ID" ]; then
    echo "  ⚠  '$name' not found (already deleted or name mismatch) — skipping"
    continue
  fi

  echo "  🗑  Deleting '$name' (id=$SVC_ID)..."
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    "${HEADERS[@]}" "$RENDER_API/services/$SVC_ID")

  if [ "$HTTP_STATUS" = "204" ] || [ "$HTTP_STATUS" = "200" ]; then
    echo "  ✅  '$name' deleted"
  else
    echo "  ❌  '$name' delete returned HTTP $HTTP_STATUS — check manually"
  fi
done

echo ""
echo "Done. Remaining active services:"
echo "$SERVICES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data:
    svc = item.get('service', item)
    print(f\"  - {svc.get('name')} ({svc.get('type')}) — {svc.get('status')}\")
" 2>/dev/null || echo "  (could not parse service list)"
