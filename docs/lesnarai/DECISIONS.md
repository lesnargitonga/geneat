# LESNAR AI portfolio — decision log

Newest first. Each entry says who decided, what, and what it changed. "Owner" is the founder of
LESNAR AI. Entries marked **superseded** stay in the log so the reasoning is not lost.

## 2026-11-02 — owner: deploy the new site to production

| # | Decision | Consequence |
|---|---|---|
| D-46 | "Deploy new site … now please, I'll review the site when it's live." | **Released 2 Nov 2026, about 19:45 EAT.** Built from `998badc` in a clean worktree linked to `lesnarai-v2`: `vercel deploy --prod` → `lesnarai-v2-6uryajod8-lesnar.vercel.app`, then `vercel alias set … lesnarai.com`. **Verified live.** lesnarai.com and www.lesnarai.co.ke return 200; www.lesnarai.com and lesnarai.co.ke return 308 with the path kept. All 19 sitemap routes on both hosts are byte-identical to the tree, with the `vercel.json` CSP, HSTS, nosniff, DENY, referrer and permissions headers. The legacy paths return 308. Canonicals are lesnarai.com (D-28). No client names, no Simy, no pending markers. `/api/enquiry` returns 405 to GET and 400 to invalid input. **Enquiries are not operational yet:** `lesnarai-v2` has no Resend or Upstash variables, so the endpoint fails closed (503) and the page offers email and WhatsApp with the message kept. **Rollback target:** `lesnarai-v2-lab7a68rq-lesnar.vercel.app` (`vercel rollback` plus `vercel alias set … lesnarai.com`). No DNS, redirect or email change. |

## 2026-11-02 — owner: final release stage

| # | Decision | Consequence |
|---|---|---|
| D-45 | Final release stage, no new scope. Anonymise the client systems that lack documented publicity approval, and keep their full material privately. Complete the Preview configuration for Resend and Upstash; an enquiry counts as delivered only when inbox receipt is confirmed. Refresh availability immediately before deployment. Keep the pure light and dark themes, and prepare the Samsung Internet device test. No production deployment or domain migration without authorisation. | **Clients.** The two client systems named under D-43 appear on Capabilities and Work as "a security company's" and "an optician's" systems, labelled "Client, unnamed" or "Client work, shown without the client's name". Their availability key is now `security`. The named material and its restore steps are held outside every repository, in the owner's private client-cases folder. The `N()` helper and the pending marker are removed; `release-check.mjs` still refuses any `data-pending` marker. The names remain in this log (D-43, D-44) and in git history; neither is deployed. **Upstash** is connected through the Vercel integration (`KV_REST_API_URL`, `KV_REST_API_TOKEN`; Preview and Production on `lesnarai-landing`). **Availability** re-checked 2 Nov, 19:19 EAT. |

## 2026-11-02 — owner: release corrections, no new scope

| # | Decision | Consequence |
|---|---|---|
| D-44 | Approaching release: finish what exists. Keep Resend with a restricted key and confirm a real message reaches the inbox (provider acceptance is not delivery). Use a shared rate limiter. A form post without script must not lose the message. Red Sky and Olive stay in the preview, marked pending publicity approval ("do not assume permission simply because we developed their systems"). Separate maturity from availability without an outage dashboard, and never imply an unavailable system is operational. Fix catalogue counts and wording. Keep discovery, written scope, acceptance, handover and agreed support, but drop response-time guarantees and unconditional maintenance. Accept the stored MediMatch road geometry and generate distances from it. No redesign. The live site stays unchanged until release is authorised. | **Enquiries.** `api/enquiry.js` counts in Upstash Redis over REST: a fixed one-hour window, 5 per address (stored as a hash) and 60 site-wide. It fails closed when the limiter is missing or errors. A no-script post gets an HTML page; on failure it returns the visitor's words in a prefilled form plus email and WhatsApp links, all escaped. 21 unit tests. **Publicity.** Red Sky and Olive carry `data-pending="publicity"` "Publicity approval pending"; `tools/release-check.mjs` refuses release while any remain. It also refuses an availability check older than three days, and pages that differ from a fresh regeneration. **Availability.** A note appears only for a system that was offline at the last check ("Offline when last checked, {date}"), once per page at its first mention; online systems show nothing extra. Capabilities' infrastructure line no longer says the live systems "run" today: "We deployed the live and pilot systems on this page, on servers we set up and administer". **Catalogue.** Group counts come from the rows (`gen:count`). Work's description no longer says every system has a case page. **Commitments.** Home "Support as agreed", Company "Agreed support", Start "We reply — usually with a question or two first"; no response times. BizMtaani copy no longer says merchants are trading today. **MediMatch.** The export reads km and minutes from `road-routes.json` and stops if the plan disagrees; the published figures are unchanged. **Zygos.** Re-captured on 2 Nov with the demo banner off; the app's own "Fictional demo record" marks stay. **Gate.** `SIZES=` sweeps tablets and small phones. |

