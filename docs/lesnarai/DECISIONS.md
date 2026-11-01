# LESNAR AI portfolio — decision log

Newest first. Each entry says who decided, what, and what it changed. "Owner" is the founder of
LESNAR AI. Entries marked **superseded** stay in the log so the reasoning is not lost.

## 2026-11-01 — owner direction, third round (execution)

| # | Decision | Consequence |
|---|---|---|
| D-31 | User id 9 in the MediMatch seed data is the owner's own record. Remove the seed from active branches safely, prepare history cleanup without destroying work, and treat password reuse as an outstanding precaution. | Removed from three public branch tips by normal commits. A verified all-refs bundle is the rollback point. The cleanup script is prepared and not run (force-push needs authorisation). |
| D-30 | Build Phase 2 as one coherent language from Record, Terrain and Contact Sheet. | Field Record (`FIELD_RECORD.md`, `field.css`) is adopted. Every page is rebuilt in it. |
| D-29 | Optimise the 1.49 MB MediMatch video. | Re-cut from the 1920×1080 recording at 1280×720: WebM 421 KB, MP4 453 KB. Both pass the decode gate in Chromium and Firefox, and the page plays it click-to-play. Home carries no video. |
| D-28 | Prepare lesnarai.com as the primary production domain; keep .co.ke as it is. | Canonicals, og:url, the sitemap and robots point to lesnarai.com. No redirect, DNS or mail change. |

## 2026-11-01 — owner decisions, second round

| # | Decision | Consequence |
|---|---|---|
| D-27 | The white light mode stays experimental and separate from production until it is tested on a real Samsung device. | No enamel theme in any site branch. The device probe is the only artifact. |
| D-26 | Optimise the 1.49 MB MediMatch loop before the redesign counts as release-ready. | Open: a release-readiness blocker for the redesign, not for the hotfix. |
| D-25 | MediMatch research: separate the 52 generated responses from the 12 of unverified provenance, and imply neither is validated participant research. Preserve the original thesis artifacts with documented corrections. | Product, README and presentation state the split (MediMatch 4328e60). Correction records sit beside the preserved documentation (df5a69d) and the private thesis chapters (separate private repository). |
| D-24 | Warm bone and terracotta is **not** approved as the default direction. Develop three substantially different, project-specific directions from real artifacts and earlier research. | Three comps (Record, Terrain, Contact Sheet) are in a private local repository, because they contain private product captures. Supersedes the proposal in §3 of the art-direction review. |
| D-23 | Treat the exposed MediMatch user record as a security incident. Prepare containment, assess the consequences of making the repository private, establish the credential risk. No history rewrite or disclosure without authorisation. | The incident assessment is kept privately, outside every repository. Nothing has been changed on GitHub. |
| D-22 | lesnarai.com remains the intended primary domain. Keep .co.ke operational. Don't change redirects or email routing yet. | No domain, redirect or MX change. |
| D-21 | Prepare all five hotfix commits for release, including the Nairobi capture removal. Verify the Vercel mapping, the exact diff and rollback first. The deploy is authorised separately. | The release plan lists all five. The diff matches the branch exactly, and live production still equals its base on both domains. The Vercel mapping is blocked on CLI login. |

## 2026-11-01 — owner corrections after Phase 1

