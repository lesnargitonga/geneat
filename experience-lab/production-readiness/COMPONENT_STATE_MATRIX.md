# Component State Matrix

Every interactive component and the states it must define (§24.7).

**Status:** `PASS` · `PARTIAL` · `PENDING` · `NOT APPLICABLE`

Rules being enforced: no hover-only information; no disabled CTA without an
explanation; loading buttons preserve width; links look like links and buttons
do not masquerade as navigation; touch targets usable on small phones.

| Component | Concern / state | Applicable? | Planned behaviour | Status | Test method | Evidence | Blocking? | Notes |
|---|---|---|---|---|---|---|---|---|
| Chapter rail link | default | Yes | Tertiary text, mono index | PASS | Playwright | `structure.spec.ts` | — | |
| Chapter rail link | hover | Yes | Text lifts to primary | PASS | Manual + CSS review | — | — | Colour only; state is not information |
| Chapter rail link | focus-visible | Yes | 2px signal outline, 3px offset | PASS | Computed style | `keyboard.spec.ts` | — | |
| Chapter rail link | current | Yes | Weight + underline + `aria-current` | PASS | Playwright | `structure.spec.ts` | — | Never colour alone |
| Chapter rail link | touch target | Yes | ≥44px | PASS | Bounding box | `signal-responsive.spec.ts` | — | Verified 320→1440 |
| Chapter rail | wrapping at 320px | Yes | Wraps to two rows | PASS | Overflow assertion | `signal-responsive.spec.ts` | — | |
| Primary CTA | default / hover / active | Yes | Solid champagne; 1px lift on fine pointer only | PASS | CSS review | — | — | Lift gated behind `(hover: hover)` |
| Primary CTA | focus-visible | Yes | Outline, 13.52:1 | PASS | Contrast audit | `contrast-audit.json` | — | |
| Primary CTA | available before animation | Yes | Present in served HTML | PASS | No-wait Playwright | `hero-timing.json` | — | 67 ms |
| Primary CTA | disabled | No | — | NOT APPLICABLE | — | — | — | No disabled CTA exists; if introduced it must explain why |
| Primary CTA | loading | No | — | NOT APPLICABLE | — | — | — | Navigation only, no async action |
| Secondary CTA | all states | Yes | Ghost border, same targets | PASS | CSS review | — | — | |
| Effects control | radio group semantics | Yes | Native radios, roving focus | PASS | Playwright roles | `keyboard.spec.ts` | — | |
| Effects control | selected | Yes | Background + text + inset bar | PASS | Playwright | `structure.spec.ts` | — | |
| Effects control | keyboard | Yes | Arrow keys move and select | PASS | Playwright | `keyboard.spec.ts` | — | |
| Effects control | persistence | Yes | localStorage, survives reload | PASS | Reload assertion | `hero-choreography.spec.ts` | — | Blocked storage degrades silently |
| Signal caption | state change | Yes | Index + label + meta track state | PASS | Playwright | `hero-choreography.spec.ts` | — | Editorial, not a control |
| Signal stepper | default / current / disabled | Yes | Full toolbar semantics | PASS | Playwright | `signal-states.spec.ts` | — | Dev-only; hidden without `?diagnostics=1` |
| Signal stepper | keyboard | Yes | Roving tabindex, arrows, Home/End | PASS | Playwright | `signal-states.spec.ts` | — | |
| Signal stepper | mobile | Yes | Horizontal scroll strip, real buttons | PASS | Bounding box | `signal-responsive.spec.ts` | — | |
| Signal stepper | visibility to visitors | Yes | Absent unless diagnostics | PASS | Playwright | `hero-choreography.spec.ts` | — | §26.4 |
| Portfolio fixture step | default / current | Yes | Border + weight + `aria-current` | PASS | Playwright | `hero-choreography.spec.ts` | — | Dev-only |
| Status label (LIVE) | rendering | Yes | Word + dot + pill outline | PASS | Playwright | `no-js.spec.ts` | — | Not colour-dependent |
| Status label (PROTOTYPE) | rendering | Yes | Word + dot + pill outline | PASS | Playwright | `no-js.spec.ts` | — | |
| Evidence label | verified | Yes | Word "Verified" + cyan | PASS | Playwright | `no-js.spec.ts` | — | |
| Evidence label | pending | Yes | "EVIDENCE PENDING" + dashed border | PASS | Playwright | `no-js.spec.ts` | — | |
| State text panel | content per state | Yes | 5 fields, all states | PASS | Playwright | `signal-states.spec.ts` | — | |
| State text panel | height stability | Yes | Reserved per breakpoint | PASS | CLS measurement | `layout-shift-summary.json` | — | Fixed in Wave D; was shifting ~21px |
| Live region | announcement | Yes | Polite, state name only | PASS | Playwright | `signal-states.spec.ts` | — | No re-announce on no-op |
| Skip link | hidden / focused | Yes | Slides in on focus | PASS | Playwright | `keyboard.spec.ts` | — | |
| Inspector stage | selection / lock / Escape | Yes | Tablist with locked selection | PENDING | — | — | No | Wave F. Content fully readable now |
| Mobile menu | open / close / Escape / focus return | Yes | — | PENDING | — | — | No | No global nav exists yet |
| Cards | default / hover / focus | Yes | — | PARTIAL | — | — | No | Project card is static; not yet interactive |
| Filters | all states | Yes | — | PENDING | — | — | No | Work index, Wave E+ |
| Forms | empty → success/error | Yes | — | PENDING | — | — | No | Contact is `mailto:` today; a real form triggers all of §24.8 |
| Modals / drawers | open / focus trap / Escape | Yes | — | PENDING | — | — | No | None introduced. Dossier prefers avoiding them |
| Password show/hide | — | No | — | NOT APPLICABLE | — | — | — | §24.9: no authentication exists. An eye icon will not be added to satisfy a generic checklist |
| Loading state | any component | Yes | Skeletons matching final geometry | PENDING | — | — | No | Nothing async yet; no spinner exists |
| Pressed state | buttons | Yes | `:active` returns to baseline | PASS | CSS review | — | — | |
| Visited link | external links | Yes | — | PENDING | — | — | No | §24.3 lists it; not yet defined |

