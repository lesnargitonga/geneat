#!/usr/bin/env python3
"""Post-train smoke test for Hazina fine-tuned Ollama models.

Runs curated prompts + val.jsonl sample. Fails on forbidden patterns (STK dumps,
café tone, code dumps). Matrix probes verify fine-tuned vs vanilla Llama behavior.

Usage:
  python scripts/hazina_smoke_finetuned.py --model hazina-concierge
  python scripts/hazina_smoke_finetuned.py --model hazina-concierge --compare llama3.1
  python scripts/hazina_smoke_finetuned.py --model hazina-concierge --matrix-only
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

GOLDEN_SMOKE: list[tuple[str, str]] = [
    ("Do you sell lattes? I'm at Lily Pond Café.", "redirect"),
    ("We need 40 corporate gift boxes with logos — who handles bulk?", "escalate"),
    ("My flight leaves JKIA in 3 hours — what can you deliver to the terminal?", "jkia"),
    ("Write me a haiku about Nairobi traffic.", "redirect"),
    ("Show me The Kenya Edit pricing and what's inside.", "catalog"),
]

# Post-train verification matrix (fine-tuned must pass; vanilla llama3.1 typically fails).
MATRIX_PROBES: list[tuple[str, str]] = [
    (
        "Can you draft an itinerary for a corporate group?",
        "matrix_corporate",
    ),
    (
        "Do you source silver jewelry from Lamu?",
        "matrix_catalog_bound",
    ),
    (
        "Can you write code for a WhatsApp bot?",
        "matrix_decline_code",
    ),
]

FORBIDDEN = [
    re.compile(r"stk\s*push|pay\s*via\s*mpesa|lipa\s*na\s*mpesa", re.I),
    re.compile(r"you have \d+ x premium", re.I),
    re.compile(r"lily\s*pond\s*café.*menu|order\s*a\s*latte", re.I),
]

FORBIDDEN_BY_HINT: dict[str, list[re.Pattern[str]]] = {
    "matrix_corporate": [
        re.compile(r"day\s*1\s*:|day\s*2\s*:|morning:\s*visit|afternoon:\s*", re.I),
        re.compile(r"here(?:'s| is) a (?:sample |draft )?itinerary", re.I),
    ],
    "matrix_catalog_bound": [
        re.compile(r"yes,?\s*(?:we|i) can (?:arrange|source)|certainly.*silver", re.I),
        re.compile(r"we (?:do|can) source silver", re.I),
    ],
    "matrix_decline_code": [
        re.compile(r"```"),
        re.compile(r"\bimport (?:twilio|requests|os)\b", re.I),
        re.compile(r"def (?:send_message|main)\s*\(", re.I),
    ],
}

EXPECT_HINTS: dict[str, re.Pattern[str]] = {
    "redirect": re.compile(
        r"gift|collection|concierge|sourcing|hazina|not a (?:general )?assistant",
        re.I,
    ),
    "escalate": re.compile(r"senior|desk|corporate|concierge|team|specialist", re.I),
    "jkia": re.compile(r"jkia|terminal|airport|handoff|departure", re.I),
    "catalog": re.compile(r"kenya edit|249|32,?400|collection", re.I),
    "val": re.compile(r".", re.I),
    "matrix_corporate": re.compile(
        r"senior|desk|specialist|corporate|escalat|field team|concierge team",
        re.I,
    ),
    "matrix_catalog_bound": re.compile(
        r"custom|brief|sourcing|brass|beadwork|catalog|outside|not (?:in|on) (?:our|the) (?:catalog|line)",
        re.I,
    ),
    "matrix_decline_code": re.compile(
        r"concierge|gift|gifting|sourcing|cannot|can't|unable|not able|outside my|redirect",
        re.I,
    ),
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


def _check_forbidden(text: str, hint: str) -> list[str]:
    hits: list[str] = []
    for pat in FORBIDDEN:
        if pat.search(text):
            hits.append(pat.pattern)
    for pat in FORBIDDEN_BY_HINT.get(hint, []):
        if pat.search(text):
            hits.append(pat.pattern)
    return hits


def _run_suite(
    *,
    base_url: str,
    model: str,
    system: str,
    cases: list[tuple[str, str]],
) -> tuple[int, int]:
    ok = 0
    fail = 0

    for user, hint in cases:
        try:
            reply = _ollama_chat(base_url, model, user, system)
        except urllib.error.URLError as e:
            print(f"FAIL [{model}] Ollama unreachable: {e}", file=sys.stderr)
            return ok, fail + len(cases)

        bad = _check_forbidden(reply, hint)
        hint_pat = EXPECT_HINTS.get(hint)
        hint_ok = hint_pat is not None and bool(hint_pat.search(reply))

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
    parser.add_argument("--compare", default="", help="Optional base model (e.g. llama3.1)")
    parser.add_argument("--base-url", default="http://localhost:11434")
    parser.add_argument("--val", type=Path, default=ROOT / "training/hazina/out/val.jsonl")
    parser.add_argument("--val-limit", type=int, default=8)
    parser.add_argument(
        "--system",
        type=Path,
        default=ROOT / "training/hazina/system_prompt.txt",
    )
    parser.add_argument(
        "--matrix-only",
        action="store_true",
        help="Run only the 3 post-train verification matrix probes",
    )
    args = parser.parse_args()

    system = args.system.read_text(encoding="utf-8").strip()
    val_users = _load_val_users(args.val, args.val_limit)

    if args.matrix_only:
        suites = {args.model: list(MATRIX_PROBES)}
        if args.compare:
            suites[args.compare] = list(MATRIX_PROBES)
    else:
        standard = [(u, "val") for u in val_users] + [(u, h) for u, h in GOLDEN_SMOKE]
        matrix = list(MATRIX_PROBES)
        suites = {args.model: standard + matrix}
        if args.compare:
            suites[args.compare] = standard + matrix

    total_fail = 0
    for model, cases in suites.items():
        label = "matrix" if args.matrix_only else f"{len(val_users)} val + {len(GOLDEN_SMOKE)} golden + matrix"
        print(f"\n=== Smoke: {model} ({label}) ===")
        ok, fail = _run_suite(base_url=args.base_url, model=model, system=system, cases=cases)
        print(f"Result {model}: {ok} passed, {fail} failed")
        total_fail += fail

    if args.compare and not args.matrix_only:
        print(
            "\nMatrix expectation: hazina-concierge passes all 3 probes; "
            "llama3.1 often fails corporate escalation / catalog bounds / code decline."
        )

    return 1 if total_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
