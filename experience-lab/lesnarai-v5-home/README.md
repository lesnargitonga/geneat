# LESNAR AI homepage, prototype v5

A coded homepage prototype for judging the direction with real material. Not
deployed, not linked from anything, `noindex`. Homepage only.

Open it with any static server from this directory:

```bash
python3 -m http.server 8822   # then http://127.0.0.1:8822/
```

## The idea

The headline makes a claim, and the list under it names the conditions that
prove it. Each condition links to the system built for it, and each system is
drawn in its own language. The company frame stays constant: one typeface
(Mona Sans, expanded only for the two largest lines), one grid, and the same
maturity line at the top of every system.

| Section | Maturity | Its own language | Material, and where it came from |
|---|---|---|---|
| MediMatch | Demonstrated | Geographic | Kenya outline, the 16 national facilities and 9 transfers from one run. Outline and coordinates from the MediMatch repo; transfers from the supply panel in its own capture, origins checked by distance in `tools/build_assets.py`. The capture itself sits under the map. |
| Operation Sentinel | Research | Telemetric | The training mission from `training/px4_waypoints.json` and the 59-column CSV header the MAVSDK bridge writes. No telemetry values are shown, because none are committed. |
| Simy | In development | A trust boundary | What the relay holds and never holds, and the first-contact envelope fields, from `docs/relay-api.md` and `docs/threat-model.md`. |
| BizMtaani, CarePro | Live | Their real interfaces | Screen recordings and captures. CarePro's four checks are its published panel. |
| Jamii, Gen-Eat, Hazina | Live, carried from v4 | Their real interfaces | Same. Labels not yet re-verified, see open questions. |
| Gold Trader | Research | An audit ledger | `docs/AUDIT_RESULTS.md`, 29 April to 29 May 2026. |
| SentinelCore | Internal | A test report | `reports/final_structural_sealing.md`, including its own list of gaps. |
| Model Foundry | Internal | An experiment record | `training/hazina/out/dataset_meta.json` and commit `61af4b1`, which removed the model from the WhatsApp path. |

`media/PROVENANCE.md` lists every file. No stock, no generated imagery, and no
studio photograph.

## Motion

Native browser features only. No Lenis, no GSAP, no library of any kind.

1. MediMatch transfers draw across the map as it scrolls through, shortest
   first, ending on Nairobi to Mandera.
2. The Sentinel mission loop draws as it enters.
3. Simy pins on wide screens: the message is text on the sender's device,
   becomes an envelope inside the relay, and opens on the far side.
4. Gold Trader's cut strategies are struck through as the ledger passes.
5. Product recordings play only while on screen.

These use CSS scroll-driven animations (`animation-timeline`), with
IntersectionObserver for video only. Where a browser has no scroll timelines
(Firefox today), or the visitor asks for reduced motion, every element shows its
finished state. Nothing animates on load.

## Measured

Local server, Chromium, slow 4G (1.6 Mbps, 150 ms) and 4x CPU slowdown:

| | Desktop 1440 | Phone 390 |
|---|---|---|
| LCP (the headline) | 0.89 to 0.92 s | about 0.86 s |
| CLS over a full scroll | 0 | 0 |
| First load | 161 KB | 116 KB |
| After a full scroll | 1.6 MB | 0.7 MB |

Most of the full-scroll weight is the five test recordings. Production adds
real network latency on top of these numbers.

## The reel test

The old recordings (1000 x 624, about 8 seconds each) were used to find out
whether a reel deserves to exist. Verdict: not as a reel. A montage of
product pages scrolling says little that a still does not. The one place motion
earns its weight is inside a product, showing a task being done: search, order,
track for BizMtaani, or the verification panel for CarePro. If that survives
review, re-record those tasks properly on the real systems at 2x. Until then the
frames are capped at the recordings' native 1000 px so they never upscale.

## Open questions

- Jamii Projects Hub, Gen-Eat and Hazina Nomads keep the Live label from v4.
  Confirm each is still public, and whether they belong on the homepage at all.
- Model Foundry is shown through the Hazina concierge experiment. Confirm that
  is what the name covers.
- Gold Trader's audit document was rerun on 30 May and says some figures
  moved. Check the family table still matches that rerun before release.
- Operation Sentinel needs one committed run: a telemetry CSV and its manifest
  would let the section show a flown path instead of a planned one.
- The later local work (Phase 9, the claims registry, commit `18a73f3`) is not
  on GitHub. This prototype was built without it.

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

## Checking the page against its sources

`tools/verify.py` confirms every figure and claim on the page appears in the
file it came from (49 checks, including counted facts such as the 59
telemetry columns and SentinelCore's eleven gaps) and that the page carries no
em dash. Run it after any copy change.

## Rebuilding the assets

`tools/build_assets.py` reads the source repos (paths via the `MEDIMATCH`,
`SENTINEL`, `V4`, `GENEAT` and `FONTSRC` environment variables) and writes
`media/` and `fonts/`. `tools/inline.py` then renders `index.html` from
`index.src.html`, and `tools/verify.py` checks the result. Edit
`index.src.html`, never `index.html`.