| # | Decision | Consequence |
|---|---|---|
| D-20 | **lesnarai.com is the intended primary canonical domain.** Audit both Vercel projects and their DNS before changing redirects or canonical tags, and keep both current deployments until a migration is approved. | Supersedes the recommendation of `www.lesnarai.co.ke` made at the end of Phase 1. Canonicals, sitemap and robots stay unchanged until migration approval. DNS audited; the Vercel project mapping is blocked on CLI authentication. |
| D-19 | **SentinelCore** is the authoritative evidence, event and identity foundation. **Sentinel Assurance** is its proof and qualification layer. **Operation Sentinel** (aerial simulation) is a separate project. | 3589d05's indiscriminate rename was reverted (d5c0d16). The /work row describes both layers (d685b8f). Supersedes D-07's naming clause. |
| D-18 | MediMatch: cached real-road routes where the provider's terms permit. Remove misleading field-study claims and separate synthetic data from participant research across the website, product and presentation. Investigate the personal-data exposure in Git history without exposing records or rewriting history. | Routes are computed on a self-hosted OSRM with OpenStreetMap data under the ODbL. The public demo server is non-commercial only and is no longer used. Product, README and presentation are corrected on MediMatch branch `fix/synthetic-survey-truth`. The history finding went to the owner only. No history rewrite. |
| D-17 | The four hotfixes are accepted in principle. Prepare the exact production diff, verified mapping and rollback plan. No deploy until the release target is approved. | `RELEASE_PLAN_HOTFIX_2026-11-01.md`. A fifth, optional commit (5d9fb4b) waits for approval. |
| D-16 | Include CarePro as LESNAR AI engineering work with no unsupported corporate ownership claim. Red Sky, Olive Optical and Sarepta need publicity authorisation before identifiable case studies. TV Militia's public name waits on trademark clearance. | CarePro record reworded (4e188ef). No client is identified anywhere on the site. TV Militia is not named publicly. |
| D-15 | Confirm Home's actual transfer size. Real-device and production qualification remain open. | `tools/transfer.mjs`. Home: 268 KB at rest, 1,824 KB on desktop after scrolling (v5's MediMatch loop). No video optimisation has been made yet. |
| D-14 | Run a design-skills, anti-slop and art-direction review before Phase 2's major visual changes. Preserve useful existing design work. | `ART_DIRECTION_REVIEW_2026-11-01.md`. The proposed direction waits on owner approval. |
| D-13 | The shared VPS billing problem is known and is handled separately from the website. | Out of scope for this work. |

## 2026-11-01 — owner direction during Phase 1

| # | Decision | Consequence |
|---|---|---|
| D-12 | MediMatch media must be a seamless live capture (swipe, globe, Kenya, Nairobi) with transfers drawn along roads, and arcs only for air transfers. | Stored real-road routes built (D-18). The capture follows in Phase 3. |
| D-11 | Light mode should survive forced dark ("cards that stay white"). | Device probe published to the owner. The enamel theme is proposed in the art-direction review. |

## 2026-11-01 — architecture baseline (owner, e50f207)

| # | Decision | Consequence |
|---|---|---|
| D-10 | Page roles: Home introduces, Work indexes, project pages prove, Capabilities sells, Engineering explains, Company identifies, Start converts. Build `/work` and `/work/sentinel` together first. | Phase 1. |
| D-09 | Every claim records name, problem, audience, role, stage, as-of date, public evidence, limitations, permissions, primary media, fallback and CTA. Stages are research, prototype, pilot, internal or live. | `CONTENT_INVENTORY_2026-11-01.md`. |

## 2026-10-12 — owner rulings

| # | Decision | Consequence |
|---|---|---|
| D-08 | Film 001 MC2 is canonical. Home gets a 5–8 s moment; `/work/sentinel` gets the full film. | Phase 1 moved the film. The short cut is rendered in Phase 2. |
| D-07 | Zygos: a public Work project with private source, "demonstrated / pre-production". ~~The Linux tool is presented as "Sentinel Assurance"~~ (superseded by D-19). Cypher and Gold Trader are sourced from their repositories. Greenhouse and Sensing/Radar lose their pages. `/menu` redirects to `/capabilities`. | Partly applied in Phase 1. `/menu` waits for Phase 4. |
| D-06 | The production hotfix is cut from `18a73f3`, not from the experience branch. | `hotfix/site-truth-2026-10-12`. |
| D-05 | The evidence registry is internal. Page copy owns the claim. | Registry entries are unbound with recorded reasons, not deleted. |
| D-04 | Simy is never featured (stated 2026-10-14). | Removed from Home by the hotfix. |

## 2026-09-13 and earlier

| # | Decision | Consequence |
|---|---|---|
| D-03 | Strategic reset: the existing site is evidence, not the brief. Work runs from strategy to implementation, never CSS-first. | Governs every phase. |
| D-02 | Visual changes are reviewed on rendered pixels, not prose or metrics. | Frames at 390 and 1440 for every visual change. |
| D-01 | V2 creative doctrine: "We make ambitious ideas real", the Lesnar Signal, warm colour roles, performance and accessibility contracts. Its Astro, GSAP and WebGL production target is superseded by static HTML. | See the art-direction review. |
