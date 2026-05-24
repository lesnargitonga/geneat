#!/usr/bin/env bash
# Prevent accidental commits of .env to the repository.
if git diff --cached --name-only | grep -q '^.env$'; then
  echo "ERROR: Committing .env is forbidden. Remove it from the commit and use environment secrets." >&2
  exit 1
fi
exit 0
