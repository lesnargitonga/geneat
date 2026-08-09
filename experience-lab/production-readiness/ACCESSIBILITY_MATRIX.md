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
| Keyboard: focus visible | Yes | 2px outline, 3px offset, 13.5:1 | PASS | Computed style + contrast | `contrast-audit.json` | — | Never removed |
| Keyboard: focus order | Yes | Follows reading order | PARTIAL | Reasoned + spot checks | — | No | No automated full tab-order audit |
| Focus after anchor nav | Yes | Focus moves to target section | PASS | Keyboard | `keyboard.spec.ts` | — | `tabindex="-1"` removed on blur |
| Roving tabindex | Yes | Stepper is one tab stop | PASS | Playwright | `signal-states.spec.ts` | — | |
| Colour contrast — text | Yes | ≥4.5:1 | PASS | In-browser measurement | `contrast-audit.json` | — | Two tokens fixed in Wave D |
| Colour contrast — UI | Yes | ≥3:1 | PASS | Same | `contrast-audit.json` | — | |
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
