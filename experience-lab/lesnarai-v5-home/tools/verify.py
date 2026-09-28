"""Check that every figure and claim on the page is present in the file it came
from. Run after tools/inline.py. Exits non-zero on the first drift.

Each check names the phrase as the page states it, the source file, and the
phrase as the source states it. Source paths use the same env vars as
build_assets.py.
"""
import json
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
    # The Phase 9 evidence layer on experience/lesnarai-v5-static: the registry
    # and the creative-reset handover's truth doctrine outrank older sources.
    "V5": Path(os.environ.get("V5S", "/home/user/v5s/experience-lab")),
    # A lesnargitonga/lesnarai clone with the evidence/* and fix/* branches fetched as
    # origin/* remote refs: it holds the sealed runs and the commits that fixed them.
    "LE": Path(os.environ.get("LESNARAI", "/home/user/lesnarai")),
}
REG = "V5/evidence-integration/evidence/registry.json"
DOC = "V5/creative-reset/final2/docs/HANDOVER.md"

# (page phrase, source, source phrase). Source phrase None means "same as page".
CHECKS = [
    # MediMatch
    ("USIU-Africa", "MM/README.md", None),
    ("ranked by distance, urgency, verification and product fit", "MM/README.md", "ranked by distance, urgency, verification and product fit"),
    ("public facility names and approximate geocodes, synthetic inventory and need data, no patient records", "MM/client/src/pages/CommandMap.tsx", "synthetic inventory and need data"),
    ("Kenyatta National Hospital to Mandera", "MM/server/src/mock/db.ts", "Mandera County Referral Hospital"),
    ("No facility supplied stock and no transfer was executed", REG, "No facility was supplied, no transfer was executed"),
    # Operation Sentinel
    ("built to fly a PX4 x500 in Gazebo Harmonic", "ST/README.md", "Gazebo Harmonic + PX4 SITL (`x500`)"),
    ("registers an aircraft only when real telemetry arrives", "ST/README.md", "drones are registered only when real MAVSDK telemetry arrives"),
    ("SHA-256 manifest", "ST/README.md", "SHA-256 hashes of every artifact"),
    ("integrated PX4, Gazebo and AirSim, which are the work of their own upstream maintainers", DOC, "integrated the PX4, Gazebo and AirSim projects, which are the work of their own upstream maintainers"),
    ("34 runs recorded detections and 53 recorded none", REG, "34 runs recorded detections; 53 recorded none"),
    ("71,813 detections in all, 53,971 obstacles and 17,842 proximity alerts", REG, "71,813 rows in total: 53,971 obstacle and 17,842 proximity_alert"),
    ("No flight log exists, simulated or physical", REG, "so there is no logged flight, simulated or physical"),
    ("No flight is on record, simulated or physical", REG, "so there is no logged flight, simulated or physical"),
    ("a run that recorded nothing is not a clean flight", DOC, "they do **not** prove 53 clean flights"),
    ("Wind and air density are simulated for training and marked synthetic", "ST/README.md", "environment.synthetic_environment: true"),
    # Simy
    ("X3DH and Double Ratchet", "SY/README.md", "X3DH, and Double Ratchet foundations"),
    ("Not yet a finished messenger", "SY/README.md", "It does not yet implement a production-ready end-user"),
    ("not independently audited", REG, "No third-party cryptographic audit"),
    ("Public prekey bundles and device records", DOC, "**public prekey bundles, device records**"),
    ("Session secrets and ratchet state", DOC, "X3DH shared secrets, ratchet state"),
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
    # SentinelCore: the registry's 16 September measurement, plus the gaps its own July report lists
    ("133 passed, 0 failed, across 21 test files", REG, "133 tests passed, 0 failed, in 21.87s across 21 test files"),
    ("at commit 65cbd3c", REG, '"source_commit": "65cbd3c"'),
    ("An orchestrator and five modules in 242 tracked files", REG, "scanner, monitor, firewall, remediator, telemetry. 242 tracked files"),
    ("Running against a real server, protecting anything, or being deployed", REG, "running against any real server, protecting anything, or being deployed"),
    ("from its July sealing report", "SC/reports/final_structural_sealing.md", "Manifest revision: `2026.07.15.2`"),
    ("CVE-2024-6387 attribution is not a verified detector", "SC/reports/final_structural_sealing.md", "CVE-2024-6387 attribution is not a verified vulnerability detector"),
    ("Credential-spray detection is not implemented", "SC/reports/final_structural_sealing.md", "Credential-spray automation is not implemented"),
    ("cannot guarantee erasure on SSDs or snapshots", "SC/reports/final_structural_sealing.md", "cannot guarantee physical erasure on SSD"),
    # Model Foundry: the registry's evaluation record
    ("Qwen2.5-Coder-7B-Instruct, Q4_K_M, pinned by SHA-256", REG, "qwen2.5-coder-7b-instruct-q4_k_m.gguf"),
    ("llama.cpp passed 80% of tasks, 8 of 10 repeatable", REG, "llama.cpp b10107: 80% task pass rate, 8/10 exact repeatability"),
    ("Ollama passed 60%, 6 of 10", REG, "Ollama 0.24.0: 60% task pass rate, 6/10"),
    ("Ollama obeyed it, in both repetitions", REG, "Ollama failed, returning PWNED in both repetitions"),
    ("No fine-tuned model has been produced yet", DOC, "No fine-tune has been produced"),
    ("Not for accepting code on its own, security decisions, or enforcing instruction boundaries", DOC, "explicitly not for autonomous code acceptance, security-sensitive decisions or instruction-boundary enforcement"),
    ("Ten tasks, two repetitions, one machine", REG, "ten tasks with two repetitions each"),
    # BizMtaani
    ("One business is listed today: The Villager, in Embu", REG, "One business published and open ('The Villager', Food & drink, Embu)"),
    ("Operated by LESNAR AI LTD", REG, "operated by LESNAR AI LTD"),
    # CarePro, contact
    ("Registry check.", "V4/work/carepro/index.html", "Registry check"),
    ("Clinical sign-off.", "V4/work/carepro/index.html", "Clinical sign-off"),
    ("We reply within two working days", "V4/index.html", "Usually within two working days."),
]

