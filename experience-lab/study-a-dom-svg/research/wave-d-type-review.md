# Wave D — Typography review

§26.6 requires a review, and states plainly: *do not change fonts merely to make
the page look different.*

**Decision: no typeface change in Wave D.** The stack stays as-is. What changed
is *rhythm* — scale, leading, tracking, measure and wrapping — which is where
the actual hierarchy problem was.

## Current stack

```css
--font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, "SF Mono", "Cascadia Mono", "JetBrains Mono",
             Menlo, Consolas, monospace;
```

System fonts only. No web font is loaded, so there is **no FOIT, no FOUT and no
font-driven layout shift** — measured CLS is 0 on every viewport
(`evidence/wave-d/layout-shift-summary.json`).

### Why not a custom face yet

The performance contract forbids a runtime third-party font dependency, and a
self-hosted subset is a real decision with real cost: it needs a licence, a
subsetting step, a preload strategy, `font-display` behaviour, and a fallback
metric-matched to avoid shift. Making that decision *now* would mean choosing a
typeface before the visual direction is settled, and then defending the choice
rather than the direction.

**What would justify one:** the display face is the strongest available lever
on brand distinctiveness, and a system stack means the headline looks like
every other system-stack site. If Wave E or the production build wants
typographic ownership, this is where it comes from. It is deliberately deferred,
not overlooked.

## Scale

| Token | Value | Use |
|---|---|---|
| `--text-hero` | `clamp(2.5rem, 1.6rem + 4.2vw, 5.5rem)` | the headline |
| `--text-h2` | `clamp(1.75rem, 1.4rem + 1.5vw, 2.75rem)` | section headings |
| `--text-h3` | `clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)` | project, stage headings |
| `--text-lede` | `clamp(1.0625rem, 0.98rem + 0.42vw, 1.25rem)` | hero and section ledes |
| `--text-body` | `clamp(1rem, 0.95rem + 0.22vw, 1.0625rem)` | prose |
| `--text-small` | `0.8125rem` | panels, stage detail |
| `--text-micro` | `0.6875rem` | mono labels, indices |

Ratio between hero and body at desktop is roughly 5:1 — a real scale contrast,
which was the point of the Wave D hierarchy work. Below `--text-small` there is
only one step, deliberately: two nearly identical small sizes is a common way
for a system to look accidental.

## Changes made in Wave D

| Property | Before | After | Why |
|---|---|---|---|
| headline `line-height` | inherited 1.08 | `0.94` | Three-line display at 1.08 left rivers of space; tightening made it read as one object. |
| headline `letter-spacing` | `-0.018em` | `-0.032em` | Large display needs more negative tracking than body; the inherited value was tuned for h2. |
| headline `max-width` | none | `14ch` | Forces the intended three-line break instead of reflowing per viewport. |
| headline `text-wrap` | `balance` | `balance` (kept) | Prevents "real." stranding alone. |
| lede `line-height` | 1.6 | `1.5` | 1.6 at lede size read as loose against the tightened headline. |
| lede `max-width` | 46ch | `44ch` | Slightly shorter measure; the lede is a summary, not body copy. |
| `.hero__next` | plain | rule above, `32ch` | Became a labelled threshold rather than floating micro-text. It wrapped to two lines at its earlier 22ch cap. |

## Italic usage

The italic is used in exactly one place: **"ambitious ideas"** in the headline,
in `--signal-active`.

That restraint is the reason it works. It marks the phrase the whole company
promise turns on, and because nothing else on the page is italic, it does not
have to compete. `em` is also semantically correct here — it is emphasis, not
decoration.

**Rule going forward:** italic is reserved for brand-level emphasis in display
type. It must not spread to ledes, pull quotes or section headings.

## Mono-label density

This is the most legitimate criticism of the current design, and it is a real
finding rather than a clean bill of health.

Mono uppercase micro-text currently appears in: the eyebrow, the brand lab
label, chapter rail indices, the effects legend, the signal caption, the state
panel title, all `dt` terms in the state panel and inspector, proof verification
labels, status pills, route indices, action-step numbers, and the footer.

That is **a lot**. Mono + uppercase + letter-spacing is a strong device, and
using it for every label makes it the page's default voice rather than an
accent. It currently reads as coherent because everything else is quiet, but it
is close to the point where it would start to feel like a terminal skin.

**Not changed in Wave D** — reducing it well means deciding which labels are
*technical* (module paths, indices, state ids) and which are merely *small*
(eyebrows, captions), and that is a content-architecture decision that belongs
with Wave E's proof work. Flagged explicitly so it is a decision rather than a
drift.

## Body readability

- Prose measure capped at `--measure: 62ch`; ledes at 44ch. Both inside the
  45–75ch comfortable range.
- Body `line-height: 1.6`.
- `text-wrap: pretty` on paragraphs to avoid orphans.
- No justified text, no all-caps body copy.

## Navigation and buttons

- Rail links: `--text-small`, 44px minimum target, current chapter marked by
  weight **and** underline **and** `aria-current` — never weight alone.
- Buttons: `--text-small` at weight 560, 44px minimum height. Labels are verbs
  ("See a real system", "Start a project"), not nouns.
- Effects control: real radio group; labels are single words at `--text-small`.

## Mobile wrapping

Checked at 320, 393, 768. `clamp()` handles the scale; `max-width: 14ch` on the
headline keeps the break consistent rather than letting narrow viewports produce
five ragged lines. No horizontal overflow at any tested width
(`signal-responsive.spec.ts`).

At 320px the chapter rail wraps to two rows — acceptable, and better than the
horizontal scroll it produced before Wave C's fix.

## Fallback behaviour

Because the stack is system-only, the "fallback" is simply the next family in
the list. Tested implicitly on Linux/Chromium, where `ui-sans-serif` resolves to
the platform UI face. **Not tested on macOS, Windows or iOS** — the metrics
differ, and the `14ch` headline cap in particular may produce a different break.
Recorded as a gap.

## Open items

- Mono-label density (above) — needs a decision, not a tweak.
- No custom display face; brand typographic ownership is deferred.
- Cross-platform rendering unverified.
- Tabular/numeric treatment undefined — no numerals of consequence exist yet,
  but proof metrics in Wave E will need `font-variant-numeric: tabular-nums`.
- No `font-size-adjust` fallback tuning, which will matter the moment a web
  font is introduced.
