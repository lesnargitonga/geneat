# LESNAR AI homepage, v5

A portfolio homepage for Lesnar Gitonga and LESNAR AI, written for clients, in
Lesnar's own voice. Not deployed, not linked from anything, `noindex`. Homepage
only.

Open it with any static server from this directory:

```bash
python3 -m http.server 8822   # then http://127.0.0.1:8822/
```

## The idea

The second round of review, on 29 September, set four things: the page is for
clients who might hire Lesnar, it speaks as Lesnar ("I build..."), the honesty
rules stay while everything else is free to change, and motion is built with
GSAP. The first version read like an audit: run IDs, column counts and claims
worded to survive a fact check, and hardly any pictures. This one says what
each thing is, who it is for and why it matters, in plain words, and shows it.

Every project still carries its honest label (Live, Demonstrated, Research, In
development, Internal), explained in a legend, and every figure on the page is
checked against its source by `tools/verify.py` (83 checks).

| Section | Label | What the visitor sees | Where it comes from |
|---|---|---|---|
| Hero | | Headline, a showreel of the five live products | `media/reel/showreel.*`: seconds 1 to 4 of each product recording, cross-faded |
| BizMtaani | Live | The site in a browser frame, three phone screens fanning out | Recordings and captures from the v4 site; The Villager listing from the evidence registry |
| CarePro | Live | The site, and its four checks turning green in turn | Its published verification panel; its own counter (20 nurses joined, none approved, 16 September) and payment policy, from the registry |
| MediMatch | Demonstrated | Kenya, with the planned transfers drawing across it, and the command floor | The MediMatch repo; the page says the run is on sample data and nothing was executed |
| Operation Sentinel | Research | A scroll-driven replay of the latest sealed flight, in 3D, with live time, altitude, speed and distance | `media/flight.json`, built from run `px4_teacher_20260929_082014_d1`'s own telemetry, mission and teacher log, each hash-checked against its manifest; the story of the two earlier runs and the fixes |
| Gold Trader | Research | Nine strategies as bars growing from zero, five struck out | `docs/AUDIT_RESULTS.md` |
| Simy | In development | A message scrambling into ciphertext, crossing the relay, and opening on the other phone | The relay API, threat model and Phase 9 handover |
| Jamii, Gen-Eat, Hazina | Live | Their recordings on a strip that slides sideways as you scroll | The v4 site |
| SentinelCore, Model Foundry | Internal | A test report, and pass-rate bars filling | The Phase 9 registry and SentinelCore's July sealing report |

`media/PROVENANCE.md` lists every file. No stock, no generated imagery.

## Motion

GSAP 3.15 (ScrollTrigger, SplitText, DrawSVG, ScrambleText), self-hosted in
`vendor/`. Every effect shows something about the work:

1. The headline rises on load (CSS, so it paints without waiting for scripts), and
   the showreel grows to full width as it comes up.
2. Section headings rise line by line; text fades up as it arrives; counters count.
3. BizMtaani's phone screens fan out from behind the browser.
4. CarePro's four checks turn green one at a time.
5. MediMatch's hospitals appear, then the transfers draw across Kenya, shortest first.
6. Operation Sentinel pins, and scrolling flies the drone along its logged path.
7. Gold Trader's results grow out from zero.
8. Simy pins, and the message is sealed, carried and opened as you scroll.
9. The three smaller products slide sideways past the reader.
10. Product recordings play only while on screen.

The page is complete without any of it. With reduced motion, or if GSAP fails to
load, everything shows in its finished state, and the flight replay gets a slider.

## Renders

`renders/` holds viewport screenshots at 1440 and 390 wide from 29 September,
taken part-way through the pinned stories so the motion's states are visible.

## Measured

Local server, Chromium, slow 4G (1.6 Mbps, 150 ms) and 4x CPU slowdown, 29 September:

| | Desktop 1440 | Phone 390 |
|---|---|---|
| LCP (the headline) | about 1.1 s | about 1.1 s |
| CLS over a full scroll | 0.005 | 0.008 |
| First load, bytes on the wire | 975 KB | 620 KB |
| After a full scroll | 2.8 MB | 2.3 MB |

Most of the first load is the showreel (613 KB on desktop; phones get a 237 KB copy
at 640 wide). GSAP adds 141 KB before compression. The side strip is not pinned: a
pinned strip measured as a layout shift of 1.3.

## Open questions

- The About section is written from what the evidence shows: founder of LESNAR AI
  LTD, in Nairobi, builds products end to end and runs the live ones. Lesnar should
  confirm it, and send a photograph if he wants one there. Until then the About
  visual is a collage of his products.
- Real Gazebo footage of a flight would add a second kind of flight evidence next
  to the replay. The run script's watch mode (HANDOFF.md) shows the flight on the
  Precision's screen; recording it is the next step.
- The Phase 9 work is on GitHub as `experience/lesnarai-v5-static`. Its eleven
  `/work/` pages and route redirects are not touched here.

Settled since the last review:

- CarePro is described as a platform whose vetting gate has not yet admitted a
  nurse, as its own published counter says (20 joined, 0 approved for assignments,
  16 September 2026). The first draft of this version said families book nurses;
  that was wrong and is gone.

- The April detections chart is gone from the homepage. Its counts (87 diagnostic
  runs, 71,813 detections) came from a detector that read the old lidar model, which
  turned box obstacles into discs, so some were detections of nothing, and the sealed
  flight now carries the section. The record itself is unchanged in the evidence
  registry and in `telemetry.json` on `experience/lesnarai-v5-static`; re-running
  those diagnostics with the fixed bridge would be the way to bring it back.

- Operation Sentinel flies from a stock checkout. LesnarAI's `main` carries the
  console, both bridge fixes, the world and the Linux stack, and a CI that passes
  (PRs 1 to 4 on lesnargitonga/LesnarAI). Run `px4_teacher_20260929_082014_d1` then
  flew the whole box from `main` at `3ba2677`, with `obstacles.sdf` unchanged, and the
  page now draws it. The earlier completed run, `px4_teacher_20260928_205942_d1`,
  flew the fixes from their branch in a patched copy of the world; it stays on record
  in `media/sentinel-history.json`. The page says the flight ran the main code at
  `3ba2677`, not that the checkout had no local edits: that run predates the script
  recording them (`bridge.tracked_files_changed` in later runs).

- Model Foundry is the registry's own name for the local-model evaluation
  (`registry.json` evidence 16 and 17, "Model foundry"). The page shows that
  evaluation, llama.cpp against Ollama.
- Gold Trader's figures hold after the 30 May rerun. The rerun changed the live
  gates and the IFVG path's `_entry_plan` targets, and replaced the sequential-sim
  results (the old +$43 on 18 IFVG trades and -$334 on 96 across families). The page
  uses neither. Its headline and bars are the full-stack overlap figures, which none
  of those changes reaches. `verify.py` fails if either superseded figure appears on
  the page, or if the document stops marking them superseded.

## Operation Sentinel's operator console

The console was run here in its own demo-safe mode (real backend and UI,
simulated drone records, no PX4 or Gazebo) to see whether it could supply a
real surface. It is not used on the page, for two reasons. Its visual style is
the tracked-uppercase, neon look this redesign moves away from. More
importantly, `frontend/src/components/DiagnosticTerminal.js` lines 48 to 54
print a fixed boot sequence on every load, including "ENCRYPTION LAYER:
AES-256-GCM ACTIVE" and "SYSTEM STATUS: OPTIMAL", whatever the real state.
That contradicts the project's own truth-first rule, so the console should
not be shown publicly until those lines are driven by real state or removed.

Those lines, the header's fixed Live_Stream label and the footer's fixed
readouts are now driven by the measured link state, in LesnarAI's `main` since
PR 1 (`fix/console-real-state`).

## Checking the page against its sources

`tools/verify.py` confirms every figure and claim on the page appears in the
file it came from (83 checks with the flight, including counted facts such as the five
live products, the eleven systems, the four logged flights and the 59 measurements)
and that the page carries no em dash. Run it after any copy change.

The flight checks read a lesnargitonga/lesnarai clone (`LESNARAI`, default
`/home/user/lesnarai`) with the evidence and fix branches fetched as remote refs:

```bash
git -C "$LESNARAI" fetch origin 'refs/heads/evidence/*:refs/remotes/origin/evidence/*' \
  'refs/heads/fix/*:refs/remotes/origin/fix/*' main
```

From there they re-hash the flown run's telemetry and mission record against its
sealed manifest, check each sentence about the earlier runs against that run's sealed
outcome and the fix commit's own description, check that the fixes are on
`fix/offboard-engage` and in `main` exactly when the page says they are merged, check
that the drawn run flew that branch (the run script's ref and commit, the orchestrator's
sealed commit, both fixes in it, and that commit's own `obstacles.sdf` by hash), and
check that the rate the copy states (about five readings a second) is the run's own.

## Rebuilding the assets

`tools/build_assets.py` reads the source repos (paths via the `MEDIMATCH`,
`SENTINEL`, `V4`, `GENEAT`, `FONTSRC` and `GSAP_DIST` environment variables) and writes
`media/`, `fonts/` and `vendor/`. It needs `imageio-ffmpeg` for the showreel. `tools/inline.py` then renders `index.html` from
`index.src.html`, and `tools/verify.py` checks the result. Edit
`index.src.html`, never `index.html`.

With a sealed Sentinel run (its CSV, `MANIFEST.json`, `mission.json` and
`teacher_live_0.log`, from its evidence branch, in one folder):

```bash
SENTINEL_TELEMETRY=<run>/telemetry_live_0.csv SENTINEL_MANIFEST=<run>/MANIFEST.json \
python3 tools/build_assets.py && python3 tools/inline.py && python3 tools/verify.py
git checkout -- fonts/mona-sans.woff2   # the font subset is not byte-reproducible
```
