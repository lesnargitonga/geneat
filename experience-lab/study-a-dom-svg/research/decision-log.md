# Study A — Decision log

Waves A, B, C and D. Each entry records what was decided, why, and what would
reverse it.

---

## D-01 — Guide v1.1 located; §22/§23 confusion resolved

Wave C was asked for §22/§23 of a guide that ended at §19. **v1.1 exists** (6,417
lines) and contains §24 Production Experience Completeness Contract, §25
Portfolio-Aware Experience Rule and §26 Study A Wave D. All three were read in
full and are the basis for this wave. §22 and §23 in v1.1 are the Study A
baseline checkpoint and the Wave C spec respectively — so the earlier prompt's
reference was to a later document than the one on disk at the time.

---

## D-02 — The hero schedules the Wave C machine; it is not a machine

`HeroChoreography` holds timing only. It calls `SignalController.goTo` and owns
no state. §26.2 forbids a second hero-only state machine, and the assertion that
`HERO_SEQUENCE` equals the canonical state ids fails the build if one appears.

Dwell: 340 ms per state, 420 ms for Protect, 620 ms for Human review — total
2740 ms, inside the 2.2–3.2 s window. Human review is longest because the gate
is the one moment the sequence should feel *held* rather than paced.

---

## D-03 — The sequence yields; it never fights the visitor

Wheel, touch, key, pointer or a >24 px scroll cancels the remaining schedule and
leaves the signal where it is. It deliberately does **not** snap to `prove`:
jumping the composition under someone who has started driving is the animation
overriding the person. All listeners are passive so scrolling is never delayed.

---

## D-04 — Reduced motion does not run the sequence at all

Rather than running it faster, reduced mode places the signal directly on
`prove` and reports `settled` with 0 ms elapsed. A faster movement is still a
movement. Nothing is lost: `prove` is the most complete state, so the reduced
view is the whole story rather than an abbreviation.

---

## D-05 — The stepper leaves the page; a caption replaces it

§26.4 requires the development stepper not to read as homepage navigation. It is
now inside `[data-lab-tools]`, hidden unless `?diagnostics=1`, with all
functionality intact.

Its visible replacement is an **authored caption** — index, state name, rule,
"state N of 8" — which reports where the signal is the way a caption reports
what a figure shows. Editorial, not a control.

---

## D-06 — The engine is parameterised over its sequence

`SignalController<S extends SequenceState>` takes a `states` array, defaulting
to the canonical eight. Project grammars are different arrays driven by the same
class, and `SequenceState` was introduced so they are first-class inputs rather
than casts smuggled past the type system.

Geometry became a function of step count (`createSequenceGeometry`) for the same
reason: geometry that only existed for eight waypoints would have hard-wired the
canonical sequence into the renderer.

---

## D-07 — `--boundary` split from `--risk`

Boundary bars used the failure hue, which made the Protect state read as an
alarm — §7.5 warns against exactly that. A constraint is a healthy part of the
system, not a fault. `--risk` is now reserved for genuine failure surfaces.

---

## D-08 — Contrast measured, not eyeballed; two tokens raised

The audit found `--text-tertiary` at 4.16:1 and `--surface-line` at 1.43:1, both
below threshold. Raised to 60% and 33% lightness. Neither was visible to
inspection.

The first version of the audit reported **every** pair at ~1:1 because it parsed
`getComputedStyle(...).color`, which Chromium leaves in `oklch()` form — so
"0.94 0.012 82" was read as an RGB triple. Replaced with a canvas pixel read.
Recorded because a broken ruler that fails everything looks like a catastrophic
palette.

---

## D-09 — View element ids are namespaced per instance

Four `SignalView` instances now exist on one page (hero + three grammars).
Hard-coded ids produced duplicates — invalid HTML, and ambiguous for
`getElementById`, anchors and assistive technology. Ids take an `idPrefix`;
styling and tests key off `data-` attributes so they work across every instance.

---

## D-10 — The state panel reserves its height

Explanation length differs per state, so advancing the signal reflowed
everything below it — a layout-shift source, and it made "selecting a state must
not scroll the page" untrue by ~21 px. Heights are now reserved per breakpoint
from measured worst cases (32 / 28.5 / 21.5 rem). Measured CLS after stepping
all eight states: 0.0001 desktop, 0 on both mobile widths.

