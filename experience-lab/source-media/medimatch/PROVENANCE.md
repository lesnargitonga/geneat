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

## Known internal inconsistency

In the route state the headline says a 1141 km coordination route while the AI
brief below it says 806 km. That is the product's own output. It was not
corrected here and should not be quoted on the homepage without resolving
which figure is right.
