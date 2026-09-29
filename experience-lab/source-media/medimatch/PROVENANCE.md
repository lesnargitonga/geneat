# MediMatch source captures, provenance

Captured 29 September 2026 on the Precision, from the live application, not
from a mockup and not from generated imagery.

## How they were produced

- Repository: `~/publish-stage/MediMatch`
- Route: `/command`, rendered by `client/src/pages/SavannahCommand.tsx` (657 lines)
- Server: `npm --prefix server run dev` with `USE_MOCK_DB=true`, so the API
  serves `server/src/mock/db.ts`. No Postgres container was started and no
  running database was touched.
- Client: Vite dev server on 5173.
- Browser: Playwright Chromium, viewport 1440x900, `deviceScaleFactor: 3`.
  Mobile frame at 390x844, also 3x, `isMobile` and `hasTouch` set.
- Zero page errors were recorded on every capture.

## Which build this is

There are two real generations in the repository. `CommandMap.tsx` (714 lines)
is the older teal build with an abstract Kenya outline, and it is what the
committed `docs/screenshots/` images show. `SavannahCommand.tsx` is the current
build at `/command`: real CARTO and OpenStreetMap basemap tiles, amber and
green palette, live coordination counters. These captures are the current
build. The older screenshots were not reused.

## Stage control

The four stages are real product state, not staging for a photograph. They are
driven by the buttons carrying `aria-label` of `detect`, `rank`, `route` and
`impact` in `.sv-steps`, which call `setStage`. The kickers the product itself
renders are `01 Urgent signal detected`, `02 Geospatial ranking`,
`03 Source selected`, `04 Equitable access restored`.

The application auto-cycles scenarios roughly every 15 seconds. `detect` and
`route` are the only two states that name a county, so they were captured
adjacently and verified to be the same scenario before the frames were kept:
detect reads `Mandera supply gap`, route reads `Nairobi to Mandera`. An earlier
pass that drifted across scenarios was discarded.

## The frames

| file | state | what the product says |
|---|---|---|
| `mm-prelude-1440@3x.png` | opening, early accumulation | counters at 5 served, 2 urgent, 92%. Brief still typing. Fewer routes drawn. |
| `mm-detect-1440@3x.png` | 01 detect | Mandera supply gap. Mandera County Referral Hospital reports an urgent need for 120 units of insulin. |
| `mm-rank-1440@3x.png` | 02 rank | Geospatial ranking, weighing 11 supply hubs. |
| `mm-route-1440@3x.png` | 03 route | Nairobi to Mandera. Aga Khan University Hospital releases 120 units across a 1141 km coordination route. |
| `mm-impact-1440@3x.png` | 04 impact | Equitable access restored, 53 facilities reached. |
| `mm-atrest-1440@3x.png` | geography alone | narrative card collapsed, so the national picture reads without copy over it. |
| `mm-route-390@3x.png` | mobile, route | same product, 390 wide. |

## Disclosure that must survive

The application renders its own disclosure in every frame:

> Case study: Nairobi County, synthetic data, no patient records, coordinator
> verification required

The homepage may present this differently, but it may not lose the meaning:
the inventory and need data are synthetic and no patient records are involved.

## Route distance: traced and resolved

The stills first captured showed 1141 km in the headline and 806 km in the
brief, for the same transfer. Traced rather than patched.

The plan is fetched twice by design, and the code says so:
`/redistribution/plan?roads=0` returns curved arcs immediately, then
`?roads=1` replaces it with real road geometry once that resolves. Measured
against the mock plan, 54 of the 55 routes change distance between the two,
and route 1, Nairobi to Mandera, goes from 806 km to 1141 km, a 42 percent
difference. The `roads_used` flag is false on the first and true on the second.

Both strings read the same route object, so they could not legitimately
differ. The cause was `briefFor(lead)` memoised on `[lead?.id]` alone. Route
ids are stable across the arc-to-road upgrade but distances are not, so the
headline re-rendered with the road distance while the memoised brief kept the
arc distance.

**1141 km is correct.** The product routes over real road geometry, its own
impact panel gates on `roads_used`, and the second fetch is explicitly the
upgrade. Nairobi to Mandera is roughly 800 km straight line and roughly
1,100 km by road.

Fixed in the MediMatch repository on branch `fix/brief-stale-arc-distance`,
commit `63e8983`, by adding `lead?.distance_km` to the memo dependencies.
Depending on the whole `lead` object would recompute every render, because
`lead` comes from a `find()`, and that would restart the typewriter
continuously. Verified in the running app: headline and brief both read
1141 km, and 1141 is the only km figure on screen in the route state.

`mm-route-1440@3x.png` was recaptured from the fixed branch on 29 September
2026 with the same settings (1440x900 viewport, deviceScaleFactor 3, same
Mandera scenario, verified adjacent to the detect state). The headline and the
brief both read 1141 km and it is the only km figure on the page. No still in
this directory now carries the stale arc distance.

Checks run against the fix at commit `63e8983`, all passing:

| check | command | result |
|---|---|---|
| client typecheck | `tsc --noEmit -p client/tsconfig.json` | exit 0, no diagnostics |
| client build | `npm --prefix client run build` | exit 0, built in 5.98 s |
| server tests | `npm --prefix server run test:run` | 3 files, 5 tests passed |
| server build | `npm --prefix server run build` | exit 0 |

Worth noting: `vite build` does not typecheck, since Vite strips types rather
than checking them, so `tsc --noEmit` was run separately. That is the check
that actually covers the changed file. The branch is not merged.

## Motion recording

`motion/medimatch-detect-rank-route-impact-1920x1080.webm`

- 30.40 s, 1920x1080, recorded from the live application after the distance fix
- Captured with Playwright's own recorder. No screen capture tool, no ffmpeg on
  this machine, no post-processing, no overlays, no presentation effects
- Zero page errors
- One scenario throughout, verified beat by beat as the stills were:
  `01 Urgent signal detected, Mandera supply gap`, then
  `02 Geospatial ranking, weighing 11 supply hubs`, then
  `03 Source selected, Nairobi to Mandera`, then
  `04 Equitable access restored, 53 facilities reached`
- The take opens on the product's own globe intro carrying
  "See surplus. Detect need. Close the gap.", which was not staged
- Confirmed at zoom in the footage: the brief reads "over the 1141 km transfer"

One piece of capture-time instrumentation, and nothing else. The product
schedules its scenario carousel with exactly `setTimeout(..., 15000)`. That one
timer was dropped by an init script for the length of the take, so a single
scenario runs end to end instead of the lead changing mid-sequence. No product
code was changed for the recording, no visual design was altered, and the
suppression affects only which scenario is on screen, not what it says.

Frames were verified by drawing the decoded video to a canvas and reading pixel
data. A headless screenshot of a `<video>` element returns white, because the
decoded frame is not composited, so that method was discarded rather than
trusted.
