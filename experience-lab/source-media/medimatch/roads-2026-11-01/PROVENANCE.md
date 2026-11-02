# MediMatch road capture, 2026-11-01

Frames from one frame-exact capture of MediMatch running locally on its mock database (synthetic
inventory, public facility locations), branch `fix/synthetic-survey-truth` at `df5a69d`, with
transfers drawn along the stored road routes (self-hosted OSRM on OpenStreetMap, ODbL).

Capture: headless Chromium (SwiftShader WebGL), 1600×900 CSS px at device scale 1.5, 24 fps on a
virtual clock (Playwright clock for timers and rAF; CSS animations seeked to the same time). One
click is scripted, on "Nairobi research base" at 13.5 s, and recorded with a touch ring. The hand
and the tap on Kenya earlier are the product's own intro animation.

| File | Capture frame | Content |
|---|---|---|
| `mm-globe-flick.jpg` | 26 (1.08 s) | the intro's hand flicks the globe |
| `mm-kenya-tap.jpg` | 130 (5.42 s) | the globe settles on Kenya and the tap lands |
| `mm-roads-national.jpg` | 300 (12.5 s) | national command view, transfers on roads, Nairobi to Mandera selected |
| `mm-roads-nairobi.jpg` | 420 (17.5 s) | Nairobi County close-up, cropped to the stats, road map and steps; the panel's survey strip below is excluded because survey figures are withdrawn from the site |

Script and edit: `experience-lab/motion-system/medimatch-roads/` (capture.mjs, make_frames.py).
