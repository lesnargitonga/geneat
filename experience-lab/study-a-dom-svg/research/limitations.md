# Study A — Limitations after Waves A and B

Read before forming any opinion about Study A. Everything below is a known gap,
not a discovered defect.

The most important ones are also stated **on the page itself**, in the visible
`Current limitations of this prototype` block — not only here.

---

## 1. There is no motion — by instruction

The brief forbids animated SVG, GSAP and ScrollTrigger in this wave. Study A is
currently a completely static composition, asserted by
`structure.spec.ts` → “no autonomous animation exists at this wave”.

The Effects control is present, wired and persists a choice, but **there is
currently no animation for “Reduced” to reduce**. It is shipped now for parity
with Study B and so Wave C designs against it rather than retrofitting.

**Nothing in this wave supports any judgement about whether the DOM+SVG
approach can carry the signal as a moving system.** That is Wave C.

---

## 2. No A-vs-B score is available

Both studies are now at the same point: semantic baseline, no visual or motion
work. The §8 framework scores brand ownership, narrative continuity and
memorability — none of which can be assessed from two static pages that
deliberately share the same content.

What *can* be compared today, and only this:

| | Study A | Study B |
|---|---:|---:|
| Total transfer, gzip | **13.31 kB** | 147.00 kB |
| Critical path, gzip | 13.31 kB | 17.57 kB |
| Runtime dependencies | **0** | 1 (`three`) |
| TypeScript modules | **7** | 22 |
| TypeScript source lines | **747** | 3,174 |
| Build config | plain | `manualChunks` + dynamic-import boundary |
| Failure modes needing tests | **0** | context loss, tier degradation, disposal, pause |

That is a maintainability and performance signal, not a creative one. It says
nothing about whether spatial rendering communicates something SVG cannot.

---

## 3. Two parity differences could distort scoring

Both declared in `research/content-parity.md`:

- **Visible limitations block.** Study A has one on the page; Study B does not.
  This favours Study A on honesty. Either Study B gains the same block, or the
  difference is neutralised in the score.
- **Physical-action step labels.** Study A uses seven labels that follow §13.13
  more literally than Study B's committed seven. Same process, same truth label.
  Either align Study B later, or record as cosmetic.

Neither has been resolved, because Study B is frozen at `7dc29a2` and editing
it is not authorised.

---

## 4. Proof is partially unverified, and says so

Three proof panels are marked `verified` and were read directly from this
repository — architecture, technical decision, deployment. Sources are listed in
`implementation-notes.md`.

The fourth is marked `EVIDENCE PENDING` and contains **no figures**.

**Not verified in this wave:**

- No HTTP request was made to `geneat.lesnarai.co.ke` or `api.lesnarai.co.ke`.
  The `LIVE` label rests on the production landing linking the product and on
  the deployment target declared in this repository — not on an observed
  response. This is stated on the page.
- No interface screenshots exist. `public/proof/` is empty.
- No Gen-Eat metrics, adoption figures, payment volumes or performance numbers
  appear anywhere, deliberately. A regex guard in `no-js.spec.ts` fails the
  build if a figure shaped like an unmeasured metric appears on the page.

§7.9 requires at least three real proof categories. Architecture, technical
decision and deployment status are present and sourced. **Real interface
screenshot** and **measured outcome** are not, and are Wave E work.

---

## 5. The system inspector is not interactive

All six stages render as always-visible content. There is no tab semantics, no
arrow-key stage selection, no locked selection, no Escape handling.

That is Wave F. It is written as plain readable content first so enhancement can
never become the only route to it — but the acceptance criterion about the
inspector being keyboard usable is **not yet satisfied**, because there is
nothing interactive to keyboard through.

What *is* satisfied: the six stages are fully readable without JavaScript, and
every stage answers all four questions (enters / acts / can fail / recovery).

---

## 6. The physical-action sequence is a description

Seven labelled steps, marked `PROTOTYPE — engineering demonstration`. No
computer-vision system, no actuation, no recorded run backs it. §7.11 requires
exactly this labelling where the evidence is only an engineering
demonstration.

---

## 7. Performance figures are build-time only

Verified: bundle sizes from `vite build`.

**Not measured:** LCP, INP, CLS, behaviour under 4× CPU throttling, slow-4G,
or anything on real hardware. Study A is small enough that these are very
likely fine — but “very likely fine” is not a measurement, and none is claimed.

---

## 8. Test environment caveats

- **Chromium only.** No Firefox or WebKit run.
- **Emulated mobile.** Pixel 5 device descriptor, not a real handset. Touch
  target sizes and overflow are real measurements against that emulation;
  scroll feel and font rendering are not.
- **No axe or Lighthouse run.** Accessibility assertions here are structural —
  heading order, landmarks, `aria-labelledby` on every section, skip link
  behaviour, focus movement, 44px targets, colour-independence of every status.
  No automated audit and no screen-reader pass has been performed.
- **Parity extraction is regex-based** over HTML and would not catch drift in
  prose outside the fourteen compared fields. Stated in `content-parity.md`.

---

## 9. Not evaluated at all

The dossier's Study A rejection conditions (§7.20) include “it feels like a
generic data-line animation”, “the signal distracts from the headline” and “the
project transition feels forced”. **None of these can be assessed yet** — there
is no animation, no transition, and no motion hierarchy to judge.

Study A has not passed. It has established a baseline that a later wave can be
judged against.
