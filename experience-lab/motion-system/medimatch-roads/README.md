# MediMatch on real roads: film and hero loop (2026-11-01)

One frame-exact capture of the running product, cut into the site's two MediMatch recordings. It
replaces the 1280×720 command moment (`medimatch-720/`), which was re-cut from an older recording
whose transfers were drawn as arcs.

**Source:** MediMatch `fix/synthetic-survey-truth` at `df5a69d`, on its mock database (synthetic
inventory, public facility locations). Transfers follow stored road routes from a self-hosted OSRM
on OpenStreetMap (ODbL). Server: `USE_MOCK_DB=true PORT=4000`; client: `vite --port 5173`.

**Capture** (`capture.mjs`): headless Chromium with SwiftShader WebGL, 1600×900 CSS px at device
scale 1.5, 24 fps on a virtual clock. Playwright's clock drives timers, `requestAnimationFrame`,
`Date` and `performance`. Every CSS animation and transition is paused and seeked to the same
virtual time before each screenshot, so nothing depends on how fast the machine renders. Each
frame waits for network idle, so map tiles are in. `actions.json` holds the one scripted tap
("Nairobi research base" at 13.5 s), recorded with a touch ring. The hand and the tap on Kenya
are the product's own intro animation.

```bash
C=/srv/ai/cache/medimatch-roads; T=experience-lab/motion-system/tools; M=experience-lab/motion-system/medimatch-roads
DPR=1.5 node $M/capture.mjs $C/raw 1600 900 24 19.5 1 $M/actions.json
python3 $M/make_frames.py $C/raw $C                         # film/ (1280x720) and loop/ (960x720)
SIZE=1280x720 MAXRATE=450000 bash $T/encode_master.sh $C/film $C/mm-roads-film 24 32
ONLY=mp4 SIZE=1280x720 MAXRATE=700000 bash $T/encode_master.sh $C/film $C/mm-roads-film 24 27
SIZE=960x720 MAXRATE=330000 bash $T/encode_master.sh $C/loop $C/mm-roads-loop 24 32
ONLY=mp4 SIZE=960x720 MAXRATE=520000 bash $T/encode_master.sh $C/loop $C/mm-roads-loop 24 27
# decode gate, per file and engine
node $T/decode_frames.mjs $C/mm-roads-film.webm $C/dec 433 24 chromium && python3 $T/check_decode.py $C/film $C/dec 24
```

**Edit** (`make_frames.py`):
- **Film:** the national shot (globe, tap, landing, routes, the tap on "Nairobi research base") is
  crossfaded over 8 frames into the Nairobi County close-up. The close-up is cropped to the stats,
  road map and steps, and stops above the panel's survey strip, because survey figures are
  withdrawn from the site.
- **Loop:** a 4:3 window. It sits right of the app's own headline during the globe, then eases left
  as the map lands, so all of Kenya stays in frame. The last 12 frames crossfade into the first.

| File | Size | Decode gate (Chromium and Firefox) |
|---|---|---|
| `mm-roads-film.webm` | 1,022,032 B · 18.0 s | 433/433 frames; 0 doubled, 0 skipped, 0 off timeline; PSNR min 33.5 / median 38.7 dB |
| `mm-roads-film.mp4` | 920,818 B | 433/433; 0 / 0 / 0; PSNR min 29.9 / median 37.3 dB |
| `mm-roads-loop.webm` | 425,092 B · 12.1 s | 291/291; 0 / 0 / 0; PSNR min 36.0 / median 41.1 dB |
| `mm-roads-loop.mp4` | 440,310 B | 291/291; 0 / 0 / 0; PSNR min 33.5 / median 40.9 dB |

**On the site:**
- The film is click-to-play (`preload="none"`) on `/work/medimatch/`.
- The loop was Home's hero reel until the 2026-11-02 review (D-38) removed it from the site. The files
  remain in history at `4eef9d9`.
- Stills from the same capture are in `experience-lab/source-media/medimatch/roads-2026-11-01/`.
