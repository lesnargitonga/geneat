import os
import subprocess

import pytest


@pytest.mark.skipif("DATABASE_URL" not in os.environ and "PGB_URL" not in os.environ, reason="No DB URL")
def test_check_pgbouncer():
    env = os.environ.copy()
    res = subprocess.run(["python", "scripts/check_pgbouncer.py"], env=env, capture_output=True, text=True)
    assert res.returncode == 0, f"check_pgbouncer failed: stdout={res.stdout}\nstderr={res.stderr}"
