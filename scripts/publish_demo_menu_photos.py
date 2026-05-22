"""Publish a full demo menu-photo catalog to the hosted API.

This script pulls item/image pairs from two local sources:

1. The backend fallback registry in ``app.services.menu_photos``
2. The consumer portal's richer menu definitions in
   ``gen-eat-portal/lib/cafes.ts``

It then verifies each image URL, optionally mirrors it to R2 when a public
R2 base URL is configured, and bulk-publishes the final per-business photo
map to the hosted admin endpoint.

Usage:
    ./.venv/bin/python scripts/publish_demo_menu_photos.py --dry-run
    ./.venv/bin/python scripts/publish_demo_menu_photos.py
"""
from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
import re
import sys
from typing import Any

import httpx

REPO_ROOT = Path(__file__).resolve().parents[1]
CAFES_TS = REPO_ROOT / "gen-eat-portal" / "lib" / "cafes.ts"
_NORMALIZE_RE = re.compile(r"[^a-z0-9 ]+")

ALIAS_CANDIDATES: dict[str, dict[str, list[str]]] = {
    "lily-pond-cafe": {
        "cappuccino": ["flat white", "coffee"],
        "mocha": ["latte", "coffee"],
        "mandazi": ["mandazi & masala chai", "breakfast"],
        "masala chai": ["mandazi & masala chai", "breakfast"],
    },
    "block-a-express": {
        "chai": ["chai latte", "coffee tea"],
    },
    "pavilion-grill": {
        "tilapia": ["tilapia grilled whole", "grill plates from 12 00"],
    },
}

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.core.config import get_settings
from app.services import media as media_svc
from app.services.menu_photos import MENU_PHOTOS


@dataclass(slots=True)
class PublishStats:
    slug: str
    requested: int
    published: int
    mirrored: int


def _normalize_key(value: str) -> str:
    return _NORMALIZE_RE.sub(" ", (value or "").lower()).strip()


def _is_http_url(value: Any) -> bool:
    text = str(value or "").strip()
    return text.startswith("http://") or text.startswith("https://")