---

## Waves A, B and C

---

## C-01 — Sections 22 and 23 do not exist

**Context.** The Wave C brief asked for Sections 22 and 23 of the latest master
guide. The newest guide on disk is **v0.7** (4,487 lines) and it ends at
**Section 19**.

**Decision.** Proceed using §7.6 (SVG anatomy), §7.18 (Wave C definition), §7.14,
§7.17, §3.3 and §19, and treat the brief as authoritative where it is richer.

**Reasoning.** §7.6 is byte-identical between v0.4 and v0.7, so the layer
contract is stable. §7.18's Wave C is four lines; the brief specifies the state
contract, stepper, motion budget and evidence in detail. Inventing content for
non-existent sections would have been worse than working from what exists and
saying so.

---

## C-02 — The two sequences stay separate, and a test enforces it

**Decision.** The eight company-level signal states live in
`signal/signal-states.ts`; the seven-step physical-action sequence stays in
`content.ts`. Separate types, separate modules.

**Reasoning.** They share two words — Observe and Act — and nothing else.
Merging or renaming either is explicitly forbidden, and shared vocabulary is
exactly how such a merge happens by accident.

`signal-contract.spec.ts` asserts the separation directly: `detect`, `verify`,
`command` and `record` must exist in the action sequence and must **not** appear
in the signal states; `idea`, `model`, `engineer`, `protect`, `human-review` and
`prove` must hold the reverse.

---

## C-03 — Geometry is generated from waypoints

**Decision.** Eight waypoints per geometry; the path is a Catmull-Rom curve
converted to cubic Bézier at build time in `signal-geometry.ts`.

**Reasoning.** §7.20 rejects Study A if the SVG becomes "an unmaintainable
illustration with hundreds of hand-coded coordinates". Catmull-Rom specifically
because it passes *through* its control points — the waypoints are the states,
so the head must land exactly on them, and a spline that merely approximates
would place the signal head slightly off its own state.

---

## C-04 — Segments are separate elements, not one dash-offset path

**Decision.** Seven `<path>` elements, each toggled between hidden / current /
complete.

**Reasoning.** Stroke reveal via `stroke-dashoffset` requires path-length
arithmetic that changes with every geometry edit and differs between the two
geometries. Per-segment elements make reveal deterministic, make "which segments
are drawn" directly assertable in a test, and make the state contract
checkable from the DOM rather than inferred from a computed style.

---

## C-05 — The SVG became `aria-hidden`

**Decision.** `aria-hidden="true"`, `focusable="false"`, replaced by a per-state
text panel plus the permanent legend.

**Reasoning.** Required by the brief, and correct: the graphic now changes with
state, so the Wave B `role="img"` + static description would describe the wrong
state as soon as anything moved.

**Risk accepted and mitigated.** This removes the labelling Wave B shipped, so
the text must carry everything. Mitigations: the panel renders all five required
fields for every state; the eight-state legend is always present; the static
markup ships the `idea` state so the no-JavaScript view is complete; and the
no-JS suite asserts all of it.

---

## C-06 — Reduced motion removes travel structurally

**Decision.** In reduced mode the head marker gets `transition: none`, not a
short duration.

**Reasoning.** "Reduced motion: 0–80 ms, no path travel" is two requirements,
not one. A 60 ms head travel is still travel. Enforced twice — the view refuses
to mark a transition as animated, and the stylesheet removes the transition —
and asserted by reading computed style rather than trusting the token.

---

## C-07 — Rapid selection coalesces to the last request

**Decision.** `SignalController.goTo` stores a pending id and applies once per
frame; intermediate requests are discarded rather than queued.

**Reasoning.** The requirement is that rapid selection settles on the *final
requested* state, not that it replays the sequence. Queuing would make the
composition visibly chase the input.

**Consequence.** `goToNow` exists for the initial render, which must not wait a
frame.

---

## C-08 — The stepper ships hidden and is revealed by script

**Decision.** `hidden` in the markup, unhidden in `mount()`.

**Reasoning.** A stepper without JavaScript is a row of buttons that do nothing.
The no-JS reader gets the eight-state legend instead — the same information,
without the pretence of interactivity.

---

## C-09 — Study A is now a wave ahead of Study B

