# LESNAR AI portfolio — November 2026 architecture baseline

**Status:** planning only; not deployed. **Date:** 2026-11-01.
**Repository:** `lesnargitonga/geneat` **website root:** `lesnarai-landing/`.
**Implementation baseline:** `experience/lesnarai-v5-static`.
**Working branch:** `portfolio/2026-11-architecture`.
**Existing truth hotfix:** `hotfix/site-truth-2026-10-12`, NOT yet integrated into V5. V5 has diverged by 19 commits ahead and 1 behind from this hotfix. Do not merge or publish blindly.
**Domains:** `lesnarai.co.ke` publicly used for the newer portfolio; `lesnarai.com` was linked to a separate Vercel project `lesnarai-v2` in previous work. Independently verify the latter's current deployment and source. Do not assume they are interchangeable.

## The product to build
This is LESNAR AI LTD's engineering-company portfolio, not a list of repositories or a personal resume. Preserve **We make ambitious ideas real** and the **Lesnar Signal** idea: a controlled progression from idea, observation, modelling and engineering to human review, real-world action and proof. Real engineering evidence outranks cinematic effects and ambitious claims.

The website must (1) explain what the company builds within ten seconds, (2) offer compelling inspectable work, (3) attract credible clients, collaborators and applicants, (4) make inquiry easy, and (5) stay accurate, fast, accessible, and mobile-first.

## Page ownership
| URL | One job | Primary content owner |
|---|---|---|
| `/` | Introduce LESNAR AI and distinctive proof; short 5–8s Sentinel moment, no long video | Brand proposition, 3-4 selected projects, entry routes |
| `/work/` | Index by real maturity and problem | Single evidence-backed project register |
| `/work/sentinel/` | Prove aerial simulation work | 27.75s film, PX4 evidence, limitations; simulation only, **no physical airframe flight** |
| `/work/medimatch/` | Showcase research/data-driven product | n=52 survey and accurate synthetic dataset distinction; no hospital deployment |
| `/work/zygos/` | Show scam verification/research process and constraints | Independent evidence vs self-attestation; no automatic verification claim |
| `/work/carepro/` | Document live home-care operations | Actual workflows only, privacy-respecting examples |
| `/work/bizmtaani/` | Merchant marketplace | Actual deployment, status, approved evidence; The Villager is a merchant, not standalone project |
| `/work/red-sky/` | Security client engagement | Client permission first, no sensitive security details |
| `/work/olive-optical/` | Optical retail/workshop operations | Clearly separate local tests, demo hosting and production acceptance |
| `/work/lesnar-tv/`, `/work/lesnar-play/` | TV launcher, games and local multiplayer prototypes | Device recordings, honest alpha status, TV Militia demonstration |
| `/capabilities/` | Sell engineering services with linked project proof | Client problem, scope, deliverable, evidence |
| `/engineering/` | Show principles, testing, failures, architecture, security, release discipline | Methods, not invented certifications |
| `/company/` | Identify legal company, people, base and mission | No internal photography briefs or stale claims |
| `/start/` | Convert qualified visitors | Clear project inquiry/contact routes |

A project case study is not a cloned template. Sentinel is an operational flight-film narrative; MediMatch is a research/data story; Zygos is an evidence-led verification narrative; CarePro an actual workflow; LESNAR PLAY an interactive device/game demonstration.

**Additional projects:** Gen-Eat, Hazina Nomads, Jamii Projects Hub, Sarepta, Cypher and Gold Trader may appear in an honest project register after status/proof check. Don't auto-promote every repo to a public flagship. **Do not restore** removed Simy, Greenhouse and Sensing/Radar standalone pages.

**Sentinel naming:** distinguish the aerial-simulation case study from SentinelCore's wider operating-intelligence foundation. Don't confuse it with older Linux scanner copy.

## Every claim needs proof
For each project, record `name`, `problem`, `audience`, `role`, `stage`, `as_of`, `public_evidence`, `limitations`, `permissions`, `primary_media`, `fallback`, and `cta`. Allowed stages: research, prototype, pilot, internal, live. Never imply that simulations are field tests, prototypes are production, or self-reported documents establish merchant legitimacy. Private clients, security findings and bounty investigations require independent publication approval.

## Execution order
0. Preserve the dirty local workspace (earlier report: 56 uncommitted changes, including encoder edits). Use an isolated worktree. No new live deployment or DNS changes from this architecture branch.
1. **Separate factual hotfix:** Reconcile/deploy the approved Oct 12 corrections—two false Sentinel log claims and leaked internal Company photography brief. Keep current live rollback and verify live content after authenticated Vercel deployment.
2. **Domain/source audit:** Read October teardown, examine main/V5/hotfix, determine the currently deployed artifact and Vercel ownership for **both** lesnarai.com and lesnarai.co.ke; reconcile canonical tags and domain policy.
3. **Page-role and evidence schema:** Build verified factual inventory from GitHub projects and approved assets. Identify absent proof and client permissions.
4. **Implement Work + Sentinel together:** move full film to case study, shorten Home, preserve accessibility, document page-specific truth.
5. **Build distinct MediMatch and Zygos pages**, then verifiable additional products and client case studies.
6. **Refresh Capabilities, Engineering, Company, Start**, redirects, forms, SEO, and navigation.
7. **Qualify:** keyboard, no-JS, reduced-motion, Android/mobile, performance, captioning, accessibility, smoke/browser tests, source review, links, canonical domains, rollback. Deploy only on explicit release approval.

## Motion and engineering contract
Read the existing August 2026 `LESNAR_AI_V2_MASTER_IMPLEMENTATION_GUIDE_v1.0.md` and later October design decisions before implementation. Natural scroll, immediate HTML content and CTA, responsive layouts, graceful static fallback, deterministic motion, original aesthetic, and bounded GPU/CPU work. Use WebGL only if it actually clarifies a story. Do not invent UI or telemetry screenshots as evidence.

## Immediate deliverable for local Claude/Codex
Perform a **read-only** dual-domain/Vercel/repo audit, check hotfix vs V5, and report proposed route-fact owner + current verified evidence. Preserve untracked files. Do not deploy, redirect, migrate frameworks or generate marketing claims in this initial pass.
