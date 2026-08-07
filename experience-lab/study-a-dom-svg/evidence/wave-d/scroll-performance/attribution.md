# Wave D.1 — scroll long-task attribution

**Question.** Wave D reported `longest scroll task @ 4× CPU: 142 ms` against a
programme budget of *no ordinary-scroll long task > 50 ms*. Where does the
142 ms come from?

**Answer.** It is the **initial boot task** — parse, execute and first render —
which the Wave D harness misfiled as a scroll measurement. There are **zero**
long tasks during scrolling, at any tested viewport, in any tested mode.

This was not dismissed as a synthetic-test artifact. It was measured.

---

## Step 1 — Reproduction

Wave D scenario repeated 6×: desktop 1440×900, CPU 4× via CDP, diagnostics on,
hero settled, synthetic full-page scroll. Long tasks classified by whether they
overlap the scroll window.

| Run | Lifetime longest (what Wave D reported) | Longest **during scroll** | Tasks in scroll window |
|---|---:|---:|---:|
| run_1 | 174 ms | **0 ms** | 0 |
| run_2 | 156 ms | **0 ms** | 0 |
| run_3 | 147 ms | **0 ms** | 0 |
| run_4 | 110 ms | **0 ms** | 0 |
| run_5 | 150 ms | **0 ms** | 0 |
| run_6 | 102 ms | **0 ms** | 0 |
| **median** | **148.5 ms** | **0 ms** | — |
| **max** | **174 ms** | **0 ms** | — |

**Classification: deterministic, and deterministically misattributed.** Every
run produces a boot task in the 102–174 ms range and *no* scroll task at all.
The Wave D figure of 142 ms sits squarely inside the boot distribution.

Raw data: `run-distribution.json`.

### Where the boot task sits

Every run shows the same shape:

```
task start ≈ 32 ms   duration 102–174 ms   attribution: containerType "window"
hero settled ≈ 2 930 ms
scrollStart  ≈ 2 940 ms      ← scrolling begins ~2.9 s after the long task ended
scrollEnd    ≈ 4 160 ms
```

The task ends around 140–210 ms. Scrolling starts around 2 940 ms. They do not
overlap and cannot be the same event. Two runs (4 and 6) additionally show a
second boot task of 57 ms at ~135–142 ms — still boot, still ~2.8 s before any
scrolling.

---

## Step 2 — Attribution

### CDP `Performance.getMetrics` deltas across the scroll window

Sampled immediately before and after the scroll, run 1 (window 1 216 ms):

| Metric | Delta across scroll |
|---|---:|
| `TaskDuration` | 154.3 ms |
| `ScriptDuration` | **0.1 ms** |
| `RecalcStyleDuration` | 11.9 ms |
| `LayoutDuration` | 4.6 ms |
| `RecalcStyleCount` | 32 |
| `LayoutCount` | 31 |

154 ms of task time spread across a 1 216 ms window — roughly 13% occupancy —
of which JavaScript is **0.1 ms**. The remainder is paint and compositing.

### CDP trace over the scroll window

Trace captured with `devtools.timeline`, 3 650 events over 1 218 ms, aggregated
by event name:

| Event | Total | Longest single | Count |
|---|---:|---:|---:|
| `RunTask` | 637.26 ms | **12.73 ms** | 1 502 |
| `Paint` | 59.55 ms | 2.39 ms | 43 |
| `RasterTask` | 39.22 ms | 1.88 ms | 109 |
| `PrePaint` | 27.32 ms | 1.09 ms | 74 |
| `Commit` | 18.91 ms | 0.97 ms | 74 |
| `UpdateLayoutTree` | 17.51 ms | 1.52 ms | 32 |
| `Layerize` | 9.87 ms | 0.76 ms | 74 |
| `Layout` | 6.95 ms | 1.03 ms | 31 |
| `TimerFire` | 6.31 ms | 0.85 ms | 20 |
| `ScrollLayer` | 2.79 ms | 0.58 ms | 63 |
| `IntersectionObserverController::computeIntersections` | 2.62 ms | 0.76 ms | 148 |
| `FunctionCall` | **0.56 ms** | 0.24 ms | 20 |
| `EventDispatch` | 0.40 ms | 0.28 ms | 63 |

**The longest single task during scrolling is 12.73 ms** — 25% of the 50 ms
budget, at 4× CPU throttle.

Raw data: `trace-summary.json`.

### Per-source verdict

