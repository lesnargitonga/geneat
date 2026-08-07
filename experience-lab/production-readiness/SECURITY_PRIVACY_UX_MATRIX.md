# Security and Privacy UX Matrix

**Status:** `PASS` · `PARTIAL` · `PENDING` · `NOT APPLICABLE`

Scope: the public marketing experience. Backend and product security are out of
scope for this artefact and live with the systems themselves.

| Concern | Applicable? | Planned behaviour | Status | Test method | Evidence | Blocking? | Notes |
|---|---|---|---|---|---|---|---|
| No secrets in client code | Yes | Nothing sensitive shipped | PASS | Source review + commit scans | — | — | No keys, tokens or endpoints beyond public hostnames |
| No private client data | Yes | Nothing identifying published | PASS | Content review | `project-grammars.ts` | — | Grammars name operational stages only — no client names, no records |
| Third-party runtime deps | Yes | None | PASS | Network-request assertion | `signal-reduced-motion.spec.ts` | — | Zero external requests; no CDN font or script |
| Content Security Policy | Yes | Strict, nonce-based for prod | PENDING | — | — | No | Static prototype has no headers. Required before deploy |
| Security headers (HSTS, nosniff, frame-options, referrer-policy, permissions-policy) | Yes | Full set | PENDING | — | — | No | Deploy-time concern; none configured |
| Subresource integrity | No | — | NOT APPLICABLE | — | — | — | Nothing loaded from a CDN |
| External link safety | Yes | `rel="noreferrer noopener"` | PASS | Markup | — | — | Applied on the Gen-Eat product link |
| XSS surface | Yes | No untrusted HTML injection | PASS | Source review | — | — | All DOM built via `textContent` / `createElement`; no `innerHTML` with dynamic data |
| URL parameter handling | Yes | Validated against known ids | PASS | Source review + tests | `main.ts`, `readInitialState` | — | `?signal=` is checked with `isSignalStateId`; unknown values fall back silently |
| localStorage use | Yes | One non-personal preference | PASS | Source review | `motion-preference.ts` | — | Stores only `auto\|full\|reduced`. Blocked storage degrades silently |
| Cookies | Yes | None | PASS | Codebase | — | — | No cookies set |
| Analytics / tracking | Yes | None yet; consent-gated later | PASS (today) | Network assertion | — | — | Nothing is currently collected. See ANALYTICS_CONVERSION_MATRIX |
| Consent UX | Yes | Required if analytics added | PENDING | — | — | No | Must not be a dark pattern; reject must be as easy as accept |
| Privacy policy link | Yes | Reachable from footer | PENDING | — | — | No | Not present in the prototype |
| Form data handling | Yes | Minimal collection, stated purpose | PENDING | — | — | No | Contact is `mailto:` today — no data touches a server |
| Rate limiting / anti-abuse | Yes | On any submission endpoint | PENDING | — | — | No | Applies when a form exists |
| Authentication UX | No | — | NOT APPLICABLE | — | — | — | §24.9 — no auth on a marketing site. No password UI will be added to satisfy a checklist |
| Sensitive-project disclosure | Yes | Per §18.13 | PARTIAL | Content review | `project-grammars.ts` | No | CarePro and SentinelCore appear **only** as dev-fixture grammars, with no status, metrics or client detail. Publication remains provisional and unreverified |
| Proof media sanitisation | Yes | Reviewed before commit | PENDING | — | `public/proof/README.md` | No | Directory is empty; the requirement is recorded there |
| Truthful status labels | Yes | Five labels, evidence-backed | PASS | Playwright + content review | `no-js.spec.ts` | — | `LIVE` is inferred from the production landing linking the product and the repo's deploy target — stated on the page, not probed |
| Fabricated metrics | Yes | None anywhere | PASS | Regex guard in suite | `no-js.spec.ts`, `hero-choreography.spec.ts` | — | Build fails if an unmeasured figure appears |
