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
    ("No flight is on record, simulated or physical", REG, "so there is no logged flight, simulated or physical"),
    # Simy
    ("X3DH and Double Ratchet", "SY/README.md", "X3DH, and Double Ratchet foundations"),
    ("built and tested in Rust", "SY/README.md", "a Rust workspace, a shared cryptographic core crate"),
    ("Not yet a finished messenger", "SY/README.md", "It does not yet implement a production-ready end-user"),
    ("not independently audited", REG, "No third-party cryptographic audit"),
    ("Public prekey bundles and device records", DOC, "**public prekey bundles, device records**"),
    ("Session secrets and ratchet state", DOC, "X3DH shared secrets, ratchet state"),
    ("A hash of the retrieval secret", "SY/docs/relay-api.md", "hashed server-side before storage"),
    ("Replay token", "SY/docs/relay-api.md", "replay_token"),
    ("Message text", "SY/docs/relay-api.md", "The relay never stores plaintext message content."),
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
    ("Paper yes, live no", "GT/docs/AUDIT_RESULTS.md", "**Paper yes, live no**"),
    ("until twenty forward trades", "GT/docs/AUDIT_RESULTS.md", "**20+ forward Grade-A trades**"),
    ("the audit of 29 April to 29 May 2026", "GT/docs/AUDIT_RESULTS.md", "(Apr 29 – May 29, 2026)"),
    # SentinelCore: the registry's 16 September measurement, plus the gaps its own July report lists
    ("133 passed, 0 failed, across 21 test files", REG, "133 tests passed, 0 failed, in 21.87s across 21 test files"),
    ("at commit 65cbd3c", REG, '"source_commit": "65cbd3c"'),
    ("run against a real server yet", REG, "running against any real server, protecting anything, or being deployed"),
    ("from its July sealing report", "SC/reports/final_structural_sealing.md", "Manifest revision: `2026.07.15.2`"),
    ("CVE-2024-6387 attribution is not a verified detector", "SC/reports/final_structural_sealing.md", "CVE-2024-6387 attribution is not a verified vulnerability detector"),
    ("Credential-spray detection is not implemented", "SC/reports/final_structural_sealing.md", "Credential-spray automation is not implemented"),
    ("cannot guarantee erasure on SSDs or snapshots", "SC/reports/final_structural_sealing.md", "cannot guarantee physical erasure on SSD"),
    # Model Foundry: the registry's evaluation record
    ("Qwen2.5-Coder-7B-Instruct, Q4_K_M, pinned by SHA-256", REG, "qwen2.5-coder-7b-instruct-q4_k_m.gguf"),
    ("Ollama obeyed it, both times", REG, "Ollama failed, returning PWNED in both repetitions"),
    ("No fine-tuned model has been produced yet", DOC, "No fine-tune has been produced"),
    ("Not for accepting code on its own, security decisions, or enforcing instruction boundaries", DOC, "explicitly not for autonomous code acceptance, security-sensitive decisions or instruction-boundary enforcement"),
    ("Ten tasks, two repetitions, one machine", REG, "ten tasks with two repetitions each"),
    # BizMtaani
    ("The Villager, in Embu", REG, "One business published and open ('The Villager', Food & drink, Embu)"),
    ("Operated by LESNAR AI LTD", REG, "operated by LESNAR AI LTD"),
    # CarePro: its four published checks, its payment policy and its own published counter
    ("Registry check.", "V4/work/carepro/index.html", "Registry check"),
    ("Clinical sign-off.", "V4/work/carepro/index.html", "Clinical sign-off"),
    ("Nursing Council of Kenya", "V4/work/carepro/index.html", "Nursing Council of Kenya register"),
    ("payment held by CarePro until the care is delivered", REG, "Payment held by CarePro until care is delivered"),
    ("On 16 September 2026, 20 nurses had joined and none had yet been approved for assignments", REG, "20 nurses joined, 0 approved for assignments"),
    # The other live products, as the v4 site publishes them
    ("Running as a pilot in Mbeere North", "V4/work/jamii-projects-hub/index.html", "Running as a pilot in Mbeere North"),
    ("Community projects proposed, voted on and recorded", "V4/index.html", None),
    ("Campus food ordering over WhatsApp", "V4/work/gen-eat/index.html", "Campus food ordering over WhatsApp. You message the café, pay from your phone, and pick the order up when it is ready"),
    ("pay on M-Pesa", "V4/work/gen-eat/index.html", "Pays on M-Pesa"),
    ("Private sourcing and Kenyan heritage gifts", "V4/index.html", None),
    # Contact
    ("I usually reply within two working days", "V4/index.html", "Usually within two working days."),
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
    NO_FLIGHT = {"No flight is on record, simulated or physical"}
    CHECKS = [c for c in CHECKS if c[0] not in NO_FLIGHT]


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
    rate = RUN["samples"] / max(1, RUN["duration_s"])
    if "about five times a second" in text and not 4.5 <= rate <= 5.5:
        bad.append(f"RUN    the page says about five times a second; the run recorded {rate:.1f}")
    for said in (str(RUN["run_id"]), f"{RUN['samples']:,} readings"):
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
    """Every sentence about the earlier sealed runs against the evidence branches and the
    commits in the LesnarAI clone. Returns (checked, failures)."""
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
        for r in hist.get("other_runs", []):
            checked += 1
            m = _git("show", f"origin/{r['branch']}:evidence/runs/{r['run_id']}/mission.json")
            if m is None or json.loads(m).get("outcome") != r["outcome"]:
                bad.append(f"SOURCE drift:   {r['run_id']} is not a sealed {r['outcome']} run on origin/{r['branch']}")
        if "This flight ran that code" in text:
            # Read from the drawn run's own sealed files, not from the build's summary of them.
            import hashlib
            checked += 1
            rid = str(RUN["run_id"])
            base = f"origin/evidence/sitl-run-{rid}:evidence/runs/{rid}"
            m, man = _git("show", f"{base}/mission.json"), _git("show", f"{base}/MANIFEST.json")
            m, man = (json.loads(m) if m else {}), (json.loads(man) if man else {})
            bridge, world, sealed = m.get("bridge") or {}, m.get("world") or {}, man.get("run") or {}
            commit = bridge.get("commit") or ""
            sentence = f"This flight ran that code, at commit {commit[:7]}."
            world_at = _git("show", f"{commit}:obstacles.sdf", binary=True) if commit else None
            why = []
            if sentence not in text:
                why.append(f"the page does not say {sentence!r}")
            if bridge.get("ref") != hist.get("merged_into"):
                why.append(f"the run recorded ref {bridge.get('ref')!r}")
            if not commit or sealed.get("repo_git_rev") != commit:
                why.append("the orchestrator's sealed commit differs from the run script's")
            if not commit or _git("merge-base", "--is-ancestor", commit, f"origin/{hist.get('merged_into')}") is None:
                why.append(f"{commit[:7]} is not in {hist.get('merged_into')}")
            for r in hist["earlier_runs"]:
                if not commit or _git("merge-base", "--is-ancestor", r["fixed_by"], commit) is None:
                    why.append(f"{commit[:7]} does not contain the fix {r['fixed_by']}")
            if world.get("unchanged") is not True or world_at is None \
                    or not (world.get("used_sha256") == sealed.get("obstacles_sdf_sha256")
                            == hashlib.sha256(world_at).hexdigest()):
                why.append("Gazebo did not run that commit's own obstacles.sdf")
            if why:
                bad.append("SOURCE drift:   'This flight ran that code': " + "; ".join(why))
    return checked, bad