## 2026-11-02 — owner: Red Sky and Olive Optical may be named; no photo credits

| # | Decision | Consequence |
|---|---|---|
| D-43 | "Red Sky and Olive are our making too and we can use them." Photo credit lines are not needed. | **Naming.** Red Sky Security (public site and operations portal; staging, in validation; offline on 2 Nov with the shared server) and Olive Optical Supplies (public website, staff operations and owner management; a demonstration on fictional data) are named in the Capabilities register and listed in the Work catalogue. Neither has a case page yet. The non-profit platform and the hospitality pilot stay unnamed (supersedes D-16 for Red Sky and Olive only). **Photographs.** The credit lines are removed from Home and Company; licences stay recorded in `experience-lab/source-media/photos/CREDITS.md`. |

## 2026-11-02 — external critique (owner-forwarded): P0 facts and enquiries, P1 hierarchy

| # | Decision | Consequence |
|---|---|---|
| D-42 | The site proves engineering activity better than ambition or business value. Fix facts and availability, and replace the mailto enquiry (P0). Then rework Home's hierarchy, simplify Work, give SentinelCore a first-level explanation, add an engagement model, and revisit `font-display: block` (P1). No wholesale redesign. | **Facts.** The critique held that 926 km came from our own OSRM; the committed geometry says otherwise. The stored self-hosted route is 1,141 km (re-measured at 1,142.3 km) via Thika, Isiolo and Marsabit: the fastest road, not the shortest. The sentence is now generated from the plan export and registered (C-MM-ROUTES). **Availability.** Separated from maturity: `check_availability.py` records reachability, and every availability marker is filled from it. On 2 Nov, BizMtaani and CarePro are offline (shared server refusing connections). **Enquiries.** `/api/enquiry` replaces the mailto handoff: validation, honeypot, fill-time check, same-origin check, best-effort throttle, Resend delivery and an honest 503 fallback. It is tested by 15 unit tests and the behaviour gate. Delivery goes live when the owner sets RESEND_API_KEY, ENQUIRY_FROM and ENQUIRY_TO in Vercel. **Home.** The first screen carries the proposition and three strengths (operational software; intelligent, secure systems; connected and autonomous machines). The 16-discipline stack moves to Capabilities only. Jamii replaces the offline BizMtaani in Selected systems. **Work.** It now opens on four flagship cases from different disciplines (problem, then what we built), then one catalogue. The contact sheet and the reel are removed, with their code and thumbnails. **SentinelCore** gets an "In plain terms" first level. **Company** gets an engagement model (to be confirmed by the owner). **Font.** Archivo moves to `font-display: optional`; worst CLS on throttled 4G is 0.040, worst LCP 444 ms. **Deferred:** deeper CarePro and BizMtaani workflow cases (both are offline; fresh captures wait for the server); the Samsung device test; Safari and production qualification. |

## 2026-11-02 — owner review: grids, background photographs, final corrections

