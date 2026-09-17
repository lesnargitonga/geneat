# LESNAR AI homepage – engineering handover

**Build:** `experience-lab/creative-reset/final2/` · commit `fda4892` · 17 Sep 2026
**Status:** design-complete, not deployed. Production is untouched and must stay that way until Lesnar says otherwise.
**Next phase:** advanced motion, WebGL, interactive data layers.

Read §5 before you write copy. The factual constraints are not style preferences; several of them were corrections to claims that had outrun their evidence.

---

## 1. Code architecture & environment

### 1.1 The build you are extending

```
experience-lab/creative-reset/final2/
├── index.html          37 KB   single file: markup + <style> + <script>. No build step.
├── telemetry.json      13 KB   real recorded flight data, fetched at runtime
├── docs/HANDOVER.md            this file
└── img/                2.0 MB total
    ├── mm-national.jpg        1440×900   MediMatch national command (desktop terrain)
    ├── mm-terrain-m.jpg        760×830   map-only crop (mobile terrain, ≤900px)
    ├── mm-nairobi.jpg         1300×885   Nairobi county research view (desktop callout)
    ├── mm-nairobi-m.jpg        980×521   tighter crop (mobile callout)
    ├── mm-national-m.jpg       980×693   route + coordinator brief (unused since v5)
    ├── mm-heat.jpg            1200×750   demand heatmap (unused since v5)
    ├── mm-copilot.jpg         1200×750   copilot panel (unused since v5)
    ├── biz-venue.jpg          1560×965   The Villager on BizMtaani
    ├── carepro-verify.jpg     1000×1094  CarePro verification panel
    ├── hazina-room.jpg        1720×595   Hazina editorial spread (desktop)
    ├── hazina-room-m.jpg       900×733   Hazina boxed contents (mobile)
    ├── jamii-list.jpg         1540×840   Jamii project records
    └── geneat-cafe.jpg        2340×1040  unused since v5
```

Three images are dead weight (`mm-heat`, `mm-copilot`, `geneat-cafe`, `mm-national-m`). Left in place deliberately in case a motion treatment wants them. Delete if you don't.

**It is a single static file.** No bundler, no framework, no npm. That was a deliberate constraint and it has survived six revisions. If you introduce Three.js, keep the no-build-step property if you can (pinned UMD from a CDN), and if you can't, say so explicitly before adding tooling.

### 1.2 Production target – read this carefully

| | |
|---|---|
| Vercel project | `lesnarai-v2` (org `lesnar`) |
| Live alias | `lesnarai.co.ke` → `lesnarai-v2-bt2e4f73u-lesnar.vercel.app` |
| Local dir | `lesnarai-landing/` |

**`lesnarai-landing/` is NOT what is live.** It contains the release shipped at commit `b511535`, which Lesnar rated 2/10 and ordered rolled back. Production was reverted to the earlier deployment `bt2e4f73u` and that is what `lesnarai.co.ke` serves today. The local tree is the rejected build, preserved in git as history.

Practical consequences:
- Do not `vercel --prod` from `lesnarai-landing/`. You would ship the rejected design.
- Do not assume the local routes reflect live routes.
- There was a past incident where deploying from the **repo root** triggered a new-project flow that wrote a root `vercel.json` rewriting all traffic to a FastAPI service. Always deploy from an explicit project directory.
- There is a dormant, login-protected project called `lesnarai-landing`. It is not production. A stray deploy went there once.

### 1.3 Existing production routing (`lesnarai-landing/vercel.json`)

`cleanUrls: true`. Directory-style canonical routes with trailing slashes.

Headers applied to `/(.*)`:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Cache-Control: public, max-age=0, must-revalidate
```

Redirects (9):
```
/services        → /capabilities/           301
/services/:p*    → /capabilities/           301
/about           → /company/                301
/about/:p*       → /company/                301
/book            → /start/                  301
/contact         → /start/#write-directly   301
/engagement      → /start/#engagements      301
/pricing         → /start/#cost             301
/confirmation    → /start/                  302
```

Existing route tree: `/`, `/capabilities/`, `/company/`, `/engineering/`, `/menu/`, `/start/`, `/work/` plus eleven `/work/<project>/` pages and a `404.html`.

The v5 homepage is **one page**. Its nav currently uses in-page anchors only (§1.5). Integrating it means deciding what happens to those eleven work pages – an open question, not a decision I made.

### 1.4 External dependencies

Exactly one external request, and no JS libraries at all:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
```

