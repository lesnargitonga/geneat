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
| "SentinelCore" for the Linux security tool | "Sentinel Assurance"; "SentinelCore" reserved for a design-stage foundation |
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
- **Naming:** public "SentinelCore" → "Sentinel Assurance".

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

### Phase 2 — Home
Rebuild Home to its one job: proposition, three or four systems, entry routes. Render the
5–8 s Sentinel moment from the MC2 harness through `encode_master.sh` (with the VBV-cap fix
committed first), not by re-encoding the delivered MP4.

### Phase 3 — distinct project pages
MediMatch (map-led, synthetic-data disclosure on screen), Zygos (evidence lineage), CarePro
(trust gate), BizMtaani (one order's journey), LESNAR TV and LESNAR PLAY (device evidence,
honest alpha), Cypher, Gold Trader, Sentinel Assurance. Each blocked item waits on its
permission or provenance decision.

### Phase 4 — Capabilities, Engineering, Company, Start
Engineering gains the Model foundry, the Motion Pipeline and failure-led method notes
(the Sentinel phantom wall is one). `/menu` redirect, forms, SEO, navigation.

### Phase 5 — domains and release
Choose one canonical host, redirect the other domain to it, fix canonicals/sitemap/robots,
then qualify and release on explicit approval.

## 7. Decisions waiting on the owner

1. Deploy the hotfix: which of the four commits ship, after Vercel login.
2. Domain policy: which host is canonical, and whether the other redirects.
3. MediMatch survey: source confirmation before any survey figure is published again.
4. Client work (security operations, optical retail, non-profit records): no showcase
   consent is recorded. Anonymised capability lines only, or nothing, until permission.
5. CarePro: confirm LESNAR AI's role before it is presented as company work.
6. TV Militia: needs a trademark check before its name appears anywhere public.
7. LESNAR TV / PLAY media: real-TV captures show third-party app branding and private
   household material; only emulator stills and clean gameplay frames are candidates.
