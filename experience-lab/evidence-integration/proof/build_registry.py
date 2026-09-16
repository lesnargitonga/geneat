# -*- coding: utf-8 -*-
"""Phase 9 · builds evidence/registry.json from real files and real checks.
   Hashes are computed from the bytes on disk. Nothing here is hand-typed."""
import hashlib, io, json, os, subprocess, datetime

TZ = "+03:00 Africa/Nairobi"
CAP = "2026-09-16"

def sha(p):
    if not os.path.exists(p): return None
    return hashlib.sha256(io.open(p, "rb").read()).hexdigest()

def commit(repo):
    try:
        return subprocess.run(["git","-C",repo,"rev-parse","--short","HEAD"],
                              capture_output=True, text=True, timeout=10).stdout.strip() or None
    except Exception:
        return None

E = []
def ev(**k):
    k.setdefault("captured_at", CAP); k.setdefault("timezone", TZ)
    for f in ("asset_path","original_asset_path","derivative_asset_path"):
        k.setdefault(f, None)
    # hash the derivative if there is one, else the asset, else the original
    src = k.get("derivative_asset_path") or k.get("asset_path") or k.get("original_asset_path") or ""
    k["content_hash"] = sha(src)
    k["hashed_file"] = src or None
    if k.get("original_asset_path") and src != k["original_asset_path"]:
        k["original_hash"] = sha(k["original_asset_path"])
    E.append(k)

# ── CarePro ───────────────────────────────────────────────────────────────
ev(evidence_id="EV-CAREPRO-VERIFY-01", system="CarePro",
   claim_ids=["C-CAREPRO-VERIFY","C-CAREPRO-COUNTS","C-ENG-SAYNOT"],
   maturity_at_capture="Live", evidence_strength="Published",
   source_type="real public product surface", source_location="https://carepro.co.ke/",
   public_safe=True, route_or_artifact="/ (home)",
   measurement_method=None,
   shows="The four named verification stages CarePro publishes — 01 Credentials, 02 Registry check, "
         "03 Interview, 04 Clinical sign-off — and, in the same panel, the two counters it publishes: "
         "20 nurses joined, 0 approved for assignments.",
   does_not_show="Traffic, revenue, uptime, scale, number of families served, any completed booking, "
                 "or that any nurse has ever been assigned. 0 approved means no nurse had been approved "
                 "at capture time.",
   privacy_notes="Contains no nurse, patient or customer data. No names, no photographs of people, no "
                 "identifiers, no account state. Inspected field by field before marking public_safe.",
   limitations="Published by the product, not measured by us. A published count is what the product "
               "chose to display at one moment on one day.",
   original_asset_path="evidence/originals/carepro-home-1440.png",
   derivative_asset_path="evidence/web/carepro-verification-2026-09-16.png",
   freshness_note="Counter values are time-sensitive. 19/0 on 2026-09-06 (Phase 7); 20/0 on 2026-09-16.")

ev(evidence_id="EV-CAREPRO-PAYMENT-01", system="CarePro",
   claim_ids=["C-CAREPRO-PAYMENT"], maturity_at_capture="Live", evidence_strength="Published",
   source_type="real public product surface", source_location="https://carepro.co.ke/",
   public_safe=True, route_or_artifact="/ (home, hero sub-line)",
   shows="CarePro publishes, as visible text: 'Payment held by CarePro until care is delivered · "
         "M-Pesa · never any direct cash to caregivers'.",
   does_not_show="That any payment has been held, released, or processed. It is a published policy "
                 "statement, not a transaction record.",
   privacy_notes="No payment identifiers, no transaction references, no customer data.",
   limitations="Published policy. We have not measured the escrow behaviour and do not claim to.",
   original_asset_path="evidence/originals/carepro-home-1440.png",
   freshness_note="Correction: a Phase 7-era check of the LESNAR AI study's own HTML found no "
                  "occurrence of this sentence and it was treated as unsupported. It is published "
                  "text on the product today and is verifiable at the source above.")

