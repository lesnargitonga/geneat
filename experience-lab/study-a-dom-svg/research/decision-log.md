# Study A — Decision log

Waves A and B. Each entry records what was decided, why, and what would reverse it.

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
