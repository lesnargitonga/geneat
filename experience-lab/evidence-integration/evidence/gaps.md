# PHASE 9 — EVIDENCE GAPS

Gaps are a first-class output. None of these is closed with invented proof.
Each says whether the public claim must be weakened now, whether a future
measurement can close it, or whether only real operational progress can.

---

## G-01 · Greenhouse controller has no artifact of any kind
**Claim/system:** `C-GREENHOUSE-MATURITY` — "Pilot · owner-reported embedded control."
**Evidence needed:** firmware or controller source, a photograph of the installation,
a sensor log, a control trace, or any dated owner statement recorded as such.
**Why current evidence is insufficient:** nothing was found on this machine — no
repository, no firmware, no logs, no images. The sole basis is the owner's report.
**Must the public claim be weakened now?** No. The site already labels it
owner-reported and Pilot, which is the correct strength for an owner report. It is
not overclaiming. But if challenged, there is nothing to show.
**Closable by future measurement?** Yes — a single dated photograph plus one
temperature/watering log would move this from owner-reported to Structural.
**Requires real operational progress?** No. The pilot reportedly exists; the
evidence simply has never been captured.

**PATH B, taken in Phase 9A.** No traceable, dated owner statement exists and none was invented.
A prior website version (artifact-first v7.2, 2026-08-09) restates the same attestation, but that
is the site citing an earlier version of itself — circular, not evidence. The claim therefore
**stays on the site, explicitly labelled owner-reported**, and is counted as the **one
unsupported-by-artifact claim still published**. An owner report is deliberately not promoted to
Measured, Published or Structural; those three remain the only evidence strengths. The gap is
exposed rather than hidden, which is the successful outcome — not a cosmetic zero.

---

## G-02 · No failure-isolation experiment exists
**Claim:** `C-ENG-MEASURE` — "Failure isolation was tested by stopping one service and
watching the others answer. The result is published."
**Evidence needed:** a real controlled fault test — stop one service, record what the
others return, publish method, date, environment and result.
**Why current evidence is insufficient:** no such test exists. The nearest artifacts
are resilience *contract* tests that assert on source text (e.g. that `asyncio.wait_for`
encloses an AI turn). Those are structural assertions about code, not a service-stopping
experiment. No result is published anywhere.
**Must the public claim be weakened now?** **Yes.** This is the one place the site
currently sounds more certain than the company can prove. Corrected in this study.
**Closable by future measurement?** Yes, and cheaply — the platform runs as separate
services, so the test is genuinely performable and would be strong Measured evidence.
**Requires real operational progress?** No.

---

## G-03 · Cross-database denial and cache-namespace isolation are asserted, not evidenced
**Claim:** `C-ENG-SEPARATE-RUNTIME`.
**Evidence needed:** a test or configuration showing one service is *denied* access to
another's database, and that cache namespaces are separated by an enforced prefix.
**Why current evidence is insufficient:** neither term, nor any equivalent enforcement,
appears in the platform documentation, application code or test suite. Separation of
*deployment* is well evidenced; separation as an *enforced boundary* is not.
**Must the public claim be weakened now?** **Yes** — for those two phrases only.
"Separate runtimes" stands on its own evidence.
**Closable by future measurement?** Yes — a negative-access test would settle it.

---

## G-04 · Aerial evidence supports a narrower claim than the site once made
**Claim:** `C-AERIAL-MATURITY`.

**CURRENT CLAIM — CORRECTED AND SUPPORTED.** The public wording now reads "Research into drone
state and mission simulation, modelled in software rather than flown in the air", and the record
was rewritten with it. That sentence is fully supported by `EV-AERIAL-SIM-01`: one original
580-line module modelling position, altitude, heading, speed, battery, armed state, flight mode
and mission. **This is no longer an unresolved public gap.**

What was removed, because no artifact supports it: "aircraft and flight control"; an Unreal
simulation; "an upstream flight stack, present and running in simulation"; and "control and flight
behaviour worked on inside that simulation". The record's *Not claimed* block now names the absent
things explicitly — no control laws, no flight-controller work, no SITL or HITL run, no logged
simulated flight, no hardware.

**Standing constraint:** `PX4-Autopilot` on this machine is an unmodified third-party upstream
clone — 53,525 commits, none by this account, clean working tree. It is cited nowhere in the study
and must never be used as LESNAR AI evidence.

**FUTURE OPPORTUNITY — not a current gap.** A logged simulation run, or genuine control-law work,
would support a stronger future claim. Nothing needs to change on the site until that exists.

---

## G-05 · No commercial evidence of any kind
**Claim:** none — and that is the correct current state.
**Evidence needed:** revenue, transactions, retention, contracts, named clients.
**Why current evidence is insufficient:** none exists in any form. CarePro publishes
**0 nurses approved**; BizMtaani publishes **one** listed business. Neither has evidence
of a completed transaction.
**Must the public claim be weakened now?** No — the site makes no commercial claim.
This gap is listed so the absence is deliberate and on the record, not an oversight.
**Requires real operational progress?** **Yes.** This is the one gap documentation
cannot close. No amount of capture work produces traction.

---

## G-06 · Documentary photography does not exist
**Claim:** `C-CO-PHOTOGRAPHY` — the Company page states the slot is unfilled.
**Evidence needed:** real photographs of the founder, the work and the environment.
**Why current evidence is insufficient:** none exist. Phase 9 may not create substitutes,
and did not. No stock, no render, no AI-generated image was introduced anywhere.
**Requires real operational progress?** It requires a real commission, not code.

---

## G-07 · Cypher exists as delivered bundles, not an operated repository
**Claim:** `C-CYPHER-MATURITY`.
**Evidence needed:** a version-controlled repository, or a dated run of the governance
spine.
**Why current evidence is insufficient:** the artifacts are extracted sprint bundles in
a downloads directory (to sprint 024). Real, and consistent with Research — its own
notes describe a "sandbox channel contract without live sending" — but weaker than the
structural evidence behind the other systems.
**Must the public claim be weakened now?** No. Research is already the weakest
maturity that still asserts existence.

---

## G-08 · A 200 is not uptime, and the site has nothing that measures availability
**Claim:** `C-HOME-FIVE-PUBLIC`, `C-WORK-FIVE-PUBLIC`.
**Evidence needed:** sampled availability over time, if availability is ever to be claimed.
**Why current evidence is insufficient:** one HTTP GET per surface on one day. That
supports "has a public surface". It supports nothing about uptime, and the site correctly
claims nothing about uptime.
**Must the public claim be weakened now?** No — the claim is already scoped to existence.
**Note:** Phase 0's architecture stays locked. Any future availability measurement is a
build/review artifact and must not become client-side probing of product origins.
