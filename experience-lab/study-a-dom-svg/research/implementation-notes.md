# Study A — Implementation notes, Waves A and B

## Baseline

```text
working_directory:       /home/lesnar/Documents/ai model
repository:              lesnargitonga/geneat (origin, git@github.com)
branched_from:           5479845ca8615cee3fc785c7ddd069e1f5f7671b (accepted baseline)
prototype_branch:        experience/lesnarai-v2-study-a
head:                    5479845ca8615cee3fc785c7ddd069e1f5f7671b
prototype_or_production: prototype
worktrees:               1
stashes:                 none
study_b:                 experience/lesnarai-v2-study-b @ 7dc29a2, untouched
```

Branched directly from the accepted baseline, **not** from Study B. Verified:
`git merge-base --is-ancestor 7dc29a2 HEAD` fails, so Study B is not an
ancestor. That independence is what makes the §8 comparison meaningful rather
than a measurement of shared ancestry.

One state note recorded honestly: the working tree was clean in *tracked*
terms, but Study B's ignored build artefacts (`node_modules`, `dist`,
`test-results`) remained on disk after the branch switch. They were left in
place — deleting untracked files needs authorisation. See decision A-11.

## What was built

### Wave A — baseline and isolation

- Vite 7 + TypeScript 5.9 project at `experience-lab/study-a-dom-svg/`, strict
  mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- **Zero runtime dependencies.** Dev-only: vite, typescript, @playwright/test,
  @types/node.
- Modular source: 7 TypeScript modules across `state/`, `navigation/`,
  `accessibility/`; 7 stylesheets. No single large file.
- README with local run and build instructions.
- `scripts/verify-isolation.mjs` — production-diff and Study B integrity
  validation as a repeatable script rather than commands quoted once.

### Wave B — static narrative

All nine required units, complete in the served HTML:

1. Hero and unresolved idea — headline, supporting copy, immediate CTA.
2. Idea-to-Gen-Eat transition — the seven operational routes.
3. Gen-Eat proof — four panels, three `verified`, one `EVIDENCE PENDING`.
4. System inspector — six stages, each answering enters / acts / can fail /
   recovery, with real module paths.
5. Physical action — seven steps, `PROTOTYPE — engineering demonstration`.
6. Verdict and contact CTA.
7. Mobile layout — single column, 44px targets, no overflow.
8. Reduced-motion composition — Effects control wired, tokens collapse.
9. JavaScript-disabled experience — the full story, asserted by 12 tests.

Plus a **visible limitations block** on the page, and the static Lesnar Signal
as layered SVG following the §7.6 anatomy: dormant path, residual trace, active
path, signal head, evidence nodes, constraint boundaries, human gate, action
node.

## Architecture

```
index.html                    complete story, all content, all controls
   │                          static SVG signal, no canvas, no script needed
   └── src/main.ts            progressive enhancement only (3.12 kB gzip)
         ├── state/           experience store, motion preference
         ├── navigation/      chapter tracking, anchor focus correction
         ├── accessibility/   content-model integrity check
         └── styles/          7 stylesheets, role-based tokens
```

The enhancement adds exactly three things: current-chapter state on the rail,
focus correction for in-page anchors, and the Effects preference. It starts no
animation, because none exists.

## Measured

| | Study A | Study B (7dc29a2) |
|---|---:|---:|
| `index.html` gzip | 6.67 kB | 5.97 kB |
| CSS gzip | 3.52 kB | 3.78 kB |
| JS gzip | **3.12 kB** | 7.82 kB entry + 129.43 kB renderer |
| **Total transfer** | **13.31 kB** | 147.00 kB |
| Runtime dependencies | **0** | 1 |
| TypeScript modules | **7** | 22 |
| TypeScript source lines | **747** | 3,174 |

Study A is **11× smaller in transfer** and **4.2× smaller in source**. That is
a maintainability and performance signal only — it says nothing yet about
whether spatial rendering communicates something SVG cannot, which is the
question the studies exist to answer.

## Proof sourcing

Three panels marked `verified`, each read directly from this repository:

| Claim | Source |
|---|---|
| FastAPI backend, Alembic, Postgres, Redis | `app/`, `alembic/`, `render.yaml` |
| Channel adapter contract + registry | `app/channels/base.py`, `voice_registry.py` |
| Payment factory, 5 adapters + simulator | `app/integrations/payments/` |
| Next.js storefront on Vercel | `gen-eat-portal/`, `.vercel/project.json` |
| Render infra: Docker web, Postgres, Redis, Frankfurt | `render.yaml` |
| `geneat.lesnarai.co.ke`, `api.lesnarai.co.ke` | production `lesnarai-landing/index.html` |

The fourth panel states no figures at all. A regex guard in `no-js.spec.ts`
fails the build if anything shaped like an unmeasured metric — order counts,
currency amounts, uptime percentages, latency figures — appears on the page.

## Checks run

```text
npx tsc --noEmit                      0 errors
npm run build                         success, 144ms
npx playwright test                   47 passed, 1 skipped, 0 failed
node scripts/check-content-parity.mjs 10 match, 4 intentional, 0 undeclared → PASS
node scripts/verify-isolation.mjs     16/16 passed (10 staging hazards warned)
node scripts/capture-evidence.mjs     3 screenshots
```

## Defects found and fixed during the wave

**1. Attribute collision on `data-chapter`.**
The chapter controller wrote `data-chapter` to `<html>` to mark the *current*
chapter, colliding with `data-chapter` on the four chapter *sections*.
`querySelectorAll("[data-chapter]")` returned five, and the integrity check
failed against a page that was correct. Renamed to `data-current-chapter`, and
the integrity selector scoped to `section[data-chapter]`.

Study B has the same latent collision but never counts chapters, so it never
surfaced there. Worth fixing when Study B is next authorised for edit.

**2. A test measuring timing rather than behaviour.**
The “no animation” assertion checked `getAnimations().length === 0`. It passed
on desktop and failed on mobile with exactly two running animations — the rail
link's `color` and `border-color` transitions, fired when the controller marks
the current chapter at attach. `getAnimations()` includes `CSSTransition`, so
the assertion was racing page boot.

Rewritten to assert what matters: no `CSSAnimation`, no infinite-iteration
animation, no SMIL, and nothing still running after a settle delay. Interaction
transitions are explicitly permitted by §7.14.

**3. A stale preview server masking a fix.**
Playwright's `reuseExistingServer` reused a manually started `vite preview`
serving an old `dist`, so a corrected build appeared still broken. Rebuilt and
restarted before the final run. Recorded because it is the kind of thing that
produces a false conclusion about working code.

## Isolation verified

```text
git diff 5479845 -- lesnarai-landing/            → empty
git diff 5479845 -- experience-lab/study-b-webgl/ → empty
git diff 5479845 -- hazina-portal/ gen-eat-portal/ app/ alembic/ deploy/
                     render.yaml docker-compose.yml Dockerfile → all empty
experience/lesnarai-v2-study-b                    → 7dc29a2, 55 files
git status --porcelain (tracked)                  → empty
```

Nothing committed, nothing pushed, nothing deployed.

## Not done, by instruction

No animated SVG, no GSAP, no ScrollTrigger, no interactive inspector, no
commit. **No conclusion about Study A versus Study B is available from this
wave** — both are static baselines by design. See `limitations.md`.
