from __future__ import annotations

from app.api.health import build_info


def test_build_info_prefers_hosted_commit_env(monkeypatch) -> None:
    monkeypatch.setenv("RENDER_GIT_COMMIT", "abcdef1234567890")
    monkeypatch.setenv("RENDER_SERVICE_NAME", "geneat-api")

    info = build_info()

    assert info["commit"] == "abcdef123456"
    assert info["commit_full"] == "abcdef1234567890"
    assert info["service"] == "geneat-api"
    assert info["app"]
