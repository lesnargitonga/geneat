# Network and Failure Matrix

Behaviour under degraded and failing conditions (§24.10, §24.11).

**Status:** `PASS` · `PARTIAL` · `PENDING` · `NOT APPLICABLE`

Governing principle: *useful DOM first → proof placeholders if needed →
optional heavy enhancement later.* No mandatory branded loader, no indefinite
spinner, no blank screen while code loads.

| Condition | Applicable? | Planned behaviour | Status | Test method | Evidence | Blocking? | Notes |
|---|---|---|---|---|---|---|---|
| Slow 4G | Yes | Headline + CTA usable at first paint | PASS | CDP 400 ms RTT / 400 kbps + CPU 4× | `slow-4g-summary.json` | — | FCP 1156 ms; headline and CTA both visible at load |
| High latency, low bandwidth | Yes | Same as above | PASS | Same run | `slow-4g-summary.json` | — | Wall-clock load 1263 ms |
| 4× CPU throttle | Yes | Sequence still bounded; scroll stays usable | PASS | CDP + trace attribution | `cpu-4x-summary.json`, `scroll-performance/attribution.md` | — | FCP ~212 ms, hero ~2 758 ms. **Longest task during scroll: 0 ms** across 6 runs and 9 scenarios; longest single `RunTask` in trace 12.73 ms. See correction below |
| Offline (initial load) | Yes | Browser offline page | NOT APPLICABLE | — | — | — | No service worker; nothing to serve. Adding one is a production decision |
| Offline (after load) | Yes | Page stays usable; no async deps | PASS | Reasoned + no network calls after load | — | — | Zero runtime fetches; nothing to fail |
| Request timeout | Yes | — | NOT APPLICABLE | — | — | — | No runtime requests exist |
| Failed image | Yes | Alt text or explicit decorative status | NOT APPLICABLE | — | — | — | No raster images in the page; signal is inline SVG |
| Failed font | Yes | No FOIT/FOUT/shift | PASS | CLS measurement | `layout-shift-summary.json` | — | System stack only — no font request can fail |
| Failed animation library | Yes | Page fully usable | PASS | Dependency assertions | `signal-reduced-motion.spec.ts` | — | No animation library exists; nothing to fail |
| JavaScript unavailable | Yes | Complete story, all content | PASS | `javaScriptEnabled: false` | `no-js.spec.ts` (16 tests) | — | Stepper hidden; legend carries all 8 states |
| JavaScript errors at boot | Yes | Static hero remains coherent | PARTIAL | Reasoned | — | No | Hero stays on `idea`, a valid composition. Not fault-injection tested |
| WebGL unavailable | No | — | NOT APPLICABLE | — | — | — | Study A uses no WebGL; asserted absent |
| Third-party service failure | Yes | — | NOT APPLICABLE | — | — | — | No third-party runtime dependency of any kind |
| Cold cache | Yes | ~53 kB total transfer | PASS | Build output | `evidence/wave-d/` | — | 7.7 kB HTML + 4.9 kB CSS + 12.7 kB JS gzip |
| Warm cache | Yes | Static assets cached by filename hash | PARTIAL | Build output | — | No | Vite hashes filenames; cache headers are a deploy concern, untested |
| Retry | Yes | — | NOT APPLICABLE | — | — | — | Nothing to retry |
| Rate limiting | Yes | — | PENDING | — | — | No | Applies when a contact form exists |
| 404 route | Yes | Useful content, navigation preserved | PENDING | — | — | No | Single page; no routing yet |
| 500 / server failure | Yes | Useful content preserved | PENDING | — | — | No | Static hosting; applies when an API is involved |
| Expired external link | Yes | — | PENDING | — | No | No | `geneat.lesnarai.co.ke` is linked but not health-checked |

## Correction: the "142 ms scroll task" was a measurement defect

**Wave D reported** `longest scroll task @ 4× CPU: 142 ms`, over the 50 ms
budget, and flagged it as unresolved.

**Wave D.1 investigated it rather than dismissing it.** Full method and
evidence: `study-a-dom-svg/evidence/wave-d/scroll-performance/attribution.md`.

Findings:

- Across **6 reproduction runs**, long tasks overlapping the scroll window:
  **0, every time.** Lifetime maxima were 102–174 ms, all from a single boot
  task starting ~32 ms into the page — roughly **2.8 seconds before scrolling
  began**.
- Across **9 isolation scenarios** — synthetic and natural wheel scroll, hero
  playing and settled, reduced motion, diagnostics on and off, mobile, and
  unthrottled — the longest scroll task was **0 ms** in every case.
- CDP metrics across the scroll window: `ScriptDuration` **0.1 ms**,
  `RecalcStyleDuration` 11.9 ms, `LayoutDuration` 4.6 ms.
- CDP trace: longest single `RunTask` during scroll **12.73 ms**; total
  `FunctionCall` 0.56 ms; chapter IntersectionObserver 2.62 ms across 148
  computations.

**Root cause:** the harness reduced a *cumulative* long-task list to its
lifetime maximum and labelled the result `afterFullPageScroll`. The boot task
is the largest task in a page's life, so it won every run. The old output even
claimed boot tasks were "reported separately" — they were not.

**Fix:** harness only. No application code changed. Long tasks are now
attributed to the scroll window by timestamp overlap, and boot is reported as
its own figure. The superseded 142 ms is retained in the evidence rather than
deleted.

**Residual, stated plainly:** the boot task itself (102–174 ms at 4× CPU,
111 ms in the corrected run) is real. It is a single task at ~32 ms covering
parse, execute and first render; it does not appear as a long task at 1× CPU;
and it precedes interactivity, with CTA availability measured at 64 ms. It is
not governed by the scroll budget, and no claim is made that boot is optimal.
