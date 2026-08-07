# Wave D.2 — early interaction responsiveness

**Question.** Wave D reported the CTA "available at 64 ms" while a real boot
long task runs 102–174 ms at 4× CPU. Does 64 ms mean

**A.** rendered/visible only, or
**B.** genuinely responsive to an interaction?

**Answer: A — and the 64 ms figure was not even measured under the same
conditions as the boot task it was being compared against.**

At 4× CPU the CTA becomes visible at ~172 ms and genuinely interactive when the
boot task ends (~150–185 ms). Clicks arriving before that are **queued, not
lost** — every desktop trial navigated successfully, after waiting.

---

## Method

- Clicks dispatched through CDP `Input.dispatchMouseEvent` — the real input
  pipeline. A synthetic `element.click()` bypasses it and would report zero
  delay no matter how busy the main thread was.
- Delay measured by the browser via `PerformanceEventTiming` `first-input`:
  **`inputDelay = processingStart − startTime`**. `first-input` is used rather
  than the `event` type because `event` silently drops anything under a 16 ms
  threshold and so cannot observe a fast click.
- All arithmetic uses page-relative `performance.now()` timestamps, so Node-side
  scheduling jitter never enters a result. The requested time is reported only
  as intent.
- 7 timing points × 5 repetitions × 5 scenarios = **175 cold loads**.

Laboratory measurement, single machine, headless Chromium.

---

## The 64 ms figure was not like-for-like

| | Wave D claim | Measured here |
|---|---|---|
| Basis | `getBoundingClientRect()` returning a non-zero box | `first-input` delay from the browser |
| CPU condition | **unthrottled** | stated per scenario |
| What it proves | the element had layout | whether a click is served |

Wave D's 64 ms came from the *unthrottled* `hero-timing.json` run. This pass
measures unthrottled CTA visibility at **51.2 ms median** — consistent with 64 ms,
so the number itself was not wrong. What was wrong was placing it beside a
**4×-throttled** boot task and implying the two described the same load.

At 4× CPU the equivalent visibility figure is **171.7 ms**, not 64 ms.

---

## Results

### Headline figures

| | 4× CPU, diagnostics OFF | 1× CPU | 4× mobile 393 |
|---|---:|---:|---:|
| `cta_visible_ms` (median) | 171.7 | **51.2** | 153.2 |
| `cta_focusable_ms` (median) | 171.7 | **51.2** | 153.2 |
| `cta_response_delay` (median) | 37.0 | **0.5** | 28.7 |
| `worst_early_input_delay` | 134.3 | **6.9** | 155.1 |
| boot long task (median) | 132 | *none* | 111 |

`cta_visible_ms` and `cta_focusable_ms` are identical because the CTA is an
anchor with `href` in the served HTML: it is focusable the instant it has
layout. Both are observed via rAF polling, which cannot run during a long task —
so they are the first *observable* moment, which biases them slightly late. This
is stated rather than hidden.

### Early click distribution — 4× CPU, diagnostics OFF

| Requested | Delay median | Delay max | Inside boot task | Navigated |
|---:|---:|---:|---:|---:|
| 50 ms | 121.4 ms | 134.3 ms | 5/5 | **5/5** |
| 75 ms | 89.5 ms | 98.6 ms | 5/5 | **5/5** |
| 100 ms | 79.2 ms | 94.4 ms | 5/5 | **5/5** |
| 125 ms | 33.8 ms | 59.3 ms | 5/5 | **5/5** |
| 150 ms | 15.0 ms | 37.0 ms | 5/5 | **5/5** |
| 200 ms | 1.3 ms | 2.8 ms | 0/5 | **5/5** |
| 250 ms | 1.3 ms | 2.0 ms | 0/5 | **5/5** |

### Every other scenario

| Scenario | Delay median | Worst |
|---|---:|---:|
| 4× CPU, diagnostics ON | 46.6 ms | 150.9 ms |
| 4× CPU, diagnostics OFF | 37.0 ms | 134.3 ms |
| **1× CPU** | **0.5 ms** | **6.9 ms** |
| reduced motion, 4× | 58.0 ms | 154.0 ms |
| mobile 393, 4× | 28.7 ms | 155.1 ms |

---

## How long a click waits inside the boot task

