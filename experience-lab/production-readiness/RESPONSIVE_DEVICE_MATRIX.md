# Responsive and Device Matrix

**Status:** `PASS` · `PARTIAL` · `PENDING` · `NOT APPLICABLE`

Automated coverage: `signal-responsive.spec.ts` (5 viewports × 8 assertions),
`responsive.spec.ts`, plus captures in `experience-lab/study-a-dom-svg/evidence/wave-d/`.

## Viewports

| Width × Height | Applicable? | Planned behaviour | Status | Test method | Evidence | Blocking? | Notes |
|---|---|---|---|---|---|---|---|
| 320 × 568 | Yes | Single column, vertical signal, no overflow | PASS | Playwright | `mobile-320.png` | — | Rail wraps to two rows; text panel reserves 32 rem |
| 360 × 800 | Yes | As 320 | PARTIAL | — | — | No | Not separately automated; between two tested widths |
| 393 × 851 | Yes | Single column, vertical geometry | PASS | Playwright + Pixel 5 profile | `mobile-393.png` | — | |
| 430 × 932 | Yes | As 393 | PARTIAL | — | — | No | Not separately automated |
| 768 × 1024 | Yes | Single column, horizontal geometry | PASS | Playwright | `tablet-768.png` | — | Below the 62 rem two-column breakpoint |
| 1024 × 768 | Yes | Two column, narrow copy column | PASS | Playwright | — | — | Text panel reserves 28.5 rem here |
| 1280 × 800 | Yes | Two column | PARTIAL | — | — | No | Between tested widths |
| 1440 × 900 | Yes | Two column, reference composition | PASS | Playwright | `desktop-1440.png` | — | |
| 1920 × 1080 | Yes | Two column, wider gutters | PASS | Capture | `desktop-1920.png` | — | |

## Input and environment

| Concern | Applicable? | Planned behaviour | Status | Test method | Evidence | Blocking? | Notes |
|---|---|---|---|---|---|---|---|
| Fine pointer | Yes | Hover states, 1px CTA lift | PASS | CSS gated on `(hover: hover) and (pointer: fine)` | — | — | |
| Coarse pointer | Yes | No hover dependency, ≥44px targets | PASS | Pixel 5 profile assertions | `signal-responsive.spec.ts` | — | No information is hover-only |
| Touch | Yes | Tap-driven, scroll-snap strip | PASS | Pixel 5 profile | — | — | |
| Keyboard | Yes | Full path, visible focus | PARTIAL | Playwright | `keyboard.spec.ts` | No | Inspector not interactive until Wave F |
| Orientation change | Yes | Geometry follows breakpoint | PARTIAL | Viewport resize test | `signal-responsive.spec.ts` | No | Resize is tested; a real device rotation is not |
| Safe-area insets | Yes | Respect notches / home indicators | PENDING | — | — | No | No `env(safe-area-inset-*)` yet; matters for a deployed mobile page |
| 200% zoom | Yes | No loss of content or function | PENDING | — | — | No | Not tested |
| 400% zoom | Yes | Reflow without horizontal scroll | PENDING | — | — | No | Not tested; WCAG 1.4.10 |
| Reduced motion | Yes | Static coherent composition | PASS | Emulated preference | `reduced-motion.png` | — | |
| Reduced data | Yes | — | PARTIAL | — | — | No | Honoured by Study B's tiering; Study A has no heavy asset to drop |
| High contrast (`prefers-contrast`) | Yes | Lighter text and borders | PARTIAL | CSS present | — | No | Block exists; contrast not separately measured |
| Forced colours | Yes | Borders and strokes survive | PARTIAL | CSS present | — | No | `forced-colors` block exists but is unverified |
| Dark / light preference | No | — | NOT APPLICABLE | — | — | — | The design is deliberately single-theme dark |
| Print | Yes | — | PENDING | — | — | No | No print stylesheet |

## Geometry equivalence

Verified at every tested viewport: identical state ids, node ids, narrative
order and accessible text across both geometries. Only the drawing changes.
Switching breakpoint preserves the current state and its text verbatim.

## Wave E visual acceptance — 2026-08-09

Full-page and flagship-detail captured at each viewport; audit measured document
overflow, element clipping and sub-44px interactive targets.

| Viewport | Overflow | Clipped | Small targets | Verdict |
|---|---|---|---|---|
| 1440×900 | 0px | 0 | 0 | PASS |
| 1280×800 | 0px | 0 | 0 | PASS |
| 1024×768 | 0px | 0 | 0 | PASS |
| 768×1024 | 0px | 0 | 0 | PASS |
| 430×932 | 0px | 0 | 0 | PASS |
| 390×844 | 0px | 0 | 0 | PASS |
| 360×800 | 0px | 0 | 0 | PASS |
| 200% zoom (720×450 @2dpr) | 0px | 0 | 0 | PASS |

Below 900px the separation plate stacks with a horizontal seam and the status set
becomes a single column. Machine evidence: `evidence/wave-e/visual/audit.json`.