**Observed.** Study A has completed Wave C; Study B is frozen at Waves A and B.

**Decision.** Declare it in the parity script as `wave-c.stepper` and
`wave-c.state-text`, both marked **SCORING HAZARD**.

**Reasoning.** The parity rule exists so neither study looks stronger through
content rather than approach. A wave gap is a much larger version of that
problem than any wording difference. No comparative score is valid until Study B
completes an equivalent Wave C, or the comparison is explicitly restricted to
the waves both have finished.

---

## C-10 — Legend corrected to "Human review"

**Decision.** The sixth legend entry changed from "Approve" to "Human review",
and `signalLegend` was added as a *newly compared* parity field.

**Reasoning.** §3.3's canonical state is Human review, and Wave C makes it a
real state id. Leaving the legend uncompared would have let the divergence pass
silently, so the comparison was widened at the same time as the change.

"Approve" remains correct in the physical-action sequence, which is untouched in
both studies.

---

## Waves A and B

---

## A-01 — Branched from the accepted baseline, not from Study B

**Decision.** `experience/lesnarai-v2-study-a` created directly from
`5479845ca8615cee3fc785c7ddd069e1f5f7671b`.

**Reasoning.** The §8 comparative framework only means something if the two
studies are independent. Branching from Study B would inherit its config,
tooling choices and structural habits, and any conclusion about
maintainability or build complexity would be measuring shared ancestry rather
than the approaches themselves.

**Verified.** `git merge-base --is-ancestor 7dc29a2 HEAD` fails — Study B is
not an ancestor. Asserted permanently in `scripts/verify-isolation.mjs`.

---

## A-02 — Zero runtime dependencies

**Decision.** `"dependencies": {}`. Dev-only: vite, typescript,
@playwright/test, @types/node.

**Reasoning.** Study A's thesis is that semantic HTML, CSS and static SVG can
carry the concept. A runtime dependency would weaken the claim before it was
tested. Measured result: **13.31 kB gzip total**, one bundle, no code-splitting
strategy needed.

For comparison, Study B needs `manualChunks`, a dynamic-import boundary and a
network-request test purely to keep 126 kB of `three` off its critical path.
Study A's `vite.config.ts` is 30 lines because there is nothing to arrange.

---

## A-03 — Static SVG only; no animation of any kind

**Decision.** No `@keyframes`, no `stroke-dashoffset` transitions, no SMIL, no
GSAP, no ScrollTrigger.

**Reasoning.** The brief forbids animated SVG in this wave, and §7.6 requires
the resolved composition to read as “a system now exists”. If the still frame
needs motion to be legible, the signal design has failed and motion would be
hiding it. Getting the static frame right first is the cheapest time to find
that out.

**Asserted.** `structure.spec.ts` → “no autonomous animation exists at this
wave”: no `CSSAnimation`, no infinite-iteration animation, no SMIL elements,
and nothing still running after 600 ms.

**Note.** Short CSS transitions on hover/focus/active state *are* present and
are not a violation — §7.14 asks for interaction states that feel designed. See
A-07 for the test that initially got this wrong.

---

## A-04 — Prose in HTML, structure in `content.ts`

**Decision.** All narrative copy lives in `index.html`. `content.ts` holds
identifiers, ordering and truth labels only.

**Reasoning.** Identical to Study B's D-10, and for the same reason: the Phase 2
audit faults the production site for “capability content embedded in JavaScript
rather than structured data”, and the story must work with JavaScript disabled.

**Residual risk mitigated.** `accessibility/content-integrity.ts` fails loudly
when the markup and the model disagree — every declared stage, action step,
chapter and parity count is checked in the browser and asserted in
`structure.spec.ts`.

---

## A-05 — Parity is enforced by a script, not by intention

**Decision.** `scripts/check-content-parity.mjs` compares fourteen fields
against Study B's frozen commit and fails on any undeclared difference.

**Reasoning.** “Do not let the studies drift” is not a policy anyone can keep
by hand across two prototypes and six more waves each. Reading Study B via
`git show 7dc29a2:…` rather than from disk makes the comparison deterministic
and simultaneously proves Study B's committed bytes are unchanged.