# Figures the source itself says a later rerun replaced. They must stay off the page, and
# the check fails if the source stops flagging them, so the page gets looked at again.
# Gold Trader's 30 May rerun replaced the sequential-sim results (+$43 on 18 IFVG trades,
# -$334 on 96 across families). The page's overlap figures come from the full-stack tiers,
# which the rerun's changes (live gates, and _entry_plan targets on the IFVG path) do not reach.
SUPERSEDED = [
    (r"\+\$43(?![\d,])", "GT/docs/AUDIT_RESULTS.md", "(vs prior doc +$43 — do not use old number)"),
    (r"[−-]\$334(?![\d,])", "GT/docs/AUDIT_RESULTS.md", "all-families **56 tr / −$638**"),
]

# A committed Sentinel run changes what the page may say about flight. Its facts are
# checked against the run's own files, recomputed here rather than trusted from the build.
RUN = json.loads((HERE / "media/sentinel-run.json").read_text() or "null") if (HERE / "media/sentinel-run.json").exists() else None
if RUN and RUN.get("flew"):
    NO_FLIGHT = {"No flight log exists, simulated or physical", "No flight is on record, simulated or physical"}
    CHECKS = [c for c in CHECKS if c[0] not in NO_FLIGHT]
    CHECKS.append(("None of these April runs has a flight log", REG, "so there is no logged flight, simulated or physical"))


def run_checks(text):
    """Returns a list of failures for the committed run, or [] when there is none."""
    if not RUN:
        return []
    import hashlib
    bad = []
    tel, man = os.environ.get("SENTINEL_TELEMETRY"), os.environ.get("SENTINEL_MANIFEST")
    if not (tel and man):
        # Read the sealed files straight from the run's evidence branch.
        import tempfile
        rid = str(RUN["run_id"])
        tmp = Path(tempfile.mkdtemp(prefix="sentinel-run-"))
        for name in ("telemetry_live_0.csv", "MANIFEST.json", "mission.json"):
            blob = _git("show", f"origin/evidence/sitl-run-{rid}:evidence/runs/{rid}/{name}", binary=True)
            if blob is None:
                return [f"RUN    cannot read {name} for {rid}: set SENTINEL_TELEMETRY and SENTINEL_MANIFEST, "
                        f"or fetch origin/evidence/sitl-run-{rid} into {R['LE']}"]
            (tmp / name).write_bytes(blob)
        tel, man = str(tmp / "telemetry_live_0.csv"), str(tmp / "MANIFEST.json")
    csv_hash = hashlib.sha256(Path(tel).read_bytes()).hexdigest()
    m = json.loads(Path(man).read_text())
    listed = {f.get("path"): f.get("sha256") for f in m.get("files", [])}
    mission = Path(man).parent / "mission.json"
    if csv_hash != RUN["csv_sha256"] or listed.get(Path(tel).name) != csv_hash:
        bad.append("RUN    telemetry hash differs from the build or the sealed manifest")
    if listed.get("mission.json") != hashlib.sha256(mission.read_bytes()).hexdigest():
        bad.append("RUN    mission.json is not the one the manifest sealed")
    if json.loads(mission.read_text()).get("outcome") != RUN.get("outcome"):
        bad.append("RUN    mission outcome differs from the sealed mission record")
    for said in (str(RUN["run_id"]), f"{RUN['samples']:,} samples"):
        if said not in text:
            bad.append(f"RUN    page missing: {said!r}")
    return bad


def _git(*args, binary=False):
    import subprocess
    r = subprocess.run(["git", "-C", str(R["LE"]), *args], capture_output=True)
    if r.returncode != 0:
        return None
    return r.stdout if binary else r.stdout.decode("utf-8", "replace")


