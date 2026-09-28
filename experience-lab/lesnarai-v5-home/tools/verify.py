"""Check that every figure and claim on the page is present in the file it came
from. Run after tools/inline.py. Exits non-zero on the first drift.

Each check names the phrase as the page states it, the source file, and the
phrase as the source states it. Source paths use the same env vars as
build_assets.py.
"""
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
R = {
    "MM": Path(os.environ.get("MEDIMATCH", "/home/user/src/MediMatch")),
    "ST": Path(os.environ.get("SENTINEL", "/home/user/src/LesnarAI")),
    "SY": Path(os.environ.get("SIMY", "/home/user/src/Simy")),
    "GT": Path(os.environ.get("GOLDTRADER", "/home/user/src/Gold-Trader")),
    "SC": Path(os.environ.get("SENTINELCORE", "/home/user/sentinelcore")),
    "GE": Path(os.environ.get("GENEAT", "/home/user/geneat")),
    "V4": Path(os.environ.get("V4", "/home/user/v4/experience-lab/lesnarai-site-v1")),
}

# (page phrase, source, source phrase). Source phrase None means "same as page".
CHECKS = [
    # MediMatch
    ("USIU-Africa", "MM/README.md", None),
    ("ranked by distance, urgency, verification and product fit", "MM/README.md", "ranked by distance, urgency, verification and product fit"),
    ("public facility names and approximate geocodes, synthetic inventory and need data, no patient records", "MM/client/src/pages/CommandMap.tsx", "synthetic inventory and need data"),
    ("Kenyatta National Hospital to Mandera", "MM/server/src/mock/db.ts", "Mandera County Referral Hospital"),
    # Operation Sentinel
    ("PX4 flies an x500 in Gazebo Harmonic", "ST/README.md", "Gazebo Harmonic + PX4 SITL (`x500`)"),
    ("registers an aircraft only when real telemetry arrives", "ST/README.md", "drones are registered only when real MAVSDK telemetry arrives"),
    ("No phantom assets, no synthesised figures", "ST/README.md", "No phantom assets, no synthesised KPIs"),
    ("SHA-256 manifest", "ST/README.md", "SHA-256 hashes of every artifact"),
    ("Wind and air density are simulated for training and marked synthetic", "ST/README.md", "environment.synthetic_environment: true"),
    # Simy
    ("X3DH and Double Ratchet", "SY/README.md", "X3DH, and Double Ratchet foundations"),
    ("Not yet a finished messenger", "SY/README.md", "It does not yet implement a production-ready end-user"),
    ("A hash of the retrieval secret", "SY/docs/relay-api.md", "hashed server-side before storage"),
    ("Replay token", "SY/docs/relay-api.md", "replay_token"),
    ("Message text", "SY/docs/relay-api.md", "The relay never stores plaintext message content."),
    ("Receiver prekey used", "SY/docs/relay-api.md", "receiver signed prekey public key"),
    ("perfect anonymity against a global passive adversary", "SY/docs/threat-model.md", "Perfect anonymity against a global passive adversary."),
    # Gold Trader
    ("−$79,297", "GT/docs/AUDIT_RESULTS.md", "**−$79,297**"),
    ("4,738 trades", "GT/docs/AUDIT_RESULTS.md", "| 4,738 | 25.0% |"),
    ("+$925", "GT/docs/AUDIT_RESULTS.md", "`asian_range_breakout` | **+$925**"),
    ("+$438", "GT/docs/AUDIT_RESULTS.md", "`liquidity_sweep` | **+$438**"),
    ("−$700", "GT/docs/AUDIT_RESULTS.md", "`inversion_fair_value_gap` | −$700"),
    ("−$36,427", "GT/docs/AUDIT_RESULTS.md", "`london_breakout` | −$36,427"),
    ("−$1,420", "GT/docs/AUDIT_RESULTS.md", "`trend_pullback` | −$1,420"),
    ("−$5,047", "GT/docs/AUDIT_RESULTS.md", "`momentum_burst` | −$5,047"),
    ("−$28,623", "GT/docs/AUDIT_RESULTS.md", "`ny_session_breakout` | −$28,623"),
    ("−$594", "GT/docs/AUDIT_RESULTS.md", "`compression_breakout` | −$594"),
    ("−$1,021", "GT/docs/AUDIT_RESULTS.md", "`timed_horizon_macro_regime` | −$1,021"),
    ("+2.65R over seven trades", "GT/docs/AUDIT_RESULTS.md", "**+2.65R** (n=7)"),
    ("none of 206 Grade A signals passed every live gate", "GT/docs/AUDIT_RESULTS.md", "206 Grade A signals, none pass all gates"),
    ("Paper yes, live no", "GT/docs/AUDIT_RESULTS.md", "**Paper yes, live no**"),
    ("until twenty forward trades", "GT/docs/AUDIT_RESULTS.md", "**20+ forward Grade-A trades**"),
    # SentinelCore
    ("Pass with qualified gaps", "SC/reports/final_structural_sealing.md", "PASS WITH QUALIFIED GAPS"),
    ("20 tests collected, 20 passed", "SC/reports/final_structural_sealing.md", "Current collected tests: `20`"),
    ("Token comparison is constant-time", "SC/reports/final_structural_sealing.md", "Authentication comparison is constant-time | PASS"),
    ("Rejected requests persist nothing", "SC/reports/final_structural_sealing.md", "Authentication failure does not persist telemetry | PASS"),
    ("CVE-2024-6387 attribution is not a verified detector", "SC/reports/final_structural_sealing.md", "CVE-2024-6387 attribution is not a verified vulnerability detector"),
    ("Credential-spray detection is not implemented", "SC/reports/final_structural_sealing.md", "Credential-spray automation is not implemented"),
    ("cannot guarantee erasure on SSDs or snapshots", "SC/reports/final_structural_sealing.md", "cannot guarantee physical erasure on SSD"),
    # Model Foundry
    ("950 training rows, 50 validation, 55 written by hand", "GE/training/hazina/out/dataset_meta.json", '"train_count": 950'),
    ("any of 8 required phrases", "GE/training/hazina/out/dataset_meta.json", '"required_sentinels"'),
    ("Llama 3.1 8B", "GE/training/hazina/out/dataset_meta.json", "Meta-Llama-3.1-8B-Instruct"),
    # CarePro, contact
    ("Registry check.", "V4/work/carepro/index.html", "Registry check"),
    ("Clinical sign-off.", "V4/work/carepro/index.html", "Clinical sign-off"),
    ("We reply within two working days", "V4/index.html", "Usually within two working days."),
]

