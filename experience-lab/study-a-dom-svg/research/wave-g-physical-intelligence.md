# Wave G — physical intelligence

Study A only. No production change, no deploy, no Study B change, no commit.

## The finding that set the chapter's shape

The brief proposed the greenhouse embedded system as the primary specimen,
conditional on repository evidence being sufficient. **It is not sufficient —
there is none.**

Searched: `/home/lesnar/Documents`, `/srv/ai`, this repository, and an
authenticated GitHub **code** search (scopes `repo, read:org, gist, workflow`)
for `extension:ino`, `Arduino`, `TMP36`, `HC-05` and `soil`. Nothing matched.

**That is a statement about the search, not a proof of absence.** The GitHub
search has provably incomplete coverage: control terms certain to exist in
`geneat` and `carepro` also returned zero, and neither repository ever appears
in any result set — so a zero result here is weak evidence, not proof. It must
not be written up as "the account contains no `.ino` file".

The inaccessible project disk holds a tree that cannot currently be enumerated,
so whether it contains greenhouse source is **unknown**. It is not claimed as
the cause of the gap.

The only "greenhouse" strings in this repo are ones written during Wave F,
sourced as "internal research".

So the evidence ranking is the inverse of the brief's assumption:

| Work | Evidence class | Why |
|---|---|---|
| Hardware fault isolation | **Directly verified** | Performed in this programme; kernel output recorded in `incident-2026-08-08-local-disk.md` |
| Embedded sensing and control | **Owner-attested** | Described by the person who built it; no artifact reachable |
| Aerial platform | Declared direction | Hardware inspected, nothing built |
| Radar sensing | Declared direction | A direction, not a build |

The chapter is therefore anchored on the disk diagnosis. That is not a
consolation prize: reading a failing physical system, separating media from
cable from controller, and refusing a destructive repair **is** physical
intelligence, and it is the only physical work here with machine evidence.

## Two axes, kept separate

`PhysicalMaturity` — how far the capability has been taken.
`EvidenceStrength` — how strongly the statement is evidenced.

Both are stamped on every record, so a reader sees at a glance that
`VALIDATED PROTOTYPE / OWNER-ATTESTED` is a different kind of claim from
`VERIFIED PRACTICE / DIRECTLY VERIFIED`. Collapsing them would let an
owner-attested prototype borrow the authority of a measured result.

## Structure

**The trace** — the fault as it was actually followed: Symptom → Isolate →
Measure → Classify → Contain → Recover. Each stage carries what enters, what
acts, what leaves, and how it is known. The measured output is set in the
evidence tone; the `Measure` stage carries the literal kernel line
(`Buffer I/O error on dev sdb1, logical block 0`) rather than a paraphrase,
because the paraphrase is not the proof.

`Classify` is the stage that matters most: it records what the evidence does
**not** separate, and that an earlier overclaim was withdrawn.

**The register** — four records in the Wave F grammar, each with what it
demonstrates, the evidence, both grades, and an explicit `NOT CLAIMED`.

## Interaction

One interaction: stepping the trace. It teaches causality — each step is a
consequence of the previous measurement, not an alternative view of the same
thing — which is why it is an ordered path and not a tab strip.

Complete without script (a no-JS test asserts all six stages, all four records
and the kernel line are present), keyboard operable along the path with
arrows and Home/End, no hover-only meaning, no drag, no pointer precision.

The document-level marker is `data-trace-current`, deliberately not
`data-trace-stage` — writing the stage attribute to `<html>` would make the
document match the stage selector, the collision seen twice before.

## Deliberately absent

No robot imagery, no drone photograph, no circuit-board decoration, no 3D, no
glow. No schematic is drawn for the greenhouse, because an invented diagram of
an unreachable system would be a fabricated artifact — the topology is
described in words and labelled owner-attested instead.

## Qualification

- **Text contrast:** `check-text-contrast.mjs` — every element carrying visible
  text, DOM and generated, across 14 viewports; 5,979 measurements (5,825
  `DOM_TEXT` + 154 `BEFORE`/`AFTER`), 0 failures, lowest 4.98:1
