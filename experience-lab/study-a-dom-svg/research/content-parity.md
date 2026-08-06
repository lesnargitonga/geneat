# Content parity — Study A vs Study B

**Rule being enforced:** Study A and Study B must not use different content to
make one prototype appear stronger. They differ in *how the signal is
rendered*. They must not differ in what is claimed, what is proven, what is
labelled pending, or how honest the status wording is.

**Method.** `scripts/check-content-parity.mjs` extracts fourteen fields from
both pages and compares them. Study B is read from its frozen commit via
`git show 7dc29a2:experience-lab/study-b-webgl/index.html`, never from the
working tree — so the comparison is against the reviewed artefact, and the
check doubles as a Study B integrity test.

An undeclared difference **fails** the run. A difference declared in
`INTENTIONAL_DIFFERENCES` with a reason and an impact assessment passes and is
reported as intentional. Silence is never treated as parity.

**Result:** 10 exact matches, 4 declared differences, **0 undeclared**. PASS.
Machine-readable output: `evidence/content-parity.json`.

---

## Fields that match exactly

| Field | Value |
|---|---|
| Headline | “We make ambitious ideas real.” |
| Supporting copy | “A difficult idea enters the system, becomes understandable, is engineered, protected, tested, and finally acts in the real world.” |
| Chapter names | `00 Idea`, `01 Product`, `02 System`, `03 Action` |
| First project | Gen-Eat |
| Gen-Eat architecture claims | All four `<dt>/<dd>` pairs — Backend, Channels, Payments, Storefront — byte-identical |
| Verified proof panels | 3 |
| Pending proof panels | 1 |
| Project status wording | `LIVE` |
| Physical-action truth label | `PROTOTYPE — engineering demonstration` |
| CTA wording | “See a real system”, “Start a project”, “Open the live product”, “Back to the signal” |

The architecture claims matching byte-for-byte is the important one. Both
studies assert exactly the same things about Gen-Eat, sourced from the same
files in this repository, with no capability described in one and withheld from
the other.

---

## Declared differences

### 1. Physical-action step labels — `physical-action.steps`

Study A uses the seven labels specified in the Study A brief. Study B committed
a different seven. **Same process, same truth label, different granularity.**

| # | Study A | Study B (7dc29a2) | Relationship |
|---|---|---|---|
| 1 | Observe | Observe | identical |
| 2 | Detect | Model | rename — a model proposing damage |
| 3 | Verify | Evidence + Boundary | **merged** — confidence assembled *and* checked against a threshold |
| 4 | Approve | Approve | identical |
| 5 | Command | — | **added** — the control instruction issued to the diverter |
| 6 | Act | Act | identical |
| 7 | Record | Prove | rename — the operational record updated |

Study A's sequence follows dossier §13.13 more literally, which lists
“human approval gate → **control command** → physical route change”. Study B's
markup collapsed the command into the act.

**Impact on comparison: none on claims.** Neither study asserts a deployed
computer-vision or robotics system; both carry `PROTOTYPE — engineering
demonstration`; both state in the surrounding note that no production system is
claimed.

**Action required before scoring:** Study B is frozen at `7dc29a2` and may not
be edited without authorisation. Either align Study B's labels to these seven
in a later authorised change, or record the difference as cosmetic in the §8
scoring so that neither study gains a narrative-continuity point from it.

### 2. Visible limitations block — `limitations.visible`

Study A renders a `Current limitations of this prototype` section on the page,
required by the Study A brief. Study B carries equivalent content in
`research/limitations.md` and in its pending-evidence panel, but not as a page
section.

**Impact: favours Study A on honesty, not on capability.** This is the one
difference that could distort scoring, because a prototype that states its gaps
in public is making a stronger honesty claim than one that states them in a file
nobody opens.

**Action required before scoring:** Study B should gain the same block, or the
difference must be explicitly neutralised in the score. Flagged rather than
silently banked as a Study A advantage.

### 3. Pending-evidence wording — `evidence-pending.wording`

Study A: `EVIDENCE PENDING — not collected in this wave`
Study B: `Evidence pending — not collected in this wave`

The Study A brief specifies the literal token `EVIDENCE PENDING`. Same panel,
same meaning, same complete absence of any figure. **Impact: none.**

### 4. Canvas element — `stage.canvas`

Study B has a `<canvas>` behind its SVG poster. Study A has no canvas at all.

**This is the subject of the comparison, not a defect in either.** Recorded so
the parity report is explicit that the difference was noticed and intended.

---

## Differences the check does not cover

Honest statement of the method's limits:

- **Prose beyond the extracted fields.** Section ledes, inspector stage bodies
  and note text are not compared string-by-string. They were authored by
  copying Study B's committed markup, but the check would not catch a later
  drift in, say, the Decision stage's “Can fail” sentence. Widening the
  extractor is Wave C work.
- **Visual weight.** Both studies share the same tokens, type scale and
  palette, but nothing automatically verifies that. A future divergence in
  contrast or hierarchy would not fail this check.
- **Ordering within a section.** The check compares sets and counts for some
  fields; a reordering that preserved membership would pass.

None of these currently differ. They are listed so the PASS is not read as
stronger than it is.

---

## Standing constraint

Any future content change to either study must keep this check at
**0 undeclared differences**. If a change genuinely belongs in only one study,
it goes in `INTENTIONAL_DIFFERENCES` with a reason and an impact assessment
before it is merged — not after someone notices the scores moved.
