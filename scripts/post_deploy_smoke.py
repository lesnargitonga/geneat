"""Post-deploy smoke script to run after a release.

Runs smoke checks and optionally notifies a channel (left as TODO).
"""
from __future__ import annotations

import subprocess
import sys


def main():
    rc = subprocess.call([sys.executable, "scripts/run_smoke_tests.py"]) 
    if rc != 0:
        print("Smoke tests failed", file=sys.stderr)
        return rc
    print("Post-deploy smoke checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