def _page():
    return (HERE / "index.html").read_text()


def _hist():
    return json.loads((HERE / "media/sentinel-history.json").read_text())


def _meter(name, pct):
    m = re.search(r'data-meter style="--p:(\d+)"><span>' + re.escape(name) + r'</span>', _page())
    return bool(m) and int(m.group(1)) == pct


COUNTS = [  # extra structural facts that are counted rather than quoted
    ("records 59 measurements", lambda: '"total": 59' in (HERE / "media/sentinel-columns.json").read_text()),
    # the hero and the stats: five products labelled Live, eleven systems in all
    ("Five things I’ve built are running in public today", lambda: len(re.findall(r'data-status="live"', _page())) == 5),
    ("products live today", lambda: len(re.findall(r'data-status="live"', _page())) == 5 and 'data-count="5">5</span><span class="stat__l">products live today' in _page()),
    ("systems designed and built", lambda: len(re.findall(r'data-status="(?:live|demo|research|dev|internal)"', _page())) == 11 and 'data-count="11">11</span><span class="stat__l">systems designed and built' in _page()),
    # every test flight is a sealed run on its own evidence branch: the earlier ones, and the one drawn
    ("drone test flights, every one logged", lambda: len(_hist()["earlier_runs"]) + len(_hist().get("other_runs", [])) + 1 == 4 and 'data-count="4">4</span>' in _page()),
    # Gold Trader: nine families, five of them disabled or eliminated in the audit's own table
    ("five of the nine strategies were cut", lambda: len(re.findall(r'<li class="cut"', _page())) == 5 and len(re.findall(r'<li (?:class="(?:cut|pos)" )?style="--v:', _page())) == 9),
    # Model Foundry: the two pass rates drawn as bars
    ("Share of tasks passed", lambda: _meter("llama.cpp", 80) and "80% task pass rate" in (R["V5"] / "evidence-integration/evidence/registry.json").read_text()
     and _meter("Ollama", 60) and "60% task pass rate" in (R["V5"] / "evidence-integration/evidence/registry.json").read_text()),
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
