# -*- coding: utf-8 -*-
"""Phase 9 · claim registry. Material claims only — claims whose truth matters.
   Navigation labels, adjectives and section headings are not registered."""
import io, json
C = []
def c(**k): C.append(k)

S, SQ, UN, ST, CO = ("SUPPORTED","SUPPORTED WITH QUALIFICATION","UNSUPPORTED","STALE","CONTRADICTED")

# ── HOME ──────────────────────────────────────────────────────────────────
c(claim_id="C-HOME-FIVE-PUBLIC", route="/", system=None,
  claim="Five systems have a public surface.",
  evidence_ids=["EV-REACH-01"], strongest="Measured", status=S,
  note="Five distinct public surfaces each returned 200 on 2026-09-16 and each renders its own real "
       "product: CarePro, BizMtaani, Jamii Projects Hub, Gen-Eat, Hazina Nomads.")
c(claim_id="C-HOME-ELEVEN", route="/", system=None,
  claim="Eleven systems in the register.",
  evidence_ids=[], strongest="Structural", status=S,
  note="Self-referential and checkable on the page: the register lists eleven.")
c(claim_id="C-HOME-HANDOFF-SOURCE", route="/", system="BizMtaani",
  claim="Source fact: BizMtaani publishes these five stages, and the three roles — customer, "
        "merchant, rider — in its own navigation.",
  evidence_ids=["EV-BIZ-ROLES-01","EV-BIZ-FLOW-01"], strongest="Published", status=CO,
  note="CONTRADICTED IN PART. The three parties ARE published, but as BUYING / SELLING / 'Ride or "
       "drive' functions, not as a navigation labelled customer/merchant/rider. The five stages are "
       "published as prose and product structure, not as five named stages. The actions themselves "
       "hold up — including 'Orders arrive on a screen built for a counter', which supports the shop "
       "step better than the current wording does. Source fact needs rewording; the INTERPRETATION "
       "and LIMIT blocks remain correct and unchanged.")
c(claim_id="C-HOME-CAREPRO-QUAL", route="/", system="CarePro",
  claim="CarePro publishes 19 nurses joined and 0 approved for assignments — the values on the day "
        "of capture.",
  evidence_ids=["EV-CAREPRO-VERIFY-01"], strongest="Published", status=ST,
  note="STALE. Published value is now 20 joined, 0 approved (2026-09-16). The 0 is unchanged. The "
       "caption's own 'on the day of capture' framing is what makes this a refresh, not an error.")

# ── WORK / register ───────────────────────────────────────────────────────
c(claim_id="C-WORK-FIVE-PUBLIC", route="/work/", system=None,
  claim="Live — five systems with a public surface.",
  evidence_ids=["EV-REACH-01"], strongest="Measured", status=S)
c(claim_id="C-BIZ-DESC", route="/work/", system="BizMtaani",
  claim="A neighbourhood marketplace: local shops list what they sell, customers order and pay from "
        "a phone, and riders carry the order.",
  evidence_ids=["EV-BIZ-FLOW-01","EV-BIZ-ROLES-01"], strongest="Published", status=S,
  note="Matches the product's own published description almost word for word.")
c(claim_id="C-BIZ-MATURITY", route="/work/", system="BizMtaani",
  claim="BizMtaani · Live.",
  evidence_ids=["EV-REACH-01","EV-BIZ-INVENTORY-01"], strongest="Published", status=SQ,
  note="Deployed, operating and open to apply — Live is correct. Qualification available and not "
       "currently stated: one business is listed, in one of seven trade categories. Live is "
       "maturity, not scale, so this is not a downgrade; but the site should not let a reader infer "
       "a populated marketplace.")
c(claim_id="C-BIZ-OPERATOR", route="/work/", system="BizMtaani",
  claim="BizMtaani is a LESNAR AI system.",
  evidence_ids=["EV-BIZ-ROLES-01"], strongest="Published", status=S,
  note="The product's own footer: '© 2026 BizMtaani, operated by LESNAR AI LTD'.")
c(claim_id="C-GOLD-MATURITY", route="/work/", system="Gold Trader",
  claim="Research into automated gold trading, tested only on paper — it places no real orders with "
        "anyone's money.",
  evidence_ids=["EV-GOLD-GATE-01"], strongest="Structural", status=S,
  note="SUPPORTED by the project's own status table: 'Live | Paper yes, live no — until 20+ forward "
       "Grade-A trades confirm edge', and 'Grade | A only — B paper-only, C/D blocked'. No executed "
       "trade records exist anywhere in the repository. Qualification worth knowing internally: a "
       "live broker path is implemented (mt5_broker.py alongside paper_broker.py) and the code "
       "carries LIVE_RISK_USD = 30.0, so the capability exists and is gated off rather than absent. "
       "The site's present-tense claim is accurate as the system is currently gated and operated.")