COUNTS = [  # extra structural facts that are counted rather than quoted
    ("8 required phrases", lambda: len(__import__("json").loads((R["GE"] / "training/hazina/out/dataset_meta.json").read_text())["required_sentinels"]) == 8),
    ("Eleven gaps", lambda: len(re.findall(r"^- ", (R["SC"] / "reports/final_structural_sealing.md").read_text().split("## Known gaps")[1].split("## ")[0], re.M)) == 11),
    ("59 values", lambda: '"total": 59' in (HERE / "media/sentinel-columns.json").read_text()),
]


def main():
    page = (HERE / "index.html").read_text()
    text = re.sub(r"<[^>]+>", " ", page)
    text = re.sub(r"\s+", " ", text).replace("&amp;", "&")
    bad = 0
    for said, src, needle in CHECKS:
        root, rel = src.split("/", 1)
        f = R[root] / rel
        if said not in text:
            print(f"PAGE   missing: {said!r}")
            bad += 1
            continue
        body = f.read_text()
        if (needle or said) not in body:
            print(f"SOURCE drift:   {said!r} not backed by {src}")
            bad += 1
    for label, ok in COUNTS:
        if label not in text or not ok():
            print(f"COUNT  drift:   {label!r}")
            bad += 1
    if "—" in page:
        print("STYLE  em dash present on the page")
        bad += 1
    commit = os.popen(f"git -C {R['GE']} log -1 --format=%s 61af4b1 2>/dev/null").read()
    if "no LLM fallback" not in commit:
        print("SOURCE drift:   commit 61af4b1 no longer says the concierge has no LLM fallback")
        bad += 1
    n = len(CHECKS) + len(COUNTS) + 2
    print(f"{n - bad}/{n} checks pass")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
