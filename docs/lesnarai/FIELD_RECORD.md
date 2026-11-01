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

## Page shell
Copy the head, header and footer of `index.html` exactly:
- the inline theme bootstrap is pinned in the CSP by SHA-256, so it must stay byte-identical;
- canonical and `og:url` use `https://lesnarai.com/...` (primary domain, prepared; not yet live);
- `aria-current="page"` goes on the current section's nav link.

Page-specific CSS goes in the page's own folder. Generated data goes between `gen:` markers and is
filled by `python3 tools/field/build.py`.