## Wave E visual acceptance — 2026-08-09

| Component | State | Evidence | Verdict |
|---|---|---|---|
| Separation plate (`[data-transform]`) | before / after with seam | `evidence/wave-e/visual/detail-transform-status-*.png` | PASS |
| Status set — three live | one row, equal 408px columns at desktop | same | PASS |
| Status set — limitation | full-width band, risk-toned treatment, hollow ring dot | same | PASS |
| Endpoint proof links | 44px hit area, baseline underline, `↗` affordance | `detail-endpoint-proof-1440x900.png` | PASS |
| Evidence plates | 4 proof objects, each with type/source/verified/limit | flagship captures | PASS |

## Wave F — capability register, 2026-08-09

| Component | State | Evidence | Verdict |
|---|---|---|---|
| Register index | 6 entries, selection via seam + glyph + weight + `aria-current` | `evidence/wave-f/default-register-1440x900.png` | PASS |
| Inspection field | exactly one specimen visible with script; all six without | `capability.spec.ts`, `no-js.spec.ts` | PASS |
| Capability specimen | changes / behaviours / proof / maturity / **not claimed** | same | PASS |
| Maturity chip | word first, colour only reinforcing | contrast 9.43:1 | PASS |
| Boundary line | present on all six, >30 chars each | asserted | PASS |
| Glyph set | 6 marks from NODE/TRACE/BOUNDARY/GATE, no icon library | `capability-glyph.ts` | PASS |

## Wave F — model/HTML parity gate, 2026-08-09

| Check | Result | Verdict |
|---|---|---|
| `check-capability-parity.mjs` | 6 capabilities, 23 behaviours, 12 proofs match `index.html` | PASS |
| Drift detection | model edited without regeneration → checker exits non-zero and names the field | PASS |
| Separation of concerns | generation and validation are distinct scripts; the checker never writes | PASS |

## Wave G — physical intelligence, 2026-08-09

| Component | State | Evidence | Verdict |
|---|---|---|---|
| Diagnostic trace | 6 stages, one shown with script, all shown without | `physical.spec.ts`, `no-js.spec.ts` | PASS |
| Trace measurement mark | vermilion mark on the drawn path, no card | `evidence/wave-g/final-trace-1440x900.png` | PASS |
| Physical record | demonstrates / evidence / two grades / NOT CLAIMED | `final-records-1440x900.png` | PASS |
| Two-axis grading | maturity and evidence strength stamped separately | same | PASS |
| Model ↔ HTML parity | 6 stages, 4 records, 13 evidence lines | `check-physical-parity.mjs` | PASS |

## Wave G — action sequence regrade

The seven-step action sequence was styled as Wave A/B cards (filled, bordered,
rounded) and labelled `PROTOTYPE — engineering demonstration` despite having no
research, evidence or test behind it since `e6a537c`.

| Aspect | Before | After |
|---|---|---|
| Claim label | `PROTOTYPE — engineering demonstration` | `ILLUSTRATIVE CONTROL LOOP — not a built system` |
| Closing note | "Labelled a prototype…" | "Labelled illustrative…" |
| Preface | none | "nothing below was measured… no camera, package line or diverter exists" |
| Grammar | 7 filled/rounded cards | ruled list, hanging indices |
| Step index tone | `--signal-dormant` 2.10:1 | `--text-tertiary` |
| Boundary panel | dashed callout box | stamped rule block |

The steps themselves are unchanged — the discipline is the point; only the claim
and the visual weight changed.

**Layout defect caught by screenshot, not by any gate:** the first de-carded
version used CSS Grid with a `2.4rem` index column. `<strong>Observe.</strong>`
becomes its own grid item and the sentence after it becomes a separate anonymous
item, so the prose landed in the index column and wrapped one word per line.
Every automated check passed — nothing measures whether a line box is a sensible
width. Fixed with an out-of-flow counter and padding hanging indent.
