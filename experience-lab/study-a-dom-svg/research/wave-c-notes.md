# Study A — Wave C implementation notes

## Baseline

```text
branch:           experience/lesnarai-v2-study-a
head at start:    e6a537c77adbf14ea4968ebb4280d99bd64f6f39
baseline:         5479845ca8615cee3fc785c7ddd069e1f5f7671b (ancestor, verified)
study b:          experience/lesnarai-v2-study-b @ 7dc29a2, untouched
protected paths:  9 checked, all 0 lines of diff
uncommitted:      yes — Wave C is not committed
```

## Guide discrepancy

The brief asked for **Sections 22 and 23** of the master guide. The latest guide
on disk is **v0.7** (112 KB, 4,487 lines) and it **ends at Section 19**. There is
no Section 20, 21, 22 or 23 in any version present.

Worked from what exists and is relevant instead:

| Section | Content used |
|---|---|
| 7.6 | SVG anatomy — the eight named layers, behavioural rules, prohibited behaviour |
| 7.18 | Wave C definition: reusable layered signal, state changes independent of scroll, accessible state labels, deterministic test controls |
| 7.14 | Motion control — Auto / Full / Reduced |
| 7.17 | Accessibility contract |
| 3.3 | The eight canonical signal states |
| 19 | First agent execution review (Study B Waves A and B) |

§7.6 is byte-identical between v0.4 and v0.7. The brief is materially richer
than §7.18 and was treated as authoritative where the two overlap.

§19 confirmed the earlier Study B work, its five defects, and the revised
programme order — which places Study A's visual waves before Study B Wave C.
This wave follows that order.

## What was built

```
src/signal/
├── signal-types.ts          contract: 8 state ids, 8 layer ids, geometry, motion
├── signal-states.ts         the eight canonical states as data
├── signal-geometry.ts       waypoints → Catmull-Rom path, two geometries
├── signal-controller.ts     state machine, coalesced transitions
├── signal-view.ts           renders state into the SVG
├── signal-stepper.ts        development state control
├── signal-accessibility.ts  per-state text equivalent + live region
└── signal-motion.ts         motion budget, published as CSS custom properties
```

Plus `styles/stepper.css`, a rewritten `styles/signal.css`, four new test
specs, and the Wave C capture script.

### State model

`currentSegment` is the segment the head just travelled to *arrive*;
`completedSegments` are those already drawn. Reaching state N means segments
1..N exist, with N being the one that moved. Verified in the captured contract:

```text
00 idea          layers=1  nodes=0  done=0  cur=-      gate=idle     act=idle
01 observe       layers=4  nodes=4  done=0  cur=seg-1  gate=idle     act=idle
02 model         layers=4  nodes=4  done=1  cur=seg-2  gate=idle     act=idle
03 engineer      layers=4  nodes=4  done=2  cur=seg-3  gate=idle     act=idle
04 protect       layers=5  nodes=6  done=3  cur=seg-4  gate=idle     act=idle
05 human-review  layers=6  nodes=7  done=4  cur=seg-5  gate=holding  act=idle
06 act           layers=7  nodes=8  done=5  cur=seg-6  gate=passed   act=firing
07 prove         layers=8  nodes=8  done=6  cur=seg-7  gate=passed   act=recorded
```

The human gate holding is structural, not decorative: at `human-review`,
`seg-6` is `hidden` and the action node is inactive. The signal cannot proceed,
and the contract test asserts it cannot.

`act` and `prove` differ by more than a label — `prove` adds the residual-trace
layer, completes `seg-7`, and switches the action node from a filled disc
(`firing`) to a ring (`recorded`).

### Geometry

Generated, not drawn. Eight waypoints per geometry; the curve through them is a
Catmull-Rom conversion to cubic Bézier, chosen because it passes *through* every
control point — the waypoints are the states, so the path must actually touch
them. §7.20 rejects Study A if the SVG becomes "an unmaintainable illustration
with hundreds of hand-coded coordinates"; changing the shape here means moving
a point.

