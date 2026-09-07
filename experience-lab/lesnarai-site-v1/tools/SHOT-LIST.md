# Photographic brief — LESNAR AI

Written 7 September 2026, after an evidence audit of all 42 assets on the site.
Take this on the shoot. Every shot below is specified to land in a slot that
already exists in the markup, at a size that has been measured in a browser.

---

## What the audit found

The site holds **42 image files. Only four are photographs.** The other 38 are
interface captures. Of those four:

| File | Where it sits | Verdict |
|---|---|---|
| `studio-portrait.jpg` | About page, the only human image | **Replace.** A selfie facing camera. |
| `aerial-airframe.jpg` | Aerial systems, the only evidence | **Replace.** A toy drone in a zip case. |
| `studio-close.jpg` | Homepage closing section | **Keep the behaviour, reshoot the room.** |
| `hero-bench.jpg` | Homepage hero, CSS background | **Optional.** Sits under a 78% ink gradient. |

`studio-close.jpg` is the most important file here, because it is already
**doing the right thing**: subject in profile, hand on the machine, working,
not looking at the lens. That is the register every shot below must match.
Its problems are the room, not the pose.

---

## The governing rule

This site publishes what a thing proves and what it does not. A photograph is
held to the same standard as a claim.

- **Never stage.** No arranged handshakes, no pointing at a monitor, no folded
  arms, no looking at the lens.
- **Photograph what is true.** If nothing has flown, do not photograph a sky.
- **A photograph must not out-claim its caption.** If the frame implies a team,
  an office or a customer that does not exist, the frame is wrong — not the
  caption.
- **No stock. No generated imagery. No cliché AI iconography** — no glowing
  brains, circuit boards, blue holograms or abstract networks.

---

## Set preparation — do this before touching the camera

Across all four existing photographs, the camera was never the problem. These
five things were, and all five are free to fix.

1. **Kill the LED strip.** The red/magenta wash behind the desk is the single
   largest defect in `studio-close.jpg` and `hero-bench.jpg`. It fights the
   daylight, throws a colour cast across skin and walls, and cannot be graded
   out cleanly. Switch it off for every frame.
2. **Every screen in frame shows work.** In the current files the wall TV shows
   a beach, then a waterfall; a second monitor shows a paraglider. Put the code
   editor, the register, a terminal or a live product surface on every visible
   screen. A wallpaper in frame reads as a bedroom.
3. **Clear the frame edges.** The star-print curtain, the peeling varnish on
   the chair, bottles and boxes on the shelf. You do not need a different room —
   you need eighteen inches of clearance at the edges of the frame.
4. **One light, one colour.** Shoot in the 90 minutes before sunset with the
   window as the key light and **every room light off**. Mixed daylight and warm
   bulbs is what produced the orange cast.
5. **Shoot against the least decorated wall.** Plain plaster is enough. A blank
   wall behind a working subject reads as a studio; a decorated one reads as a
   living room.

## Camera

A recent phone is fine — resolution was never the limitation.

- **Wipe the lens.** Twice.
- **Never use the front camera.** Every frame is shot on the rear lens.
- **Do not use portrait/beauty mode.** No artificial background blur, no skin
  smoothing. Depth of field must come from real distance.
- **Do not use ultra-wide.** It is what made the existing portrait bulge. Use
  the main 1x lens, and step back instead of zooming out.
- **Lock exposure and focus** by long-pressing on the subject's face or on the
  hardware, then shoot.
- **Shoot 8–12 frames of every setup**, moving 30cm between frames. Deliver all
  of them; selection happens later.

---

# The shots

## Tier 1 — shootable alone, no third party, this week

### P1 · About portrait — replaces `studio-portrait.jpg`
**The single highest-value frame on this list.** It is the only photograph of a
person on the site, and right now it is a selfie.

- **Action:** working. Typing, reading a diff, or turning to the second screen.
  Shoot *while* actually working, not while performing working.
- **Angle:** profile or three-quarter from behind the shoulder. **The subject
  must not look at the lens in any delivered frame.**
- **Framing:** waist up, subject occupying the left or right third — not
  centred. Leave the screens legible in the remaining two thirds.
- **Camera height:** seated eye level. Not above, not below.
- **Distance:** 1.5–2m, main lens.
- **Orientation:** vertical, **4:5**.
- **Light:** window camera-left or camera-right, never behind the subject.
- **Must be in frame:** the subject's hands on the keyboard or trackpad; at
  least one screen showing real work.
- **Must NOT be in frame:** the lens being looked at, the LED strip, any
  wallpaper, the curtain, the chair back.