- **Token pairs:** `contrast-audit.json` — 17 pairs, 0 failing; focus ring 5.59 /
  5.02 / 6.00 on base, inset and raised
- **Performance (exact final build):** `measure-wave-g.mjs` — LCP 140ms normal /
  232ms at 4x CPU, CLS 0; Wave G chapter entry and illustrative-loop entry both
  **0 long tasks**; trace interaction avg 27.1ms / max 32.7ms
- **Responsive:** 13 configurations clean — eight viewports down to and
  including 320x568, plus reduced motion, no-JS and 200% zoom; 0 overflow,
  0 clipped, 0 sub-44px
- **Parity:** `check-physical-parity.mjs` PASS — 6 stages, 4 records, 13
  evidence lines; a test drifts the model to prove the gate bites

## The contrast harness was measuring the wrong thing

Wave G was reported at "18/18 pairs ≥ 4.5:1". That number was true and almost
worthless, because `measure-wave-d.mjs` checks a hand-maintained list of *token
pairs* — "is `--text-tertiary` legible on `--surface-inset`" — and nothing in it
ever looks at the document. It cannot see a token used somewhere it was never
meant to go.

It had not: `--signal-dormant` is declared a non-text rule tone and the pair
audit correctly held it to 3.0 as a UI colour, while five separate rules applied
it to text a visitor reads, at 2.1:1. `--signal-active` was carrying `<em>`
emphasis in prose at 2.98:1. The pair audit passed the whole time. It was
answering a different question.

`check-text-contrast.mjs` sweeps the rendered document instead: every element
holding its own visible text, painted colour against its first *painted*
ancestor, with the large-text and decorative-mark exemptions applied by measured
font size and weight rather than by assumption. Two things it refuses to assume:

- **Notation.** Chromium leaves `oklch()` unresolved in computed styles, so a
  numeric parse reads "0.94 0.012 82" as RGB and reports ~1:1 for everything.
  Every colour is painted to a canvas and read back.
- **The background.** `background-color` is `transparent` on most elements, so
  it climbs to whichever ancestor actually paints rather than assuming `body`.

Three viewports would have repeated the original mistake in a new costume:
`.cap-entry__index` failed only between 381px and 1023px, so desktop-plus-mobile
reported clean while a real tablet did not. It now runs the full matrix with a
viewport either side of every breakpoint.

### And then it had a third blind spot

Walking `childNodes` finds DOM text and nothing else. Every `::before` and
`::after` in the design was invisible to it — including
`.action-sequence li::before`, the step numbers a visitor reads — while the
sweep reported full coverage and its probe stayed green. A probe that only
exercises DOM text cannot detect a missing pseudo-element path; it was passing
for a reason that had nothing to do with the gap.

The sweep now measures both pseudo-elements on every visible element and tags
each measurement `DOM_TEXT`, `BEFORE` or `AFTER`. Generated content whose
computed `content` is `none`, `normal`, an empty string literal or image-only is
skipped as decorative — 79 of 101 candidates here, all `content: ""` seams.
Counters are measured unresolved: the colour of the glyphs is the question, not
which digits they spell. Each source has its own negative probe, injected in the
browser page only so the checker stays observation-only against source files.

One incidental fix fell out of building the pseudo probe: unclassed elements
were reported as bare `"li"`, which identifies nothing and left the probe unable
to recognise its own injected defect. Findings now name the nearest classed
ancestor.

### The focus ring was the real find

Re-running the pair audit against the actual palette showed the focus ring at
**2.98:1** — a WCAG 2.2 SC 1.4.11 failure. The cause was not a mistake in the
tokens: canonical vermilion on canonical paper simply measures 2.98:1.

The palette is not the thing to change. A decorative rule may sit at 2.98:1
because nothing depends on seeing it; a keyboard visitor who cannot locate the
focus ring cannot use the page at all. The ring moved to `--signal-ink` — same
hue family, 5.12:1 — with a companion line so it stays findable on every ground.

The two genuinely decorative tones sit at an **internal decorative visibility
floor of 1.5**. That is studio policy so a hairline does not disappear into the
paper — **WCAG defines no minimum for purely decorative marks, and 1.5 must
never be reported as a conformance figure.** Three classes, kept separate:

