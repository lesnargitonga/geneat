#!/usr/bin/env bash
# After new hazina-api is live, update the portal's backend URL.
# Usage: NEW_BACKEND=https://hazina-api-xyz.onrender.com ./scripts/render_update_portal_backend.sh

set -euo pipefail

if [ -z "${NEW_BACKEND:-}" ]; then
  echo "ERROR: Set NEW_BACKEND=https://your-new-url.onrender.com"
  exit 1
fi

REPO="/home/lesnar/Documents/ai model"
VERCEL_JSON="$REPO/hazina-portal/vercel.json"

# Replace backend URL in vercel.json (values passed via env, not spliced into source)
VERCEL_JSON="$VERCEL_JSON" NEW_BACKEND="$NEW_BACKEND" python3 - <<'EOF'
import os

path = os.environ['VERCEL_JSON']
with open(path) as f:
    content = f.read()

# Replace the hardcoded Render URL
updated = content.replace(
    'https://hazina-api.onrender.com',
    os.environ['NEW_BACKEND'],
)

with open(path, 'w') as f:
    f.write(updated)

print("Updated vercel.json")
EOF

cd "$REPO"
git add hazina-portal/vercel.json

echo ""
echo "About to commit and push the line below to origin/main (this redeploys production):"
git --no-pager diff --cached -- hazina-portal/vercel.json
echo ""
read -r -p "Push to origin/main now? [y/N] " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Aborted. Change is staged — review, then commit and push manually."
  exit 0
fi

git commit -m "ops: point hazina-portal to new backend ($NEW_BACKEND)"
git push origin hazina-showroom-quality-gate:main
echo "Pushed — Vercel will redeploy hazina-portal with new backend URL"
