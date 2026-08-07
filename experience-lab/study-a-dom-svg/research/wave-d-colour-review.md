# Wave D — Colour review

§26.5 requires this to **audit** the black/gold/cyan system rather than assume
it is final. Measurements come from `evidence/wave-d/contrast-audit.json`,
computed in-browser from the live tokens by painting each colour to a canvas
and reading the sRGB pixel back.

> **Method note.** An earlier version of the audit read
> `getComputedStyle(...).color`. Chromium keeps `oklch()` in computed form
> rather than serialising to `rgb()`, so a numeric parse read
> "0.94 0.012 82" as an RGB triple and reported **every** pair at ~1:1. The
> canvas read gives the sRGB the display actually receives, including gamut
> clamping. Worth recording because the broken version failed everything, which
> looks like a catastrophic palette rather than a broken ruler.

## Semantic roles

| Token | Role | Value | Where it appears |
|---|---|---|---|
| `--surface-base` | Page ground | `oklch(16% 0.008 60)` | body |
| `--surface-raised` | Elevated panel | `oklch(20% 0.01 62)` | project card, inspector stages, state panel |
| `--surface-inset` | Recessed panel | `oklch(13% 0.008 58)` | proof panels, route chips, limitations |
| `--surface-line` | Border / separator | `oklch(33% 0.012 62)` | all rules and borders |
| `--text-primary` | Body and headings | `oklch(94% 0.012 82)` | headline, copy |
| `--text-secondary` | Supporting copy | `oklch(72% 0.014 74)` | ledes, definitions |
| `--text-tertiary` | Meta and labels | `oklch(60% 0.012 70)` | eyebrows, captions, mono labels |
| `--signal-dormant` | Unresolved structure | `oklch(52% 0.055 68)` | dormant path, residual trace, indices |
| `--signal-active` | Resolved signal, brand emphasis | `oklch(88% 0.095 84)` | active path, italic headline, primary CTA, focus ring |
| `--evidence` | Data / verified evidence | `oklch(76% 0.085 205)` | evidence nodes, `<code>`, verified labels |
| `--human` | Human decision | `oklch(76% 0.095 152)` | human gate, LIVE status |
| `--boundary` | Constraint | `oklch(62% 0.048 62)` | boundary bars |
| `--risk` | Failure / warning | `oklch(58% 0.115 38)` | lab banner, dev-instrumentation label |
| `--recovery` | Completed action, proof | `oklch(93% 0.032 168)` | action node |

## Contrast — measured

All 15 audited pairs pass. Body text is held to 4.5:1; non-text UI and large
display to 3:1; decorative separators to a 1.5:1 house floor.

| Pair | Ratio | Required |
|---|---:|---:|
| primary text on base | 16.36 | 4.5 |
| secondary text on base | 7.80 | 4.5 |
| tertiary text on base | 4.92 | 4.5 |
| tertiary text on inset | 5.08 | 4.5 |
| secondary text on raised | 7.28 | 4.5 |
| signal-active on base | 13.52 | 3.0 |
| signal-dormant on base | 3.48 | 3.0 |
| evidence on inset | 9.66 | 4.5 |
| human on raised | 8.80 | 3.0 |
| boundary on base | 5.29 | 3.0 |
| risk on inset | 4.47 | 3.0 |
| recovery on base | 16.00 | 3.0 |
| focus ring on base | 13.52 | 3.0 |
| primary button label | 13.05 | 4.5 |
| border on base | 1.59 | 1.5 |

### Two failures found and fixed

- **`--text-tertiary` measured 4.16 on base, 4.29 on inset.** Below the
  body-text requirement. Tertiary carries real content — eyebrows, the signal
  caption, mono labels — so it is held to 4.5 rather than the large-text
  exemption. Raised from `56%` to `60%` lightness → 4.92 / 5.08.
- **`--surface-line` measured 1.43 against base.** Borders were effectively
  invisible on some displays. Raised from `30%` to `33%` → 1.59.

Both were invisible to inspection and only surfaced because the audit was
mechanised.

## Grayscale behaviour

Verified via the Wave C greyscale contact sheet and re-checked for Wave D. No
state or status is distinguishable by hue alone:

| Distinction | Non-colour carrier |
|---|---|
| live vs prototype | the words `LIVE` and `PROTOTYPE`, plus a pill outline |
| verified vs pending | the words `Verified` / `EVIDENCE PENDING`, plus a dashed border on pending |
| selected vs unselected | `aria-current`, weight change, inset underline bar |
| human-review vs act | gate ring fill + stroke weight vs a filled action disc |
| act vs prove | filled disc vs open ring, plus the residual-trace layer appearing |
| current chapter | weight, underline, `aria-current` |

## The cyan question

§26.5 asks specifically whether cyan belongs in the Lesnar AI brand or only in
the lab signal.

**Decision: cyan stays, scoped to evidence — but it is not a brand colour.**

Reasoning:

- Its job is narrow and consistent. It marks *data and verified evidence*:
  evidence nodes, `<code>` spans, and the "Verified — read from this
  repository" labels. That is one meaning, used in one way.
- It is the only cool hue in an otherwise warm palette, which is exactly why it
  reads as "machine-checkable fact" against warm human/brand tones. Removing it
  would push evidence toward gold, and gold is already carrying brand emphasis
  and the resolved signal — two meanings on one hue is worse than three hues.
- It is never load-bearing alone (see grayscale table above).

**What it is not:** it should not appear in the logo, in navigation, on
buttons, or as a section accent. If a future wave introduces a cyan CTA or a
cyan heading, the role has leaked and this decision is void.

**Alternatives considered:**

| Option | Why not |
|---|---|
| Drop cyan; use `--text-secondary` for evidence | Evidence stops being visually distinct from ordinary prose. The proof panels are the credibility argument; they need to read as a different *kind* of statement. |
| Replace with a warm neutral | Same problem, plus it collides with `--signal-dormant`. |
| Promote cyan to a second brand colour | Rejected. Two brand hues in a system whose whole thesis is "colour communicates state" would immediately dilute that. |

## Palette discipline

No colour was added in Wave D except one, and one was **split**:

- **Added: `--boundary`.** Boundary bars previously used `--risk`. That
  conflated *constraint* with *failure* — a boundary is a healthy, expected
  part of the system, and colouring it with the failure hue made the Protect
  state read as an alarm, which §7.5 explicitly warns against. `--risk` is now
  reserved for genuine failure and warning surfaces.

Total palette: 4 surfaces, 3 text levels, 7 semantic roles. No rainbow.

## Open items

- `--risk` at 4.47 on inset passes 3:1 as a UI colour but would fail 4.5 if it
  were ever used for body text. It currently is not. If a future error state
  needs prose in this colour, it must be lightened first.
- High-contrast (`prefers-contrast: more`) overrides exist but their contrast
  has not been separately measured.
- No forced-colours (Windows High Contrast) audit has been run; the CSS has a
  `forced-colors` block but it is unverified.