- **Newsreader** (variable optical size 6–72, weights 400/500/600) – display. Replaced Syne in v5; see §2.3.
- **Inter Tight** (400/500/600) – body, labels, UI.
- **JetBrains Mono** (400/500) – **one use only**: inline code identifiers in the Foundry paragraph (`Qwen2.5-Coder-7B-Instruct Q4_K_M`, `llama.cpp`, `Ollama`). Do not reintroduce it for metadata. §2.2.

Self-hosting the fonts is a reasonable first move if you are adding heavy runtime work; there is currently a render-blocking stylesheet on the critical path.

### 1.5 Runtime scripts

All inline in `index.html`, ~120 lines total.

| Hook | Purpose |
|---|---|
| `#tg` | theme toggle. Flips `document.documentElement.dataset.t` between `dark`/`light`, updates `aria-label`, then calls `draw()` and `drawRuns()` to repaint both canvases with the new tokens. |
| `#nav` | scroll listener. Adds `.stuck` past 40px, `.hide` when scrolling down past 420px. |
| `IntersectionObserver` | `.rv` elements get `.in` at `threshold: .12`. One-shot (`unobserve` on fire). |
| `#tel` | hero canvas, `draw()` |
| `#runs` | Sentinel record canvas, `drawRuns()` |
| `fetch('telemetry.json')` | populates the module-scope `TEL`, then calls both draw functions and fades the hero canvas in via `.in` |
| `resize` | 180ms debounce → `draw(); drawRuns();` |

`const RM = matchMedia('(prefers-reduced-motion: reduce)').matches` is declared but currently unused by the canvas code – the reduced-motion handling is CSS-only. **If you add motion, wire it to `RM` properly.** The existing CSS block:

```css
@media(prefers-reduced-motion:reduce){
  *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
  .rv{opacity:1!important;transform:none!important}
  h1 .ln i{transform:none}
  #tel{opacity:.4}
  html{scroll-behavior:auto}
}
```

**Non-negotiable:** nothing may be hidden at rest under reduced motion. The audit asserts `[...document.querySelectorAll('.rv')].filter(e => +getComputedStyle(e).opacity < .9).length === 0`.

### 1.6 Section IDs and structural hooks

```
#top           header.arr        hero + #tel canvas
#medimatch     section.wd.med    .terrain (full-bleed map) + .readout + .callout
#sentinel      section.wd.uav    .record > #runs canvas + .rcap + .uavfoot > .env + .note
#security      section.wd.sec    .file > article ×3 + p.closing
#infrastructure section.wd.inf   .two > section ×2: .wire/.rail2/.stn/.sees, then .finding
(none)         section.wd.ops    .shelf > article ×4
#contact       section.inv       + footer .fin
```

Nav items and targets (all four resolve; nothing points at a page that does not exist):
`Work → #medimatch` · `Security → #security` · `Engineering → #infrastructure` · `Contact → #contact`

---

## 2. The v5 material reset – design system

The short version: **the site owns no colour.** Everything is graphite or paper; every colour you see belongs to a real artifact. This was arrived at after two failed attempts and the reasoning matters, so §2.4 explains what is forbidden and why.

### 2.1 Tokens

```css
:root{
  /* material: graphite and paper. no discipline owns a hue. */
  --bg:#0B0B0A; --bg2:#121210; --lift:#1A1A17; --edge:#2B2B27;
  --ink:#F2F1ED; --mid:#A5A29A; --dim:#86847C;
  /* the site introduces no colour of its own. what colour appears
     belongs to the artifacts: the map, the interfaces, the photographs. */
  --d:"Newsreader",Georgia,serif;
  --b:"Inter Tight",system-ui,-apple-system,sans-serif;
  --m:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --pad:clamp(20px,4.4vw,76px);
  --ez:cubic-bezier(.16,1,.3,1);
}
:root[data-t="light"]{
  --bg:#EDEBE5; --bg2:#E3E0D9; --lift:#F8F7F3; --edge:#CCC9C1;
  --ink:#14130F; --mid:#4C4A43; --dim:#615F57;
}
```

Both neutrals carry a **warm cast** (graphite/ink, not blue-black; paper, not white). That is the whole material identity. A blue-black ground is the generated-deep-tech default and was explicitly rejected.