The mechanism is unambiguous queueing behind **one** task. In every trial,
`event time + delay ≈ boot task end`:

```
requested  50ms | event at  51.3 + delay 123.7 = 175.0ms | task 34.4-169.4  waited 118.1ms
requested  75ms | event at  75.1 + delay  98.6 = 173.7ms | task 32.5-168.5  waited  93.4ms
requested 100ms | event at 100.1 + delay  68.2 = 168.3ms | task 31.5-163.5  waited  63.4ms
requested 125ms | event at 125.1 + delay  24.1 = 149.2ms | task 35.6-147.6  waited  22.5ms
requested 150ms | event at 149.3 + delay  37.0 = 186.3ms | task 40.0-182.0  waited  32.7ms
requested 200ms | event at 199.8 + delay   1.5 = 201.3ms | no overlap
requested 250ms | event at 250.1 + delay   0.9 = 251.0ms | no overlap
```

The click is served the moment the task ends. The earlier the click, the longer
the wait — and the sum is constant, which is the signature of a single blocking
task rather than accumulating work.

**No input was ever lost.** 35/35 desktop trials navigated.

---

## Attribution

| Candidate | Verdict |
|---|---|
| Boot long task (parse + execute + first render) | **This is the cause.** Delay = time remaining in the task |
| Hero choreography | Not the cause — reduced motion skips the sequence entirely and shows the *same* delay profile (worst 154 ms) |
| Diagnostics / portfolio fixture | Not the cause — ON 150.9 ms worst vs OFF 134.3 ms worst; boot medians 117 vs 132 ms, i.e. within noise. Three extra `SignalView` builds do not move the figure |
| SignalView rebuild at boot | Not dominant — see above. If three extra builds are invisible in the noise, one is too |
| Application logic | Not the cause — the delay is queueing, not execution. Handler processing time is ~0 |
| CPU throttling | **Necessary condition.** At 1× CPU no boot long task appears at all and worst delay is 6.9 ms |

---

## Decision: no application change

The delay is **bounded, decaying, and never drops input**:

- Worst observed: **155.1 ms**, under the 200 ms INP "good" threshold.
- Falls below 40 ms by 150 ms and below 3 ms by 200 ms.
- Exists only under 4× CPU emulation; unthrottled worst case is 6.9 ms.
- Occurs only for a click in the first ~150 ms of a cold load — before the CTA
  is even visible at that throttle level (172 ms), so a visitor cannot
  deliberately click it that early.

A targeted fix was considered and rejected **on evidence**: the obvious
candidate is deferring `SignalView.#build()`, which rebuilds the static SVG at
boot. But the diagnostics ON/OFF comparison runs *three additional*
`SignalView` builds and produces no measurable difference in delay. The
dominant cost is parse, execute and first render of the bundle, not the work
the application does afterwards. Deferring the rebuild would add a code path
and change when mobile geometry applies, to shave something the measurement
says is not the bottleneck.

Per the brief — *"If early interaction delay is acceptably bounded, document it
and leave application code untouched"* — **no application code was changed in
Wave D.2.**

---

## Harness limitation, recorded

Mobile trials report `navigated 0/5`. This is **not** a broken CTA.

Verified directly: on a Pixel 5 context, a normal touch-aware click navigates
correctly (`location.hash` → `#product`). A raw CDP `Input.dispatchMouseEvent`
leaves the hash empty, because Chromium routes link activation through the
touch path when `hasTouch` is set. The harness was switched to
`Input.dispatchTouchEvent`, which still did not synthesise a tap gesture
complete enough to activate the link.

Consequence: on mobile, the **delay measurements remain valid** — `first-input`
recorded real input events and real queueing — but the **navigation
confirmation column is not valid**. The CTA's mobile behaviour is confirmed
working by the separate check above and by `responsive.spec.ts`.

Not chased further because it is a synthetic-input-synthesis limitation with no
bearing on the question this pass exists to answer.

---

## Residual gaps

- Lab measurement on one machine; not field p75 data.
- `cta_visible_ms` / `cta_focusable_ms` are rAF-observed and therefore biased
  slightly late, since rAF cannot run during a long task.
- Real INP would require an interaction during ordinary use, not a scripted
  click at a fixed offset.
- Chromium only.
