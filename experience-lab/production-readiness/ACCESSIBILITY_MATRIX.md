# Accessibility Matrix

**Status:** `PASS` · `PARTIAL` · `PENDING` · `NOT APPLICABLE`

Target: WCAG 2.2 AA for the production release. Study A at Wave D is a
prototype; this records what is actually verified.

> **Standing caveat.** All assertions below are *structural and automated*. No
> axe/Lighthouse audit and no screen-reader session has been run. Passing rows
> mean "the mechanism is present and tested", not "audited by a human using
> assistive technology".

| Concern | Applicable? | Planned behaviour | Status | Test method | Evidence | Blocking? | Notes |
|---|---|---|---|---|---|---|---|
| Semantic heading order | Yes | One h1, no skipped levels | PASS | Level-sequence assertion | `structure.spec.ts`, `no-js.spec.ts` | — | Caught a real 1→3 jump in Wave C |
| Landmarks | Yes | header / main / footer / nav | PASS | Playwright | `structure.spec.ts` | — | |
| Section labelling | Yes | Every section `aria-labelledby` | PASS | Playwright | `structure.spec.ts` | — | |
| Skip link | Yes | First tab stop, reaches main | PASS | Keyboard | `keyboard.spec.ts` | — | Moves focus, not just scroll |
| Keyboard: all controls | Yes | Everything operable | PARTIAL | Keyboard suite | `keyboard.spec.ts` | No | Inspector not interactive until Wave F |
| Keyboard: focus visible | Yes | 2px outline, 3px offset, **5.59:1 base / 5.02 inset / 6.00 raised** | PASS | Computed style + contrast | `contrast-audit.json` | — | Ring moved to `--signal-ink`; canonical vermilion measured 2.98:1 and failed SC 1.4.11 |
| Keyboard: focus order | Yes | Follows reading order | PARTIAL | Reasoned + spot checks | — | No | No automated full tab-order audit |
| Focus after anchor nav | Yes | Focus moves to target section | PASS | Keyboard | `keyboard.spec.ts` | — | `tabindex="-1"` removed on blur |
| Roving tabindex | Yes | Stepper is one tab stop | PASS | Playwright | `signal-states.spec.ts` | — | |
| Colour contrast — text | Yes | ≥4.5:1 | PASS | **Rendered-element sweep, 14 viewports, ~5,800 measurements** | `text-contrast-sweep.json` | — | Lowest 4.98:1. Pair audit alone missed 6 rules applying rule tones to read text |
| Colour contrast — UI | Yes | ≥3:1 | PASS | Same | `contrast-audit.json` | — | 17 pairs, 0 failing. Applies to non-text UI that must be perceived to operate the page |
| Decorative marks / hairlines | n/a — WCAG sets no minimum | internal floor 1.5 | n/a | Same | `contrast-audit.json` | — | **Studio policy, not conformance.** Qualifies as decorative only because colour-alone tests enforce no information dependency |
| No colour-only meaning | Yes | Word/shape/weight always present | PASS | Playwright + greyscale sheet | `structure.spec.ts`, `evidence/wave-c/grayscale/` | — | |
| Decorative SVG | Yes | `aria-hidden`, `focusable="false"` | PASS | Playwright | `structure.spec.ts` | — | |
| Text equivalent for diagram | Yes | 5 fields, updates per state | PASS | Playwright | `signal-states.spec.ts` | — | Plus a permanent 8-state legend |
| Live region | Yes | Polite, restrained | PASS | Playwright | `signal-states.spec.ts` | — | State name only; silent on no-op |
| `prefers-reduced-motion` | Yes | No travel, no autonomous motion | PASS | Emulated preference | `signal-reduced-motion.spec.ts` | — | Structural, not shortened |
| Manual motion control | Yes | Auto / Full / Reduced, persisted | PASS | Playwright | `hero-choreography.spec.ts` | — | |
| Touch target size | Yes | ≥44×44 | PASS | Bounding box | `signal-responsive.spec.ts` | — | All 10 stepper controls + rail + CTAs |
| No autoplay sound | Yes | No audio at all | PASS | Codebase | — | — | |
| No keyboard trap | Yes | — | PARTIAL | Reasoned | — | No | No modal/drawer exists to trap in |
| Dialogs avoided | Yes | None introduced | PASS | Codebase | — | — | Dossier prefers inline over modal |
| Language attribute | Yes | `lang="en"` | PASS | Markup | — | — | |
| Page title | Yes | Descriptive | PASS | Markup | — | — | |
| Duplicate element ids | Yes | None | PASS | Namespaced per view instance | — | — | Fixed in Wave D; fixture views collided |
| Automated audit (axe) | Yes | Zero criticals | PENDING | — | — | No | Not run |
| Screen-reader pass | Yes | NVDA / VoiceOver | PENDING | — | — | No | Not performed |
| 200% / 400% zoom | Yes | Reflow, no loss | PENDING | — | — | No | Not tested |
| Forced colours | Yes | Survives | PARTIAL | CSS present | — | No | Unverified |
| Form labelling / errors | Yes | — | PENDING | — | — | No | No form exists yet |
| Motion-triggered vestibular risk | Yes | Nothing large or parallax | PASS | Motion inventory | — | — | Only opacity, stroke reveal, one head translate |