c(claim_id="C-AERIAL-MATURITY", route="/work/aerial-systems/", system="Aerial systems",
  claim="Research into drone state and mission simulation, modelled in software rather than flown "
        "in the air.",
  evidence_ids=["EV-AERIAL-SIM-01"], strongest="Structural", status=S,
  note="CORRECTED IN PHASE 9A and now fully supported by EV-AERIAL-SIM-01. The previous wording "
       "claimed 'aircraft and flight control'; the record additionally claimed an Unreal simulation "
       "running on an upstream open-source flight stack, with control and flight behaviour worked on "
       "inside it. None of that is evidenced. The artifact is one original 580-line module modelling "
       "drone state and mission, which is exactly what the corrected sentence says. The record's "
       "'Not claimed' block now names the absent things explicitly: no control laws, no "
       "flight-controller work, no SITL or HITL run, no logged simulated flight, no hardware. "
       "PX4-Autopilot on this machine is an unmodified third-party clone and is cited nowhere.")
c(claim_id="C-GREENHOUSE-MATURITY", route="/work/", system="Greenhouse controller",
  claim="Pilot — owner-reported embedded control for a greenhouse: temperature, moisture and "
        "watering, unattended.",
  evidence_ids=[], strongest=None, status=UN,
  note="PATH B. No traceable, dated owner statement exists, and none was invented. A prior website "
       "version (artifact-first v7.2, 2026-08-09) restates the same attestation, but that is the "
       "site citing an earlier version of itself — circular, and not evidence. The only basis is the "
       "owner's report, which the public wording states plainly. The claim therefore remains "
       "UNSUPPORTED BY ARTIFACT and stays on the site, openly labelled. That is an exposed gap, not "
       "a hidden one. It would only be removed if the owner-report basis were found to be false.")
c(claim_id="C-SENSING-MATURITY", route="/work/", system="Sensing and radar",
  claim="A stated direction we intend to work in. Nothing is built yet.",
  evidence_ids=[], strongest=None, status=S,
  note="The absence of evidence IS the claim, and it matches: nothing was found, and nothing is "
       "claimed. The strongest truthful evidence type here is truthful absence.")
c(claim_id="C-CYPHER-MATURITY", route="/work/", system="Cypher",
  claim="Research — rules about what an AI system is allowed to do, and a person who has to approve "
        "it before anything happens.",
  evidence_ids=[], strongest="Structural", status=SQ,
  note="A real artifact set exists (cypher_governance_spine, sprints to 024) and its own sprint notes "
       "describe a 'sandbox channel contract without live sending' — consistent with Research. It "
       "exists as delivered bundles rather than an operated repository, which is weaker than the "
       "other systems' structural evidence but not contradictory.")

# ── CarePro record ────────────────────────────────────────────────────────
c(claim_id="C-CAREPRO-VERIFY", route="/work/carepro/", system="CarePro",
  claim="CarePro publishes four verification steps on its own surface, in this order, as named steps.",
  evidence_ids=["EV-CAREPRO-VERIFY-01"], strongest="Published", status=S,
  note="Verified verbatim: 01 Credentials, 02 Registry check, 03 Interview, 04 Clinical sign-off.")
c(claim_id="C-CAREPRO-COUNTS", route="/work/carepro/", system="CarePro",
  claim="19 nurses joined, 0 approved for assignments — the live values on the day of capture.",
  evidence_ids=["EV-CAREPRO-VERIFY-01"], strongest="Published", status=ST,
  note="Same refresh as C-HOME-CAREPRO-QUAL: now 20 / 0.")
c(claim_id="C-CAREPRO-PAYMENT", route=None, system="CarePro",
  claim="(not currently on the site) Payment is held by CarePro until care is delivered.",
  evidence_ids=["EV-CAREPRO-PAYMENT-01"], strongest="Published", status=S,
  note="NEWLY SUPPORTED. Published as visible text on carepro.co.ke today. An earlier check in this "
       "programme searched the LESNAR AI study's own HTML, found nothing, and treated the sentence as "
       "unsupported — correctly, at the time, for the site. It is verifiable at the product now, so "
       "it is available for use if wanted. Still Published, never Measured.")
c(claim_id="C-CAREPRO-MATURITY", route="/work/carepro/", system="CarePro",
  claim="CarePro · Live.",
  evidence_ids=["EV-REACH-01","EV-CAREPRO-VERIFY-01"], strongest="Published", status=S,
  note="Real deployed product with services, prices, verification structure and public counters. "
       "Live is maturity, not health: 0 nurses are approved, which the site already publishes.")