**Cost.** The extractor is regex-based over HTML and is brittle to markup
restructuring. Accepted for now because both pages are hand-authored and
stable; `content-parity.md` states the method's limits explicitly rather than
letting the PASS read as stronger than it is.

---

## A-06 — `data-current-chapter` on `<html>`, not `data-chapter`

**Decision.** The chapter controller writes `data-current-chapter` to the root
element.

**Cause.** It originally wrote `data-chapter`, colliding with `data-chapter` on
the four chapter sections. On a section the attribute means “this *is* a
chapter”; on `<html>` it meant “this is the *current* chapter” — two different
relationships under one selector. `querySelectorAll("[data-chapter]")` returned
five, and the content-integrity check failed against a page that was actually
correct.

**Reasoning.** Distinct meanings get distinct attribute names. The integrity
check was additionally scoped to `section[data-chapter]` as defence in depth.

**Note.** Study B has the same collision in `chapter-controller.ts` but never
counts chapters, so it never surfaced there. It is latent, not harmless — worth
fixing when Study B is next authorised for edit.

---

## A-07 — The “no animation” test was wrong, not the code

**Cause.** The first version asserted
`document.getAnimations().length === 0`. It passed on desktop and failed on
mobile with exactly two running animations.

**Diagnosis.** Those two were the rail link's `color` and `border-color`
transitions, fired when the controller marks the current chapter at attach.
`getAnimations()` includes `CSSTransition` objects, so the assertion was racing
page boot — the emulated device simply reached the assertion before the 140 ms
transition finished.

**Decision.** Rewrote it to assert what actually matters: no `CSSAnimation`, no
infinite-iteration animation, no SMIL, and nothing still running after a settle
delay. Interaction transitions are explicitly permitted.

**Lesson recorded because it generalises:** a test that fails on one device and
passes on another is usually measuring timing, not behaviour. The fix was to
make the assertion specific rather than to add a sleep and move on.

---

## A-08 — Focus follows in-page anchor navigation

**Decision.** `navigation/anchor-focus.ts` moves focus to the anchor target,
using `tabindex="-1"` removed on blur.

**Reasoning.** Browsers move scroll on anchor navigation but historically
disagree about moving focus. Without this, a keyboard user who activates
“02 System” is scrolled to the section while focus stays in the rail, so their
next Tab resumes from the navigation and the link achieved nothing for them.

`preventDefault()` is deliberately *not* called — the browser's own scrolling
and history entry are correct and are left alone. Only focus is corrected. With
JavaScript disabled the anchors still navigate; they simply do not move focus,
which is the browser default and is what the no-JS baseline is measured
against.

---

## A-09 — Effects control ships before there is motion to reduce

**Decision.** The Auto/Full/Reduced control is present, wired and persisted,
even though Study A currently has no animation.

**Reasoning.** Parity requires the same control in the same place with the same
wording. And §10 requires reduced motion to be implemented “during the feature,
not afterward” — building the preference plumbing now means Wave C designs
against it from the first frame instead of retrofitting.

**Honesty requirement.** This is stated on the page in the visible limitations
block, not just in this file. A control that appears to do nothing is worse
than no control unless the page says why.

---

## A-10 — `@playwright/test` pinned to 1.60.0

**Decision.** Pinned, matching Study B.

**Reasoning.** 1.60.0 maps to `chromium-1223`, already in
`~/.cache/ms-playwright`. Newer releases require a browser build whose download
stalled during the Study B wave. Pinning also keeps both studies on an
identical browser revision, which matters for a comparison — differing browser
versions would add a variable neither study controls.

---

## A-11 — Study B build residue is a staging hazard, left in place

**Observed.** Switching branches leaves Study B's ignored artefacts
(`node_modules`, `dist`, `test-results`) on disk. `study-b-webgl/.gitignore` is
a tracked file that does not exist on this branch, so `dist/` and
`test-results/` are no longer ignored here. A broad `git add experience-lab/`
would stage **10 Study B build artefacts**.

**Decision.** Left untouched. Deleting untracked files requires explicit
authorisation, and the residue is harmless as long as nothing stages it.

**Mitigation.** `scripts/verify-isolation.mjs` runs `git add --dry-run` and
warns with the exact file list whenever anything outside
`experience-lab/study-a-dom-svg/` would be staged. Any future commit must scope
its add to that path.