## Wave E visual acceptance — 2026-08-09

| Check | Result | Verdict |
|---|---|---|
| Heading order | 18 headings, 0 skipped levels | PASS |
| Status meaning not colour-only | all four carry a word label | PASS |
| Contrast — separation head | 16.36:1 | PASS |
| Contrast — separation list | 7.80:1 | PASS |
| Contrast — endpoint link | 9.36:1 | PASS |
| Contrast — live status label | 9.43:1 | PASS |
| Contrast — limitation label | **6.43:1** (was 4.34:1 — `--risk` raised to `oklch(68% 0.135 38)`) | PASS |
| Endpoint links keyboard reachable | tabbable, 2px solid focus outline | PASS |
| Endpoint link touch target | **44px** (was 23px — corrected) | PASS |
| Accessible link names | name states destination and new-tab behaviour | PASS |
| Reduced motion | full meaning present, nothing gated behind a reveal | PASS |

Two defects were found by measurement and fixed in the interface rather than in
the assertions: the limitation label failed AA contrast, and the endpoint links
were below the 44px touch minimum at every viewport.

## Wave F — capability register, 2026-08-09

| Check | Result | Verdict |
|---|---|---|
| Heading order | 37 headings, 0 skipped levels | PASS |
| Contrast — index name / entry lede | 16.36:1 | PASS |
| Contrast — maturity chip | 9.43:1 | PASS |
| Contrast — proof source | 9.36:1 | PASS |
| Contrast — behaviours | 7.80:1 | PASS |
| Contrast — boundary label | 6.43:1 | PASS |
| Contrast — boundary text / index maturity | 4.92:1 | PASS |
| Selection not colour-only | `aria-current` + seam + glyph + font-weight ≥600 | PASS |
| Keyboard operation | click, Enter, arrows, Home/End | PASS |
| Touch targets | all ≥44px | PASS |
| Hover-only content | none | PASS |
| Without JavaScript | all 6 specimens, 6 boundaries, 20+ behaviours, 6+ proofs | PASS |
| Reduced motion | complete state, transitions disabled | PASS |

## Canonical palette reconciliation — 2026-08-09

The palette was re-mapped onto the four canonical colours (paper `#F1EBDD`, ink
`#15110F`, vermilion `#FF3D18`, violet `#4D36C8`). Teal `--evidence` (hue 205)
and amber `--signal-active` (hue 84) were removed at token level so hero, Wave E
and Wave F remain one visual system.

Contrast re-measured page-wide with a canvas pixel read — computed styles leave
`oklch()` unresolved in Chromium, so parsing them as RGB reports false
confidence. **All 20 measured pairs ≥ 4.5:1.**

| Pair | Ratio |
|---|---|
| hero headline · nav · index name · transform head | 15.79:1 |
| live label · maturity chip | 13.88:1 |
| hero lede · behaviours · proof metadata | 8.12:1 |
| endpoint link · proof source | 7.21:1 |
| limitation label · NOT CLAIMED | 5.96:1 |
| eyebrow · caption · index maturity · boundary body · note | 5.13:1 |

Canonical violet measures 2.39:1 on ink and is unusable for text; the token is
lightened to `oklch(72% 0.16 281)` (7.21:1) with hue and character preserved.
Canonical vermilion passes at its literal value (5.30:1).

## Wave G — rendered-text contrast sweep

The Wave D/E/F contrast figures came from a hand-maintained list of token pairs.
That check is a policy check and it stays, but it never looks at the document, so
it cannot see a token used somewhere it was not meant to go.

It had not been seeing exactly that. Six rules applied non-text tones to text a
visitor reads:

| Rule | Tone | Measured | Fixed to |
|---|---|---|---|
| `em` (prose emphasis) | `--signal-active` | 2.98:1 / 2.67:1 | `--signal-ink` |
| `.signal-text__title` | `--signal-active` | 3.19:1 | `--signal-ink` |
| `.route__index` ×7 | `--signal-dormant` | 1.88:1 | `--text-tertiary` |
| `.signal-caption__index` | `--signal-dormant` | 2.10:1 | `--text-tertiary` |
| `.portfolio__evidence` ×4 | `--signal-dormant` | 2.10:1 | `--text-tertiary` |
| `.stepper__index` | `--signal-dormant` | 2.10:1 | `--text-tertiary` |
| `.proof__verified[pending]` | `--signal-dormant` | 2.10:1 | `--text-tertiary` |
| `.cap-entry__index` (381–1023px only) | `--surface-line` | 2.62:1 | `--text-tertiary` |
| `.action-sequence li::before` | `--signal-dormant` | 2.10:1 | `--text-tertiary` |

