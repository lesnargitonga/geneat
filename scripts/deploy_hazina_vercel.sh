#!/usr/bin/env bash
set -euo pipefail

# Non-interactive deploy helper for hazina-portal using Vercel CLI.
# Usage:
#   VERCEL_TOKEN=xxxxx ./scripts/deploy_hazina_vercel.sh [--add-domain] KEY=VALUE ...
# Examples:
#   VERCEL_TOKEN=xxx ./scripts/deploy_hazina_vercel.sh BACKEND_URL=https://api.lesnarai.co.ke NEXT_PUBLIC_BACKEND_URL=https://api.lesnarai.co.ke --add-domain

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "ERROR: VERCEL_TOKEN environment variable is required. Create a Vercel Personal Token and export it as VERCEL_TOKEN."
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/hazina-portal"

ADD_DOMAIN=false
ENV_PAIRS=()
for arg in "$@"; do
  if [ "$arg" = "--add-domain" ]; then
    ADD_DOMAIN=true
    continue
  fi
  if [[ "$arg" == *=* ]]; then
    ENV_PAIRS+=("$arg")
  fi
done

echo "Deploying hazina-portal to Vercel (non-interactive)..."

# Perform a production deploy. This will create a project if one doesn't exist.
echo "Running: npx vercel --prod --confirm"
npx vercel --token "$VERCEL_TOKEN" --prod --confirm || {
  echo "Vercel deploy failed; check output above." >&2
  exit 2
}

if [ ${#ENV_PAIRS[@]} -gt 0 ]; then
  echo "Adding environment variables to Vercel project (production scope)."
  for kv in "${ENV_PAIRS[@]}"; do
    key="${kv%%=*}"
    val="${kv#*=}"
    echo "Adding env var: $key"
    # Try to supply the value via stdin to the interactive prompt.
    printf '%s\n' "$val" | npx vercel env add "$key" production --token "$VERCEL_TOKEN" --yes || {
      echo "Failed to add $key via Vercel CLI. You can add it manually in the Vercel dashboard." >&2
    }
  done
fi

if [ "$ADD_DOMAIN" = true ]; then
  echo "Attempting to add domain hazina.lesnarai.co.ke to the Vercel project."
  npx vercel domains add hazina.lesnarai.co.ke --token "$VERCEL_TOKEN" --confirm || {
    echo "Could not add domain automatically. Please add domain in the Vercel dashboard and follow the DNS instructions." >&2
  }
  echo "If the domain was added, Vercel will show DNS records you must add at your DNS provider (CNAME/A)."
fi

echo "Done. Visit the Vercel dashboard to verify the project, environment variables, and domain status. If you requested domain add, follow the DNS instructions Vercel provides." 
