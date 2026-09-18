# Gates

Two gates guard this site. Both exit non-zero on failure.

    python3 -m http.server 8911 --bind 127.0.0.1    # serve first, from this directory

    node tools/static-gate.mjs        # structure, links, metadata, CSP integrity
    node tools/gate.mjs               # every route in a real browser
    ENGINE=firefox node tools/gate.mjs
    ENGINE=webkit  node tools/gate.mjs
    ROUTES=/,/work/ node tools/gate.mjs

## static-gate.mjs

No browser. Reads every `.html` in the tree and checks: one `<title>`, one
`<h1>`, one `<main>`, no skipped heading levels, no duplicate `id`, a canonical
that resolves, a meta description with substance, `lang` on `<html>`, every
`<img>` with `alt` and explicit `width`/`height`, every internal link and asset
reference resolving on disk under `cleanUrls`, sitemap coverage both ways, and
every `vercel.json` redirect landing somewhere real.

It also owns the CSP. The policy pins each inline script by SHA-256, so editing
the theme bootstrap would silently block it in production while every local
check still passed. The gate hashes each inline script and fails if it is not
pinned, fails if the policy pins a hash no page carries, and fails if any of the
five security headers goes missing.

## gate.mjs

Loads every route in Chromium, Firefox and WebKit at 1440 and 390, in both
themes, scrolls each one, then checks console and page errors, element-level
viewport overflow, WCAG AA contrast, broken images, missing alt, links with no
accessible name, and runs axe-core over wcag2a/aa, wcag21, wcag22aa and
best-practice.

Two things worth knowing:

The contrast probe parses `rgb()`, `rgba()` and `color(srgb r g b / a)`,
composites translucent ancestors and walks ancestor opacity, and samples every
element carrying its own text rather than a list of tags. An allowlist is how a
4.49:1 caption shipped.

WebKit's network process cannot reach the loopback server in this sandbox
although it renders correctly, so `ENGINE=webkit` serves the tree through
Playwright's route layer and fulfils the webfonts from a cache node populates.
Measuring Safari on fallback font metrics would make the overflow gate
meaningless, which is exactly how a line-breaking bug reached Firefox and
Safari unseen.

## claims-gate.mjs

Binds the evidence layer in `experience-lab/evidence-integration/evidence/` to
the HTML. It fails if a registered claim points at a route that does not exist,
or if a figure the registry records for a route has drifted out of it, and it
notes any claim the registry will not stand behind so someone confirms the page
still qualifies it.

It also prints figure coverage: every distinctive number a route asserts,
looked up in the evidence layer. A figure that appears nowhere in it is not
automatically wrong — plenty are sourced in a record's own prose — but it is a
figure with no registered source, and that is the number to drive down before
anything is promoted. Phone numbers and a 404 page naming its own status code
are excluded; they are contact details, not claims.

At the time of writing every published route sits at 100%. The candidate
homepage sits at 15%, because it leads with MediMatch, Operation Sentinel,
Simy and Model foundry, and the evidence layer covers none of them.

## perf.mjs

    node tools/perf.mjs
    BASE=https://www.lesnarai.co.ke THROTTLE=4g node tools/perf.mjs

Cold cache — a fresh context per run — at 1440, 1024 and 390, with optional
CDP throttling, reporting TTFB, FCP, LCP, CLS and bytes split by type.

Two things it gets right that an earlier attempt did not. LCP comes from a
PerformanceObserver with `buffered:true` installed before navigation; reading
`getEntriesByType` afterwards misses it, which is how a run once reported LCP
as "—" and was called measured. And LCP is taken at rest, before the page is
scrolled, because scrolling lets a later image become the largest candidate —
that is why one run showed 3664ms on 4G and 696ms on slow 3G.

`BASE` points it at production. Local numbers have a 1-2ms TTFB and are not
production timings.
