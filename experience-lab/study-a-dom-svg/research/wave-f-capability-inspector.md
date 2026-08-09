# Wave F — capability inspector

Study A only. No production change, no deploy, no Study B change.

## What it answers

Wave E proved the studio can take a messy shared system and make it
independently operable. Wave F answers the next question a visitor actually
has: **what can you do for me, and can I check it without reading a services
list?**

## Concept — an inspection register, not a services grid

A numbered register of six capability specimens with an inspection field beside
it. The composition is built from rules, seams, hanging indices and monospace
annotation — the language of a field sheet — rather than cards.

Deliberately absent: uniform-radius cards, drop shadows, glassmorphism, glow,
particles, 3D, gradients used as decoration, dashboards, fake terminals, logo
walls, and any new decorative hue.

## The six families

`BUILD · OPERATE · PROTECT · INTELLIGENCE · PROVE · PHYSICAL` — six ways an idea
moves toward reality, not six services.

Each specimen carries five fields, and the fifth is the one that matters:

| Field | Purpose |
|---|---|
| what it changes | one line, in the reader's terms |
| what we do | concrete behaviours, no tooling inventory |
| where it is demonstrated | 1–3 real proofs, never a logo wall |
| maturity | how far it has actually been taken |
| **not claimed** | what we are explicitly **not** asserting |

A capability list without that last field is a brochure. A test asserts all six
carry one and that it is more than a token sentence.

## Capability maturity is its own axis

`CapabilityMaturity` is deliberately separate from the proof model's
`MaturityLevel`. The latter grades how strongly one artifact is evidenced; this
grades how far a capability has been taken. A capability can rest on verified
evidence and still be only active research — Physical is exactly that case.

## Evidence mapping

| Capability | Maturity | Proofs |
|---|---|---|
| Build | live product | Gen-Eat · Hazina Nomads (commerce on one tenant model) · CarePro (home-care and nursing coordination) |
| Operate | controlled client system | three apps + PostgreSQL + Redis + Nginx + connector coexisting within measured capacity on 1 vCPU / 2 GB · reboot qualification confirming unattended return |
| Protect | controlled client system | the Gen-Eat / Hazina separation · cross-database denial re-proved after reboot · public surface reduced to 404 |
| Intelligence | validated prototype | deterministic gate ahead of the model with human escalation · provider and embedding configuration validated at boot |
| Prove | internal engineering system | independent regression suites for both separated backends and this prototype · a performance regression traced to the harness, and a contrast failure found by pixel measurement |
| Physical | **active research** | storage fault isolated to a first-block read failure · greenhouse and embedded control experiments |

Physical stays at active research and explicitly disclaims deployed robotics,
autonomous field systems and any physical product in customer hands. A test
enforces both.

Intelligence explicitly states that conversation is **not currently
operational** — the separated runtimes hold no model credential. A test enforces
that too, so the register cannot quietly outrun the runtime.

## Claim audit — corrections made in this pass

| Was | Now | Why |
|---|---|---|
| "regulated care operations" | "home-care and nursing coordination platform" | No regulatory status is evidenced anywhere in the CarePro repository. Its own README says *"Managed homecare & nursing coordination platform."* |
| "unplanned reboot recovered every service" | "a reboot qualification confirmed the supervised services returned automatically" | The verified event was a controlled reboot during qualification. It is **not** the separate network-path reachability incident, which proved no reboot at all. |
| "limits keeping one product from starving another" | "protections are configured to reduce cross-service contention" | Limits were configured and coexistence measured. Starvation resistance was never stress-qualified. |
| "467 tests … plus 183 on this prototype" | "independent regression suites … each passing without the others" | The count went stale inside the same wave. Exact counts belong in dated evidence, not visitor copy. |
| "payment flows through provider-agnostic interfaces" | "payment integration behind provider-agnostic interfaces" | Routes and integrations exist; end-to-end settlement was not qualified. The BUILD boundary now says so explicitly. |

Every remaining sentence was classified internally as directly verified,
repository evidence, architectural capability, or research. Anything that graded
**too strong** was rewritten above.

## Glyphs

Six marks assembled from the signal system's own primitives — NODE, TRACE,
BOUNDARY, GATE — so they read as native geometry rather than a borrowed icon
set. No shields, magnifiers, brains, bolts, gears, robots, targets, clouds,
cylinders or code brackets.

```
nodes-join       BUILD         separate points resolve into one trace
trace-sustained  OPERATE       a trace held steady across repeated marks
boundary-closed  PROTECT       a boundary closed around what it contains
trace-inferred   INTELLIGENCE  a trace branching, weighed, reconverging
node-witnessed   PROVE         a node with the trace it left on every side
gate-crossed     PHYSICAL      a trace crossing a gate into open space
```

## Model ↔ HTML parity