| Class | Threshold | Kind |
|---|---|---|
| Readable text | 4.5 / 3.0 large | WCAG conformance |
| Non-text UI required to operate the page (focus) | 3.0 | WCAG conformance, SC 1.4.11 |
| Purely decorative mark, no information dependency | 1.5 | internal floor, policy only |

A tone qualifies for the third class only because the classification is
*enforced*: `structure.spec.ts` and `capability.spec.ts` both fail if either tone
ever becomes the sole carrier of a state. Neither test was weakened.

### Stale evidence at the Wave F checkpoint

- The `contrast-audit.json` **committed at Wave F** describes the
  pre-paper-first **gold** palette (`--signal-active: oklch(88% .095 84)`).
- The `tokens.css` committed in that **same** checkpoint already contained the
  paper-first **vermilion** palette.
- The audit was never re-run after the doctrine correction. That specific Wave F
  contrast artifact was therefore **stale** — it does not describe the code it
  shipped with, and it was not valid evidence for that checkpoint.
- Wave G re-ran the audit against the palette actually in the repository.
- The re-run exposed the focus ring at 2.98:1, a real SC 1.4.11 failure the
  stale artifact had concealed.
- The defect is corrected in the Wave G working state, and the regenerated
  evidence **supersedes** the stale artifact.

The Wave F commit is **not** amended, rewritten or reverted. The historical
checkpoint stands as made; only forward evidence is corrected.

## A test defect worth recording

The forbidden-claim guard initially failed on the chapter's own disclaimers —
"no autonomous navigation" matched the pattern meant to catch the claim. The
first fix stripped a fixed window after each negation, which then failed on
chained disclaimers ("not a deployed installation, not precision agriculture,
not an IoT fleet") because the first negation consumed the window and left the
last clause exposed. It now filters by clause and self-tests that an unnegated
claim still trips it.

## The legacy action sequence

The seven-step sequence predates this wave: it entered at `e6a537c` with no
research, evidence or test behind it, labelled `PROTOTYPE — engineering
demonstration`. Sitting directly beneath measured Wave G work, it read as a
second real physical system. It is now labelled **ILLUSTRATIVE CONTROL LOOP —
not a built system**, with a note stating that nothing below it was measured and
that no camera, package line or diverter exists. The steps are kept, because the
discipline they describe is the point; only the claim changed.

Its styling was Wave A/B card grammar — seven filled, rounded boxes directly
under de-carded material, which both read as a different design language and
gave an illustration the visual weight of the evidenced records. It is now a
ruled list with hanging indices, matching the trace and the register above it.

One trap worth recording: the first version of that list used CSS Grid with a
`2.4rem` index column. `<strong>Observe.</strong>` is an element and becomes its
own grid item, while the sentence following it becomes a *separate* anonymous
item — so the prose was placed into the narrow index column and wrapped one word
per line. Grid treats the contents of a list item as several items, not one run.
The counter is positioned out of flow instead. This was caught only by opening
the screenshot; every automated gate passed on it, because nothing measures
whether a line box is a sensible width.

## Observed, not changed

`.section-heading--sub` resolves to `font-size: var(--text-lede)` — a heading
set at exactly the size of the lede beneath it (20.0px at 1440, 17.3px at 390),
separated only by weight 560 against 400. That is no scale contrast at all in
the chapter's typographic hierarchy.

It is left as-is deliberately. The modifier originates in Wave F's capability
chapter, which was visually accepted with this exact treatment, so changing it
now would restyle accepted work that nobody asked to have restyled. Recommended
fix if wanted: give the modifier its own step — roughly
`clamp(1.5rem, 1.2rem + 1vw, 2rem)` — which stays subordinate to the chapter
`h2` while clearing the lede.

## Truth boundaries — maturity, not defects

- Nothing here has been flown, built as a robot, or deployed
- The embedded prototype is owner-attested; no artifact is reachable
- Radar is a direction with no build and no measurement
- One storage fault was diagnosed; the drive was never proven dead
- No regulatory, industrial or fleet capability is implied anywhere
