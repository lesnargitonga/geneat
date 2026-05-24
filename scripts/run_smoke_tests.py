"""Run a suite of lightweight smoke checks locally.

Runs the pgvector-dim, metrics, pgbouncer and sentry checks where configured.
"""
from __future__ import annotations

import os
import subprocess
import sys


SCRIPTS = [
    "scripts/check_pgvector_dim.py",
    "scripts/check_pgbouncer.py",
    "scripts/check_metrics.py",
    "scripts/check_sentry.py",
]


def main():
    for s in SCRIPTS:
        if not os.path.exists(s):
            print(f"skipping missing {s}")
            continue
        print(f"Running {s}...")
        env = os.environ.copy()
        rc = subprocess.call([sys.executable, s], env=env)
        if rc != 0:
            print(f"{s} failed with exit {rc}")
            return rc
    print("Smoke checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
