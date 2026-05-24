import os
import sys
import subprocess

import pytest


def test_check_pgbouncer():
    env = os.environ.copy()
    # Skip if no Postgres-like DB is available (conftest may default to sqlite)
    db_url = env.get("DATABASE_URL", "")
    if (not db_url or db_url.startswith("sqlite")) and ("PGB_URL" not in env):
        pytest.skip("No Postgres DB / PGB_URL for pgbouncer check")
    # Use the same Python interpreter that's running the tests
    res = subprocess.run([sys.executable, "scripts/check_pgbouncer.py"], env=env, capture_output=True, text=True)
    assert res.returncode == 0, f"check_pgbouncer failed: stdout={res.stdout}\nstderr={res.stderr}"
