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
