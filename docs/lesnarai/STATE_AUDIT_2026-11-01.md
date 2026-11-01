# LESNAR AI portfolio — state audit and implementation plan

**Date:** 2026-11-01. **Scope:** read-only audit, then the first implementation phase on
`portfolio/2026-11-architecture`. **Companion:** `PORTFOLIO_ARCHITECTURE_2026-11-01.md`
(page roles, proof schema, execution order) and `CONTENT_INVENTORY_2026-11-01.md`
(per-project records).

This file is public with the repository. Client identities, hosting details, disclosure
specifics and anything held back for owner approval are deliberately absent; they were
reported to the owner directly.

## 1. What is deployed

| Host | Behaviour on 2026-11-01 | Serves |
|---|---|---|
| `www.lesnarai.co.ke` | 200 | the 19-route static site at `18a73f3` (Home, the aerial record and Company are byte-identical to it) |
| `lesnarai.co.ke` | 308 → `www.lesnarai.co.ke` | — |
| `lesnarai.com` | 200 | the same bytes (identical ETag and length) |
| `www.lesnarai.com` | 308 → `lesnarai.com` | — |

- Both domains are served by Vercel. DNS for both is on Cloudflare, on two different
  nameserver pairs, and each domain has a different Vercel DNS target. Whether they are
  attached to one Vercel project or two **is not verified**: the Vercel CLI on this machine
  is not authenticated. The local link in `lesnarai-landing/.vercel/` names project
  `lesnarai-v2` (team-owned).
- Identical bytes do not prove a shared deployment, and the two domains disagree about
  their canonical host (apex on `.com`, `www` on `.co.ke`).
- **Canonical conflict:** every page's `<link rel="canonical">`, `og:url`, the sitemap and
  `robots.txt` point at `https://lesnarai.co.ke/…`, a URL that 308-redirects to `www`.
  `lesnarai.com` serves the full site with canonicals pointing at `.co.ke`.
- The approved October hotfix has **never been deployed**. Production still states that no
  flight log of any kind exists and that there was no logged simulated flight, and the
  Company page still shows an internal photography brief.

## 2. Branches

| Branch | Head | Relation |
|---|---|---|
| `main` | `01068d4` (2026-06-21) | Gen-Eat/Hazina product line; does not contain the website history (`18a73f3` is not an ancestor). Never deploy the site from it. |
| `experience/lesnarai-v5-static` | `8e71cf9` (2026-10-12) | Production `18a73f3` + 124 commits ahead of `main`. Adds the 27.75 s Film 001 MC2 and the MediMatch loop to Home, the LESNAR Motion Pipeline and the MC2 harness. Unreleased. |
| `hotfix/site-truth-2026-10-12` | `bb4c92b` | `18a73f3` + the three approved corrections. Pushed, not merged, not deployed. |
| `hotfix/site-truth-2026-11-01` | local | `bb4c92b` + further corrections proposed on 2026-11-01 (§3). Not pushed, not deployed. |
| `portfolio/2026-11-architecture` | `e50f207` + this phase | v5 + the architecture doc. The redesign branch. |

The main checkout holds 56 uncommitted entries (32 modified, 24 untracked), mostly
regenerated study evidence plus two encoder edits. They are untouched; all work here runs
in separate worktrees.

## 3. The factual hotfix

`bb4c92b`, verified again on 2026-11-01: its three changes are still accurate and still
absent from production. "Simulation only. No physical airframe has been flown." remains
true — every Sentinel flight to date is PX4/Gazebo software-in-the-loop.

Proposed on top of it, each as its own commit so any can be dropped:

1. Home names a person who must not be featured, and publishes the mechanics and value of a
   private vulnerability disclosure. Both are removed; the disclosure becomes the agreed
   category line.
2. The aerial record still says "nothing was measured" and "no autonomy result", which the
   site's own Home and seven public sealed SITL runs contradict.
3. Home's MediMatch survey readout is withdrawn pending confirmation of its source.

**Release:** blocked on authentication. Deploy only after (a) the Vercel project(s) behind
each domain are confirmed, (b) the current production deployment of each is recorded as the
rollback, and (c) the owner approves which commits ship. After deploy, re-check live text on
both domains.

## 4. Superseded decisions

