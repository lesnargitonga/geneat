#!/usr/bin/env python3
"""Audit Render resource regions for the Hazina stack.

Render regions are immutable after resource creation. This script is a small
operator gate before switching Hazina traffic to a dedicated API service: API,
Postgres, and Key Value should all report the same target region.
"""
from __future__ import annotations

import argparse
import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx


ROOT = Path(__file__).resolve().parents[1]
RENDER_API = "https://api.render.com/v1"


@dataclass(frozen=True)
class ResourceSpec:
    label: str
    endpoint: str
    wrapper_key: str
    name: str


def _env_file_value(key: str) -> str:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return ""
    prefix = f"{key}="
    for line in env_path.read_text(errors="ignore").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or not stripped.startswith(prefix):
            continue
        return stripped.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def _unwrap_rows(rows: Any, wrapper_key: str) -> list[dict[str, Any]]:
    if not isinstance(rows, list):
        return []
    resources: list[dict[str, Any]] = []
    for row in rows:
        if isinstance(row, dict):
            value = row.get(wrapper_key)
            if isinstance(value, dict):
                resources.append(value)
            elif wrapper_key == "service" and "name" in row:
                resources.append(row)
    return resources


async def _fetch_resource(
    client: httpx.AsyncClient,
    spec: ResourceSpec,
) -> tuple[ResourceSpec, dict[str, Any] | None, str]:
    try:
        response = await client.get(
            f"{RENDER_API}{spec.endpoint}",
            params={"name": spec.name, "limit": 100},
        )
    except httpx.HTTPError as exc:
        return spec, None, f"{type(exc).__name__}: {exc}"
    if response.status_code >= 400:
        return spec, None, f"HTTP {response.status_code}: {response.text[:160]}"
    matches = [
        resource
        for resource in _unwrap_rows(response.json(), spec.wrapper_key)
        if str(resource.get("name") or "") == spec.name
    ]
    if not matches:
        return spec, None, "not found"
    return spec, matches[0], ""


def _status(resource: dict[str, Any]) -> str:
    if "status" in resource:
        return str(resource.get("status") or "unknown")
    suspended = resource.get("suspended")
    if suspended and suspended != "not_suspended":
        return str(suspended)
    return "available"


async def main_async() -> int:
    parser = argparse.ArgumentParser(description="Audit Render regions for Hazina.")
    parser.add_argument("--expected-region", default="frankfurt")
    parser.add_argument("--api", default="hazina-api")
    parser.add_argument("--portal", default="hazina-portal")
    parser.add_argument("--postgres", default="hazina-postgres-fra")
    parser.add_argument("--redis", default="hazina-redis-fra")
    parser.add_argument(
        "--token",
        default=os.environ.get("RENDER_API_TOKEN") or _env_file_value("RENDER_API_TOKEN"),
        help="Render API token. Defaults to RENDER_API_TOKEN from env/.env.",
    )
    args = parser.parse_args()
    token = (args.token or "").strip()
    if not token:
        raise SystemExit("Missing RENDER_API_TOKEN; set it in your shell or .env.")

    specs = [
        ResourceSpec("api", "/services", "service", args.api),
        ResourceSpec("portal", "/services", "service", args.portal),
        ResourceSpec("postgres", "/postgres", "postgres", args.postgres),
        ResourceSpec("redis", "/key-value", "keyValue", args.redis),
    ]
    async with httpx.AsyncClient(
        timeout=20.0,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    ) as client:
        rows = await asyncio.gather(*(_fetch_resource(client, spec) for spec in specs))

    expected = args.expected_region.strip().lower()
    failures = 0
    for spec, resource, error in rows:
        if resource is None:
            print(f"BAD {spec.label:8} {spec.name:24} {error}")
            failures += 1
            continue
        region = str(resource.get("region") or "unknown").lower()
        status = _status(resource)
        ok = region == expected
        mark = "OK " if ok else "BAD"
        if not ok:
            failures += 1
        print(f"{mark} {spec.label:8} {spec.name:24} region={region} status={status}")

    if failures:
        print(f"REGION AUDIT FAILED: {failures} resource(s) not in {expected}.")
        return 1
    print(f"REGION AUDIT PASSED: all resources are in {expected}.")
    return 0


def main() -> int:
    return asyncio.run(main_async())


if __name__ == "__main__":
    raise SystemExit(main())