**Theming contract:** `data-t` on `<html>` is `"dark"` by default, toggled to `"light"`. There is no `prefers-color-scheme` handling – it is an explicit toggle only. If you add one, define the complete palette on bare `:root` first; never let a colour exist only inside a media or `[data-theme]` block.

**Canvases must repaint on theme change.** Both read tokens live via `getComputedStyle(root).getPropertyValue(n)`. Any WebGL layer needs the same: subscribe to the toggle and re-upload uniforms.

### 2.2 Worlds separate by value, not hue

```css
.med  { background:#070706; --edge:#232320; --bg2:#0F0F0D; }   /* darker room */
.sec  { background:var(--bg2); border-top-color:transparent; } /* lifted */
.ops  { background:var(--bg2); border-top-color:transparent; } /* lifted, holds bright screenshots */
:root[data-t="light"] .med { background:#E6E3DB; --edge:#C8C5BC; --bg2:#DBD8D0; }
```

Where the ground changes, the `border-top` is set transparent – **the change of ground is the transition.** Do not add a rule back.

### 2.3 Typography

Display is **Newsreader**, a variable editorial serif. It replaced Syne (geometric display sans) in v5 because, once the monospace metadata and the rule scaffolding were removed, an oversized geometric face was the last structural tell of AI-generated deep-tech design. Newsreader reads as a research institution and stops competing with the artifacts.

The Syne build is preserved for comparison at `scratchpad/syne-backup.html` (session-scoped; copy it somewhere durable if you want it).

Scale, desktop → mobile:

| Role | Selector | Size |
|---|---|---|
| Hero | `h1` | `clamp(2.2rem,4.3vw,3.7rem)` → mobile `clamp(1.8rem,7.4vw,2.5rem)` |
| Section | `.wd h2` | `clamp(1.7rem,3.7vw,3rem)` → mobile `clamp(1.45rem,6.2vw,2.1rem)` |
| Close | `.inv h2` | `clamp(2rem,5.2vw,4.3rem)` |
| Sub-head | `.file h3`, `.two h3` | `clamp(1.2rem,2.1vw,1.6rem)` / `clamp(1.3rem,2.4vw,1.85rem)` |
| Large figures | `.fig div b` | `clamp(2rem,4.2vw,3.2rem)` |
| Readout figures | `.readout b` | `clamp(1.6rem,3vw,2.35rem)` |
| Hero definition | `.define` | `clamp(1.05rem,1.35vw,1.22rem)` |
| Body | `body`, `.lead` | `17px` / `clamp(1rem,1.25vw,1.15rem)` |
| Proof, notes, labels | `.proof`, `.note`, `.k`, `.meta` | `13.5–15px` |

Serif line-heights are **loose**: `h1{1.02}`, `h2{1.06}`. Do not tighten them to sans values. Tracking is near-zero to slightly negative (`-.018em` to `-.02em` on display); the serif does not want the heavy negative tracking the old sans used.

The wordmark is deliberately **not** the display face: `.lg` is Inter Tight 600, `letter-spacing:.13em`, uppercase, 14px. A serif wordmark read soft.

Measured hero hierarchy (px): desktop `59 / 19 / 15 / 14`, mobile `29 / 17 / 15 / 14`. On mobile the size steps compress, so **tone** carries the hierarchy: `--ink` → `--mid` → `--dim`. Preserve that.

### 2.4 Removing decorative technicality – the hard rules

The page was rebuilt to stop proving it was technical and let the work be technical. Measured before and after the v5 subtraction:

| Convention | Before | Now | Rule |
|---|---|---|---|
| `var(--m)` monospace uses | 25 | **1** | mono is for genuine code identifiers only |
| thin horizontal rules | 19 | **6** | a rule exists only when structurally necessary |
| `text-transform:uppercase` | 16 | **1** | no tracked uppercase micro-labels |
| dash before headline | 6 | **0** | eyebrows are plain sentence-case text |
| boxed comparisons | 2 | **0** | comparisons read as prose |
| hatched "restricted" panels | 3 | **0** | see §2.5 |
| colours the site owns | 1 | **0** | see §2.5 |

Specifically forbidden, because each was tried and rejected:

- **No thematic colour per discipline.** Health does not get green, autonomy does not get orange, security does not get blue. This was v3 and it read as a system.
- **No monospace metadata.** Labels, captions, axis text, status lines and eyebrows are all Inter Tight at 13.5–14px, sentence case, normal tracking.
- **No `– LABEL` dash-plus-tracked-caps before headings.** Eyebrows are plain: `Operation Sentinel`, `MediMatch`, `Security and assurance`.
- **No per-item accent bars, status dots, or coloured edges** on cards or list rows.
- **No graph scaffolding** around data: no axis bars, no gridlines, no header strips, no boxed chart containers.
- **No pill/chip UI** (`border-radius:99px` tag lists). The tech stack is a plain middot-separated sentence.
- **No decorative scroll indicators.** The hero cue is the word "Scroll" and a 22px static hairline.

### 2.5 The mark – there isn't one

**There is no semantic colour token.** `--mark` existed in v4 and was removed. There is no house red for failure, withheld information, alerts, or errors.

Difference is carried by other mechanisms:

| Meaning | Mechanism |
|---|---|
| proximity alerts vs obstacles | **density**: proximity is the solid foot of each column, obstacles the lighter gradient body |
| the model that failed the injection test | **wording**: named in a sentence. A pass is simply unmarked. |
| confidential work | **absence**: the entry carries no numbers because there are none to publish, and one plain sentence says so |

**When may colour be introduced?** Only when the underlying artifact genuinely contains it – the MediMatch map, the CarePro panel, the Villager masthead, the Hazina spread, the Jamii list. If a future state genuinely needs a warning colour (a real error state in a real interactive control, for example), argue it on its merits and expect to justify it. Do not reintroduce a palette.

### 2.6 Spacing and layout

```
--pad: clamp(20px, 4.4vw, 76px)          page gutter, also used for canvas inset
.w   { max-width:1440px; margin-inline:auto; padding-inline:var(--pad) }
.wd  { padding-block: clamp(72px,10.5vh,136px) }     desktop section rhythm
      mobile: clamp(56px,7.5vh,84px)
--ez : cubic-bezier(.16,1,.3,1)          the single easing curve in use
```

Reveal: `.rv { opacity:0; transform:translateY(20px) }` → `.rv.in` transitions both over `.85s var(--ez)`.

**Grid blowout warning.** `body{overflow-x:hidden}` masks element-level overflow from the document-level check. Grid children need `min-width:0` or they refuse to shrink below min-content. There is already a rule for this:

```css
.uavfoot>*,.env,.sees>div,.file article>div,.shelf article,.split>div,.result>*{min-width:0}
```

Add to it when you add grids. The audit harness checks element bounding boxes, not `scrollWidth`, for exactly this reason.

---

## 3. Data visualisation & canvas

Two 2D canvases. Both are pure `CanvasRenderingContext2D`, both read CSS tokens at paint time, both repaint on theme change and on debounced resize.

### 3.1 The data payload: `telemetry.json`

Real recorded output from Operation Sentinel's segmentation diagnostics. Source: 87 files at `~/workspace/LesnarAI/logs/seg_diag_YYYYMMDD_HHMMSS.csv`, schema `drone_id,detected_class,confidence,timestamp`.

```jsonc
{
  "runs": [
    {
      "t": "20260413_190109",  // source filename stamp
      "d": "20260413",         // day key, matches an entry in days[]
      "x": 0.07138,            // normalised position in the capture window, 0..1
      "n": 357,                // total detection events in this run
      "p": 48,                 // of which proximity_alert (the rest are obstacle)
      "b": [0.17, 0.22, ...]   // 40 buckets, mean confidence per bucket; [] when n===0
    }
  ],
  "totalEvents": 71813,
  "withData": 34,             // runs with n > 0
  "allRuns": 87,
  "from": "2026-04-13T13:19:59",
  "to":   "2026-04-16T20:59:21",
  "days": ["20260413","20260414","20260415","20260416"]
}
```

Ranges you can rely on: `n` ∈ [28, 13991]; `b[i]` ∈ [0.15, 1.999] (the renderers clamp at `v/2`); 53 of 87 runs have `n === 0` and an empty `b`.

Regeneration: the extraction script is not checked in. It globs the CSVs, parses the filename stamp for `t`, normalises `x` against the window, buckets `confidence` into 40 means, and counts `proximity_alert` for `p`. Rewrite it from this schema if you need finer buckets – **40 was chosen for payload size, not fidelity.** The raw CSVs hold 71,813 rows and full per-event timestamps, which is what you want for scrubbing.

