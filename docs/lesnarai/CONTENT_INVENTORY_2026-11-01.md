# LESNAR AI portfolio — content inventory

**As of:** 2026-11-01. **Method:** each record was rebuilt from the project's own repository
(GitHub `lesnargitonga/*`, compared with local clones), its documentation, deployment
evidence and existing captures. The September website copy was not used as a source.
**Schema:** the fields required by `PORTFOLIO_ARCHITECTURE_2026-11-01.md` §"Every claim
needs proof". **Stages:** research · prototype · pilot · internal · live.

This file is public. Where a record says *withheld*, the detail was reported to the owner
and is not repeated here. Reachability was not confirmed for several product hosts on
2026-11-01; every public URL must be re-checked before it is linked.

## Summary

| System | Stage | Public treatment now | Page |
|---|---|---|---|
| Operation Sentinel | prototype (simulation only) | project page | `/work/sentinel/` (phase 1) |
| BizMtaani | live (one merchant) | project page later; register row now | existing record |
| CarePro | live (controlled public beta) | register row; LESNAR AI engineering, no ownership claim (D-16) | existing record |
| Zygos | prototype ("demonstrated / pre-production") | project page (phase 3) | — |
| MediMatch | prototype (research; synthetic inventory and synthetic survey) | project page (phase 3); survey shown only as synthetic (D-18) | — |
| Jamii Projects Hub | prototype (deployed; pilot in preparation) | register row | existing record |
| Gen-Eat | prototype (demonstration) | register row | existing record |
| Hazina Nomads | prototype (storefront; service suspended) | register row | existing record |
| LESNAR TV | internal (alpha on the owner's TV) | register row now; page later | — |
| LESNAR PLAY | prototype | register row now; page later | — |
| SentinelCore (with Sentinel Assurance) | internal | register row naming both layers (D-19) | existing record (`/work/sentinelcore/`) |
| Cypher | prototype | register row; page later | existing record (stale) |
| Gold Trader | research (paper only; live orders locked in code) | register row; page later | existing record (stale) |
| Model foundry | internal | Engineering, not Work | Home / Engineering |
| Security-operations platform (client) | pilot | withheld pending client permission | — |
| Optical retail platform (client) | prototype (demonstration) | withheld pending client permission | — |
| Non-profit records platform (client) | prototype | anonymous capability evidence only | — |
| TV Militia | prototype (early) | omit until trademark check | — |
| Elixirs | pilot | capability evidence only; no Work row (ruling) | — |
| Praxis | research | omit (internal codename) | — |
| Greenhouse controller, Sensing/Radar, Simy, Campus Map | — | removed; do not restore | — |

## Records

### Operation Sentinel
- **Problem:** an aircraft's autonomy stack has to fly a mission, avoid what is really
  there, and stay accountable to an operator, without depending on cloud services in flight.
- **Audience:** robotics, defence-adjacent and infrastructure teams evaluating autonomy and
  simulation engineering.
- **Role:** LESNAR AI built the autonomy bridge, mission logic, telemetry pipeline and
  operator console, and integrated PX4, Gazebo and MAVSDK (upstream projects, credited).
- **Stage / as of:** prototype, simulation only · 2026-09-30 (last sealed run).
- **Public evidence:** public repo `lesnargitonga/LesnarAI`; seven sealed SITL runs on
  branches `evidence/sitl-run-px4_teacher_*` (manifest with SHA-256 per file, mission,
  telemetry CSV, world file); fix commits `6a40f0f` (offboard engage), `bcf9e52` (lidar and
  obstacle geometry), `bd81d2e` (stack on plain Linux; world GPS and compass); 87 recorded
  perception diagnostic runs, 13–16 April 2026; Film 001 MC2 and its harness
  (`experience-lab/motion-system/film-001/mc2/`).
- **Key facts:** every sealed run flew the console's training mission, a 25 m box at 10 m.
  Runs 1–2 timed out (≈631 s each) on the original code and on the offboard fix; runs 3–7
  completed (125.6–215.8 s) after the geometry fix. Run 2 held 1.6 m from an obstacle that
  did not exist for nine minutes: the simulated lidar treated a 1 m × 38 m wall as a 19 m
  disc.
- **Limitations:** no physical airframe; no field test; no range or endurance result. The
  sealed runs fly with simulated GPS and compass: GPS-denied estimation is configured
  (EKF2 parameters), not demonstrated. The lidar scan ignores height. Single aircraft. The
  film's opening and layered space are explanatory renderings.
- **Permissions:** public repo and evidence; PX4 x500 model attribution in
  `experience-lab/source-media/sentinel/MODEL-ATTRIBUTION.md`.
- **Primary media:** Film 001 MC2 (`lesnarai-landing/media/sentinel-film-001.{webm,mp4}`,
  27.75 s, poster frames); telemetry figures generated from the sealed runs.
- **Fallback:** poster frame plus the generated figures.
- **CTA:** discuss an autonomy or simulation project.

### BizMtaani
- **Problem:** neighbourhood businesses cannot easily take orders and payments from
  customers' phones. **Audience:** Kenyan local merchants and their customers.
- **Role:** built and operated by LESNAR AI (code in `lesnargitonga/villager`, private).
- **Stage / as of:** live with one merchant (The Villager, Embu — a merchant, not a separate
  project) · 2026-10-27 release.
- **Key facts:** 2,066 tests in 156 files plus 37 database tests at the 27 Oct release;
  multi-merchant isolation and stock contention proven in testing.
- **Limitations:** one merchant trading; riders simulated; enterprise offering not built.
- **Media:** October 2026 phone captures of the live storefront (real menu) and the
  demonstration console (labelled sample data). Exclusions withheld.
- **CTA:** list your business / see The Villager on BizMtaani.

### CarePro
- **Problem:** families who need home nursing cannot easily find verified nurses and
  arrange, pay for and track visits.
- **Role:** LESNAR AI engineered the platform. The site claims no corporate ownership of the service (D-16).
- **Stage / as of:** live as a controlled public beta, real payments · 2026-10-22.
- **Key facts:** nurse verification gates; booking lifecycle with patient details revealed
  only after acceptance; mandatory staff two-factor sign-in; audit browser.
- **Limitations:** small automated test suite; no automated refunds or payout runs.
- **Permissions:** health data and real payments — never capture authenticated screens.
- **Media:** public pages only.

### Zygos
- **Problem:** before you pay a business you found online, you cannot easily tell who is
  behind it or what is known about it.
- **Role:** built and owned by LESNAR AI (private repo).
- **Stage / as of:** prototype, presented as "demonstrated / pre-production" · 2026-10-27.
- **Key facts:** 438 unit, 201 integration and 136 browser tests at milestone 9; an unbroken
  audit chain; a business's own declarations are weighed as evidence, never treated as proof.
- **Limitations:** final demonstration on a real business awaits owner approval; no MFA;
  emulated phones only.
- **Permissions:** never say Zygos "verifies" anyone; never capture the production host;
  demonstration data is fictional and labelled in-app.
- **Media:** October 2026 demonstration captures (fictional records, in-app banner).
- **Narrative:** evidence lineage — one fictional claim from report to published record.

### MediMatch
- **Problem:** hospitals let surplus stock expire while county facilities run out.
- **Role:** research and engineering at USIU-Africa; presented at a health conference.
- **Stage / as of:** prototype on synthetic inventory; never deployed in a health system.
- **Public evidence:** public repo `lesnargitonga/MediMatch`; product captures and the
  frame-exact command moment in `experience-lab/source-media/medimatch/`.
- **Survey:** the survey's responses include entries generated by the project's
  synthetic-survey tool, so it is synthetic and illustrative, never participant research
  (D-18). The product, README and presentation are corrected on MediMatch branch
  `fix/synthetic-survey-truth`. The Nairobi capture whose UI repeated the field-study line is
  withdrawn from the site.
- **Routes:** transfers are drawn along stored real roads (self-hosted OSRM on OpenStreetMap,
  ODbL), with no dependence on the public demo router.
- **Narrative:** map-led — national view to Nairobi, detect → rank → route → impact, the
  synthetic-data disclosure kept on screen.

### Jamii Projects Hub
- **Stage:** prototype — deployed publicly; its own copy says a controlled pilot in Mbeere
  North is being prepared. No usage evidenced. **Correction:** not "running as a pilot".

### Gen-Eat
- **Stage:** prototype (demonstration). The portal is static; no working ordering channel
  or merchant account exists. **Correction:** not a live product; no pilot has run.

### Hazina Nomads
- **Stage:** prototype — storefront reachable from cache; its API service is suspended.
  **Correction:** not a live product.

### LESNAR TV
- **Problem:** the stock TV home screen is slow and ad-heavy on a 2 GB television.
- **Stage / as of:** internal alpha, used daily on the owner's TV; not distributed · 2026-11-01.
- **Key facts:** measured on the real device (cold start, memory, navigation jank), with
  open performance budgets reported honestly.
- **Permissions:** private repo; real-TV captures show third-party app branding and private
  household material — emulator stills with fixture apps are the publishable candidates.
- **Narrative:** a D-pad focus walk at ten-foot scale with the device measurements beside it.

### LESNAR PLAY
- **Problem:** couch co-op normally needs a console; here the TV hosts the game and phones
  join as controllers by QR code.
- **Stage:** prototype — played on the real TV with one real phone; four-player play shown
  with simulated pads only. **Narrative:** phone as controller.

### SentinelCore, with Sentinel Assurance (repo `sentinelcore`)
- **What each name means (D-19):** SentinelCore is the evidence, event and identity
  foundation. Sentinel Assurance, its Continuous Assurance Control Plane, is the proof and
  qualification layer: authorised assessment, retest and closure. Operation Sentinel is a
  separate project.
- **Stage:** internal, ready for internal pilot on owned or synthetic assets only.
- **Correction:** figures on the current record come from the v1.0 baseline and understate the
  system. The record is rebuilt in phase 3.

### Cypher
- **Stage:** prototype — fail-closed, tenant-isolated retrieval with measured retrieval and
  safety evaluations; live enablement gated. **Correction:** the record's "nothing measured"
  is stale.

### Gold Trader
- **Stage:** research — paper trading only; live orders locked in code until an edge is
  shown. Measured replays show the unfiltered strategy loses money; that negative result and
  the lock are the story. **Correction:** the record's "no backtest result" is stale.

### Model foundry
- **Stage:** internal. The Home figures (two runtimes, same pinned weights, 80% vs 60% task
  pass, 8 vs 6 of ten reproducible, prompt-injection outcome) match the run report of
  2026-07-26. Engineering material, not a Work case study.

### Client systems
Three client systems (security operations, optical retail and workshop, non-profit records)
have substantial engineering behind them. None records showcase consent. Treatment:
withheld or anonymous capability evidence until written client permission exists.
