# Production Experience Completeness Matrix

Programme qualification artefact for the Lesnar AI V2 release (§24.2). **Not
homepage content.**

Scope of evidence: `experience-lab/study-a-dom-svg/` at Wave D. Nothing here
describes the live site at `lesnarai.co.ke`, which is unchanged.

**Status vocabulary:** `PASS` · `PARTIAL` · `PENDING` · `NOT APPLICABLE` · `BLOCKED`

> §24.1: nothing is "finished" because it looks premium. A component is complete
> only when every relevant state is designed, implemented, tested, evidenced,
> and reviewed for mobile, keyboard, reduced motion and realistic failure.
> Omissions must be explicit rather than accidental — that is what this file is.

| Concern | Applicable? | Planned behaviour | Implementation status | Test method | Evidence | Blocking? | Notes |
|---|---|---|---|---|---|---|---|
| Hero readable immediately | Yes | Headline + CTA in served HTML, no loader | PASS | Playwright, no-wait assertion | `hero-choreography.spec.ts`; `evidence/wave-d/hero-timing.json` | — | CTA measurable at 67 ms; sequence ends at 2744 ms |
| Formation sequence bounded | Yes | 2.2–3.2 s, settles, no ambient loop | PASS | Data assertion + browser measurement | `hero-timing.json` | — | Scheduled 2740 ms, measured 2744 ms |
| Scrolling never blocked | Yes | Native scroll always | PASS | Playwright mid-sequence scroll | `hero-choreography.spec.ts` | — | No scroll lock; sequence yields on intent |
| Reduced motion complete | Yes | Immediate coherent final state, no travel | PASS | Computed-style + content assertions | `signal-reduced-motion.spec.ts`, `hero-choreography.spec.ts` | — | `transition-property: none` on head |
| Signal state system | Yes | 8 deterministic states, one engine | PASS | Contract + runtime suites | `signal-contract.spec.ts`, `evidence/wave-c/` | — | Wave C; unchanged in D |
| Portfolio extensibility | Yes | ≥3 grammars on one engine | PASS | Fixture + engine-identity assertions | `hero-choreography.spec.ts`; dev fixture | — | 6/8/7-step grammars |
| No JavaScript | Yes | Full story without script | PASS | `javaScriptEnabled: false` project | `no-js.spec.ts` (16 tests) | — | |
| Colour contrast | Yes | All semantic pairs meet threshold | PASS | In-browser canvas measurement | `evidence/wave-d/contrast-audit.json` | — | 15/15; two tokens fixed in D |
| Layout stability | Yes | CLS ≤ 0.1 | PASS | PerformanceObserver | `layout-shift-summary.json` | — | 0 on load; 0.0001 after stepping all states |
| Responsive 320→1920 | Yes | No overflow, targets ≥44px | PASS | 5-viewport suite | `signal-responsive.spec.ts`; `evidence/wave-d/*.png` | — | |
| Keyboard operation | Yes | Full keyboard path | PARTIAL | Playwright keyboard suite | `keyboard.spec.ts`, `signal-states.spec.ts` | — | Inspector is not yet interactive (Wave F) |
| Isolation from production | Yes | No production path touched | PASS | Git assertions in-suite | `isolation.spec.ts`, `verify-isolation.mjs` | — | 17/17 |
| Content parity with Study B | Yes | No undeclared divergence | PASS | Parity script vs frozen commit | `evidence/content-parity.json` | — | Wave gap declared as scoring hazard |
| Global navigation | Yes | Distinct from chapter nav | PENDING | — | — | No | No global nav exists yet; only chapter rail |
| Case-study pages | Yes | Per §18.10 template | PENDING | — | — | No | Wave E+ |
| Work index | Yes | Broader portfolio | PENDING | — | — | No | §18.9 |
| Forms | Yes | Contact / enquiry | PENDING | — | — | No | Currently `mailto:` only — see COMPONENT_STATE_MATRIX |
| Authentication | No | — | NOT APPLICABLE | — | — | — | §24.9: public marketing site has no auth. No password UI will be added to satisfy a checklist |
| WebGL | No | — | NOT APPLICABLE | — | — | — | Study A is DOM+SVG by definition; WebGL is Study B's question |
| Analytics | Yes | Consent-gated measurement | PENDING | — | — | No | See ANALYTICS_CONVERSION_MATRIX |
| SEO / discoverability | Yes | Indexable, structured | PENDING | — | — | No | Prototype is deliberately `noindex` |
| Error / 404 / 500 routes | Yes | Useful content preserved | PENDING | — | — | No | Single-page prototype has no routes yet |
| Real proof media | Yes | Screenshots, diagrams | PENDING | — | `public/proof/` empty | No | §7.9; measured-outcome panel explicitly pending |
| Cross-browser | Yes | Chrome, Firefox, Safari | PENDING | — | — | No | Chromium only so far |
| Automated a11y audit | Yes | axe or equivalent | PENDING | — | — | No | Structural assertions only to date |
| Field performance (p75) | Yes | LCP/INP/CLS at p75 | BLOCKED | RUM | — | No | Cannot be obtained from a lab run or from an undeployed prototype |
