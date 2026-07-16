#!/usr/bin/env bash
# Deploy hazina-api to a NEW Render account.
#
# Prerequisites:
#   1. Sign up at https://render.com (use a different email or Google account)
#   2. Go to Account → API Keys → Create API Key
#   3. Connect GitHub: Account Settings → Git → Connect GitHub → lesnargitonga/geneat
#   4. Run this script:
#        NEW_RENDER_KEY=rnd_xxxx ./scripts/render_new_account_deploy.sh

set -euo pipefail

if [ -z "${NEW_RENDER_KEY:-}" ]; then
  echo "ERROR: Set NEW_RENDER_KEY=rnd_xxxx (API key from new Render account)"
  exit 1
fi

OLD_KEY="${RENDER_API_KEY:?Set RENDER_API_KEY=rnd_xxxx (API key from the SOURCE Render account to copy env vars from)}"
SOURCE_SERVICE_ID="${SOURCE_SERVICE_ID:-srv-d8er5lc2m8qs7398brj0}"
API="https://api.render.com/v1"
NEW_HDR=(-H "Authorization: Bearer $NEW_RENDER_KEY" -H "Content-Type: application/json" -H "Accept: application/json")
OLD_HDR=(-H "Authorization: Bearer $OLD_KEY" -H "Accept: application/json")

echo "=== Step 1: Verify new account ==="
OWNER_ID=$(curl -fsSL "${NEW_HDR[@]}" "$API/owners?limit=1" | python3 -c "
import sys,json; data=json.load(sys.stdin)
print(data[0].get('owner',data[0]).get('id',''))
")
echo "Owner ID: $OWNER_ID"
if [ -z "$OWNER_ID" ]; then
  echo "ERROR: Could not get owner from new account. Check NEW_RENDER_KEY."
  exit 1
fi

echo ""
echo "=== Step 2: Fetch all env vars from old hazina-api ==="
OLD_ENV=$(curl -fsSL "${OLD_HDR[@]}" "$API/services/$SOURCE_SERVICE_ID/env-vars?limit=100")
echo "Fetched $(echo "$OLD_ENV" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))") env vars"

echo ""
echo "=== Step 3: Create hazina-api service on new account ==="
CREATE_PAYLOAD=$(OWNER_ID="$OWNER_ID" python3 -c "
import json, os
payload = {
  'type': 'web_service',
  'name': 'hazina-api',
  'ownerId': os.environ['OWNER_ID'],
  'repo': 'https://github.com/lesnargitonga/geneat',
  'autoDeploy': 'yes',
  'autoDeployTrigger': 'commit',
  'branch': 'main',
  'rootDir': '',
  'serviceDetails': {
    'env': 'docker',
    'dockerfilePath': './Dockerfile',
    'dockerContext': '.',
    'plan': 'starter',
    'region': 'frankfurt',
    'healthCheckPath': '/readyz',
    'preDeployCommand': 'alembic upgrade head',
    'numInstances': 1,
  }
}
print(json.dumps(payload))
")

SVC_RESPONSE=$(curl -fsSL -X POST "${NEW_HDR[@]}" -d "$CREATE_PAYLOAD" "$API/services")
NEW_SVC_ID=$(echo "$SVC_RESPONSE" | python3 -c "
import sys,json
data=json.load(sys.stdin)
svc=data.get('service',data)
print(svc.get('id',''))
")
NEW_SVC_URL=$(echo "$SVC_RESPONSE" | python3 -c "
import sys,json
data=json.load(sys.stdin)
svc=data.get('service',data)
print(svc.get('serviceDetails',{}).get('url','') or svc.get('url',''))
")

if [ -z "$NEW_SVC_ID" ]; then
  echo "ERROR: Service creation failed:"
  echo "$SVC_RESPONSE"
  exit 1
fi
echo "Created service: $NEW_SVC_ID"
echo "URL will be: $NEW_SVC_URL"

echo ""
echo "=== Step 4: Copy all env vars to new service ==="
# Build env var array from old service
ENV_PAYLOAD=$(echo "$OLD_ENV" | python3 -c "
import sys,json
data=json.load(sys.stdin)
pairs = []
for item in data:
    ev = item.get('envVar', item)
    k = ev.get('key','')
    v = ev.get('value','') or ''
    if k:
        pairs.append({'key': k, 'value': v})
print(json.dumps(pairs))
")

RESULT=$(curl -fsSL -X PUT "${NEW_HDR[@]}" \
  -d "$ENV_PAYLOAD" \
  "$API/services/$NEW_SVC_ID/env-vars")
echo "Env vars set: $(echo "$RESULT" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo '?')"

echo ""
echo "=== Step 5: Trigger first deploy ==="
DEPLOY=$(curl -fsSL -X POST "${NEW_HDR[@]}" \
  -d '{"clearCache":"clear"}' \
  "$API/services/$NEW_SVC_ID/deploys")
DEPLOY_ID=$(echo "$DEPLOY" | python3 -c "
import sys,json; d=json.load(sys.stdin); d=d.get('deploy',d); print(d.get('id',''))")
echo "Deploy triggered: $DEPLOY_ID"

# The actual URL comes from the dashboard; Render auto-generates it as hazina-api.onrender.com
# if the name is unique, or hazina-api-1.onrender.com etc.
echo ""
echo "=== Done ==="
echo ""
echo "New service ID : $NEW_SVC_ID"
echo ""
echo "NEXT STEPS (takes ~8 min for Docker build):"
echo ""
echo "1. Go to https://dashboard.render.com and watch the build"
echo "2. Once live, get the actual URL from the dashboard (Settings → URL)"
echo "3. Run: NEW_BACKEND=https://<new-url>.onrender.com ./scripts/render_update_portal_backend.sh"
echo ""
echo "Or update hazina-portal manually:"
echo "  BACKEND_URL in hazina-portal/vercel.json → replace https://hazina-api.onrender.com"
echo "  Then: git add hazina-portal/vercel.json && git commit -m 'ops: point portal to new backend' && git push"