# ── BizMtaani ─────────────────────────────────────────────────────────────
ev(evidence_id="EV-BIZ-ROLES-01", system="BizMtaani",
   claim_ids=["C-HOME-HANDOFF-SOURCE","C-BIZ-DESC","C-BIZ-OPERATOR"],
   maturity_at_capture="Live", evidence_strength="Published",
   source_type="real public product surface", source_location="https://bizmtaani.com/",
   public_safe=True, route_or_artifact="/ (home, footer)",
   shows="BizMtaani's published role structure, organised as BUYING (browse businesses, your orders, "
         "your account), SELLING (apply to join, business sign-in, what it costs) and 'Ride or drive'. "
         "Also the operator line: '© 2026 BizMtaani, operated by LESNAR AI LTD'.",
   does_not_show="A navigation literally labelled 'customer, merchant, rider'. The three parties are "
                 "published, but as buying/selling/riding functions, not as three named nav items.",
   privacy_notes="Company contact details shown (0715 540 653, hello@lesnarai.co.ke) are the same "
                 "deliberately public contacts already published in the LESNAR AI site footer.",
   limitations="Establishes which parties the product addresses. It does not establish ordering, "
               "state names, or that responsibility passes at any particular point.",
   original_asset_path="evidence/originals/bizmtaani-home-1440.png",
   derivative_asset_path="evidence/web/bizmtaani-roles-2026-09-16.png")

ev(evidence_id="EV-BIZ-FLOW-01", system="BizMtaani",
   claim_ids=["C-HOME-HANDOFF-SOURCE"], maturity_at_capture="Live", evidence_strength="Published",
   source_type="real public product surface", source_location="https://bizmtaani.com/",
   public_safe=True, route_or_artifact="/ (home, hero + merchant panel)",
   shows="Two published sentences that carry the flow: 'Find a local business, order and pay from your "
         "phone. Kiosks, supermarkets, farms, butcheries, electronics shops and kitchens sell here, and "
         "riders carry it.' and, for merchants, 'Orders arrive on a screen built for a counter'.",
   does_not_show="Five separately named stages. The flow is published as prose and as product "
                 "structure, not as a five-step published sequence.",
   privacy_notes="No merchant private data, no orders, no customer records.",
   limitations="Supports the actions and the parties. The ORDER of responsibility, and the two handoff "
               "points, remain our interpretation — which is what the record already says.",
   original_asset_path="evidence/originals/bizmtaani-home-1440.png")

ev(evidence_id="EV-BIZ-INVENTORY-01", system="BizMtaani",
   claim_ids=["C-BIZ-MATURITY"], maturity_at_capture="Live", evidence_strength="Published",
   source_type="real public product surface", source_location="https://bizmtaani.com/",
   public_safe=True, route_or_artifact="/ (home, category index)",
   shows="One business published and open ('The Villager', Food & drink, Embu) with five priced items. "
         "Food & drink shows '1 business'. Six other trade categories show 'OPEN TO APPLY'.",
   does_not_show="Any order, any transaction, any customer, any revenue, or any second merchant.",
   privacy_notes="Merchant is a publicly listed business on a public marketplace; prices are public.",
   limitations="A published listing count at one moment. It is not traction and not usage.",
   original_asset_path="evidence/originals/bizmtaani-home-1440.png",
   freshness_note="Listing counts change as merchants join. Value is dated to capture.")