| Earlier decision | Superseded by |
|---|---|
| V2 guide (Aug): Astro + GSAP + WebGL production target | Static HTML/CSS with no build step (Sep reset, v5); no framework migration (Nov architecture) |
| Motion-led signature scenes | 2026-09-13 strategic reset: static composition with real evidence at readable scale; motion only where it clarifies |
| Lesnar Signal as a global SVG scroll system | Kept as a concept: Idea → Observe → Model → Engineer → Protect → Human review → Act → Prove, used where a project's own pipeline gives it meaning |
| Evidence registry as the public site model (35 claims bound to pages) | Rejected 2026-10-12: page copy owns the claim; evidence stays internal |
| Home carries the full Sentinel film and its disclosure | Rejected 2026-10-12: Home gets a short moment and a link; `/work/sentinel` owns the film |
| Teardown build order (all project pages first) | `/work` + `/work/sentinel` together, then Home, then distinct project pages |
| `/work/simy` and a Simy Home section | Never feature (2026-10-14) |
| Linux tool renamed "Sentinel Assurance" (chat ruling 2026-10-12) | **Corrected by D-19:** SentinelCore is the foundation and Sentinel Assurance is its proof and qualification layer; the rename was reverted |
| Greenhouse controller and Sensing/Radar pages | Removed; do not restore |
| `/menu` as a page | 301 → `/capabilities/` |
| Production served by `experience-lab/lesnarai-site-v1` | `lesnarai-landing/` (v5 static); site-v1 link renamed `.vercel.unlinked` on 2026-09-18 |

## 5. Corrections the inventory requires

Taken from primary sources (see the inventory for citations):

- **Stages:** Gen-Eat and Hazina Nomads are not live products (static storefronts only;
  no working backend endpoint was reachable). Jamii Projects Hub is deployed but its own copy
  says the pilot is being prepared. CarePro is a controlled public beta.
- **Understated work:** Cypher and Gold Trader pages say nothing was measured; both have
  measured results (retrieval and safety evaluations; negative backtests and a
  code-enforced live-order lock).
- **Sentinel:** the sealed runs fly with simulated GPS and compass. GPS-denied operation is
  configured in the estimator, not demonstrated. The Home headline implies more.
- **Naming:** SentinelCore names the system; Sentinel Assurance names its proof and qualification layer (D-19).

## 6. Plan

### Phase 1 — this session (redesign branch, nothing deployed)
1. Merge the truth hotfix into the redesign branch so the redesign cannot regress it.
2. `/work/sentinel`: the full MC2 film, the seven sealed runs, the phantom-wall failure and
   fix drawn from recorded telemetry, detection diagnostics, the GPS-denied boundary,
   limitations and attribution. Figures generated by a committed script from the public
   evidence branches.
3. `/work`: rebuilt register — corrected stages, problem domains, Sentinel featured, newer
   systems added, removed pages gone.
4. Redirects: aerial record → `/work/sentinel/`; Greenhouse and Sensing/Radar → `/work/`.
5. Home: the full film and long caption leave; a still frame, one line and a link remain.
6. Minimal stage corrections on the Gen-Eat, Hazina and Jamii records.
7. Qualify: static gate, browser gate in three engines, performance, reduced motion, no-JS,
   390/1440 frames in both themes.

**Phase 1 status (2026-11-01): done on this branch, not deployed.** Commits after `e50f207`:
docs, hotfix merge, `/work/sentinel`, `/work`, Home moment and record stage corrections. A
Sentinel Assurance rename was made and then reverted under D-19. Qualification:

- `static-gate` and `claims-gate` pass. The static gate passed on this branch for the first
  time: v5 shipped with Home's inline script unpinned in the CSP, so deploying v5 would have
  blocked that script in production.
- `behaviour-gate` (new) passes in Chromium and Firefox: no-JS player and figures, reduced
  motion, keyboard order and skip link, Home network, Work links. Before it was trusted it was
  run against a deliberately broken copy and failed on each injected defect.
- `perf` (local, cold, 4G): LCP under 1 s and CLS at most 0.019 on `/`, `/work/` and
  `/work/sentinel/`. Local TTFB is about 2 ms, so these are not production timings.
- `gate` (runtime): all 17 routes at 1440 and 390 pass in Chromium, Firefox and WebKit, with axe,
  contrast, overflow, broken-media and console checks.
  WebKit's own player icons fail under the gate's request interception. That is filtered
  narrowly, the filter still fails on a real 404, and Safari itself is unverified here.

