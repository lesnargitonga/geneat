"""Bootstrap the hosted Gen-Eat demo with an explicit operator token.

This script intentionally does not source `.env`. Hosted admin tokens are
rotated outside the repo, so using a stale local ADMIN_API_TOKEN makes live
bootstrap failures look like app bugs.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import httpx


DEFAULT_BASE_URL = "https://api.lesnarai.co.ke"
LIVE_TOKEN_ENV = "GENEAT_LIVE_ADMIN_API_TOKEN"


def _is_live_base_url(base_url: str) -> bool:
    normalized = base_url.rstrip("/").lower()
    return normalized.startswith("https://api.lesnarai.co.ke")


def _resolve_token(*, base_url: str, token_env: str) -> str:
    token = os.getenv(token_env, "").strip()
    if token:
        return token

    if _is_live_base_url(base_url):
        raise SystemExit(
            f"{token_env} is missing. Export the current hosted ADMIN_API_TOKEN "
            f"from Render/your secret manager as {token_env}; local .env may be stale "
            "after rotation."
        )

    token = os.getenv("ADMIN_API_TOKEN", "").strip()
    if token:
        return token
    raise SystemExit(
        f"{token_env} is missing, and ADMIN_API_TOKEN is not set for this non-live target."
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Call /admin/bootstrap/geneat-demo using an explicit operator token."
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("GENEAT_API_URL", DEFAULT_BASE_URL),
        help=f"API base URL. Defaults to {DEFAULT_BASE_URL}.",
    )
    parser.add_argument(
        "--token-env",
        default=LIVE_TOKEN_ENV,
        help=f"Environment variable containing the admin token. Defaults to {LIVE_TOKEN_ENV}.",
    )
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    token = _resolve_token(base_url=base_url, token_env=args.token_env)
    url = f"{base_url}/admin/bootstrap/geneat-demo"

    try:
        with httpx.Client(timeout=120.0, follow_redirects=True) as client:
            response = client.post(url, headers={"Authorization": f"Bearer {token}"})
    except httpx.HTTPError as exc:
        raise SystemExit(f"Bootstrap request failed before the API responded: {exc}") from exc

    if response.status_code in {401, 403}:
        raise SystemExit(
            f"Admin token rejected by {base_url} (HTTP {response.status_code}). "
            f"Pull the current hosted ADMIN_API_TOKEN from Render/your secret manager "
            f"and export it as {args.token_env}, then retry."
        )
    if response.status_code >= 400:
        body = response.text[:500].replace("\n", " ")
        raise SystemExit(f"Bootstrap failed with HTTP {response.status_code}: {body}")

    try:
        payload = response.json()
    except json.JSONDecodeError:
        print(response.text)
        return 0

    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