| # | Decision | Consequence |
|---|---|---|
| D-41 | Remove the grids. Use background photographs, starting with the owner's own photos of himself and the workstation from earlier work. Licensed online photos may fill places that read like a storybook. Make final corrections and send the site for review. | **Grids.** The graph-paper background is removed everywhere. **Owner's photographs.** Three come from the first site (`experience-lab/lesnarai-site-v1/media/`): the workstation is now Home's full-bleed hero background; Lesnar at work is the founder-led band; the portrait sits in Company's new founder section. **Licensed photograph.** One, chosen for context rather than decoration: Nairobi with KICC, photo by Kenny Murgor on Unsplash (Unsplash License, credited on the page), behind Home's closing ask and Company's "Based in Nairobi" band. Generic stock was declined as template filler. **Pipeline.** Sources and licences are in `experience-lab/source-media/photos/CREDITS.md`; `tools/assets/photos.py` writes the sizes with metadata dropped. The placeholders are retired. Personal images found in Downloads (screenshots, chats) were not used. **Copy.** Company is rewritten to the multidisciplinary positioning, with founder-led accountability rather than headcount. Start's "Bring us this" follows the six engineering layers, and "We are not a staffing agency" is gone. |

## 2026-11-02 — owner review: colour, pictures, the drone film, SentinelCore

| # | Decision | Consequence |
|---|---|---|
| D-40 | Two-tone accent headlines and orange or red text are AI-template styling; remove them. Pictures are the biggest weakness: take fresh screenshots of the systems, use them only where they earn a place, and drop annotation circles and in-app demo or disclaimer messages from screenshots (provenance stays in captions). Film 001 is the weakest Sentinel media; use a real recording. SentinelCore was shown as a few steps when it is a large system: give it its full truth. | **Colour.** Headlines are one colour. Orange frame labels became neutral grey. Numerals, kickers and hovers are ink, with underlines for hover. Red remains only for the primary action button, focus outlines and data marks that mean failure. The logo's red "AI" is unchanged pending the owner. **Pictures.** The yellow selection circles are gone everywhere. MediMatch's national still is cropped above the app's disclaimer bar. **Film.** The Sentinel film is the 31 Oct follow-camera recording of the corrected stack flying Run 2's mission (`experience-lab/motion-system/sentinel-follow/`), with a timed flight log; Film 001's media leave the site. **SentinelCore.** Its page is rewritten from the APEX program: the 12-capability protection loop, six pinned engines, ATT&CK coverage, governed reversible containment, blind qualification (0.867, 0.902, 0.967; precision still under its gate), the purple-team lab, 14 waves with test counts, and honest limits. New evidence objects and claims are registered; the v1.0 claims are unbound with a reason. **Still to do:** fresh screenshots of the other systems, starting with Zygos without its demo banner (`DEMO_MODE`). |

## 2026-11-02 — owner correction: present the full engineering company

| # | Decision | Consequence |
|---|---|---|
| D-39 | The client-plain Home (D-38) undersold LESNAR AI as a small-business web, booking and payments shop. LESNAR AI is a multidisciplinary technology and engineering company serving businesses, organisations and institutions. Home carries positioning and selected proof only; Capabilities explains the disciplines; Work, the project pages, Engineering and Company each keep their role. Separate what is built from what we can engineer, from what is experimental, from what needs partners. No invented headcount, credentials, deployments or capacity; founder-led accountability, without leading on headcount. Placeholder photographs until the owner's arrive. | **Register.** One discipline register, `tools/field/disciplines.py`: 16 disciplines in six layers (Organisations, Products, Intelligence, Security, Infrastructure, Machines and research). Each has a maturity mark (In use, Demonstrated, Experimental), its evidence, and its limits or partner needs. Client systems are described without names. **Home.** It now shows: a company proposition; the six-layer stack, with no project names, so nothing repeats; five selected systems across five disciplines (Operation Sentinel, MediMatch, SentinelCore, LESNAR TV and PLAY, BizMtaani), each once; how we engineer; founder-led engineering; one ask. **Capabilities.** Generated from the same register, and it keeps the unnamed client descriptions. The security company's operations platform counts as enterprise systems, not cybersecurity, so cybersecurity is marked Demonstrated. **Photographs.** Labelled placeholders sit at final sizes in `assets/photos/` (`tools/assets/placeholders.py`); real photographs replace them by overwriting the same files. Every section fits one 390×844 and one 360×780 screen. |

