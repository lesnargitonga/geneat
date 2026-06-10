#!/usr/bin/env python3
"""Generate Hazina Nomads instruction-tuning JSONL from catalog + golden examples.

Output: ShareGPT-style ``messages`` rows for Unsloth / Axolotl / TRL.

Usage:
  python scripts/hazina_generate_finetune_dataset.py
  python scripts/hazina_generate_finetune_dataset.py --target-count 1000 --out training/hazina/out
  python scripts/hazina_generate_finetune_dataset.py --target-count 100 --sample 2
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.ai.playbooks.gift_concierge import GIFT_CONCIERGE_PLAYBOOK  # noqa: E402
from app.catalog.hazina_catalog import (  # noqa: E402
    HAZINA_COLLECTIONS,
    HAZINA_TREASURES,
    MIN_CUSTOM_ITEMS,
    PACKAGING_FEE_USD,
)
BRAND_VOICE = (
    "Hazina Private Concierge — calm luxury concierge for Hazina Nomads. "
    "Born in Kenya. Curating Africa. Delivered to the world. "
    "Use Certainly. Ask one question at a time. Never overpromise or invent prices. "
    "Recommend only from [Catalog context] when provided. Escalate corporate/bulk to human desk."
)

TRAINING_DIR = ROOT / "training" / "hazina"
DEFAULT_OUT = TRAINING_DIR / "out"
GOLDEN_PATH = TRAINING_DIR / "golden.jsonl"
SYSTEM_PATH = TRAINING_DIR / "system_prompt.txt"

REQUIRED_SENTINELS = (
    "PROMPT_VERSION: hazina-private-concierge-v1.0",
    "Hazina Private Concierge",
    "Born in Kenya",
    "Bespoke Curation",
    "Certainly",
    "custom sourcing brief",
    "order_creation_ready",
    "human_escalation",
)

OFF_TOPIC_USER = [
    "Write me a haiku about elephants.",
    "What's the weather in Mombasa tomorrow?",
    "Help me debug my Python FastAPI app.",
    "Tell me a joke about coffee.",
    "Who won the Premier League last season?",
    "Book me a safari at Maasai Mara for $50.",
    "Translate this email to French for me.",
    "What's the capital of Tanzania?",
]

CAFE_CONFUSION_USER = [
    "I'll have a flat white and a croissant.",
    "Do you have oat milk for lattes?",
    "Table for two on the terrace please.",
    "Is the kitchen still open for brunch?",
]

CORPORATE_USER = [
    "We need 200 gift boxes for a bank AGM — can you do 30% off?",
    "Corporate retreat for 80 guests — negotiate bulk pricing.",
    "Invoice our company in USD with NET-30 terms?",
    "Can procurement get a wholesale rate sheet?",
]

IMPOSSIBLE_TIMELINE_USER = [
    "Custom engraved leather by 6am tomorrow.",
    "I need 50 bespoke necklaces delivered tonight.",
    "Can you source a one-of-a-kind carving in two hours?",
]

HALLUCINATION_BAIT = [
    "Do you have Apple AirPods in stock?",
    "Sell me a Samsung TV for my hotel room.",
    "I want Nike running shoes size 44.",
    "Do you carry Swiss watches?",
]


def _prompt_version() -> str:
    if not SYSTEM_PATH.is_file():
        return "unknown"
    first = SYSTEM_PATH.read_text(encoding="utf-8").splitlines()[0].strip()
    if first.startswith("PROMPT_VERSION:"):
        return first.split(":", 1)[1].strip()
    return "unknown"


def _load_system_base() -> str:
    if SYSTEM_PATH.is_file():
        return SYSTEM_PATH.read_text(encoding="utf-8").strip()
    return (
        f"{BRAND_VOICE}\n\n"
        f"{GIFT_CONCIERGE_PLAYBOOK[:800]}"
    )


def _git_commit() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
            timeout=1.0,
        )
        return result.stdout.strip()
    except Exception:
        return "unknown"


def _rows_fingerprint(rows: list[dict]) -> str:
    payload = "\n".join(json.dumps(row, sort_keys=True, ensure_ascii=False) for row in rows)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _example(*, system: str, user: str, assistant: str) -> dict:
    return {
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ]
    }


def _catalog_context(*rows: dict) -> str:
    parts = []
    for row in rows:
        name = row["name"]
        usd = row["price_usd"]
        kes = int(row["price_kes"])
        lead = row.get("lead_time_hours", 24)
        parts.append(f"{name} (USD {usd} / KES {kes:,}; lead {lead}h)")
    return "[Catalog context: " + "; ".join(parts) + "]"


def _gen_persona(system_base: str) -> list[dict]:
    out: list[dict] = []
    for user in OFF_TOPIC_USER:
        out.append(
            _example(
                system=system_base,
                user=user,
                assistant=(
                    "I focus exclusively on Hazina Nomads private sourcing and luxury gifting. "
                    "May I help you select a curated collection, open a bespoke sourcing brief, "
                    "or discuss seamless logistics and global export?"
                ),
            )
        )
    for user in CAFE_CONFUSION_USER:
        out.append(
            _example(
                system=system_base,
                user=user,
                assistant=(
                    "We are a premium gift concierge — not a café. I can guide you through our "
                    "signature collections, bespoke curation, seamless logistics, or global export."
                ),
            )
        )
    out.append(
        _example(
            system=system_base,
            user="What exactly does Hazina Nomads do?",
            assistant=(
                "Hazina Nomads operates through three pillars: Bespoke Curation, "
                "Seamless Logistics, and Global Export. I can show signature collections "
                "or initialize a private sourcing brief."
            ),
        )
    )
    return out


def _gen_catalog(system_base: str) -> list[dict]:
    out: list[dict] = []
    for col in HAZINA_COLLECTIONS:
        ctx = _catalog_context(col)
        sys = f"{system_base}\n\n{ctx}"
        name = col["name"]
        usd, kes = col["price_usd"], int(col["price_kes"])
        lead = col["lead_time_hours"]
        contents = (col.get("contents") or "")[:120]
        out.append(
            _example(
                system=sys,
                user=f"Tell me about {name}.",
                assistant=(
                    f"*{name}* is USD {usd} / KES {kes:,} with a {lead}-hour lead time. "
                    f"It includes {contents}. Shall I continue with seamless logistics "
                    "or prepare this for global export?"
                ),
            )
        )
        out.append(
            _example(
                system=sys,
                user=f"Is {name} available for my private lodge tomorrow?",
                assistant=(
                    f"*{name}* is in our ready-to-ship catalog at USD {usd} / KES {kes:,} "
                    f"(typical lead {lead}h). Share the exact property, room or access note, and preferred window — "
                    f"I will confirm dispatch before payment."
                ),
            )
        )
        if col.get("jkia_only"):
            out.append(
                _example(
                    system=sys,
                    user="I'm leaving soon — will this work?",
                    assistant=(
                        f"*{name}* is reserved for departure-sensitive handoffs with approximately {lead}-hour "
                        f"dispatch (USD {usd} / KES {kes:,}). Send the meeting point and departure time to confirm."
                    ),
                )
            )
    for treasure in random.sample(HAZINA_TREASURES, min(20, len(HAZINA_TREASURES))):
        ctx = _catalog_context(treasure)
        sys = f"{system_base}\n\n{ctx}"
        out.append(
            _example(
                system=sys,
                user=f"Do you have {treasure['name']}?",
                assistant=(
                    f"Yes — {treasure['name']} is USD {treasure['price_usd']} / "
                    f"KES {int(treasure['price_kes']):,} in our treasure catalog "
                    f"({treasure.get('lead_time_hours', 24)}h lead). "
                    f"It can anchor a custom box (minimum {MIN_CUSTOM_ITEMS} treasures) or complement a collection."
                ),
            )
        )
    return out


def _gen_strictness(system_base: str) -> list[dict]:
    out: list[dict] = []
    highland = next(c for c in HAZINA_COLLECTIONS if c["id"] == "highland-treasure")
    ctx = _catalog_context(highland)
    sys = f"{system_base}\n\n{ctx}"
    for user in IMPOSSIBLE_TIMELINE_USER:
        out.append(
            _example(
                system=sys,
                user=user,
                assistant=(
                    f"Our ready-to-ship line includes *{highland['name']}* at USD {highland['price_usd']} / "
                    f"KES {int(highland['price_kes']):,}. Bespoke commissions require a custom brief — "
                    f"standard field lead time is seven days, not same-day. Shall I open the brief?"
                ),
            )
        )
    for user in HALLUCINATION_BAIT:
        ctx2 = _catalog_context(highland)
        out.append(
            _example(
                system=f"{system_base}\n\n{ctx2}",
                user=user,
                assistant=(
                    "That item is outside our Kenyan sourcing portfolio. "
                    f"I can recommend *{highland['name']}* or submit a custom sourcing request — "
                    "what occasion and fulfillment brief should I note?"
                ),
            )
        )
    multi = _catalog_context(*HAZINA_COLLECTIONS[:3])
    out.append(
        _example(
            system=f"{system_base}\n\n{multi}",
            user="What collections do you have and which is best for a honeymoon?",
            assistant=(
                "From today's catalog: "
                + ", ".join(
                    f"*{c['name']}* (USD {c['price_usd']})" for c in HAZINA_COLLECTIONS[:3]
                )
                + ". For honeymoons our team often suggests *The Safari Romance Box* when it appears in your catalog search — shall I confirm it is available for your dates?"
            ),
        )
    )
    return out


def _gen_escalation(system_base: str) -> list[dict]:
    out: list[dict] = []
    for user in CORPORATE_USER:
        out.append(
            _example(
                system=system_base,
                user=user,
                assistant=(
                    "Corporate and volume pricing is managed by our senior concierge desk. "
                    "I have flagged your request — a specialist will contact you on this thread shortly."
                ),
            )
        )
    return out


def _gen_logistics(system_base: str) -> list[dict]:
    templates = [
        (
            "Deliver to Four Seasons room 512 tonight.",
            "Noted — this falls under seamless logistics to Four Seasons, room 512. Which collection or custom brief should I attach, and what is your latest acceptable handoff time?",
        ),
        (
            "I'm departing at 22:40 — what fits?",
            "For departure handoffs, share the meeting point and latest acceptable handoff time — *The Departure Drop* is built for short windows when it is in your catalog. I will confirm stock before STK or card checkout.",
        ),
        (
            "Need DHL to Munich Germany — how do you quote?",
            "Global export moves on an insured courier quote before payment. Send full address, desired delivery date, and your chosen collection — we return shipping separately from the box total.",
        ),
    ]
    return [
        _example(system=system_base, user=u, assistant=a) for u, a in templates
    ]


def _gen_custom_box(system_base: str) -> list[dict]:
    return [
        _example(
            system=system_base,
            user="I want to pick my own items — how does that work?",
            assistant=(
                f"Compose a custom box from at least {MIN_CUSTOM_ITEMS} individual treasures; "
                f"optional premium packaging is USD {PACKAGING_FEE_USD}. "
                "Use our build brief or list the pieces here and I will confirm totals and lead time."
            ),
        ),
        _example(
            system=system_base,
            user="Can I add monogram on two items?",
            assistant=(
                "Engraving is available on eligible leather and select pieces — "
                "typically twenty-four hours' notice per line. List the SKUs and initials and I will confirm feasibility."
            ),
        ),
    ]


def _gen_visual_sourcing(system_base: str) -> list[dict]:
    highland = next(c for c in HAZINA_COLLECTIONS if c["id"] == "highland-treasure")
    kenya_edit = next(c for c in HAZINA_COLLECTIONS if c["id"] == "kenya-edit")
    ctx = _catalog_context(highland)
    sys = f"{system_base}\n\n{ctx}"
    coastal_sys = f"{system_base}\n\n{_catalog_context(kenya_edit, highland)}"
    return [
        _example(
            system=sys,
            user=(
                "I like The Highland Treasure, but my wife wants silver filigree earrings "
                "from Lamu. I have a magazine photo. Can you add them by tomorrow?"
            ),
            assistant=(
                f"*{highland['name']}* is in today's catalog at USD {highland['price_usd']} / "
                f"KES {int(highland['price_kes']):,} with a {highland['lead_time_hours']}-hour lead time. "
                "The Lamu silver earrings are outside the listed catalog, so I cannot promise stock, price, "
                "authenticity, or tomorrow delivery yet; send the reference photo and I will open a custom visual sourcing brief."
            ),
        ),
        _example(
            system=sys,
            user="I saw carved silver cufflinks in a hotel magazine. Can your runner get the exact pair?",
            assistant=(
                "Those cufflinks are outside the catalog shown for this turn. "
                "Please send the reference image and I will open a custom visual sourcing brief for field-team validation before we quote price or timing."
            ),
        ),
        _example(
            system=coastal_sys,
            user=(
                "We are staying at Alfajiri Villas in Diani Beach and flying to London "
                "from Ukunda airstrip on Sunday morning. We want The Kenya Edit, and "
                "we have a photo of a hand-woven Swahili coastal Mkeka chest from a "
                "boutique lounge. Can you buy that exact chest and deliver all of it "
                "by Friday night?"
            ),
            assistant=(
                f"*{kenya_edit['name']}* is in today's catalog at USD {kenya_edit['price_usd']} / "
                f"KES {int(kenya_edit['price_kes']):,} with a {kenya_edit['lead_time_hours']}-hour collection lead time; "
                "Diani villa handoff and Ukunda airstrip coordination are part of Seamless Logistics, but I need the exact Friday-night window before confirming dispatch. "
                "The Mkeka chest is outside the listed catalog, so I cannot promise the exact piece, price, authenticity, stock, or Friday delivery yet; please send the photo and I will open a custom visual sourcing brief for our coastal field team."
            ),
        ),
    ]


def _load_golden(system_base: str) -> list[dict]:
    if not GOLDEN_PATH.is_file():
        return []
    import re

    rows: list[dict] = []
    for line in GOLDEN_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        msgs = row.get("messages") or []
        if msgs and msgs[0].get("role") == "system":
            raw = msgs[0].get("content") or ""
            catalog = ""
            m = re.search(r"\[Catalog context:[^\]]+\]", raw, flags=re.I)
            if m:
                catalog = m.group(0)
            msgs[0]["content"] = f"{system_base}\n\n{catalog}".strip() if catalog else system_base
        rows.append(row)
    return rows


def generate_dataset(*, target_count: int, seed: int, golden_multiplier: int = 8) -> list[dict]:
    random.seed(seed)
    system_base = _load_system_base()
    rows: list[dict] = []
    golden = _load_golden(system_base)
    for _ in range(max(1, golden_multiplier)):
        rows.extend(golden)
    rows.extend(_gen_persona(system_base))
    rows.extend(_gen_catalog(system_base))
    rows.extend(_gen_strictness(system_base))
    rows.extend(_gen_escalation(system_base))
    rows.extend(_gen_logistics(system_base))
    rows.extend(_gen_custom_box(system_base))
    rows.extend(_gen_visual_sourcing(system_base))

    # Paraphrase pool expansion until target_count.
    paraphrase_openers = ["Hi", "Hello", "Quick question", "Please advise", "Good evening"]
    synth_start = len(golden) * max(1, golden_multiplier)
    while len(rows) < target_count:
        pool = rows[synth_start:] if len(rows) > synth_start else rows
        base = random.choice(pool)
        msgs = base["messages"]
        user = msgs[1]["content"]
        opener = random.choice(paraphrase_openers)
        variant = _example(
            system=msgs[0]["content"],
            user=f"{opener} — {user[0].lower()}{user[1:]}" if user else user,
            assistant=msgs[2]["content"],
        )
        rows.append(variant)

    random.shuffle(rows)
    return rows[:target_count]


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Hazina fine-tune JSONL")
    parser.add_argument("--target-count", type=int, default=800)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--val-ratio", type=float, default=0.05)
    parser.add_argument(
        "--golden-multiplier",
        type=int,
        default=8,
        help="Repeat each golden row N times before synthetic expansion (tone anchoring).",
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=0,
        help="Print this many generated examples after writing the dataset.",
    )
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    rows = generate_dataset(
        target_count=args.target_count,
        seed=args.seed,
        golden_multiplier=args.golden_multiplier,
    )
    n_val = max(1, int(len(rows) * args.val_ratio))
    val_rows = rows[:n_val]
    train_rows = rows[n_val:]

    train_path = args.out / "train.jsonl"
    val_path = args.out / "val.jsonl"
    all_path = args.out / "all.jsonl"

    for path, part in ((train_path, train_rows), (val_path, val_rows), (all_path, rows)):
        with path.open("w", encoding="utf-8") as f:
            for row in part:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")

    meta = {
        "train_count": len(train_rows),
        "val_count": len(val_rows),
        "golden_count": len(_load_golden(_load_system_base())),
        "golden_multiplier": args.golden_multiplier,
        "system_prompt": str(SYSTEM_PATH),
        "prompt_version": _prompt_version(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_commit": _git_commit(),
        "dataset_sha256": _rows_fingerprint(rows),
        "required_sentinels": list(REQUIRED_SENTINELS),
        "base_model_ollama": "llama3.1",
        "hf_base_suggested": "meta-llama/Meta-Llama-3.1-8B-Instruct",
    }
    (args.out / "dataset_meta.json").write_text(
        json.dumps(meta, indent=2), encoding="utf-8",
    )
    print(f"Wrote {len(train_rows)} train + {len(val_rows)} val rows → {args.out}")
    if args.sample > 0:
        for i, row in enumerate(rows[: args.sample], start=1):
            print(f"\n--- sample {i} ---")
            print(json.dumps(row, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
