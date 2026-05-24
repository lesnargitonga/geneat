import os
import pytest


def test_metrics_script_runs_or_skips():
    """Run the metrics check script only when METRICS_URL is set in env.

    This keeps CI flexible: repository-level runs can opt-in by setting
    METRICS_URL to a reachable endpoint.
    """
    if not os.getenv("METRICS_URL"):
        pytest.skip("METRICS_URL unset; skipping metrics check")
    import scripts.check_metrics as chk

    assert chk.main() == 0