- **Master:** ≥ 1600 × 2000.
- **Destination:** `about/index.html`, `.ab-portrait` (renders 420 × 453).
- **Caption must stay true to:** one person, at a bench, in Nairobi.

### P2 · Aerial hardware — replaces `aerial-airframe.jpg`
The page already says, correctly, that nothing has flown. The current frame is
still wrong: a top-down snapshot of a consumer drone in its zip case with a
keyboard intruding at the corner and the manual upside down. Photograph the
same object as **evidence**, not as clutter.

- **Subject:** the airframe out of the case, on a clear surface, shell off,
  control side facing up.
- **Set:** clear the desk completely. Plain surface, nothing else in frame — no
  keyboard, no manual, no mesh pocket, no case.
- **Angle:** 30–40° from horizontal, not straight down. A raking angle shows
  depth and the fact that this is a real object on a real bench.
- **Distance:** close enough that the airframe fills 70% of the frame width.
- **Orientation:** horizontal, **4:3**.
- **Light:** window light from one side, so the components cast a soft
  directional shadow. Never the phone flash.
- **Must be in frame:** exposed wiring, the motor mounts, the battery — the
  parts that make it evidently opened rather than unboxed.
- **Must NOT be in frame:** the carry case, the printed manual, a sky, a hand
  holding it up, a person.
- **Master:** ≥ 2400 × 1800.
- **Destination:** `work/aerial-systems/index.html`, `.surface`
  (renders 1248 × 937 desktop, 362 × 272 mobile).
- **Caption must keep saying:** the hardware exists and has been opened. Not a
  custom aircraft. No flight, range, endurance or autonomy is claimed.

### P3 · Bench detail — new material for the commercial pages
Services, Engagement, Pricing, Book and Contact currently have **zero visual
material between them**. This one frame can carry several of them.

- **Subject:** hands and one screen. No face.
- **Framing:** tight. Hands on the keyboard entering the lower third, one
  monitor filling the rest, code or the register legible but not readable.
- **Angle:** over the shoulder, slightly above.
- **Orientation:** horizontal, **3:2**.
- **Must NOT be in frame:** a face, a mug, a phone, a notebook prop.
- **Master:** ≥ 2400 × 1600.

### P4 · Wide bench plate — optionally replaces `hero-bench.jpg`
This one sits under a 78% ink gradient in the homepage hero, so it works as
texture rather than as a photograph. Reshoot only after P1–P3.

- **Subject:** the whole bench, no person, shot wide.
- **Orientation:** horizontal, **16:9 or wider**. The hero renders a
  5:1 letterbox, so keep the interest in the **middle vertical third** — the
  top and bottom will be cropped away.
- **Light:** shoot at dusk with screens as the brightest thing in frame. The
  hero is an ink plate; a dark original survives the gradient far better than a
  bright one.
- **Master:** ≥ 2800 × 1600.

## Tier 2 — only if the hardware physically exists

`work/greenhouse-controller/` and `work/sensing-and-radar/` are text-only
records. **Do not photograph anything that does not exist.** If there is real
hardware on a bench, shoot it to the P2 specification above — clear surface,
raking light, 4:3, no props. If there is not, these pages stay text, and that
is the honest outcome.

## Tier 3 — requires a real, consenting person

These are the strongest possible frames for the site and the easiest to get
wrong. **Only shoot these if the person and the transaction are genuinely
real.** A staged merchant is worse than no photograph.

- **P5 · A real merchant handling a real BizMtaani order.** Hands, the device,
  the counter, the goods. Documentary distance, no eye contact with the lens.
- **P6 · A real Jamii or CarePro user on their own phone.** Screen legible
  enough to be recognisable, not legible enough to expose personal data.

**Required before shooting either:** spoken consent to be photographed and
published, and **no customer names, phone numbers, addresses or order details
legible in frame.** If a screen shows real personal data, the frame is unusable.

---

## Delivery

- Deliver **originals**, straight off the camera. No filters, no crops, no
  Instagram export, no screenshots of photographs.
- Keep the largest file the phone produced.
- Put them in `media/incoming/` named by shot: `P1-portrait-01.jpg`,
  `P1-portrait-02.jpg`, and so on.

## How a delivered photograph reaches the site

Cropping and resizing is mechanical — do not do it by hand.

```
python3 tools/photo.py derive about-portrait media/incoming/P1-portrait-04.jpg
```

That crops to the slot's exact aspect at the anchor the spec names, resamples
once to the declared box, writes both the JPEG and the WebP at matching
geometry, and prints the `<picture>` block to paste in.

```
python3 tools/photo.py audit
```

proves afterwards that every image on every page still resolves, still matches
its declared box, and still reserves the right space — which is what stops a
photograph from silently reintroducing a layout shift.