`check-text-contrast.mjs` now measures every element carrying its own visible
text against its first *painted* ancestor, across 14 viewports with one either
side of each breakpoint — `.cap-entry__index` failed only in the 381–1023px band
and a desktop-plus-mobile sample reported it clean. A gate probe injects an
unreadable rule each run and fails if the sweep does not catch it.

**Result: 5,979 measurements (5,825 DOM text + 154 generated text), 0 failures,
lowest 4.98:1.**

### Generated text was a second blind spot

The sweep initially walked `childNodes` only, so it never saw a single
`::before` — including `.action-sequence li::before`, the step numbers a visitor
reads — while reporting full coverage, with a green probe throughout. It now
measures `::before` and `::after` on every visible element and records the
source of each measurement as `DOM_TEXT`, `BEFORE` or `AFTER`.

Pseudo-elements whose computed `content` is `none`, `normal`, an empty string
literal or image-only are skipped as decorative rather than counted as text — in
this design that is 79 of 101 candidates, all `content: ""` seams and rules. CSS
counters are measured without being resolved: the question is what colour the
glyphs are painted in and on what, not which digits they spell.

Each source now has its own negative probe. A DOM probe passing said nothing
about pseudo coverage, which is exactly how the gap survived. Injection happens
in the browser page only (`addStyleTag`); no repository file is mutated.

| Probe | Result |
|---|---|
| DOM probe | detected (6 matching findings) |
| PSEUDO probe | detected (7 matching findings) |
| real document | 0 failures |

### Threshold classification — three separate things

These must not be collapsed into one number:

| Class | Threshold | Status |
|---|---|---|
| Readable text | 4.5 (3.0 large) | WCAG conformance |
| Non-text UI that must be perceived to operate the page, incl. focus indicators | 3.0 | WCAG conformance (SC 1.4.11) |
| Purely decorative mark with no information dependency | 1.5 | **Internal decorative visibility floor — studio policy, not a WCAG threshold** |

WCAG defines no minimum for purely decorative marks. The 1.5 figure exists only
so a hairline does not vanish into the paper, and it must never be reported as
an accessibility conformance result. `--signal-active` (2.98:1) and
`--signal-dormant` (2.10:1) sit in that third class **only** because the
colour-alone tests in `structure.spec.ts` and `capability.spec.ts` fail if either
ever becomes the sole carrier of a state. Those tests were not weakened.

### Focus ring — genuine SC 1.4.11 failure, now fixed

Canonical vermilion on canonical paper is 2.98:1; the ring needed 3:1. The
palette was not the defect — a decorative rule may sit below threshold because
nothing depends on seeing it, but a keyboard visitor who cannot find the ring
cannot use the page. Ring moved to `--signal-ink` (same hue family) with a
companion line: **5.59 base / 5.02 inset / 6.00 raised**.

### Evidence-integrity note — the stale Wave F contrast artifact

Recorded plainly, because it affects how an accepted checkpoint should be read:

- The `contrast-audit.json` **committed at Wave F** describes the pre-paper-first
  **gold** palette (`--signal-active: oklch(88% .095 84)`).
- The `tokens.css` committed in that **same** checkpoint already contained the
  paper-first **vermilion** palette.
- The audit was never re-run after the paper-first doctrine correction, so that
  specific Wave F contrast artifact was **stale** — it does not describe the code
  it shipped with. It was not valid evidence for that checkpoint.
- Wave G re-ran the audit against the palette actually in the repository.
- That re-run exposed the focus ring at 2.98:1 — a real SC 1.4.11 failure that
  the stale artifact had concealed.
- The defect is corrected in the Wave G working state.
- The regenerated evidence **supersedes** the stale Wave F contrast artifact.

The Wave F commit is **not** amended, rewritten or reverted. The historical
checkpoint stands as it was made; only the evidence going forward is corrected.

### Open, reported not changed

`.section-heading--sub` is `font-size: var(--text-lede)` — a heading at exactly
the size of its own lede (20.0px @1440, 17.3px @390), separated only by weight.
No scale contrast. Left unchanged because the modifier originates in the
visually-accepted Wave F chapter; recommended step is
`clamp(1.5rem, 1.2rem + 1vw, 2rem)`.