| Candidate source | Verdict | Evidence |
|---|---|---|
| JavaScript execution | **Not the cause.** 0.1 ms `ScriptDuration`; 0.56 ms total `FunctionCall` | CDP deltas, trace |
| Style recalculation | Minor. 17.51 ms total across 32 recalcs, max 1.52 ms | trace |
| Layout | Minor. 6.95 ms total across 31, max 1.03 ms | trace |
| Paint | Largest scroll cost, still small. 59.55 ms total, max 2.39 ms | trace |
| Compositing / raster | 39.22 ms raster, 18.91 ms commit, max <2 ms | trace |
| SVG path work | Not separately attributable; contained within Paint, which peaks at 2.39 ms | trace |
| Chapter IntersectionObserver | **Negligible.** 2.62 ms across 148 computations, max 0.76 ms | trace |
| State caption updates | Not active — the hero has settled before scrolling begins | marks |
| Hero choreography | Not active — settled ~2.9 s before the scroll window | marks; also tested with hero *playing*, still 0 |
| Scroll handler | **None exists.** The application registers no scroll listener for state; chapter position uses IntersectionObserver | source + trace |
| Diagnostics | Not the cause — tested on and off, both 0 ms | isolation |
| Test automation / capture tooling | Not the cause — natural wheel scroll also 0 ms | isolation |
| **Boot: parse + execute + first render** | **This is the 142 ms.** 102–174 ms, starting ~32 ms, ending ~2.8 s before any scroll | run-distribution.json |

---

## Step 3 — Isolation

All at CPU 4× unless stated. `during-scroll-max` is the longest long task
overlapping the scroll window.

| Scenario | Longest during scroll | Over budget |
|---|---:|---:|
| synthetic scroll, settled | 0 ms | 0 |
| natural wheel scroll, settled | 0 ms | 0 |
| natural wheel, hero playing | 0 ms | 0 |
| synthetic, hero playing | 0 ms | 0 |
| reduced motion, natural | 0 ms | 0 |
| diagnostics OFF, natural | 0 ms | 0 |
| diagnostics ON, natural | 0 ms | 0 |
| mobile Pixel 5, natural | 0 ms | 0 |
| no CPU throttle, natural | 0 ms | 0 |

Raw data: `before-after.json`.

**Conclusion:** the problem belongs to neither the visitor experience nor the
qualification harness's *scrolling* — it belongs to the harness's
**attribution**. Both the visitor path (natural wheel) and the synthetic path
are clean.

---

## Root cause

`scripts/measure-wave-d.mjs`, Wave D version:

```js
const afterScroll = await paintTimings(page);   // cumulative, from page load
...
afterFullPageScroll: {
  longestTaskMs: afterScroll.longestTaskMs,     // max over the WHOLE lifetime
}
```

The `PerformanceObserver` accumulated long tasks from page load with
`buffered: true`. `longestTaskMs` reduced that entire list to its maximum, and
the field was then labelled `afterFullPageScroll`. The boot task is by far the
largest task in a page's life, so it won every time.

The Wave D output even carried the note *"Long tasks during initial parse/boot
are reported separately and are not scroll tasks."* They were never separated.
That note was wrong, and it made the resulting figure look more considered than
it was.

**This is a measurement defect, not an application defect.**

---

## Fix

Harness only. **No application code was changed in Wave D.1.**

`measure-wave-d.mjs` now:

- records `start` and `end` for each long task, not just duration;
- marks `scrollStart` / `scrollEnd` from inside the page;
- counts a task as a scroll task only if it overlaps the scroll window;
- reports `duringFullPageScroll` and `duringBoot` as separate objects;
- carries a `supersedes` block naming the old 142 ms figure and why it was
  invalid.

The superseded number is **retained, not deleted** — here and in
`cpu-4x-summary.json`.

### Before / after

| | Wave D | Wave D.1 |
|---|---|---|
| Reported as "longest scroll task" | 142 ms | 0 ms |
| What was actually measured | max long task over page lifetime | max long task overlapping the scroll window |
| Boot task | invisible, folded into the scroll figure | reported separately: 111 ms |
| Verdict against 50 ms budget | over budget | **within budget** |

---

## Remaining honest caveat

The boot task itself — 102–174 ms at 4× CPU — is real, and it is worth stating
plainly even though the scroll budget does not govern it:

- It is a **single** task at ~32 ms into the page, covering parse, execute and
  first render of a 12.78 kB gzip bundle.
- At 1× CPU it does not appear as a long task at all.
- It occurs **before** the hero is interactive, and the measured CTA
  availability is 64 ms — so it does not block the primary action.
- It would count against **INP** only if it coincided with an interaction,
  which at ~32 ms it cannot.

No claim is made that boot is optimal. It is simply not a scroll task, and the
scroll budget was the question.