# ── SentinelCore record ───────────────────────────────────────────────────
c(claim_id="C-SENTINEL-DESC", route="/work/sentinelcore/", system="SentinelCore",
  claim="The studio's own tool for checking a Linux server is safe: it scans for open doors, watches "
        "the logs for trouble and tightens the settings that matter.",
  evidence_ids=["EV-SENTINEL-STRUCT-01","EV-SENTINEL-TESTS-01"], strongest="Measured", status=S,
  note="scanner / monitor / firewall+remediator map to scanning, log watching and hardening.")
c(claim_id="C-SENTINEL-STRUCTURE", route="/work/sentinelcore/", system="SentinelCore",
  claim="Five modules and one orchestrator, named as the repository names them.",
  evidence_ids=["EV-SENTINEL-STRUCT-01"], strongest="Structural", status=S,
  note="cli.py orchestrator + scanner, monitor, firewall, remediator, telemetry.")

# ── ENGINEERING ───────────────────────────────────────────────────────────
c(claim_id="C-ENG-SEPARATE-RUNTIME", route="/engineering/", system=None,
  claim="Live systems are deployed and operated as distinct product surfaces rather than handed over "
        "as a repository. Five live systems publish on distinct product domains; Gen-Eat and Hazina "
        "additionally have documented dedicated service and data-store separation. The same service "
        "and database separation has not been independently documented for every live system.",
  evidence_ids=["EV-PLATFORM-SEPARATION-01","EV-REACH-01"], strongest="Structural", status=S,
  note="NARROWED IN PHASE 10A after the executive review upgraded this to MATERIAL. The previous "
       "wording claimed every live product runs on its own service, database and domain. Only "
       "Gen-Eat and Hazina have documented service and data-store separation; for CarePro, BizMtaani "
       "and Jamii the audit established separate repositories and separate domains, which does not "
       "prove a distinct database or runtime. The claim now states the domain fact for all five, the "
       "documented separation for two, and carries the gap as its own limit — so the public wording, "
       "the evidence object and this entry say the same thing with no inference in between.")
c(claim_id="C-ENG-MEASURE", route="/engineering/", system=None,
  claim="Failure isolation was tested by stopping one service and watching the others answer. The "
        "result is published, including what it does not prove.",
  evidence_ids=[], strongest=None, status=UN,
  note="UNSUPPORTED. No such experiment was found in the platform repository, its documentation, its "
       "scripts or its test suites, and no published result exists. The nearest artifacts are "
       "resilience CONTRACT tests, which assert on source text (for example that asyncio.wait_for "
       "encloses an AI turn) — those are structural assertions, not a service-stopping test. The "
       "principle also cites SentinelCore as its demonstration, which is a different system "
       "altogether. Phase 9 can offer a real substitute: the SentinelCore measured test run.")
c(claim_id="C-ENG-SAYNOT", route="/engineering/", system=None,
  claim="Every record states its evidence strength: measured by us, published by the product, or "
        "structural in the product's own surface.",
  evidence_ids=["EV-CAREPRO-VERIFY-01"], strongest="Structural", status=S,
  note="Checkable on the site itself.")
c(claim_id="C-ENG-MEASURED-RARE", route="/engineering/", system=None,
  claim="Measured is rare, and reachability is currently the only thing measured.",
  evidence_ids=["EV-REACH-01","EV-SENTINEL-TESTS-01"], strongest="Measured", status=ST,
  note="STALE once Phase 9 lands: a second measured object now exists (the SentinelCore test run). "
       "The spirit — measured is rare — remains true and worth keeping.")
c(claim_id="C-ENG-DIRECT", route="/engineering/", system=None,
  claim="You work with the engineer who builds the system. One engineer, named, on the Company page.",
  evidence_ids=[], strongest="Structural", status=S,
  note="The Company page names Lesnar Gitonga, Founder and engineer.")

# ── COMPANY ───────────────────────────────────────────────────────────────
c(claim_id="C-CO-LIVE-LIST", route="/company/", system=None,
  claim="Marketplaces, home healthcare, community records, campus ordering and private sourcing are "
        "live.",
  evidence_ids=["EV-REACH-01"], strongest="Measured", status=S,
  note="Maps one-to-one onto the five surfaces measured: BizMtaani, CarePro, Jamii, Gen-Eat, Hazina.")
c(claim_id="C-CO-PHOTOGRAPHY", route="/company/", system=None,
  claim="Documentary photography required — not yet commissioned.",
  evidence_ids=[], strongest=None, status=S,
  note="A truthful stated absence, already on the page. Phase 9 does not fill it and may not.")