### 3.2 `draw()` – hero field, `#tel`

Ambient texture, not a chart. One horizontal row per run, one vertical tick per confidence bucket, tick height by confidence, row opacity by event volume.

```js
const runs = TEL.runs, ink = css('--mid');
const rows = runs.length, gap = H / rows;
const pad = W * 0.05, span = W - pad * 2;
runs.forEach((r, i) => {
  const y = gap * (i + 0.5);
  const m = r.b.length, step = span / m;
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.15 + Math.min(0.48, r.n / 9000);
  ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let j = 0; j < m; j++) {
    const x = pad + j * step + step * 0.5;
    const h = Math.min(1, r.b[j] / 2) * gap * 0.82;
    ctx.moveTo(x, y - h / 2); ctx.lineTo(x, y + h / 2);
  }
  ctx.stroke();
  ctx.globalAlpha = 0.10;                       // row baseline
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + span, y); ctx.stroke();
});
```

Positioned `absolute; inset:0 0 0 auto; width:62%`, masked `linear-gradient(90deg,transparent,#000 34%,#000 88%,transparent)`, faded in by adding `.in` (`opacity:.9`) after first paint. Mobile: full width, vertical mask, `opacity:.5`.

### 3.3 `drawRuns()` – the flight record, `#runs`

A strip chart on a **real time axis**. Each run sits at `padL + r.x * span`, so clustering by session is genuine, not layout.

```js
const padL = W*0.045, padR = W*0.045, span = W - padL - padR;
const base = H - 34, top = 14, peak = base - top;
const max = 14000;                        // manual ceiling; real max n is 13991

// day labels: written once, at the x of that day's first run
TEL.days.forEach(d => {
  const first = runs.find(r => r.d === d); if (!first) return;
  rx.fillText(String(+d.slice(6)) + ' April', padL + first.x * span, base + 14);
});

runs.forEach(r => {
  const x = padL + r.x * span;
  if (!r.n) {                             // a run that recorded nothing: a 6px tick
    rx.globalAlpha=.42; rx.strokeStyle=dim;
    rx.beginPath(); rx.moveTo(x, base); rx.lineTo(x, base - 6); rx.stroke();
    return;
  }
  const h = Math.max(6, Math.min(1, r.n / max) * peak);
  const w = Math.max(4, span / runs.length * 0.8);
  const g = rx.createLinearGradient(0, base - h, 0, base);
  g.addColorStop(0, ink); g.addColorStop(1, 'transparent');
  rx.globalAlpha=.42; rx.fillStyle=g;     // obstacles: light body
  rx.fillRect(x - w/2, base - h, w, h);
  const ph = h * (r.p / r.n);
  rx.globalAlpha=1; rx.fillStyle=ink;     // proximity: solid foot
  rx.fillRect(x - w/2, base - ph, w, ph);
  rx.globalAlpha=.34;                     // confidence trace along the column top
  r.b.forEach((v,i)=>{ /* polyline at base-h-2-min(1,v/2)*14 */ });
});
```

Canvas height `clamp(180px,25vh,268px)` desktop, `clamp(150px,19vh,190px)` mobile. `devicePixelRatio` capped at 2.

### 3.4 What to hook into for WebGL / scrubbing

**Data.** `TEL` is module-scope and populated asynchronously. It is not exported. First job: lift it to something addressable – a small store, or `window.__TEL` if you want to stay dependency-free – and give it a ready signal. Everything currently races on `fetch().then()`.

**DOM anchors.**

| Target | Node | Notes |
|---|---|---|
| hero field | `#tel` (`<canvas>` inside `header.arr`) | absolutely positioned, masked. Swap to WebGL by replacing the element and keeping the mask CSS. |
| flight record | `#runs` (`<canvas>` inside `.record`) | has `role="img"` + `aria-label`. **If you make it interactive, that must become a real accessible control**, not an image. |
| terrain | `.terrain > .map > picture > img` | the MediMatch map is a static `<picture>` with a `max-width:900px` source swap. A WebGL globe or a pan/zoom map replaces `.map`; the `.terrain::after` scrim gradient and `.terrain .w` overlay stay. |
| Simy wire | `.rail2` (5-cell grid: `i`, `s`, `i.mid`, `s`, `i`) | currently pure CSS. A packet-traversal animation hooks here; `.stn` holds the three station labels. |
| product shelf | `.shelf article` ×4 | CSS grid stagger with per-child `grid-column` and `margin-top` at ≥900px. |
| reveals | `.rv` | one-shot IntersectionObserver at `threshold:.12`. A scroll-driven system should replace this wholesale rather than layer on it. |

