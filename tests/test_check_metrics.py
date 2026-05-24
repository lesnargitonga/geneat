import os
import subprocess

import pytest


@pytest.mark.skipif("METRICS_URL" not in os.environ and True, reason="No metrics URL")
def test_check_metrics():
    env = os.environ.copy()
    # prefer METRICS_URL from env; default used otherwise
    res = subprocess.run(["python", "scripts/check_metrics.py"], env=env, capture_output=True, text=True)
    assert res.returncode == 0, f"check_metrics failed: stdout={res.stdout}\nstderr={res.stderr}"