# ── SentinelCore ──────────────────────────────────────────────────────────
ev(evidence_id="EV-SENTINEL-TESTS-01", system="SentinelCore",
   claim_ids=["C-SENTINEL-DESC","C-SENTINEL-STRUCTURE","C-ENG-MEASURE"],
   maturity_at_capture="Internal", evidence_strength="Measured",
   source_type="controlled measurement", source_location="local repository, not published",
   public_safe=True, route_or_artifact="pytest run, 21 test files",
   source_commit=commit("/home/lesnar/Documents/Cyber"),
   measurement_method="python3 -m pytest tests -q on the SentinelCore repository at the commit "
                      "recorded here, on a local Linux workstation, 2026-09-16. No network target "
                      "was scanned and no host was modified.",
   shows="133 tests passed, 0 failed, in 21.87s across 21 test files covering detection, exposure "
         "graph, monitoring, evidence legal hold, offensive lifecycle and safety, and owned-source "
         "connectors.",
   does_not_show="Operational use. It does not show SentinelCore running against any real server, "
                 "protecting anything, or being deployed. A passing suite proves the implementation "
                 "behaves as its own tests specify — nothing about the world.",
   privacy_notes="Only the pass/fail summary is published. No hostnames, IPs, paths, configuration, "
                 "scan targets, findings or topology are included.",
   limitations="Measured on one machine on one day at one commit. Not a reliability or uptime claim.",
   asset_path="evidence/originals/sentinelcore-tests.txt",
   freshness_note="Re-runnable. Tied to the recorded commit.")

ev(evidence_id="EV-SENTINEL-STRUCT-01", system="SentinelCore",
   claim_ids=["C-SENTINEL-STRUCTURE"], maturity_at_capture="Internal", evidence_strength="Structural",
   source_type="implementation / repository structure", source_location="private repository",
   public_safe=True, route_or_artifact="module layout named in the repository's own README",
   source_commit=commit("/home/lesnar/Documents/Cyber"),
   shows="An orchestrator (cli.py) and five modules named by the repository itself: scanner, monitor, "
         "firewall, remediator, telemetry. 242 tracked files.",
   does_not_show="Deployment, operation, or that any module has run outside tests.",
   privacy_notes="Module names only. No source, no configuration, no infrastructure detail.",
   limitations="Structural evidence proves the code exists in that shape. Not that it is used.")

# ── Aerial ────────────────────────────────────────────────────────────────
ev(evidence_id="EV-AERIAL-SIM-01", system="Aerial systems",
   claim_ids=["C-AERIAL-MATURITY","C-AERIAL-DESC"],
   maturity_at_capture="Research", evidence_strength="Structural",
   source_type="simulation artifact", source_location="local workspace, not published",
   public_safe=True, route_or_artifact="drone_simulation/ — simulator.py (580 lines), main.py, one geojson",
   shows="An original flight-simulation module modelling drone state (position, altitude, heading, "
         "speed, battery, armed, mode, in_air, mission type) with mission handling. Authored in-house.",
   does_not_show="Any flight. No hardware, no airframe, no field test, no PX4/SITL integration, "
                 "no control-law validation, and no aircraft of any kind.",
   privacy_notes="No location data published; the geojson is not published.",
   limitations="A kinematic state simulation, not a control-system proof. 'Nothing flown remains "
               "nothing flown.'")

# ── Gold Trader ───────────────────────────────────────────────────────────
ev(evidence_id="EV-GOLD-GATE-01", system="Gold Trader",
   claim_ids=["C-GOLD-MATURITY"], maturity_at_capture="Research", evidence_strength="Structural",
   source_type="implementation / repository structure", source_location="local repository, not published",
   public_safe=True, route_or_artifact="README status table + src/gold_trader/live/",
   source_commit=commit("/home/lesnar/Gold-Trader"),
   shows="The project's own status table gates live execution off: 'Live | Paper yes, live no — until "
         "20+ forward Grade-A trades confirm edge' and 'Grade | A only — B paper-only, C/D blocked'. "
         "No executed-trade records exist in the repository.",
   does_not_show="That live execution is impossible. A live broker path is implemented "
                 "(mt5_broker.py beside paper_broker.py) and the code carries LIVE_RISK_USD = 30.0. "
                 "The capability exists and is gated, not absent.",
   privacy_notes="No broker credentials, account identifiers, balances or positions are reproduced.",
   limitations="Structural. It shows how the system is configured and gated, not what it has done.")