`scripts/check-capability-parity.mjs` regenerates the expected register from
`capability-model.ts` and `capability-glyph.ts` and compares it against the
region in `index.html`. It **never writes** — generation and validation are
separate operations.

It compares semantic content (ids, indices, names, maturity, changes,
behaviours, proofs, boundaries, glyph geometry) rather than raw HTML, so a
formatter reindenting the file cannot produce a false failure while any drift
in what the page *claims* still fails the build.

A test proves the checker actually works: it introduces a one-line change to the
model, asserts the checker exits non-zero and names the drifted field, then
restores the file and asserts it passes again.

```
capability parity: PASS — 6 capabilities, 23 behaviours, 12 proofs match index.html
```

## Interaction model

Progressive enhancement. **The served markup contains every capability in full.**
With script the field narrows to one specimen; without it the whole register
reads top to bottom. A no-JS test asserts all six entries, all six boundaries,
20+ behaviours and 6+ proof statements are present without script.

- Click, `Enter`, arrow keys, `Home` / `End` all move the selection
- Selection is carried by `aria-current`, a seam, glyph resolution and font
  weight — never colour alone
- Each capability is linkable by fragment (`#capability-protect`), so the back
  button and plain anchors keep working
- Nothing is revealed on hover; nothing needs a precise pointer or a drag

### A collision worth recording

The inspector first wrote `data-capability` to `<html>` to mark the current
selection. That made the document itself match the entry selector, so the
register reported seven entries instead of six — the same defect class as the
Wave C `data-chapter` collision. It is now `data-capability-current`, and a test
asserts the document never carries the entry attribute.

## Responsive decisions

- **≥1024px** — sticky register index beside the inspection field
- **<1024px** — the index becomes a horizontal band; the specimen body drops to
  one column
- **<640px** — two-column index; the specimen becomes a field-sheet record with
  the register number hung in the left margin against a vertical seam, so it
  never reads as a stack of identical cards
- **≤380px** — the hanging number returns inline and the index drops to one
  column

Two defects were found by measurement and fixed in the interface: the hanging
index pushed the specimen past a 320px viewport, and `repeat(2, 1fr)` refused to
shrink below its content because `1fr` carries an implicit `min-width: auto`.
Both now use `minmax(0, 1fr)`.

## Accessibility

Re-measured after the canonical palette reconciliation, across the whole page —
not only Wave F. Twenty pairs, all ≥ 4.5:1:

hero headline 15.79 · nav 15.79 · index name 15.79 · transform head 15.79 ·
live label 13.88 · maturity chip 13.88 · hero lede 8.12 · behaviours 8.12 ·
proof meta 8.12 · endpoint link 7.21 · proof source 7.21 · limitation label 5.96 ·
NOT CLAIMED 5.96 · eyebrow 5.13 · caption 5.13 · index maturity 5.13 ·
boundary body 5.13 · note 5.13.

37 headings, **0 skipped levels**. Every interactive target ≥ 44px. Focus is
visible. Maturity is a word before it is a colour.

## Performance

Re-measured after the palette change:

| | LCP | CLS | load long tasks | register-entry long tasks | selection |
|---|---|---|---|---|---|
| normal | 136ms | 0 | 1 (worst 90ms) | **0** | avg 29.1ms, max 33.4ms |
| 4× CPU | 300ms | 0 | 1 (worst 221ms) | **0** | avg 28.8ms, max 33.6ms |

No new dependency. No Three.js, no UI framework, no icon library. The register
is HTML, CSS and inline SVG; the inspector adds roughly 1.2 kB gzipped.

## Analytics semantics — declared, not installed

The inspector records the current selection on the document
(`data-capability-inspected`) and exposes an `onInspect` callback. No tracking
vendor was added. Future events this shape supports:
`capability_inspected` · `proof_opened` · `project_followed` ·
`start_project_from_capability`.

## Not done, deliberately

No Work index, no Physical Intelligence showcase, no Study C, no production
change, no deploy, no external model configuration, no infrastructure work.


## Maturity axes, kept separate

`ProofArtifact.maturity` answers **"how strongly is this individual claim
evidenced?"** — verified, repository-evidence, declared-config, pending.

`CapabilityMaturity` answers **"how far has this capability actually been
taken?"** — live product, controlled client system, internal engineering system,
validated prototype, active research, archive.

They are deliberately not collapsed. Physical rests on directly verified
evidence and is still only active research; that combination is only expressible
with two axes.

## Truth boundaries — not defects

These are maturity boundaries the page states openly, not outstanding work:

- Model-backed conversation is **not operational** on the separated runtimes —
  no provider credential is configured.
- Physical remains **active research**; no deployed robotics or autonomy.
- Capability evidence implies **no regulatory certification, approval or
  compliance** for any product.
- Infrastructure claims are limited to what was qualified: coexistence within
  measured capacity and tested failure isolation, **not** load or stress
  behaviour.
- Payment paths are implemented and integrated, **not** qualified end to end
  against live settlement.