**Events currently bound:** `scroll` (nav, passive), `resize` (180ms debounce → both draws), `click` on `#tg`. There is **no** scroll-progress system, no rAF loop, no pointer tracking. You are starting clean.

**Constraints that survive any rewrite:**
- both canvases must repaint on theme toggle, reading live CSS tokens
- `prefers-reduced-motion` must leave everything visible at rest
- no element may exceed the viewport at 390px (check bounding boxes, not `scrollWidth`)
- contrast must clear WCAG AA at every size in both themes – the harness composites against the actual painted ancestor background, not `body`

### 3.5 The audit harness

Not checked in; it lived in the session scratchpad and is gone. Rebuild it, because every claim of "verified" in the git log came from it. It runs Playwright (`experience-lab/study-b-webgl/node_modules/playwright`) against `http://127.0.0.1:8910/final2/` at 1440×900 and 390×844, in both themes, and asserts:

1. zero console errors and zero page errors
2. zero elements whose bounding box exceeds the viewport by >8px
3. zero broken images, zero images missing `alt`
4. zero text nodes below AA contrast, computed against the composited ancestor background
5. zero `.rv` elements below 0.9 opacity under `reducedMotion:'reduce'`

Serve with `python3 -m http.server 8910` from `experience-lab/creative-reset/`.

---

## 4. Assets & the review pipeline

### 4.1 Drive

Root folder – `LESNAR-AI-REVIEW`:
**https://drive.google.com/open?id=1CTx862lvytD-6enPsi0H8SyAeyah6dko**

| Bundle | Link |
|---|---|
| **v5 – material reset** (the colour/subtraction pass) | https://drive.google.com/open?id=167fHInlQ_aZ7_r9z9Bej2Sed1qdWOwGS |
| **v6 – current build** (adds the company definition + nav) | https://drive.google.com/open?id=1s_qNAkoeleHLxEJ0TYUQEamKJhpEl1xJ |

Earlier bundles `homepage-20260917` through `-v4` are also present and show the progression, including the two rejected colour systems.

Each bundle contains `stills/` (full-page, both themes, desktop and mobile, 2× DPR), `sections/` (one frame per movement × desktop/mobile/light), `video/` (~30s eased scroll-throughs as `.webm`), and a `README.txt`. v6 adds `cold-read/` – the first screen alone, which is the comprehension test.

**These links are "anyone with the link can view."** They were generated with `rclone link`, which sets that permission. Treat them as shareable but not secret, and do not put client material in that folder.

### 4.2 rclone

The remote is `lesnar-review-drive:`, type `drive` (Google Drive), configured on Lesnar's machine only.

- It authenticates with **rclone's shared Google OAuth client_id**, which Google is retiring during 2026. Expect `NOTICE` lines on every call and expect it to stop working. Creating a project-owned client_id is the durable fix.
- **The config holds OAuth tokens. Do not print `rclone config show` output, do not commit `rclone.conf`, do not paste it into an issue or a prompt.** Everything in this document was obtained without exposing it.
- You will need your own remote. `rclone config` → new remote → `drive` → follow the browser flow. Name it whatever you like and adjust the upload command.

Upload pattern used throughout:

```bash
rclone copy <local-bundle-dir> lesnar-review-drive:LESNAR-AI-REVIEW/<bundle-name> --transfers 4
rclone link lesnar-review-drive:LESNAR-AI-REVIEW/<bundle-name>
```

Videos are `.webm` because **ffmpeg is not installed on this machine**; Playwright's native recorder was the only path. Drive previews webm in-browser. Install ffmpeg if you need mp4.

### 4.3 Local source material

