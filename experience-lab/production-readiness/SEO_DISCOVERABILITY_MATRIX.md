# SEO and Discoverability Matrix

**Status:** `PASS` · `PARTIAL` · `PENDING` · `NOT APPLICABLE`

> **Deliberate inversion.** The prototype is `noindex, nofollow` **on purpose**
> — an experience lab must never compete with or outrank the production site.
> Most rows below are therefore `PENDING` by design, and describe what the
> production build must do rather than what the lab does.

| Concern | Applicable? | Planned behaviour | Status | Test method | Evidence | Blocking? | Notes |
|---|---|---|---|---|---|---|---|
| Robots directive | Yes (inverted) | Lab excluded from indexing | PASS | Markup | `<meta name="robots" content="noindex, nofollow">` | — | Correct for a lab; must be removed for production |
| Title element | Yes | Unique, descriptive | PASS | Markup | — | — | Names the study explicitly |
| Meta description | Yes | Accurate summary | PASS | Markup | — | — | States that it is not a production page |
| Semantic HTML | Yes | Real landmarks and headings | PASS | Playwright | `structure.spec.ts` | — | Strong foundation for the production build |
| Single h1 | Yes | One per page | PASS | Playwright | `no-js.spec.ts` | — | |
| Content without JavaScript | Yes | Fully server-rendered HTML | PASS | Playwright | `no-js.spec.ts` | — | Crawlable without script execution |
| Canonical URL | Yes | Self-referencing | PENDING | — | — | No | Production requirement |
| Open Graph / Twitter cards | Yes | Title, description, image | PENDING | — | — | No | Production landing already has a share card; V2 must carry one |
| Structured data (JSON-LD) | Yes | Organization, WebSite, case studies | PENDING | — | — | No | §18 case studies are natural `CreativeWork` candidates |
| Sitemap | Yes | Generated | PENDING | — | — | No | Production landing has one; V2 must too |
| robots.txt | Yes | Allow production, exclude lab | PENDING | — | — | No | Deploy-time |
| Heading hierarchy for topics | Yes | Reflects information architecture | PARTIAL | Playwright | `structure.spec.ts` | No | Correct structurally; the IA itself is §18 work |
| Descriptive link text | Yes | No "click here" | PASS | Content review | — | — | Links name their destination |
| Image alt text | Yes | Meaningful or explicitly decorative | NOT APPLICABLE | — | — | — | No raster images; SVG is `aria-hidden` with a text equivalent |
| Core Web Vitals as a ranking input | Yes | Within budget | PARTIAL | Lab measurement | `evidence/wave-d/` | No | Lab LCP 72 ms / CLS 0. Field p75 unobtainable pre-deploy |
| Internal linking | Yes | Chapters + work index | PARTIAL | — | — | No | Chapter anchors work; no work index yet |
| URL structure | Yes | Readable, stable | PENDING | — | — | No | Single page today; §18.7 defines the site map |
| hreflang / i18n | No | — | NOT APPLICABLE | — | — | — | English only; no localisation planned in this programme |
| Pagination / crawl depth | Yes | — | PENDING | — | — | No | Applies to the work index |
| 404 handling | Yes | Useful, links onward | PENDING | — | — | No | No routing yet |
