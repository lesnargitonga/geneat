# Art-direction and anti-template review before Phase 2

**Date:** 2026-11-01. **Purpose:** the owner asked for a design-skills, anti-slop and art-direction
review before Phase 2 makes major visual changes. This review judges the Phase 1 pages honestly,
names the earlier design work worth keeping, and proposes the direction Phase 2 should build to.
No visual change is made until the owner approves the direction.

**Standards applied**
- The anti-template policy (the banned patterns, at least four of the ten required qualities,
  the component checklist).
- The V2 guide's creative doctrine and its colour roles.
- The 2026-09-13 reset: real evidence at readable scale outranks effects.
- The owner's brief: original, project-specific experiences, not a polished AI template.

## 1. Phase 1, judged

### `/work/sentinel`
**Holds up**
- Its figures are generated from recorded telemetry: the run ledger, the plan view with the
  recorded scan and the phantom disc, and the speed trace. That is data visualisation as part of
  the design, and no template produces it.
- Colour carries state only: rust for the failure and the phantom, green for the recovery, blue
  for the mission path.
- The Lesnar Signal is used as this mission's own path, and it visibly breaks at the human gate.

**Template risks**
- The opening is a stock arrangement: a big title, a lede, a chip, then full-width media.
- "Four parts are ours" is a uniform four-column ruled grid, which the policy bans.
- Monospace labels and thin rules repeat section after section, the same grammar the October
  review criticised.
- Archivo with Plex Mono at one width has little typographic character.
- The page reads as excellent documentation more than as a memorable experience.

### `/work`
**Holds up:** scale contrast in the opening, the maturity glyphs, honest one-line rows.

**Template risks**
- The case card is the generic image-left, text-right card.
- Every register row is the same shape, so a reader cannot tell the systems apart at a glance.
- Nothing visual belongs to any one project.

### Home
Phase 1 only cut the Sentinel case down to a moment. The page is still the v5 system and still too
long. Its desktop transfer (1.8 MB once scrolled) breaks the budget.

### The system as a whole
**Colour**
- Light theme: cool grey with one blue accent. That is close to the banned "safe gray-on-white
  with one decorative accent".
- Dark theme: near-black with the same blue.
- Both drifted from the V2 guide's warm colour roles: graphite, warm off-white, bronze signal,
  cyan evidence, green human decision, rust risk.

**Typography:** one width of Archivo for everything. Mono carries labels everywhere, not only data.

**Counted against the ten required qualities:** clear hierarchy, semantic colour and data
visualisation are met. Depth, texture, character typography and designed interaction states are
weak. Motion is nearly absent.

## 2. Earlier work to preserve

- **The brand line and its voice.** "We make ambitious ideas real", set in a condensed display
  grotesque. The G01, G02 and G03 renders in `experience-lab/site-direction/` show it with real
  character. Their fonts are self-hosted, including a variable Archivo with a width axis, so a
  condensed display voice needs no new font family.
- **The bone and terracotta ground** (G02, G03). It is warm, controlled and specific, and it
  matches the V2 guide's colour roles better than the current cool grey.
- **"What the system actually decided."** A real product screen at readable scale, which is the
  composition that scored 8/10 in September.
- **The maturity glyph system** (filled, half, diagonal, outlined, faint).
- **The Lesnar Signal as a project's own pipeline**, as on the Sentinel page, never as global
  decoration.
- **The LESNAR Motion Pipeline** (frame-exact encoder and decode gate) for every moving asset.
- **The gates:** static, claims, runtime in three engines, behaviour, transfer and performance.

## 3. Proposed direction for Phase 2 (for approval)

**Ground and colour**
- Return to the V2 roles: a bone or enamel light theme and a graphite dark theme.
- Terracotta for identity and the primary action, cyan for evidence, green for human
  decisions, rust for failure.
- Colour marks state, never category.

**The enamel light theme**
- Light surfaces are painted as opaque images, and every text element declares its own colour,
  so a phone's forced dark mode cannot invert the page. This site has no third-party content, so
  coverage can be complete.
- The deciding test is the owner's Samsung Internet probe. Chromium's force-dark keeps raster
  backgrounds but inverts text regardless, so it cannot stand in for Samsung.

**Typography**
- Archivo at condensed width for statements, Archivo at normal width for reading.
- Plex Mono only for data, measurements and identifiers.
- Still two families, self-hosted, and subset where possible.

**Page physics: each case built around what its system does**
- **Sentinel:** keep the film band and the flight record. Replace the four-column grid with one
  stack diagram that sets our parts against the upstream projects.
- **MediMatch:** one continuous live capture as the page's spine: the globe, a tap on Kenya, the
  national zoom, then Nairobi when the story arrives. Routes run along stored real roads, and the
  synthetic-data disclosure stays in frame.
- **Zygos:** evidence lineage. One fictional claim is traced through independent evidence versus
  the business's own statements.
- **CarePro:** the trust gate. The nurse-verification sequence, shown from public surfaces only.
- **BizMtaani:** one order's journey, from table QR code to station ticket to daybook.
- **LESNAR TV:** a ten-foot D-pad focus walk with the device measurements beside each move.
- **LESNAR PLAY:** phone as controller, the phone and the TV side by side.

**Home:** the proposition in condensed display, three or four systems each shown in its own
visual language (never identical cards), entry routes, and an initial transfer within budget.

**Motion:** only where it explains: the Sentinel moment, the MediMatch take, the D-pad walk.
Every moving asset goes through the Motion Pipeline, with stills under reduced motion.

**Checks before any Phase 2 page ships**
- No banned pattern.
- At least four required qualities, named.
- Real evidence at readable scale.
- Frames at 390 and 1440 in both themes.
- The forced-dark probe.
- The owner's review on pixels, not on prose.