def _norm(t):
    return re.sub(r"\s+", " ", t or "")


def history_checks(text):
    """Every sentence about the earlier sealed runs, and the April lidar caveat, against the
    evidence branches and the commits in the LesnarAI clone. Returns (checked, failures)."""
    import json
    checked, bad = 0, []
    hp = HERE / "media/sentinel-history.json"
    hist = json.loads(hp.read_text()) if hp.exists() else None
    if RUN and hist:
        fix_branch = hist["fix_branch"]
        for r in hist["earlier_runs"]:
            rid = r["run_id"]
            checked += 1
            if r["sentence"] not in text:
                bad.append(f"PAGE   missing: {r['sentence']!r}")
            checked += 1
            m = _git("show", f"origin/{r['branch']}:evidence/runs/{rid}/mission.json")
            if m is None or json.loads(m).get("outcome") != r["outcome"]:
                bad.append(f"SOURCE drift:   {rid} is not a sealed {r['outcome']} run on origin/{r['branch']}")
            msg = _norm(_git("log", "-1", "--format=%B", r["fixed_by"]))
            for phrase in r["fix_says"]:
                checked += 1
                if phrase not in msg:
                    bad.append(f"SOURCE drift:   commit {r['fixed_by']} no longer says {phrase!r}")
            checked += 1
            on_branch = _git("merge-base", "--is-ancestor", r["fixed_by"], f"origin/{fix_branch}") is not None
            in_main = _git("merge-base", "--is-ancestor", r["fixed_by"], "origin/main") is not None
            merged = hist.get("fix_state") == "merged"
            if not on_branch or in_main != merged:
                said = "in main" if merged else "on a branch that is not yet merged"
                bad.append(f"SOURCE drift:   {r['fixed_by']} is {'in main' if in_main else 'not in main'}; "
                           f"the page says it is fixed {said}")
        checked += 1
        if hist["fix_sentence"] not in text:
            bad.append(f"PAGE   missing: {hist['fix_sentence']!r}")
    if RUN and RUN.get("flew"):
        # The April detector read a simulated lidar that modelled boxes as discs: the last
        # committed bridge before the runs ended (16 April) shows both.
        checked += 1
        if "modelled box obstacles as discs" not in text:
            bad.append("PAGE   missing: 'modelled box obstacles as discs'")
        checked += 1
        last = (_git("log", "-1", "--format=%h", "--before=2026-04-16T21:00", "origin/main", "--",
                     "training/px4_teacher_collect_gz.py") or "").strip()
        src = _git("show", f"{last}:training/px4_teacher_collect_gz.py") if last else None
        if not src or "size = (max(obs.dx, obs.dy) / 2) if obs.is_box else obs.radius" not in src \
                or "1.0 - (float(front_eval_dist) / 20.0)" not in src:
            bad.append("SOURCE drift:   the April-era bridge does not show the disc lidar feeding the detector")
    return checked, bad


def _tel():
    import json
    return json.loads((R["V5"] / "creative-reset/final2/telemetry.json").read_text())


COUNTS = [  # extra structural facts that are counted rather than quoted
    ("59 values", lambda: '"total": 59' in (HERE / "media/sentinel-columns.json").read_text()),
    ("71,813 detections", lambda: sum(r["n"] for r in _tel()["runs"]) == 71813),
    ("17,842 proximity alerts", lambda: sum(r["p"] for r in _tel()["runs"]) == 17842),
    ("34 runs recorded detections", lambda: sum(1 for r in _tel()["runs"] if r["n"]) == 34 and len(_tel()["runs"]) == 87),
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
    for pattern, src, needle in SUPERSEDED:
        root, rel = src.split("/", 1)
        if re.search(pattern, text):
            print(f"PAGE   uses a figure its source marks superseded: {pattern!r}")
            bad += 1
        elif needle not in (R[root] / rel).read_text():
            print(f"SOURCE drift:   {src} no longer marks {pattern!r} superseded; re-check the page")
            bad += 1
    if "—" in page:
        print("STYLE  em dash present on the page")
        bad += 1
    commit = os.popen(f"git -C {R['GE']} log -1 --format=%s 61af4b1 2>/dev/null").read()
    if "no LLM fallback" not in commit:
        print("SOURCE drift:   commit 61af4b1 no longer says the concierge has no LLM fallback")
        bad += 1
    extra = run_checks(text)  # the committed run counts as one check
    for line in extra:
        print(line)
    bad += 1 if extra else 0
    hist_n, hist_bad = history_checks(text)
    for line in hist_bad:
        print(line)
    bad += len(hist_bad)
    n = len(CHECKS) + len(COUNTS) + len(SUPERSEDED) + 2 + (1 if RUN else 0) + hist_n
    print(f"{n - bad}/{n} checks pass")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
