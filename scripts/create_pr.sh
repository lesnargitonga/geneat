#!/usr/bin/env bash
set -euo pipefail

# create_pr.sh - create a GitHub PR for the current branch.
# Usage: ./scripts/create_pr.sh [--draft] [--title "Title"] [--body-file path] [--base main] [--head branch]

draft=false
title=""
body_file=""
base="main"
head=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --draft) draft=true; shift ;;
    --title) title="$2"; shift 2 ;;
    --body-file) body_file="$2"; shift 2 ;;
    --base) base="$2"; shift 2 ;;
    --head) head="$2"; shift 2 ;;
    -h|--help) echo "Usage: $0 [--draft] [--title 'Title'] [--body-file path] [--base main] [--head branch]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# determine head branch
if [ -z "$head" ]; then
  head=$(git rev-parse --abbrev-ref HEAD)
fi

if [ -z "$title" ]; then
  title="Auto PR: $head"
fi

# prefer bundled draft if present
if [ -z "$body_file" ] && [ -f "docs/archive/PR_DRAFT_SECURITY_DEPS_UPGRADE.md" ]; then
  body_file="docs/archive/PR_DRAFT_SECURITY_DEPS_UPGRADE.md"
fi

# prefer gh CLI if available
if command -v gh >/dev/null 2>&1; then
  cmd=(gh pr create --base "$base" --head "$head" --title "$title")
  if [ -n "$body_file" ]; then
    cmd+=(--body-file "$body_file")
  fi
  if [ "$draft" = true ]; then cmd+=(--draft); fi
  echo "Running: ${cmd[*]}"
  "${cmd[@]}"
  exit $?
fi

# fallback to GitHub API using GITHUB_TOKEN
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "Error: neither 'gh' CLI found nor GITHUB_TOKEN set. Install gh or set GITHUB_TOKEN with repo scope." >&2
  exit 1
fi

url=$(git remote get-url origin)
if [[ "$url" =~ github.com[:/](.+)/(.+)(\.git)?$ ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]}"
else
  echo "Failed to parse origin URL: $url" >&2
  exit 1
fi

body=""
if [ -n "$body_file" ]; then
  # escape double quotes and keep newlines as \n
  body=$(sed 's/"/\\"/g' "$body_file" | awk '{printf "%s\\n", $0}')
fi

draft_json=false
if [ "$draft" = true ]; then draft_json=true; fi

# build JSON safely with python
json=$(python - <<PY
import json, os
print(json.dumps({
  "title": os.environ.get("PR_TITLE", "${title}"),
  "head": os.environ.get("PR_HEAD", "${head}"),
  "base": os.environ.get("PR_BASE", "${base}"),
  "body": os.environ.get("PR_BODY", "${body}"),
  "draft": ${draft_json}
}))
PY
)

api="https://api.github.com/repos/${owner}/${repo}/pulls"
resp=$(curl -s -H "Authorization: token ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" -d "$json" "$api")

# print the created PR URL or API error
echo "$resp" | python - <<PY
import sys, json
try:
  obj = json.load(sys.stdin)
  print(obj.get('html_url') or obj.get('message') or obj)
except Exception:
  print(sys.stdin.read())
PY