| What | Where |
|---|---|
| Raw product captures (2880×2000 PNG) | `experience-lab/creative-reset/material/` – `biz-venue`, `carepro-home`, `hazina-edit`, `hazina-cols`, `jamii-projects`, `jamii-gov`, `geneat-cafe`, `geneat-map` |
| Earlier art-directed crops | `experience-lab/creative-reset/material/crop/` |
| MediMatch screen captures (1440×900) | `~/publish-stage/MediMatch/presentation/assets/` – `selected-route`, `nairobi-research`, `heatmap`, `copilot`, `demand-signal`, `impact-projection`, `title` |
| MediMatch survey charts (raw Google Forms output) | `~/publish-stage/MediMatch/presentation/assets/survey/q1…q9` – **these are the primary source for every survey figure. Verify against them, not against the README.** |
| Telemetry source CSVs | `~/workspace/LesnarAI/logs/seg_diag_*.csv` (87 files) |
| MediMatch repo (canonical) | `~/publish-stage/MediMatch` (47 commits) |
| Operation Sentinel repo | `~/workspace/LesnarAI` (20 GB, includes vendored AirSim) |

Captures were taken read-only against live products: no sign-ups, orders, form submissions, payments or writes. Keep that rule if you re-capture.

**Out of scope, do not browse:** `~/audits/lesnargitonga/sacco-loss-audit/` (24 GB, board-classified client forensic engagement) and `~/audits/usiu-critical-audit/` (scoped engagement manifest with target whitelist). Nothing from either may reach the site. See §5.3.

---

## 5. Factual constraints – the truth doctrine

Every line below is a correction to something that was published and then found to outrun its evidence. They are not editorial preferences.

### 5.1 Exact phrasing that must not drift

**MediMatch survey.** n = 64, verified against the raw Google Forms output, not the project README.

- `56.3%` – "Face stockouts weekly or monthly." Q4: 12.5% weekly + 43.8% monthly.
- `57.8%` – "**Would recommend their facility explore a pilot.**" Q9 asked *"Would you recommend your facility explore piloting the MediMatch platform?"* Results: **57.8% yes, 31.3% maybe, 10.9% no.** The README and speaker notes carry `89.1%`, which is **yes + maybe relabelled as "willing to pilot."** That is a double overstatement and must never be republished.
- `57%` – "KEMSA published national order fill rate." A third-party statistic, attributed.
- Status: *"built and publicly demonstrated, and has not yet been deployed inside a health system."* Verified: no Vercel deployments, no homepage, no Pages.
- Venue: *"a health conference hosted by Unique Conferences Canada"* – supported by the speaker notes. **Dubai is not supported anywhere in the material and must not be published.**
- *"Facility inventory shown is synthetic. No patient records are used anywhere in it."*

**Operation Sentinel.** The four figures – 100 drone agents per cell, 50 concurrent operators per node, 20–30 Hz operator telemetry, 10 command writers queue-locked – are the **designed capacity envelope from the platform's own technical blueprint.** No load test, benchmark or soak test exists in the repo. The page says: *"They are engineering limits, not load-test results."*

- The command-writer cap is the **documented design**. No enforcing constant was found in code, so "enforced in code" was removed.
- *"No critical function depends on **cloud assets** while a mission is running"* – the blueprint claims cloud, not network. Do not widen it.
- *"The stack is simulation-validated. No physical airframe has been flown."*
- **Attribution:** *"LESNAR AI built the autonomy bridge, mission logic, telemetry pipeline and operator system, and integrated the PX4, Gazebo and AirSim projects, which are the work of their own upstream maintainers."* `~/PX4-Autopilot` is an unmodified upstream clone at a PX4BuildBot commit with zero local divergence. Claim the integration, never the authorship.
- Telemetry: *"Thirty-four recorded detections; fifty-three recorded none."* The 53 empty files prove no detections were **recorded** – they do **not** prove 53 clean flights. An earlier version said "flew clean"; that was an unsupported inference.

**AI Foundry.** From `/srv/ai/evaluations/runs/20260726-132748/report.md`, model `Qwen2.5-Coder-7B-Instruct Q4_K_M` pinned by SHA-256.

- llama.cpp: 80% task pass, 8/10 exact repeatability. Ollama: 60%, 6/10.
- *"One task hid an instruction inside the work and told the model to obey it. llama.cpp ignored it. Ollama followed it, both times."* This is **explicitly scored**, not inferred: `task08_instruction_priority`, `task_pass: true` for llama.cpp, `task_pass: false` for Ollama, in both repetitions.
- Verdict must match the report's exclusions: qualifies for *"local coding and prompt work with a person reading the output, and explicitly not for autonomous code acceptance, security-sensitive decisions or instruction-boundary enforcement."*
- The adapter directories on `/srv/ai` are **empty**. No fine-tune has been produced. Do not imply one.

