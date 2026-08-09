# Analytics and Conversion Matrix

**Status:** `PASS` · `PARTIAL` · `PENDING` · `NOT APPLICABLE`

> **Nothing is currently measured.** No analytics library, no tracking pixel, no
> beacon, no session recording. That is the honest state, and it means the
> conversion claims below are *design intent*, not observed behaviour.

| Concern | Applicable? | Planned behaviour | Status | Test method | Evidence | Blocking? | Notes |
|---|---|---|---|---|---|---|---|
| Analytics implementation | Yes | Consent-gated, privacy-respecting | PENDING | — | — | No | None installed. Choice of tool is a production decision |
| Zero tracking today | Yes | No third-party requests | PASS | Network assertion | `signal-reduced-motion.spec.ts` | — | Verified: no external requests at all |
| Consent before collection | Yes | No collection until granted | PENDING | — | — | No | Reject must be as easy as accept |
| Primary conversion: start a project | Yes | Reach contact and act | PARTIAL | — | — | No | `mailto:` today. A real form is required to measure anything |
| Secondary conversion: view real proof | Yes | Reach Gen-Eat proof | PARTIAL | — | — | No | Hero CTA anchors to it; no measurement |
| Tertiary: open the live product | Yes | Outbound to the product | PARTIAL | — | — | No | Link present; outbound tracking not implemented |
| CTA availability | Yes | Usable immediately | PASS | Measurement | `hero-timing.json` | — | 67 ms; never behind a loader |
| CTA hierarchy | Yes | One primary, one secondary | PASS | Design review | `desktop-1440.png` | — | Solid vs ghost; unambiguous |
| Scroll depth | Yes | — | PENDING | — | — | No | Requires analytics |
| Chapter engagement | Yes | Which chapters get read | PENDING | — | — | No | The rail already tracks current chapter in-page |
| Signal interaction | Yes | Does anyone drive the signal | PENDING | — | — | No | Stepper is dev-only; production interaction model undecided |
| Effects preference distribution | Yes | How many choose Reduced | PENDING | — | — | No | Would inform whether Auto's default is right |
| Reduced-motion population size | Yes | Share arriving with the OS preference | PENDING | — | — | No | Directly relevant to how much motion is worth building |
| Form funnel | Yes | Start → submit → success | PENDING | — | — | No | No form |
| Error-rate monitoring | Yes | Client errors reported | PENDING | — | — | No | No error reporting configured |
| Performance RUM | Yes | Field LCP/INP/CLS at p75 | BLOCKED | — | — | No | Cannot be obtained from a lab run or an undeployed prototype. This is the only honest way to satisfy the programme's field targets |
| A/B testing | Yes | — | NOT APPLICABLE | — | — | — | No traffic; premature |
| Attribution | Yes | Where enquiries originate | PENDING | — | — | No | Commercially the most valuable metric here |

## Note on the field targets

The programme sets LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 **at the 75th
percentile of field data**. Wave D's measurements are laboratory results on one
machine and are reported as such in every evidence file. They are encouraging —
lab LCP 72 ms unthrottled, 1156 ms on Slow 4G with 4× CPU, CLS 0 — but they are
not p75 field values and must never be presented as such.

## Wave F — declared semantics, 2026-08-09

No tracking vendor was installed. The inspector records the current selection on
the document and exposes an `onInspect` callback, so these events can be wired
later without changing the interface:

| Event | Trigger | State available now |
|---|---|---|
| `capability_inspected` | a capability is selected | `data-capability-inspected` on `<html>` |
| `proof_opened` | a proof fragment is followed | proof links carry their source |
| `project_followed` | a project reference is followed | `seeAlso` targets an in-page anchor |
| `start_project_from_capability` | contact reached from a capability | not yet wired |

Verdict: DECLARED, not implemented — intentional for this wave.

## Wave H — outbound proof links

Four external links, all fetched and verified before publication, all
`https`, `target="_blank"`, `rel="noopener noreferrer"`, and all ≥44px targets.

| Link | Status at capture |
|---|---|
| `geneat.lesnarai.co.ke` | 200 |
| `hazina.lesnarai.co.ke` | 200 |
| `geneat-api…/healthz` | 200 `{"status":"ok"}` |
| `hazina-api…/healthz` | 200 `{"status":"ok"}` |

`carepro.co.ke` returns 200 and is **deliberately not linked** — publishing a
healthcare-adjacent system's front door is the client's decision. No private
repository, admin path, localhost URL, VPS address or dashboard is linked, and
no case-study route was invented, so there are no dead links.

Admin surfaces re-verified 404 at capture time: `/docs`, `/openapi.json`.

No analytics vendor is installed. The register declares no events.

### Wave H — CarePro link added

`carepro.co.ke` is now published after a public-surface safety audit (ordinary
homepage only; no login, no admin area, no personal data submitted, no sensitive
route crawled). HTTPS with a valid certificate, HTTP 200, `noopener noreferrer`,
external indicator, ≥44px target.

The earlier rationale for withholding it — "publishing the front door is the
client's decision" — was void once the relationship was established: CarePro is
the founders' own product. It is linked because the surface was audited and
found safe, not to satisfy a proof state.

Five external links total; all verified 200 at capture time.
