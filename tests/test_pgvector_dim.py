import os
import sys
import subprocess

import pytest


def test_pgvector_dim_script():
    # This script requires a Postgres DB with pgvector installed; skip when
    # DATABASE_URL is not present or points to sqlite (conftest defaults).
    env = os.environ.copy()
    db_url = env.get("DATABASE_URL", "")
    if not db_url or db_url.startswith("sqlite"):
        pytest.skip("No Postgres DATABASE_URL for pgvector check")
    env.setdefault("OPENAI_EMBED_DIMENSIONS", "768")
    res = subprocess.run([sys.executable, "scripts/check_pgvector_dim.py"], env=env, capture_output=True, text=True)
    assert res.returncode == 0, f"Script failed: stdout={res.stdout}\nstderr={res.stderr}"