Two geometries — horizontal (`0 0 880 460`) and vertical (`0 0 360 736`) —
with identical state ids, node ids, segment ids, narrative order and accessible
text. Switching breakpoint preserves the current state and the text verbatim,
asserted in `signal-responsive.spec.ts`.

**viewBox is stable across all eight states** in both geometries: the captured
contract shows one distinct viewBox value across the whole sequence.

### Motion

```text
full:     transition 320ms (cap 450)   head travel 520ms (cap 650)
reduced:  transition  60ms (cap 80)    head travel none
```

Reduced mode removes head travel *structurally* — `transition-property: none`
on the head marker, asserted by reading computed style — rather than by
shortening a duration. Two independent guarantees: the view refuses to mark a
transition as animated, and the stylesheet removes the transition.

No `@keyframes`, no SMIL, no infinite iterations, nothing running after settle.

### Accessibility

The SVG is now `aria-hidden="true"` with `focusable="false"`. This is a change
from Wave B, where it was a labelled image. The reason: the graphic changes with
state, and a static label goes stale the moment the state moves.

Replacing it: a per-state panel carrying title, explanation, input, boundary and
output — the five fields required — plus the permanent eight-state legend, which
is always present regardless of the current state. A reader with no JavaScript,
or one who wants the whole sequence at once, is never sent through eight
interactions to get it.

The live region announces the state *name* only. A polite region re-reading five
paragraphs per step would make the stepper unusable with a screen reader.

## Checks

```text
npm run typecheck        0 errors
npm run build            success, 198ms
npm test                 140 passed, 1 skipped, 0 failed
npm run check:parity     10 match, 8 intentional, 0 undeclared → PASS
npm run verify:isolation 17/17 passed
```

Bundle after Wave C: **20.53 kB gzip total** (7.39 HTML + 4.39 CSS + 8.75 JS),
up from 13.31 kB. Still no runtime dependencies.

## Defects found and fixed

**1. Chapter rail overflowed at 320px.** Four links total ~359px in a
non-wrapping flex row, so the document scrolled horizontally. Pre-existing from
Wave B — it survived only because Wave B tested at 390px and never at 320px.
Fixed with `flex-wrap: wrap`.

**2. Heading order broke.** The new per-state panel used `h3` directly under the
hero's `h1`, a 1→3 jump. Changed to `h2` in both the static markup and
`signal-accessibility.ts`.

**3. `git status --porcelain` mis-parsed in two places.** The helper `.trim()`s
the whole output, which strips the leading space of the first line, shifting
every path by one character — the isolation test reported
`xperience-lab/...` as being outside Study A. Both call sites now use
`git diff --name-only`, which needs no parsing.

**4. Two isolation assertions were stale.** `verify-isolation.mjs` asserted HEAD
*equals* the baseline and that *no* tracked file is modified. Both were only
correct before Study A's first commit. They now assert the properties that
actually matter and keep holding: HEAD **descends from** the baseline, commits
since the baseline touch only Study A, and no tracked file **outside Study A**
is modified. Strictly stronger for the isolation question.

**5. Two tests measured the harness, not the app.** "State selection does not
scroll the page" recorded `scrollY` before Playwright's own scroll-into-view
before clicking. The baseline is now taken after the control is in view.

Two Wave B tests also needed updating for changed contracts — the SVG is no
longer a labelled image, and the stage now has two valid aspect ratios. Both
were rewritten rather than deleted.

## Isolation

```text
git diff 5479845 -- <9 protected paths>   all empty
git diff 5479845 -- experience-lab/study-b-webgl/   empty
experience/lesnarai-v2-study-b            7dc29a2, 55 files
tracked changes outside Study A           none
```

Study B's untracked build residue was neither staged nor deleted. It remains
exactly as found.