# ── platform / engineering ────────────────────────────────────────────────
ev(evidence_id="EV-REACH-01", system="(platform)",
   claim_ids=["C-HOME-FIVE-PUBLIC","C-WORK-FIVE-PUBLIC","C-ENG-MEASURE"],
   maturity_at_capture="n/a", evidence_strength="Measured",
   source_type="controlled measurement", source_location="build/review artifact only",
   public_safe=False, route_or_artifact="evidence/originals/reachability.txt",
   measurement_method="One HTTP GET per URL, curl, 12s timeout, redirects followed, no auth, from a "
                      "Nairobi client, 2026-09-16T06:24:58Z. Single sample, not a monitor.",
   shows="Five claimed public surfaces each returned HTTP 200 on one request: carepro.co.ke, "
         "bizmtaani.com, jamii.lesnarai.co.ke, geneat.lesnarai.co.ke, hazina.lesnarai.co.ke.",
   does_not_show="Uptime, availability, reliability, usage, or that anything works beyond returning a "
                 "page. A 200 is one response at one instant.",
   privacy_notes="INTERNAL_ONLY. No credentials used, no authenticated route touched, nothing "
                 "submitted — but the file records one non-product infrastructure hostname "
                 "(a Render service URL), which is not something the corporate site should "
                 "republish. The five PRODUCT domains it measures are themselves public; the "
                 "claim they support is public, the artifact is not.",
   limitations="Single sample. Explicitly not an uptime claim. This is a build/review artifact and "
               "creates no client-side telemetry on the corporate site.",
   asset_path="evidence/originals/reachability.txt")

ev(evidence_id="EV-PLATFORM-SEPARATION-01", system="(platform)",
   claim_ids=["C-ENG-SEPARATE-RUNTIME"], maturity_at_capture="Live", evidence_strength="Structural",
   source_type="internal running system / documentation of record",
   source_location="docs/SYSTEM.md in the platform repository; public DNS", public_safe=True,
   route_or_artifact="status matrix, 'Dedicated Hazina API service'; five product domains",
   source_commit=commit("/home/lesnar/Documents/ai model"),
   shows="Five live systems publish on five distinct product domains. For TWO of them — Gen-Eat and "
         "Hazina — the platform's own status document records dedicated service and data-store "
         "separation: Hazina runs a dedicated API service with its own Postgres and its own "
         "key-value store, separate from the shared Gen-Eat API.",
   does_not_show="Service, database or runtime separation for CarePro, BizMtaani or Jamii. Those are "
                 "separate repositories on separate domains, which is NOT proof of a distinct "
                 "database or a distinct service runtime. It also does not show cross-database "
                 "denial, enforced data isolation, or isolated cache namespaces for any system — "
                 "no such enforcement appears in the platform documentation, code or tests.",
   privacy_notes="No environment values, hostnames, regions-as-addresses, credentials or connection "
                 "strings are reproduced. Only the fact of separation, for the two systems where it "
                 "is documented.",
   limitations="Documented separation covers two of five live systems. The public claim was narrowed "
               "in Phase 10A to match this exactly rather than generalising from repository and "
               "domain differences.")

io.open("evidence/registry.json","w",encoding="utf-8").write(
    json.dumps({"phase":"9","generated":CAP,"timezone":TZ,
                "note":"Generated by proof/build_registry.py. Hashes computed from bytes on disk.",
                "evidence":E}, indent=1, ensure_ascii=False))
print(f"registry: {len(E)} evidence objects")
for e in E:
    print(f"  {e['evidence_id']:<30} {e['evidence_strength']:<10} "
          f"public_safe={str(e['public_safe']):<5} hash={(e['content_hash'] or '—')[:12]}")
