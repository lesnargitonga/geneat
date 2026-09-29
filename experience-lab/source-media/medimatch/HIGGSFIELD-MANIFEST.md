# MediMatch, Higgsfield manifest

Six slots. The governing rule for all of them: **real interface, spatial camera
or depth transition, real interface.** Higgsfield moves a camera through
captured pixels. It does not redraw the product, retype the copy, invent map
geography or change a number.

Shared constraints, applying to every slot below.

Must remain unchanged in all frames:
- every numeral in the counters and in the narrative card
- the county and hospital names
- the basemap geography and the CARTO / OpenStreetMap attribution
- the route paths and node positions
- the disclosure strip at the bottom
- the MediMatch wordmark and nav

Higgsfield may: move a virtual camera (pan, push, parallax, depth separation
between basemap, route layer and card layer), adjust exposure or grade within
the existing palette, add motion blur consistent with the camera move, and
cross dissolve between two supplied real frames.

Higgsfield must not: generate new map tiles, extend the map beyond the captured
frame edge, invent facilities, routes or labels, restyle the UI chrome, alter
any digit, add lens flare, add particles, or add text of its own.

---

## Slot 1, national establishing

- **System:** MediMatch
- **Source file:** `mm-atrest-1440@3x.png` (4320x2700)
- **Exact state:** narrative card collapsed, national coordination picture only
- **Homepage role:** the opening frame of the MediMatch section, held still
  behind the section heading
- **Start frame:** full national view as captured
- **End frame:** same view, roughly 8 percent tighter on the Kenya landmass,
  centre of interest drifting toward the north east corridor
- **Transition:** slow push in with mild depth parallax, route layer separating
  from basemap by a few pixels
- **Duration:** 6 s, designed to loop without a visible cut
- **Aspect:** 16:9, cropped from 3:1.875. Safe area is the central 1440x810
- **Unchanged:** all of the shared list
- **Permitted:** camera push, parallax, grade
- **Must not invent:** anything outside the captured frame edge

## Slot 2, detection

- **Source file:** `mm-detect-1440@3x.png`
- **Exact state:** 01 Urgent signal detected, Mandera supply gap, 120 units of
  insulin, counters at 53 served, 29 urgent, 92 percent
- **Homepage role:** first beat of the four beat sequence
- **Start frame:** national view, card present at left
- **End frame:** same frame, camera settled slightly toward Mandera in the
  north east, card held legible
- **Transition:** short drift, no zoom past the point where card text softens
- **Duration:** 2.5 s
- **Aspect:** 16:9
- **Unchanged:** the card copy in full, the 120 figure, the counters
- **Permitted:** camera drift, depth between card and map
- **Must not invent:** a pulsing marker, a highlight ring, or any emphasis the
  product does not itself draw

## Slot 3, ranking

- **Source file:** `mm-rank-1440@3x.png`
- **Exact state:** 02 Geospatial ranking, weighing 11 supply hubs
- **Homepage role:** second beat, the explainable step
- **Start frame:** as captured
- **End frame:** as captured, camera held nearly still
- **Transition:** cross dissolve from slot 2, 400 ms, no camera move of its own
- **Duration:** 2 s
- **Aspect:** 16:9
- **Unchanged:** the figure 11, the ranking factors sentence
- **Permitted:** dissolve, micro drift under 1 percent
- **Must not invent:** animated ranking bars, scores, or a leaderboard

## Slot 4, routing

- **Source file:** `mm-route-1440@3x.png`
- **Exact state:** 03 Source selected, Nairobi to Mandera, Aga Khan University
  Hospital releases 120 units, 1141 km coordination route
- **Homepage role:** third beat, the decision
- **Start frame:** as captured
- **End frame:** camera follows the amber corridor north east, ending with
  Nairobi and Mandera both still inside frame
- **Transition:** lateral camera move along the existing route path
- **Duration:** 3 s
- **Aspect:** 16:9
- **Unchanged:** both place names, 120 units, the drawn corridor itself
- **Permitted:** camera travel along the corridor, depth parallax
- **Must not invent:** a travelling dot, a drawing-on animation, or a new path.
  The product already animates its own travellers; if motion along the route is
  wanted, capture the product doing it rather than asking Higgsfield to add it

## Slot 5, impact

- **Source file:** `mm-impact-1440@3x.png`
- **Exact state:** 04 Equitable access restored, 53 facilities reached,
  3,373 units routed across 5,463 km
- **Homepage role:** fourth beat, the resolution, and the still the section
  rests on
- **Start frame:** as captured, tight
- **End frame:** pulled back to the full national view
- **Transition:** slow pull out, the inverse of slot 1
- **Duration:** 3.5 s
- **Aspect:** 16:9
- **Unchanged:** 53, 3,373 and 5,463 exactly as rendered
- **Permitted:** camera pull back, grade
- **Must not invent:** counting-up numerals. If a count-up is wanted, record the
  product's own counter animating

## Slot 6, mobile

- **Source file:** `mm-route-390@3x.png` (1170x2532)
- **Exact state:** route state at 390 wide
- **Homepage role:** the phone frame beside the desktop sequence, proving it is
  one product and not a desktop-only demo
- **Start and end frame:** identical, no camera move
- **Transition:** none, a still
- **Duration:** static
- **Aspect:** 9:19.5 native, do not crop to 16:9
- **Unchanged:** everything
- **Permitted:** nothing beyond placement in a device frame, if a frame is used
  at all
- **Must not invent:** a floating phone render, a hand, a reflection, a room

---

## What is deliberately not requested

No slot asks for a fly-through of Kenya, a satellite zoom from orbit, a glowing
supply chain, or a rendered warehouse. The product's own geography and its own
motion are the subject. If a beat needs motion the product already performs,
the answer is to record the product performing it, not to synthesise it.
