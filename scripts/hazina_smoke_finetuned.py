#!/usr/bin/env python3
"""Post-train smoke test for Hazina fine-tuned Ollama models.

Runs curated prompts + a sample of val.jsonl and fails on forbidden patterns
(STK dumps, café tone, invented checkout flows).

Usage:
  python scripts/hazina_smoke_finetuned.py --model hazina-concierge
  python scripts/hazina_smoke_finetuned.py --model llama3.1 --compare hazina-concierge
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Hand-curated — must pass after fine-tune (tone + boundaries).
GOLDEN_SMOKE: list[tuple[str, str]] = [
    (
        "Do you sell lattes? I'm at Lily Pond Café.",
        "redirect",
    ),
    (
        "We need 40 corporate gift boxes with logos — who handles bulk?",
        "escalate",
    ),
    (
        "My flight leaves JKIA in 3 hours — what can you deliver to the terminal?",
        "jkia",
    ),
    (
        "Write me a haiku about Nairobi traffic.",
        "redirect",
    ),
    (
        "Show me The Kenya Edit pricing and what's inside.",
        "catalog",
    ),
]

FORBIDDEN = [
    re.compile(r"stk\s*push|pay\s*via\s*mpesa|lipa\s*na\s*mpesa", re.I),
    re.compile(r"you have \d+ x premium", re.I),
    re.compile(r"lily\s*pond\s*café.*menu|order\s*a\s*latte", re.I),
    re.compile(r"```|def main\(|import os", re.I),
]

EXPECT_HINTS = {
    "redirect": re.compile(
        r"gift|collection|concierge|sourcing|hazina|not a (general )?assistant",
        re.I,
    ),
    "escalate": re.compile(r"senior|desk|corporate|concierge|team", re.I),
    "jkia": re.compile(r"jkia|terminal|airport|handoff|departure", re.I),
    "catalog": re.compile(r"kenya edit|249|32,?400|collection", re.I),
}


def _load_val_users(path: Path, limit: int) -> list[str]:
    users: list[str] = []
    if not path.is_file():
        return users
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        for msg in row.get("messages") or []:
            if msg.get("role") == "user":
                users.append(msg["content"])
                break
        if len(users) >= limit:
            break
    return users


def _ollama_chat(base_url: str, model: str, user: str, system: str) -> str:
    payload = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
            "options": {"temperature": 0.15, "num_predict": 280},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return (body.get("message") or {}).get("content") or ""


def _check_forbidden(text: str) -> list[str]:
    hits: list[str] = []
    for pat in FORBIDDEN:
        if pat.search(text):
            hits.append(pat.pattern)
    return hits


def _run_suite(
    *,
    base_url: str,
    model: str,
    system: str,
    val_users: list[str],
) -> tuple[int, int]:
    ok = 0
    fail = 0
    cases = [(u, "val") for u in val_users] + [(u, hint) for u, hint in GOLDEN_SMOKE]

    for user, hint in cases:
        try:
            reply = _ollama_chat(base_url, model, user, system)
        except urllib.error.URLError as e:
            print(f"FAIL [{model}] Ollama unreachable: {e}", file=sys.stderr)
            return ok, fail + len(cases)

        bad = _check_forbidden(reply)
        hint_pat = EXPECT_HINTS.get(hint)
        hint_ok = hint_pat is None or bool(hint_pat.search(reply))

        if bad or not hint_ok:
            fail += 1
            print(f"\n--- FAIL [{model}] hint={hint} ---")
            print(f"USER: {user[:200]}")
            print(f"REPLY: {reply[:500]}")
            if bad:
                print(f"FORBIDDEN: {bad}")
            if not hint_ok:
                print(f"MISSING_HINT: {hint_pat.pattern if hint_pat else '?'}")
        else:
            ok += 1
            print(f"OK   [{model}] {user[:72]}…")

    return ok, fail


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="hazina-concierge")
    parser.add_argument("--compare", default="", help="Optional base model id")
    parser.add_argument("--base-url", default="http://localhost:11434")
    parser.add_argument("--val", type=Path, default=ROOT / "training/hazina/out/val.jsonl")
    parser.add_argument("--val-limit", type=int, default=8)
    parser.add_argument(
        "--system",
        type=Path,
        default=ROOT / "training/hazina/system_prompt.txt",
    )
    args = parser.parse_args()

    system = args.system.read_text(encoding="utf-8").strip()
    val_users = _load_val_users(args.val, args.val_limit)

    total_fail = 0
    for model in [args.model] + ([args.compare] if args.compare else []):
        print(f"\n=== Smoke: {model} ({len(val_users)} val + {len(GOLDEN_SMOKE)} golden) ===")
        ok, fail = _run_suite(
            base_url=args.base_url,
            model=model,
            system=system,
            val_users=val_users,
        )
        print(f"Result {model}: {ok} passed, {fail} failed")
        total_fail += fail

    if args.compare:
        print("\nCompare manually — fine-tuned should be calmer and more on-brand than base.")

    return 1 if total_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
