# Study A — DOM and SVG signal prototype

Isolated prototype for the **Lesnar AI V2 experience programme**, Phase 3.

> **This is not production.** Never deployed, never indexed, and sharing no
> build, route or asset pipeline with `lesnarai-landing/`. The live site at
> `lesnarai.co.ke` is unchanged by anything in this directory.

Governing document: `LESNAR_AI_V2_MASTER_IMPLEMENTATION_GUIDE_v0.4.md`,
sections 7.1–7.20.

## What this currently is

**Waves A and B only** — the semantic baseline and the complete static
narrative. Per the brief, this wave stops before any animation:

> Do not implement: animated SVG paths, GSAP, ScrollTrigger, Three.js, WebGL,
> canvas, custom cursor, magnetic elements, tilt effects, scroll hijacking.

So the signal is a **static** layered SVG. The thesis being tested first is
that the resolved composition reads as *a system that now exists* while
completely still — if it needs motion to be legible, the design has failed and
motion would only be hiding it.

| Wave | Scope | Status |
|---|---|---|
| A | Project skeleton, isolation, accessibility foundations, README | Complete |
| B | Full static narrative, all nine units, content parity | Complete |
| C | Signal SVG state system | Not started |
| D | Hero choreography | Not started |
| E | Project transition and proof | Not started |
| F | System inspector interaction | Not started |
| G | Physical-action sequence | Not started |
| H | Qualification | Not started |

## Commands

```bash
npm install              # first run only
npm run dev              # dev server — http://localhost:5184
npm run typecheck        # tsc --noEmit
npm run build            # typecheck + production build to dist/
npm run preview          # serve the production build — http://localhost:4184
npm test                 # Playwright: builds, previews, runs the suite
npm run parity           # content parity vs Study B's frozen commit
npm run verify:isolation # production-diff + Study B integrity validation
npm run evidence         # screenshots (needs preview running)
```

## Architecture

```
index.html              the complete story — all content, all controls,
   │                    static SVG signal. Needs no JavaScript.
   └── src/main.ts      progressive enhancement only, 3.12 kB gzip
         ├── state/         experience store, motion preference
         ├── navigation/    chapter tracking, anchor focus correction
         ├── accessibility/ content-model integrity check
         └── styles/        7 stylesheets, role-based tokens
```

Zero runtime dependencies. The enhancement layer adds exactly three things:
current-chapter state on the rail, focus correction for in-page anchors, and
the Effects preference. It starts no animation, because none exists.

### Measured against Study B

| | Study A | Study B |
|---|---:|---:|
| Total transfer, gzip | **13.31 kB** | 147.00 kB |
| Runtime dependencies | **0** | 1 (`three`) |
| TypeScript modules | **7** | 22 |
| TypeScript source lines | **747** | 3,174 |

A maintainability and performance signal only. It says nothing about whether
spatial rendering communicates something SVG cannot — which is the actual
question, and one neither study can answer until Wave C.

## Content parity

`npm run parity` compares fourteen fields against Study B's **frozen commit**
(`git show 7dc29a2:…`), never the working tree. An undeclared difference fails
the run; a declared one needs a reason and an impact assessment in
`scripts/check-content-parity.mjs`.

Current: **10 match, 4 intentional, 0 undeclared → PASS**. Full analysis in
`research/content-parity.md`, machine-readable output in
`evidence/content-parity.json`.

The rule this enforces: *Study A and Study B must not use different content to
make one prototype appear stronger.*

## Evidence discipline

Three proof panels are marked `verified` and were read from this repository.
One is marked `EVIDENCE PENDING` and states **no figures at all**.

A regex guard in `tests/no-js.spec.ts` fails the build if anything shaped like
an unmeasured metric — order counts, currency amounts, uptime percentages,
latency figures — appears on the page. Nothing here claims adoption, payment
volume, performance outcomes, or a deployed robotics system.

The `LIVE` label on Gen-Eat rests on the production landing linking the product
and on the deployment target declared in this repository. **No request was made
to the running service.** That is stated on the page, not only here.

## Boundaries

Do not, in this directory:

- modify `lesnarai-landing/`, `experience-lab/study-b-webgl/`,
  `hazina-portal/`, `gen-eat-portal/`, backend code, or deployment config
- deploy anywhere, least of all `lesnarai.co.ke`
- add animated SVG, GSAP, ScrollTrigger, Three.js, WebGL or canvas
- add a custom cursor, magnetic elements, tilt effects, or scroll hijacking
- let content diverge from Study B without declaring it in the parity script

**Staging hazard:** Study B's build residue may sit on disk under
`experience-lab/study-b-webgl/`, and its `.gitignore` does not exist on this
branch. Scope any `git add` to `experience-lab/study-a-dom-svg/` —
`npm run verify:isolation` warns with the exact file list.
