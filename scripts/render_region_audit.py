#!/usr/bin/env python3
"""Audit Render resource regions for the Hazina stack.

Render regions are immutable after resource creation. This script is a small
operator gate before switching Hazina traffic to a dedicated API service: API,
Postgres, and Key Value should all report the same target region. It also
checks the API service env for obvious old Oregon datastore URLs, because a
Frankfurt service can still be slow if DATABASE_URL / REDIS_URL point back to
legacy resources.
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


def _env_var_rows(rows: Any) -> list[dict[str, Any]]:
    if not isinstance(rows, list):
        return []
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        value = row.get("envVar")
        if isinstance(value, dict):
            out.append(value)
        elif row.get("key"):
            out.append(row)
    return out


async def _fetch_service_env(
    client: httpx.AsyncClient,
    service_id: str,
) -> tuple[dict[str, str], str]:
    try:
        response = await client.get(
            f"{RENDER_API}/services/{service_id}/env-vars",
            params={"limit": 100},
        )
    except httpx.HTTPError as exc:
        return {}, f"{type(exc).__name__}: {exc}"
    if response.status_code >= 400:
        return {}, f"HTTP {response.status_code}: {response.text[:160]}"
    values: dict[str, str] = {}
    for row in _env_var_rows(response.json()):
        key = str(row.get("key") or "")
        if key:
            values[key] = str(row.get("value") or "")
    return values, ""


async def main_async() -> int:
    parser = argparse.ArgumentParser(description="Audit Render regions for Hazina.")
    parser.add_argument("--expected-region", default="frankfurt")
    parser.add_argument("--api", default="hazina-api")
    parser.add_argument("--portal", default="hazina-portal")
    parser.add_argument("--postgres", default="hazina-postgres-fra")
    parser.add_argument("--redis", default="hazina-redis-fra")
    parser.add_argument(
        "--skip-env-drift",
        action="store_true",
        help="Only check resource regions; skip DATABASE_URL/REDIS_URL drift checks.",
    )
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
    resources_by_label: dict[str, dict[str, Any]] = {}
    for spec, resource, error in rows:
        if resource is None:
            print(f"BAD {spec.label:8} {spec.name:24} {error}")
            failures += 1
            continue
        resources_by_label[spec.label] = resource
        region = str(
            resource.get("region")
            or (resource.get("serviceDetails") or {}).get("region")
            or "unknown"
        ).lower()
        status = _status(resource)
        ok = region == expected
        mark = "OK " if ok else "BAD"
        if not ok:
            failures += 1
        print(f"{mark} {spec.label:8} {spec.name:24} region={region} status={status}")

    if not args.skip_env_drift:
        api_resource = resources_by_label.get("api") or {}
        service_id = str(api_resource.get("id") or "")
        if not service_id:
            print("BAD env      hazina-api               missing service id; cannot inspect env drift")
            failures += 1
        else:
            async with httpx.AsyncClient(
                timeout=20.0,
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            ) as client:
                env_values, error = await _fetch_service_env(client, service_id)
            if error:
                print(f"BAD env      hazina-api               {error}")
                failures += 1
            else:
                drift_hints = ("oregon", "d8eqm")
                expected_vars = ("DATABASE_URL", "DATABASE_URL_SYNC", "REDIS_URL")
                for key in expected_vars:
                    value = env_values.get(key, "")
                    hints = [hint for hint in drift_hints if hint in value.lower()]
                    if not value:
                        print(f"BAD env      {key:24} missing")
                        failures += 1
                    elif hints:
                        print(f"BAD env      {key:24} legacy datastore hints={','.join(hints)}")
                        failures += 1
                    else:
                        print(f"OK  env      {key:24} no legacy Oregon hints")

    if failures:
        print(f"REGION AUDIT FAILED: {failures} issue(s) found for target {expected}.")
        return 1
    print(f"REGION AUDIT PASSED: resources and API datastore env match {expected}.")
    return 0


def main() -> int:
    return asyncio.run(main_async())


if __name__ == "__main__":
    raise SystemExit(main())