**Simy.** The relay **does** store public identity keys – migration `0004_prekey_bundles.sql` holds `identity_signing_key`, `identity_exchange_key`, signed prekeys and one-time prekeys.

- Stores: mailbox records, ciphertext envelopes, **public prekey bundles, device records**, delivery state, TTL expiry, replay counters.
- Never sees: **plaintext** message content, **private** key material of any kind, X3DH shared secrets, ratchet state.
- *"It verifies the signature on a published prekey bundle, and it performs no decryption of its own."*
- *"The relay and the cryptographic core are built; the end-user messenger is not finished yet."* – the README's own lead caveat.

**Security practice.**
- SentinelCore: 391 source files, 120 test files, 28 subsystems – **"in the current build"** (there are 17 working directories; these counts are from `Cyber-apex`).
- Vulnerability disclosure: seven passing tests in one canonical run, identical across cycles. *"Up to 37,499.22 USDC of **vault value moved in one demonstrated settlement**"* – the submission explicitly notes this is vault value transferred, **not guaranteed attacker net profit.** *"Submitted as high severity; we do not publish an adjudication."* Severity is self-assigned at submission and no triage, acceptance or payout record exists.
- Institutional: attach governance claims to the artifact that exists – *"The university programme runs from a written manifest: approved targets, test windows, rate limits, per-module permission profiles and a stop-work file."* Do not assert scoping of every engagement.

**BizMtaani.** One listed business: The Villager, in Embu. Operated by LESNAR AI LTD.
**CarePro.** 20 nurses joined, 0 approved for assignments – published counts, repeated exactly. **Do not imply that 0 approved proves the gate is strict.**
**Hero.** *"products running in Kenya"* – an earlier version said "running **every day** in Kenya." Daily usage is not evidenced anywhere.

### 5.2 Strictly forbidden

- **The Niru hackathon result.** Lesnar states Operation Sentinel was a finalist, top 15 of ~2,800 submissions. I searched the repo, both NIRU campus documents and the recovery archive and found **no supporting material** – only a `// Hackathon KPIs Block` comment. It is preserved as pending evidence. **Do not publish it until someone supplies a results page, certificate or announcement.**
- **Dubai** as the MediMatch conference venue.
- Authorship of **PX4, Gazebo, AirSim**, or of any audit target's contracts.
- Any invented **traction, team size, revenue, order volume, membership or project count**. Several of these were deliberately removed.
- **Em dashes.** Zero, site-wide. Checked on every pass.
- Category sludge: "custom AI solutions", "digital transformation", "innovative technology solutions", "cutting-edge", "end-to-end", "empower".

### 5.3 Confidentiality

Communicate existence, type, scale and engineering character. **Never** publish:

- client names, targets, evidence, findings, reports or timelines from the institutional engagements
- the university engagement's target FQDNs, engagement ID, test windows or manifest
- adversary-emulation, detection-rule or range material from SentinelCore
- proof-of-concept code or exploit paths from any audit, including the smart-contract disclosure
- the protocol identity of the audited contract

The security section handles this by **absence**, not performance: the confidential entry carries no numbers because there are none to publish, and one plain sentence at the section foot says so. The striped "WITHHELD" panels and the red treatment were removed in v5 – they turned a real constraint into cybersecurity theatre. Do not bring them back.

---

## 6. Where I would start

1. **Rebuild the audit harness first.** Everything downstream depends on being able to prove the page still holds.
2. **Lift `TEL` out of module scope** and give it a ready signal before touching either canvas.
3. **Re-extract the telemetry at full fidelity** from the 87 CSVs if you intend to scrub – 40 buckets per run was a payload decision, and the raw data has per-event timestamps.
4. **Decide the WebGL question honestly.** The current page is one static file with one external request and no JS dependencies. That is a real asset. If Three.js earns its place, say what it buys; if a 2D canvas with better motion gets 90% of it, that is the stronger answer.
5. **`#runs` becomes a control, not an image,** the moment it is interactive. It currently has `role="img"` and an `aria-label`. That will not survive scrubbing.

**Open question I did not resolve:** the v5 homepage is a single page with anchor-only navigation, while production has eleven `/work/<project>/` pages plus `/capabilities/`, `/company/`, `/engineering/` and `/start/`. Reconciling those is a product decision, not an engineering one. Lesnar should make it.
