# LESNAR AI — canonical visual system

Extracted from the frozen homepage by measuring computed values in the browser,
not by reading the stylesheet. Every subpage is measured against this. Where a
subpage differs it is either a deliberate variant named here, or a defect.

Reference: `index.html` at 1440×900, both themes.

---

## Typography

One family, Archivo variable (`A`), with IBM Plex Mono (`M`) for metadata only.
The width axis carries the identity — human language compressed, machine
language set plain.

| role | size | weight / stretch | line-height | tracking |
|---|---|---|---|---|
| display · hero | 149.8px (`clamp(3.4rem,10.4vw,9.5rem)`) | 800 / 104% | .86 | −.045em |
| display · section | 89.6px (`clamp(2.6rem,6.6vw,5.6rem)`) | 700 / 76% | .92 | −.038em |
| close heading | 62.4px (`clamp(2rem,4.6vw,3.9rem)`) | 700 / 80% | 1.02 | −.03em |
| record name | 54.4px (`clamp(2.1rem,4.6vw,3.9rem)`) | 700 / 76% | .94 | −.035em |
| skill name | 30.4px (`clamp(1.35rem,2.2vw,1.9rem)`) | 680 / 82% | 1.02 | −.025em |
| row name | 22.4px (`clamp(1.05rem,1.65vw,1.4rem)`) | 660 / 88% | normal | −.02em |
| body | 19px / 17px / 15px | 400 / 100% | 1.5 | normal |
| lede | 16px | 400 / 100% | 1.52 | normal |
| kicker | 12px | 600 / 100% | 1 | .01em |
| metadata (mono) | 11.5px | 500 | 1.4 | 0 |
| caption | 12.5px | 500 | 1.5 | normal |

**Rule:** 13px and below is metadata — captions, maturity, dates, counts.
Prose never goes below 15px. Nothing is uppercase except the wordmark.

## Layout

| | |
|---|---|
| content width | `max-width:1340px` |
| gutter | `clamp(18px,3.4vw,46px)` — 46px at 1440 |
| section padding | `63px 0 81px` |
| record padding | `clamp(20px,2.8vh,34px) 0` |
| record column gap | `clamp(20px,3vw,44px)` |
| skills gap | `clamp(28px,3.4vw,56px)` |
| compact row padding | `15px 0` |
| stacking breakpoint | 860px (records), 1240px (rows), 640px (rows, tight) |

**Edge bleed:** evidence images may run to the viewport edge with
`margin-right:calc(50% - 50vw)`. Their captions must return to the reading
column using `max-width:1340px` + auto margins — `calc(50vw - 50%)` resolves
against the caption's own width and does not work.

## Colour

| token | light | dark |
|---|---|---|
| `--ink` (deep surface) | `#0A0B0D` | `#08090B` |
| `--fg` (primary text) | `#0A0B0D` | `#E8EAEC` |
| `--fg-2` (metadata) | `#565C64` | `#9AA1A9` |
| `--sheet` (page ground) | `#EBECEE` | `#131619` |
| `--sheet-cool` | `#DBDEE1` | `#0F1215` |
| `--rule` | `#B6BABE` | `#2F353B` |
| `--rule-s` (strong) | `#7E848A` | `#565D65` |
| `--on-ink` | `#EDEEEF` | `#EDEEEF` |
| `--on-ink-2` | `#B6BABE` | `#B6BABE` |
| `--accent` | `#D4552A` | `#D4552A` |

Text tokens flip with theme. `--ink` and `--on-ink*` do not: ink surfaces stay
dark in both themes and only deepen. **Prose is `--fg`, metadata is `--fg-2`** —
the page ran 2.4:1 grey-to-ink before this rule and read flat.

## Interaction

- **Nav** — 11px mono, `.16em` tracking, uppercase. Exactly one item carries
  `aria-current="page"`, scoped to the header nav. Project pages mark Work.
- **Links** — anything that navigates is styled. Internal same tab; external
  `target="_blank" rel="noopener noreferrer"`.
- **CTA** — 1px border, `15px 26px` padding, no radius. Solid variant inverts.
- **Focus** — 3px outline, `--fg` on sheet, `#F4F5F6` on ink. Never removed.
- **Rows** — the whole row is the link; hover shifts `padding-left` 12px.
- **Theme toggle** — set before first paint by an inline head script; choice
  persisted in `localStorage`, otherwise follows the OS.

## Photography

- **Treatment** — `saturate(.72–.78) contrast(1.03–1.04)`. Never full saturation.
- **Scrim** — directional, not flat. Solid where type sits, clearing where the
  subject is. The hero runs `96deg` from `.78` to `.15`.
- **Verification** — text over any photograph is checked by hiding the text
  layer, screenshotting the ground, and sampling the 95th percentile of
  luminance under each text box. A DOM-walking contrast probe cannot see a
  background-image and will report the solid colour behind it.
- **Captions** — host, date, dimensions, then what the capture does *not*
  evidence.

## Motion

Four primitives only.

1. **Width axis** — names set themselves on Archivo's `wdth` axis. Headline
   opens 71→104; hero strip tightens 118→88; record names open 63→96; rows
   63→88. Driven by viewport position, never by block-arrival progress, which
   saturates in ~225px and finishes below the reading line.
2. **Photographic depth** — restrained travel on large real images only.
3. **Interaction response** — links, rows, theme, focus.
4. **Real system state** — live host verification. One probe per host, ever.

**Never:** fade text, clip text, animate fake code, run a traversal, make the
visitor wait for a loop, or finish an effect below the fold.

Every element that moves on the width axis reserves its settled height first,
so the axis reflows the line and never the page.

**Reduced motion** — every axis holds its final value; the page must look
composed, not undesigned.

## Evidence language

- **Maturity** — bordered chips: `Live product` · `Public proof` · `Checked live`.
- **Limits** — a `--rule` left border, prose at 15px, stating what is *not*
  claimed.
- **Live check** — `answered in N ms` / `no answer`. Never "HTTP 200":
  cross-origin responses are opaque, so only completion is observable.
- **Register number** — 12px mono metadata above the name. Never decorative.
