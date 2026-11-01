# Release plan — site-truth hotfix (prepared 2026-11-01, not deployed)

**Status:** prepared and gated; all five commits are in the release (owner decision, 2026-11-01). The deploy needs separate owner authorisation after the Vercel mapping is verified.
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
| Which Vercel project(s) each domain is assigned to | **not verified: CLI not authenticated** |
| Current production deployment ID per project (the rollback target) | **not verified: CLI not authenticated** |

Before any deploy, with the Vercel CLI logged in:

1. `vercel whoami`, then `vercel teams ls` to confirm the owning team.
2. `vercel inspect https://lesnarai.com` and `vercel inspect https://www.lesnarai.co.ke` to record
   the deployment and project behind each domain.
3. `vercel ls <project> --prod` for each project, recording the current production deployment URL
   as the rollback target.
4. `vercel domains inspect lesnarai.com` and `vercel domains inspect lesnarai.co.ke` to confirm
   the domain assignment and redirect configuration.

If both domains belong to one project, one deploy covers both. If they belong to two, the same
tree is deployed to each, in an order the owner chooses. Domain policy (lesnarai.com as primary
canonical) is a separate migration and is not part of this release.

## 3. Deploy

From a clean checkout of the approved commit, not from the main working tree:
`lesnarai-landing/` with the project link copied into `.vercel/`. Then run `vercel deploy --prod`
for each target project.

## 4. Verify live, on both domains

- Home contains "Simulation only. No physical airframe has been flown."
- Neither "no flight log of any kind" nor "no logged simulated flight" appears anywhere.
- Company has no photography brief.
- Home has no Simy, no USDC figure, no survey percentages and no Nairobi capture.
- Unreleased redesign content is absent: no `/work/sentinel/`, no Film 001 on Home.
- Response headers still carry the full CSP and the other four security headers.

## 5. Rollback

Promote the recorded previous production deployment (`vercel rollback <url>`, or Instant Rollback
in the dashboard) for each affected project, then re-run the checks in §4 against the restored
text. Nothing in this release changes routes, redirects or headers, so rollback has no data or
DNS consequences.
