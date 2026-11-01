# Release plan — site-truth hotfix (deployed 2026-11-01)

**Status:** deployed to production on 2026-11-01 at 21:37 EAT, with owner authorisation, as
`lesnarai-v2-lab7a68rq-lesnar.vercel.app` (`dpl_ADBrGgQEBCAJqBE8HW4LfCLqBWqE`). It was verified
live on all four hosts (§6). The rollback target `lesnarai-v2-jfalf37v5-lesnar.vercel.app` is kept,
Ready.
**Source:** branch `hotfix/site-truth-2026-11-01`, cut from production revision `18a73f3`.

## 1. What ships

| Commit | Change | Status |
|---|---|---|
| `bb4c92b` | Two false Sentinel flight statements corrected; internal photography brief removed from Company | included |
| `8900503` | Simy and the smart-contract disclosure specifics removed from Home | included |
| `7a1ab1c` | Aerial record no longer says nothing was measured | included |
| `ba40649` | MediMatch survey readout withdrawn from Home | included |
| `5d9fb4b` | Nairobi capture removed: its product UI text repeats the field-study line | included (owner decision, 2026-11-01) |

**Deployed surface:** three files under `lesnarai-landing/`, namely `index.html`,
`company/index.html` and `work/aerial-systems/index.html` (15 lines added, 70 removed with all five
commits). The repo-root `.vercelignore` admits only `lesnarai-landing/`, and
`lesnarai-landing/.vercelignore` excludes `tools/`, `node_modules/` and `audit.mjs`. The only change
outside the deployed surface is the internal evidence registry. No inline script changes, so
production's CSP hashes stay valid. The exact diff was given to the owner directly, with its
SHA-256.

**Gates on the release tree:** the static and claims gates pass on every commit prefix, and the
runtime gate passes on all routes in Chromium, Firefox and WebKit at 1440 and 390.

## 2. Deployment mapping

| Fact | Verified how |
|---|---|
| `lesnarai.com` and `www.lesnarai.co.ke` serve byte-identical `18a73f3` | HTTP fetch and ETag, 2026-11-01 |
| `www.lesnarai.com` → 308 → `lesnarai.com`; `lesnarai.co.ke` → 308 → `www.lesnarai.co.ke` | HTTP headers |
| Both zones on Cloudflare DNS, different nameserver pairs; each `www` has its own `*.vercel-dns-017.com` target | `dig` |
| `lesnarai-landing/.vercel/project.json` links project `lesnarai-v2` (team-owned) | local file |
| `lesnarai.co.ke` and `www.lesnarai.co.ke` are project domains of `lesnarai-v2` (team `lesnar`) | `vercel domains inspect`, CLI as `lesnargitonga` |
| `lesnarai.com` and `www.lesnarai.com` are **not** project domains: they are manual aliases pinned to one deployment (set 2026-10-08) | `vercel domains inspect` (no project), `vercel alias ls` |
| Current production deployment, serving all four hosts: `lesnarai-v2-jfalf37v5-lesnar.vercel.app` (`dpl_768K4h2M6pMSq5ALYnBAK8mKJ8my`, 18 Sep 2026). **This is the rollback target.** | `vercel inspect` on both domains |
| The `www.lesnarai.com` → `lesnarai.com` 308 is a platform redirect (no CSP, path kept), independent of the deployment | response headers |

**Expected consequence, disproved at release:** a production deploy was expected to move only the
two `.co.ke` hosts. In fact `vercel deploy --prod` re-pointed all four hosts, the `.com` pair
included. The explicit `vercel alias set … lesnarai.com` (§3, step 2) was still run and confirmed;
it is idempotent. Keep both steps in future releases and in rollback until the domain migration
makes `lesnarai.com` a project domain.

**Preview of the release tree:** `https://lesnarai-v2-264wb38hx-lesnar.vercel.app` (project
`lesnarai-v2`, target preview, built from `5d9fb4b`). Read with `vercel curl`, Company and the
aerial page are byte-identical to the branch. Home differs only by Vercel's preview toolbar
script, which production deployments don't get. The §4 checks pass on the preview.

## 3. Deploy

From the clean hotfix worktree at `5d9fb4b` (`lesnarai-landing/`, with the project link in `.vercel/`),
never from the main working tree:

1. `vercel deploy --prod --scope lesnar`. This moves `lesnarai.co.ke` and `www.lesnarai.co.ke`.
2. `vercel alias set <new deployment URL> lesnarai.com --scope lesnar`. This moves the apex `.com`.
   `www.lesnarai.com` needs no change: it redirects to the apex.

## 4. Verify live, on both domains

- Home contains "Simulation only. No physical airframe has been flown."
- Neither "no flight log of any kind" nor "no logged simulated flight" appears anywhere.
- Company has no photography brief.
- Home has no Simy, no USDC figure, no survey percentages and no Nairobi capture.
- Unreleased redesign content is absent: no `/work/sentinel/`, no Film 001 on Home.
- Response headers still carry the full CSP and the other four security headers.

## 5. Rollback

1. `vercel rollback lesnarai-v2-jfalf37v5-lesnar.vercel.app --scope lesnar` (the `.co.ke` hosts).
2. `vercel alias set lesnarai-v2-jfalf37v5-lesnar.vercel.app lesnarai.com --scope lesnar` (the `.com` apex).
3. Re-run the checks in §4 against the restored text. Nothing in this release changes routes, redirects or headers, so rollback has no data or
DNS consequences.

## 6. Release record (2026-11-01)

1. `vercel deploy --prod --scope lesnar --yes` from the hotfix worktree at `5d9fb4b` (clean)
   → `lesnarai-v2-lab7a68rq-lesnar.vercel.app`, aliased by Vercel to all four hosts.
2. `vercel alias set lesnarai-v2-lab7a68rq-lesnar.vercel.app lesnarai.com` → success; `vercel alias ls`
   shows both `.com` hosts on the new deployment.
3. Live verification (scripted; checked first against the old production, where it failed on every
   corrected statement):
   - `www.lesnarai.com` and `lesnarai.co.ke` → 308, path and query kept.
   - `lesnarai.com` and `www.lesnarai.co.ke` → 200, with the same CSP as `vercel.json` and HSTS, nosniff, `DENY`,
     referrer and permissions policies.
   - Home, Company and the aerial page are byte-identical to the release tree.
   - Canonicals are unchanged (`https://lesnarai.co.ke/...`; the strategy is not changed in this release).
   - The Simulation-only line is present. Both false flight statements, Simy, USDC, the survey readout, the
     Nairobi capture and the photography brief are gone. No redesign content.
   - All 17 sitemap routes on both hosts → 200 and byte-identical to the tree. The legacy redirects
     (`/about`, `/services`, `/book`, `/contact`, `/pricing`) still → 308.

No rollback was needed. DNS, email routing, redirects and canonicals are unchanged.