Found during qualification, left for the phase that owns them:
- Home transfers 1.9 MB at desktop width (production 375 KB), mostly v5's MediMatch video loop.
  That breaks the 700 KB initial-media budget and belongs to the Home rebuild.
- Home's inline script still carries the Sentinel instrument and the wire diagram as inert,
  guarded code, and the style block keeps their rules. Both go when Home is rebuilt.
- One existing MediMatch capture shows a "field study" line inside the product UI.
  Re-capture or crop it before the MediMatch page uses it.
- `assets/home/mm-national.{jpg,webp}` are now unreferenced.
- Canonicals still name the apex `.co.ke` host, which redirects to `www`. This is fixed once
  for every page in Phase 5.

### Owner direction, 2026-11-01 (added after phase 1)

**A. MediMatch as one seamless live capture, not stills.** A finger swipe turns the globe, a tap
on Kenya zooms the national map, and the camera zooms into Nairobi when the story reaches it.
Transfers are drawn along roads, and as arcs only when a transfer is by air.
- The arcs in existing captures are a fallback, not the design: the server draws road geometry
  only when the public OSRM demo router answers live (`?roads=1`), and arcs otherwise.
- Fix in the product: compute road routes once, store them with the product, and mark air
  transfers explicitly, so every demo and capture is deterministic.
- The journey exists already: `GlobeIntro` → `NationalMap` → `NairobiMap`.
- Capture: Playwright with touch emulation and a visible touch indicator, deterministic time,
  then `encode_master.sh` (commit its VBV-cap fix first) and the decode gate.
- Blocker: the product's Nairobi panel carries a field-study line that is withdrawn pending its
  source. It must change before any capture of that view.

**B. Light mode that survives forced dark.** Chrome's auto-dark is stopped by `only light`.
Samsung Internet's default ignores it. BizMtaani's device probe (Aug 2026) found that an
opaque image background survives Samsung, and text survives only where the element declares its
own colour. This site has no third-party content, so complete coverage is possible here:
"enamel" white surfaces, with an explicit colour on every text element.
- Chromium's force-dark is not a faithful stand-in: it keeps raster backgrounds but inverts
  text regardless. So the deciding test is a device probe, published to the owner as
  *LESNAR AI · force-dark probe* (`experience-lab/force-dark-probe/`).

### Phase 2 — Home
Rebuild Home to its one job: proposition, three or four systems, entry routes. Render the
5–8 s Sentinel moment from the MC2 harness through `encode_master.sh` (with the VBV-cap fix
committed first), not by re-encoding the delivered MP4.

### Phase 3 — distinct project pages
MediMatch (map-led, synthetic-data disclosure on screen), Zygos (evidence lineage), CarePro
(trust gate), BizMtaani (one order's journey), LESNAR TV and LESNAR PLAY (device evidence,
honest alpha), Cypher, Gold Trader, SentinelCore. Each blocked item waits on its
permission or provenance decision.

### Phase 4 — Capabilities, Engineering, Company, Start
Engineering gains the Model foundry, the Motion Pipeline and failure-led method notes
(the Sentinel phantom wall is one). `/menu` redirect, forms, SEO, navigation.

### Phase 5 — domains and release
Migrate to lesnarai.com as the primary canonical domain (D-20). First audit both Vercel projects
and DNS with authentication, keep both current deployments as they are, then change
canonicals, sitemap, robots and redirects only on an approved migration plan. Mail stays on
`lesnarai.co.ke` (the only zone with MX routing) unless `.com` mail is set up first.

## 7. Decisions waiting on the owner

The running record is `DECISIONS.md`.


1. Deploy the hotfix: which of the four commits ship, after Vercel login.
2. ~~Domain policy~~ decided: lesnarai.com is primary (D-20); the migration plan waits on the Vercel audit.
3. ~~MediMatch survey~~ decided: synthetic, shown only as such (D-18). Any erratum to externally published figures is the author's decision.
4. Client work (security operations, optical retail, non-profit records): no showcase
   consent is recorded. Anonymised capability lines only, or nothing, until permission.
5. ~~CarePro~~ decided: engineering work, no ownership claim (D-16).
6. TV Militia: needs a trademark check before its name appears anywhere public.
7. LESNAR TV / PLAY media: real-TV captures show third-party app branding and private
   household material; only emulator stills and clean gameplay frames are candidates.
