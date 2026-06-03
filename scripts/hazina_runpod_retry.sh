#!/usr/bin/env bash
# Runpod retry helper — validates SSH, uploads tarball, starts training.
#
# 1. Start pod in Runpod console (must be Running).
# 2. Connect → copy SSH command (IP + PORT).
# 3. Connect → download SSH private key → ~/.ssh/runpod_key (chmod 600).
# 4. Pod env: HF_TOKEN = {{ RUNPOD_SECRET_hazina }}
#
# Usage:
#   export RUNPOD_HOST=YOUR_IP RUNPOD_PORT=YOUR_PORT
#   export RUNPOD_SSH_KEY=~/.ssh/runpod_key   # or ~/.ssh/id_ed25519
#   bash scripts/hazina_runpod_retry.sh
#
# No SCP? Use web terminal only:
#   bash scripts/hazina_runpod_retry.sh --web-only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "${1:-}" == "--web-only" ]]; then
  cat <<'EOF'

=== Runpod web terminal (no SCP) ===

cd /workspace
git clone https://github.com/lesnargitonga/geneat.git hazina-repo
cd hazina-repo
test -n "$HF_TOKEN" && echo "HF_TOKEN set" || echo "WARNING: set HF_TOKEN={{ RUNPOD_SECRET_hazina }} on pod"

python3 -m venv .venv && source .venv/bin/activate
pip install -U pip && pip install -r requirements-finetune.txt
python scripts/hazina_generate_finetune_dataset.py --target-count 1000 --golden-multiplier 8
bash scripts/hazina_runpod_train.sh 2>&1 | tee /workspace/hazina-train.log

EOF
  exit 0
fi

HOST="${RUNPOD_HOST:-}"
PORT="${RUNPOD_PORT:-}"
SSH_KEY="${RUNPOD_SSH_KEY:-}"

if [[ -z "$HOST" || -z "$PORT" ]]; then
  echo "Set RUNPOD_HOST and RUNPOD_PORT from Runpod → Connect → SSH (pod must be Running)." >&2
  echo "Example: export RUNPOD_HOST=213.173.102.179 RUNPOD_PORT=37808" >&2
  exit 1
fi

if [[ -z "$SSH_KEY" ]]; then
  for candidate in "$HOME/.ssh/runpod_key" \
    "$HOME/.ssh/runpod_yawning_maroon_buzzard" \
    "$HOME/.ssh/id_ed25519"; do
    if [[ -f "$candidate" ]]; then
      SSH_KEY="$candidate"
      echo "Using SSH key: $SSH_KEY"
      break
    fi
  done
fi

if [[ -z "$SSH_KEY" || ! -f "$SSH_KEY" ]]; then
  echo "No SSH key found. Download from Runpod → Connect → SSH, then:" >&2
  echo "  export RUNPOD_SSH_KEY=~/.ssh/runpod_key && chmod 600 ~/.ssh/runpod_key" >&2
  echo "Or: bash scripts/hazina_runpod_retry.sh --web-only" >&2
  exit 1
fi

chmod 600 "$SSH_KEY" 2>/dev/null || true
SSH_OPTS=(-p "$PORT" -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

echo "→ Testing SSH to root@$HOST:$PORT ..."
if ! ssh "${SSH_OPTS[@]}" "root@$HOST" "echo connected && test -n \"\${HF_TOKEN:-}\" && echo HF_TOKEN_set || echo HF_TOKEN_missing"; then
  echo "" >&2
  echo "SSH failed. Check:" >&2
  echo "  • Pod is Running (not Stopped)" >&2
  echo "  • IP and PORT match Connect tab (they change after restart)" >&2
  echo "  • Key file matches this pod's downloaded key" >&2
  echo "Fallback: bash scripts/hazina_runpod_retry.sh --web-only" >&2
  exit 1
fi

bash "$ROOT/scripts/hazina_runpod_pack.sh"
export RUNPOD_HOST="$HOST" RUNPOD_PORT="$PORT" RUNPOD_SSH_KEY="$SSH_KEY"
bash "$ROOT/scripts/hazina_runpod_upload.sh"