def _node_portal_cafes() -> list[dict[str, Any]]:
    node_script = r"""
const fs = require('fs');
const vm = require('vm');
const ts = require('./gen-eat-portal/node_modules/typescript');

let src = fs.readFileSync('gen-eat-portal/lib/cafes.ts', 'utf8');
src += '\nmodule.exports = { CAFES };\n';

const out = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const sandbox = {
  module: { exports: {} },
  exports: {},
  process: {
    env: {
      NEXT_PUBLIC_LILY_POND_WHATSAPP: '15556578220',
      NEXT_PUBLIC_LILY_POND_DISPLAY_PHONE: '+1 555-657-8220',
    },
  },
  require,
  console,
};

vm.runInNewContext(out, sandbox);
const cafes = sandbox.module.exports.CAFES || sandbox.exports.CAFES || [];
process.stdout.write(JSON.stringify(cafes));
"""
    res = subprocess.run(
        ["node", "-e", node_script],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    body = res.stdout.strip()
    if not body:
        return []
    return json.loads(body)


def _append_candidate(
    table: dict[str, list[str]],
    key: str,
    url: Any,
) -> None:
    norm = _normalize_key(key)
    if not norm or not _is_http_url(url):
        return
    table.setdefault(norm, [])
    clean_url = str(url).strip()
    if clean_url not in table[norm]:
        table[norm].append(clean_url)


def _portal_catalog() -> dict[str, dict[str, list[str]]]:
    cafes = _node_portal_cafes()
    catalog: dict[str, dict[str, list[str]]] = {}
    for cafe in cafes:
        slug = str(cafe.get("slug") or "").strip()
        if not slug:
            continue

        photos: dict[str, list[str]] = {}
        hero_photo = cafe.get("photo")
        _append_candidate(photos, "menu", hero_photo)
        _append_candidate(photos, "cafe", hero_photo)
        _append_candidate(photos, "hero", hero_photo)

        for item in cafe.get("menuPreview") or []:
            _append_candidate(photos, str(item.get("name") or ""), item.get("image"))
            _append_candidate(photos, str(item.get("name") or ""), hero_photo)

        for section in cafe.get("menuFull") or []:
            items = section.get("items") or []
            first_item_image = None
            for item in items:
                item_name = str(item.get("name") or "")
                _append_candidate(photos, item_name, item.get("image"))
                if first_item_image is None and _is_http_url(item.get("image")):
                    first_item_image = str(item["image"]).strip()
            for item in items:
                item_name = str(item.get("name") or "")
                _append_candidate(photos, item_name, first_item_image)
                _append_candidate(photos, item_name, hero_photo)
            title = str(section.get("title") or "").strip()
            if title and first_item_image:
                _append_candidate(photos, title, first_item_image)
                _append_candidate(photos, title, hero_photo)

        for shot in cafe.get("gallery") or []:
            src = shot.get("src")
            caption = str(shot.get("caption") or "").strip()
            if caption:
                _append_candidate(photos, caption, src)

        catalog[slug] = photos
    return catalog


def _combined_catalog(slugs: set[str] | None = None) -> dict[str, dict[str, list[str]]]:
    combined: dict[str, dict[str, list[str]]] = {}
    portal = _portal_catalog()
    known_slugs = set(MENU_PHOTOS) | set(portal)
    if slugs:
        known_slugs &= slugs

    for slug in sorted(known_slugs):
        merged: dict[str, list[str]] = {}
        for key, url in MENU_PHOTOS.get(slug, {}).items():
            _append_candidate(merged, key, url)
        for key, urls in portal.get(slug, {}).items():
            for url in urls:
                _append_candidate(merged, key, url)
        for alias, candidates in ALIAS_CANDIDATES.get(slug, {}).items():
            for candidate in candidates:
                for url in merged.get(_normalize_key(candidate), []):
                    _append_candidate(merged, alias, url)
        if merged:
            combined[slug] = merged
    return combined


async def _verified_photo_url(
    *,
    client: httpx.AsyncClient,
    source_url: str,
    slug: str,
    source_cache: dict[str, str],
    mirror_to_r2: bool,
) -> tuple[str | None, bool]:
    if source_url in source_cache:
        return source_cache[source_url], False

    resp = await client.get(source_url, timeout=20.0, follow_redirects=True)
    resp.raise_for_status()

    mime = resp.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if not mime.startswith("image/"):
        raise ValueError(f"non-image content type: {mime or 'unknown'}")

    resolved_url = str(resp.url)
    mirrored = False
    if mirror_to_r2:
        uploaded = await media_svc.upload_to_r2(
            resp.content,
            mime,
            prefix=f"demo-menu-photos/{slug}",
            presign_seconds=7 * 24 * 3600,
        )
        if uploaded and uploaded.startswith(("http://", "https://")):
            resolved_url = uploaded
            mirrored = True

    source_cache[source_url] = resolved_url
    return resolved_url, mirrored


async def _resolve_slug_catalog(
    slug: str,
    photos: dict[str, list[str]],
    *,
    mirror_to_r2: bool,
) -> tuple[dict[str, str], int]:
    source_cache: dict[str, str] = {}
    resolved: dict[str, str] = {}
    mirrored = 0

    async with httpx.AsyncClient(timeout=20.0) as client:
        for key, source_urls in photos.items():
            final_url = None
            did_mirror = False
            last_error: Exception | None = None
            for source_url in source_urls:
                try:
                    final_url, did_mirror = await _verified_photo_url(
                        client=client,
                        source_url=source_url,
                        slug=slug,
                        source_cache=source_cache,
                        mirror_to_r2=mirror_to_r2,
                    )
                    break
                except Exception as exc:
                    last_error = exc
            if not final_url:
                if last_error is not None:
                    print(f"[warn] {slug}:{key} skipped - {last_error}")
                else:
                    print(f"[warn] {slug}:{key} skipped - no valid image candidates")
                continue
            if not final_url:
                continue
            resolved[key] = final_url
            mirrored += int(did_mirror)

    return resolved, mirrored


async def _publish_slug(
    *,
    api_base: str,
    token: str,
    slug: str,
    photos: dict[str, str],
) -> None:
    url = f"{api_base.rstrip('/')}/admin/businesses/{slug}/menu-photos"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {"photos": photos}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.put(url, headers=headers, json=payload)
    if resp.status_code == 404:
        raise RuntimeError(
            "Hosted API does not have /admin/businesses/{slug}/menu-photos yet. "
            "Push the latest backend commit and let Render redeploy first."
        )
    resp.raise_for_status()


async def run(args: argparse.Namespace) -> int:
    settings = get_settings()
    token = settings.admin_api_token.get_secret_value()
    if not token:
        raise SystemExit("ADMIN_API_TOKEN is missing from local environment.")

    wanted_slugs = set(args.slug or [])
    combined = _combined_catalog(wanted_slugs or None)
    if not combined:
        raise SystemExit("No matching demo cafes found.")

    mirror_to_r2 = bool(args.mirror_to_r2 and settings.r2_public_url_base)
    if args.mirror_to_r2 and not settings.r2_public_url_base:
        print("[note] R2_PUBLIC_URL_BASE is empty; keeping verified source URLs to avoid temporary presigned links.")

    stats: list[PublishStats] = []
    for slug, photos in combined.items():
        resolved, mirrored = await _resolve_slug_catalog(
            slug,
            photos,
            mirror_to_r2=mirror_to_r2,
        )
        stats.append(
            PublishStats(
                slug=slug,
                requested=len(photos),
                published=len(resolved),
                mirrored=mirrored,
            )
        )
        print(f"[ready] {slug}: {len(resolved)}/{len(photos)} photos prepared")
        if not args.dry_run:
            await _publish_slug(
                api_base=args.api_base,
                token=token,
                slug=slug,
                photos=resolved,
            )
            print(f"[live]  {slug}: catalog updated")

    print("\nSummary")
    for stat in stats:
        detail = f"{stat.published}/{stat.requested} published"
        if mirror_to_r2:
            detail += f" ({stat.mirrored} mirrored to R2)"
        print(f" - {stat.slug}: {detail}")
    return 0


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--api-base",
        default="https://api.lesnarai.co.ke",
        help="Hosted API base URL.",
    )
    parser.add_argument(
        "--slug",
        action="append",
        help="Limit publishing to one cafe slug. Repeat for multiple.",
    )
    parser.add_argument(
        "--mirror-to-r2",
        action="store_true",
        help="Mirror fetched images into R2 when R2_PUBLIC_URL_BASE is configured.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and verify images without updating the hosted API.",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run(parse_args())))
