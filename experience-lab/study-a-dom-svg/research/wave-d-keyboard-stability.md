# Wave D — keyboard test stability

**Test:** `keyboard.spec.ts › keyboard navigation › every chapter link is
reachable and activates by keyboard`

**Symptom:** failed once during Wave D.2, then passed 5/5 in isolation and on
every subsequent full-suite run. Classic load-dependent flake.

**Verdict: A — test synchronisation defect. The application is correct.**

---

## Investigation

The sequence was instrumented step by step, sampling `location.hash`,
`document.activeElement`, section intersection and `scrollY` every 25 ms after
the Enter keypress. Run at **1×, 4× and 8× CPU throttle**, 6 trials each, 3
links per trial — **54 sequences**.

Representative results at 8× CPU (the harshest condition):

| Link | hash updated | focus moved | section in viewport | scroll settled |
|---|---:|---:|---:|---:|
| product | 29 ms | 29 ms | 183 ms | 696 ms |
| system | 28 ms | 28 ms | 225 ms | 795 ms |
| action | 29 ms | 29 ms | 184 ms | 697 ms |

**Incomplete sequences: 0 / 54.** Hash and focus resolve within ~15–34 ms in
every trial at every throttle level. The application does exactly what it
should, quickly and deterministically.

### Root cause

The gap between the last two columns:

```
section enters viewport at ~180-230 ms
smooth scroll actually finishes at ~700-810 ms
```

The test asserted `toBeInViewport()` (satisfied at ~200 ms) and then
immediately began the next iteration with `link.focus()`. That fires into a
smooth scroll still animating for another ~500 ms — and `focus()` scrolls the
focused element into view itself, so two scroll intentions overlap.

The resulting scroll position during the next assertion window is
load-dependent. Under a loaded full-suite run the overlap widened enough for an
assertion to observe an intermediate state. In isolation, with more headroom,
it never did — which is exactly why it passed 5/5 alone and failed once in
suite.

Nothing about the application is wrong: `scroll-behavior: smooth` is
intentional, and hash/focus are correct within ~30 ms every time. Only the
test's notion of "done" was wrong.

---

## Fix

Two helpers in `tests/helpers.ts`, used by the keyboard test and by the
equivalent pointer test in `responsive.spec.ts`:

- **`waitForScrollSettled(page)`** — polls once per animation frame
  (`polling: "raf"`) and resolves when the rounded scroll offset is identical on
  three consecutive frames.
- **`settleChapterNavigation(page, id)`** — waits for the hash to equal
  `#<id>`, then for `document.activeElement.id` to equal `<id>`, then for the
  scroll to settle.

The test now activates the link, calls `settleChapterNavigation`, and only then
asserts viewport and focus.

### Why this is deterministic

- **No sleeps.** Every wait is on observable state — hash value, active element
  identity, scroll offset stability. Nothing is timed.
- **Self-scaling.** A fast machine settles in a few frames; a loaded one takes
  more. The condition is the same either way, so load changes duration but not
  outcome.
- **The overlap is eliminated, not hidden.** The next iteration cannot begin
  until the previous scroll has genuinely stopped, so two scroll intentions can
  no longer coexist. That is the actual race, removed at its source.
- **Smooth scrolling was not disabled.** The dossier's motion behaviour is
  untouched; only the test's synchronisation changed. Disabling it globally
  would have made the test pass by removing the behaviour under test.

---

## Verification

| Check | Requirement | Result |
|---|---|---|
| Isolated repetitions | 10 consecutive passes | **10 / 10 passed** |
| Full-suite repetitions | 3 consecutive passes | **3 / 3 passed** (162 passed each) |
| Unexpected skips | zero | **zero** — the single skip is `responsive.spec.ts › proof panels stack…`, which skips itself under the desktop project by design (`test.skip(project !== "mobile")`) |
| Application regression | none | No application file changed; production bundle hashes identical (`index-wkIZVopj.css` / `index-Bz4H2C8b.js`) |

Instrumentation evidence: 54 sequences across 1×/4×/8× CPU, zero incomplete.
