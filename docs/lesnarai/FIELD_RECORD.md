# Field Record — the LESNAR AI design language (Phase 2)

One language drawn from three explorations (owner direction, 2026-11-01):

| Source | What it contributes | Components (`lesnarai-landing/field.css`) |
|---|---|---|
| Record | Our own measurements are the image | `.paper`, `.channels` / `.channel`, `.bars`, `.counts`, `.readings` / `.reading` |
| Terrain | Systems placed where they run, on real roads | `.map.sheet` (`gen:kenya-map`), `.gaz` / `.gaz__row`, `.place` |
| Contact Sheet | Real screens, with provenance on every frame | `.strip`, `.frame` (`--2`, `--3`, `--4`, `--6`, `--8`, `--12`, `--select`, `--paper`), `.frame__edge`, `figcaption` |

Shared pieces: `.statement` (condensed uppercase display), `.h2`, `.lede`, `.body`, `.data` (mono),
`.stage--live` / `--pilot` / `--prototype` / `--internal` / `--research` / `--sim`, `.act` and
`.act--quiet`, `.two`, `.steps`, `.limits`, `.crumb`, `.case-open`, `.facts`, `.next`, `.sec`,
`.sec-head`.

## Rules
1. **Nothing drawn for effect.** Every figure, number, map mark and screen is real and sourced.
   Generated figures come from `tools/` scripts that read the evidence.
2. **Provenance travels with every artifact.** Each frame caption says what it is, whose data it
   shows (real, demo, fictional, synthetic, emulator, reconstruction) and how it was captured.
3. **Colour means something.** `--signal` (red) is identity, the primary action and the failure
   that matters. `--ch-blue` and `--ch-green` are data channels. `--place` is our mark on a map.
   The film frame and edge are for captures only.
4. **Mono is for data and metadata only**, never for voice or section labels.
5. **One family, three widths.** Archivo condensed for statements, normal for reading, wide for
   place names. Plex Mono for data.
6. **Every case page is organised around what its system does.** No cloned template. Each case
   page uses at least one Record, Terrain or Contact Sheet component in a way only that project
   could.
7. **Anti-template checks** before shipping:
   - no uniform card grids, gradient blobs, stock heroes or decorative motion;
   - frames at 390 and 1440 in both themes;
   - the static, claims, runtime (three engines) and behaviour gates pass.

## Home positions the company (D-39)
Home introduces LESNAR AI as a multidisciplinary engineering company. It carries positioning and selected proof
only, in plain words: the proposition; the six-layer stack from `tools/field/disciplines.py` (short names,
maturity marks, no project names); five selected systems across disciplines, each at most once; how we engineer;
founder-led engineering; one ask. Every section fits one 390×844 and one 360×780 screen. Capabilities is
generated from the same register, so Home and Capabilities can never disagree about a discipline's maturity.
Records, terrain and contact sheets carry the proof on case pages, Work and Engineering.

## Photographs (D-41)
Real photographs carry the company: the workstation (Home hero), the founder at work (Home band), the
founder (Company), and Nairobi (Home's closing ask, Company). Each sits full-bleed with a dark scrim, so
text keeps contrast in both themes, and each carries a small credit line. Product screens stay
screens; photographs are never used to suggest a team, an office or hardware we do not have.
Licences: `experience-lab/source-media/photos/CREDITS.md`.

## Motion (`field-motion.css`, `field-motion.js`)
The record is being made in front of the visitor. Each motion belongs to one of the three sources:

| Source | Motion | Hook |
|---|---|---|
| Record | the speed trace writes behind a red playhead; bars jump up in order; readings roll into place like odometers | `[data-reveal]` on the section; `data-odo` on a reading value |
| Terrain | roads draw along their length, then the places land on them; gazetteer rows follow | `[data-reveal]` on the section |
| Contact Sheet | frames are dealt onto the sheet and jump when reached for; on phones the sheet is a roll you swipe, with a frame counter; the reel of real frames runs against the scroll, rows opposed | `.strip--roll` + `.roll-count`; `[data-reel]` with `gen:reel` |

Home's own motion is small: "REAL." lands like a stamp, the television powers on and the phone lands
beside it, offers and steps step in. `video[data-loop]` support remains in `field-motion.js` for a
loop that plays only on screen and never under reduced motion or Save-Data. No page uses it now.
Pages hand over with cross-document view transitions.

Rules:
1. **No generic text slides or fades for their own sake.** Motion shows a record being made, a
   place being reached or a frame being handled.
2. **Final state first.** Without script, or under `prefers-reduced-motion: reduce`, everything
   rests in its final state. Hidden starting states need `:root[data-js="on"]`, which the inline
   bootstrap sets before first paint, so nothing flashes. If the script fails, every section is revealed.
3. **Compositor properties only** (transform, opacity, stroke-dashoffset on small SVGs). Video
   sources attach only when the reel is on screen.
4. **A swipe roll is a keyboard region** while it actually scrolls (`tabindex="0"`, `role="region"`).

## Page shell
Copy the head, header and footer of `index.html` exactly:
- the inline theme bootstrap is pinned in the CSP by SHA-256, so it must stay byte-identical;
- canonical and `og:url` use `https://lesnarai.com/...` (primary domain, prepared; not yet live);
- `aria-current="page"` goes on the current section's nav link.

Page-specific CSS goes in the page's own folder. Generated data goes between `gen:` markers and is
filled by `python3 tools/field/build.py`.
