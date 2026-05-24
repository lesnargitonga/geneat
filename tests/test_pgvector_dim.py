import os
import subprocess

import pytest


@pytest.mark.skipif("DATABASE_URL" not in os.environ, reason="No DATABASE_URL")
def test_pgvector_dim_script():
    env = os.environ.copy()
    env.setdefault("OPENAI_EMBED_DIMENSIONS", "768")
    res = subprocess.run(["python", "scripts/check_pgvector_dim.py"], env=env, capture_output=True, text=True)
    assert res.returncode == 0, f"Script failed: stdout={res.stdout}\nstderr={res.stderr}"