# ── what Phase 9 / 9A actually DID about each claim ───────────────────────
ACTION = {
 "C-HOME-HANDOFF-SOURCE": ("CORRECTED", "Source fact reworded to what BizMtaani actually publishes — its own two sentences, and buying/selling/riding as its navigation. Interpretation and Limit unchanged."),
 "C-HOME-CAREPRO-QUAL":   ("CORRECTED", "Refreshed to 20 joined / 0 approved, dated 16 Sep 2026."),
 "C-CAREPRO-COUNTS":      ("CORRECTED", "Same refresh, plus a new dated capture and a Limit line on the record."),
 "C-ENG-MEASURE":         ("CORRECTED", "The non-existent failure-isolation experiment removed from Engineering and Home beat 05, replaced by a measurement actually performed: EV-SENTINEL-TESTS-01."),
 "C-ENG-SEPARATE-RUNTIME":("CORRECTED", "'Cross-database denial' and 'isolated cache namespaces' removed from Engineering and the Infrastructure capability. 'Separate runtimes' retained — it is evidenced."),
 "C-ENG-MEASURED-RARE":   ("CORRECTED", "Now reads 'Measured is rare: reachability, and one test run.'"),
 "C-AERIAL-MATURITY":     ("CORRECTED", "PHASE 9A. Register line, Company sentence and the whole Aerial record rewritten to the evidence. Research maturity unchanged, no image added, record still compact."),
 "C-BIZ-MATURITY":        ("CLOSED — NO PUBLIC CHANGE", "Owner decision taken: Live is maturity, not scale, and the site claims no marketplace scale. No qualification added to the register. EV-BIZ-INVENTORY-01 stays in the registry so the dated one-business finding remains available for challenge."),
 "C-CAREPRO-PAYMENT":     ("CLOSED — NO NEW CLAIM", "Owner decision taken: evidence availability does not write the story. EV-CAREPRO-PAYMENT-01 remains registered as available Published evidence; no corporate-site claim added."),
 "C-GREENHOUSE-MATURITY": ("STANDS — OPENLY LABELLED", "PATH B. No traceable owner statement exists and none was invented. The claim stays, explicitly owner-reported, and is counted as the one unsupported-by-artifact claim still on the site."),
 "C-CYPHER-MATURITY":     ("NO ACTION", "Research is the weakest maturity that still asserts existence; evidence is consistent."),
 "C-GOLD-MATURITY":       ("NO ACTION — MY ERROR CORRECTED", "First flagged CONTRADICTED from the README headline. The project's own status table says 'Paper yes, live no'. The site claim is accurate."),
}
for x in C:
    a = ACTION.get(x["claim_id"])
    if a: x["phase9_action"], x["phase9_action_note"] = a
    else: x["phase9_action"] = "NO ACTION"

# ── post-integration PUBLIC status, derived — never hard-coded ────────────
# A claim the site still makes is unsupported only if it has no evidence, no
# strongest strength, and was not corrected away.
for x in C:
    corrected = x["phase9_action"].startswith("CORRECTED")
    on_site   = x["route"] is not None
    if corrected:            x["public_status"] = "CORRECTED — now supported as written"
    elif not on_site:        x["public_status"] = "NOT ON THE SITE"
    elif x["status"] == UN:  x["public_status"] = "UNSUPPORTED BY ARTIFACT — openly labelled"
    elif x["status"] == SQ:  x["public_status"] = "SUPPORTED WITH QUALIFICATION"
    else:                    x["public_status"] = "SUPPORTED"

io.open("evidence/claims.json","w",encoding="utf-8").write(
    json.dumps({"phase":"9A","generated":"2026-09-16","claims":C}, indent=1, ensure_ascii=False))

from collections import Counter
audit = Counter(x["status"] for x in C)
pub   = Counter(x["public_status"] for x in C)
print(f"claims registered: {len(C)}\n")
print("AUDIT STATUS (what was found)")
for k in (S, SQ, ST, UN, CO): print(f"  {k:<32} {audit.get(k,0)}")
print("\nPOST-INTEGRATION PUBLIC STATUS (the site today)")
for k, v in sorted(pub.items()): print(f"  {k:<42} {v}")
still_unsupported = [x for x in C if x["public_status"].startswith("UNSUPPORTED")]
still_stale       = [x for x in C if x["route"] and x["status"] == ST and not x["phase9_action"].startswith("CORRECTED")]
print(f"\n  DERIVED · unsupported claims still on the site : {len(still_unsupported)}")
for x in still_unsupported: print(f"      {x['claim_id']} — {x['route']}")
print(f"  DERIVED · stale claims still on the site       : {len(still_stale)}")