## 2026-11-02 — owner review of the Phase 2 preview (scored −5/10)

| # | Decision | Consequence |
|---|---|---|
| D-38 | The review: no repetition (MediMatch appeared six times on Home); a stranger must learn who we are before seeing a project; the site read as an engineer's dashboard talking to itself; nothing fit a phone screen. Home's audience is **organisations that need software built**. Feature **LESNAR TV and PLAY** once. The owner supplies real photographs. | Home is rewritten in plain language, phone first, each section inside one 390×844 screen (and 360×780). It gives a clear promise; four offers, each linking once to its proof; LESNAR TV and PLAY as our own products; how working with us goes; who you work with; one ask. Telemetry channels, odometers, the reel, the map and the hero capture leave Home; the engineering detail stays on case pages, Work and Engineering. The hero loop leaves the site. The three Home-bound registry claims are unbound with a reason. The TCL screen recordings stay off the site: they show third-party apps (including CricFy TV), so publishing them is the owner's call. |

## 2026-11-01 — owner direction, fourth round (release, then soul)

| # | Decision | Consequence |
|---|---|---|
| D-37 | Video optimisation covers Film 001 too: the site served its 1080p master (4.28 MB MP4, 3.97 MB WebM). | Re-cut at 1280×720, with sound at 96 kb/s: WebM 1.17 MB, MP4 1.39 MB. All four decode-gate runs pass (PSNR ≥ 37 dB against the master). Same filenames, still click-to-play. |
| D-36 | Nairobi to Mandera is 1,141 km by road, and MediMatch holds 55 transfers on 54 stored routes. The 926 km and "54 transfers" figures had no source. | Corrected on Home and the MediMatch page from MediMatch's stored OSRM route and the plan export (`tools/assets/medimatch-plan.json`). |
| D-35 | The MediMatch seamless live capture (D-12) is delivered. | A frame-exact virtual-clock capture of the running product: globe, tap on Kenya, roads, Nairobi. The site gets an 18 s film (click-to-play) and a 12 s hero loop. The Nairobi panel is cropped above its survey strip, because survey figures stay withdrawn. All eight decode-gate runs pass. Recipe: `experience-lab/motion-system/medimatch-roads/`. |
| D-34 | The site needs soul: photos, video, motion with character, not generic text slides. | Home leads with a live capture in a film gate. A reel of real frames runs against the scroll. Traces write behind a playhead, readings roll like odometers, roads draw before places land, frames jump on hover, and pages hand over with view transitions. On phones the contact sheet and readings become swipe rolls. All of it is off under reduced motion and without script. No stock or generated imagery. Real photographs (workstation, hardware, field use) must come from the owner; the project holds none. |
| D-33 | Forced dark mode preservation is mandatory: light is #FFFFFF on #000000 text, dark is #000000 with #FFFFFF text, preserved under Samsung Internet's forced dark and Chrome's auto-darkening. It needs a controlled test matrix, and it is not releasable on desktop emulation alone. | Built on `portfolio/force-dark` and merged into the portfolio branch (`416b938`): strict tokens, `color-scheme` declared three ways, the probe page `/lab/theme-probe/` (noindex) and a pixel-sampling matrix (`FORCED_DARK_MATRIX.md`). All 18 required desktop configurations pass at phone density. Blink force-dark under a light device preference overrides even `only light`, by design. No primary source settles current Samsung Internet behaviour, so its rows stay untested until the owner's device run, and light mode is not releasable before then. |
| D-32 | Deploy the five-commit factual hotfix to production, move the `lesnarai.com` alias explicitly, keep `jfalf37v5` as the rollback target, verify all four addresses. | Released as `lesnarai-v2-lab7a68rq` and verified live (release plan §6). No rollback needed. |

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
