"""Alpha seed: The Sovereign Suites & Urban Lounge — Nairobi.

Premium hybrid hospitality tenant. Forces the agent to handle two distinct
workflows under one roof:
    1. Long-form bookings (calendar tool)        → rooms, VIP table reservations
    2. Instant transactions (IntaSend M-Pesa STK) → deposits, food/bottle service

Multi-tenancy: this script PROMOTES Sovereign as the active Meta-routed tenant
(claims META_WA_PHONE_NUMBER_ID). Any previous Asha Beauty seed is kept as a
second inactive-for-routing tenant — proves the businesses table works.

Run:
    python scripts/seed_alpha.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text, select  # noqa: E402

from app.ai.rag import embed_texts  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.db.models import Business, KnowledgeChunk  # noqa: E402


SOVEREIGN_BRAND_VOICE = (
    "You are Asha, the elite AI Guest Relations Manager for **The Sovereign "
    "Suites & Urban Lounge** on Mombasa Road, Nairobi. You are warm, "
    "decisive, and quietly luxurious — never servile, never pushy. You guide "
    "guests fluidly from inquiry → availability → deposit → confirmed "
    "reservation. You speak Kenyan English, Kiswahili Sanifu, and upscale "
    "Sheng natively — matching the guest's register without being over-"
    "familiar. You quote exact KES rates from the knowledge base, never "
    "invent prices, and you trigger the M-Pesa prompt the moment a guest "
    "agrees to a deposit so the booking is locked in real time."
)

SOVEREIGN_GREETING = (
    "Karibu Sovereign Suites 🥂 How may I help you tonight — a suite, the "
    "VIP lounge, or something special?"
)

# ── Knowledge base — 26 production-grade chunks for hospitality ─────────
KB_ENTRIES: list[tuple[str, str]] = [
    # ── Brand / about ──────────────────────────────────────────────────
    ("about",
     "The Sovereign Suites & Urban Lounge is a premium hybrid hospitality "
     "venue on Mombasa Road, Nairobi — combining boutique-hotel suites with "
     "an upscale rooftop lounge. We host business travellers, weekend "
     "escapes, executive celebrations, and curated nightlife under one "
     "roof. Opened 2023. Average rating 4.8/5."),

    ("location",
     "We're on Mombasa Road, Nairobi — right next to the Airtel HQ turn-off "
     "(landmark on the eastern side of the highway). Google Maps pin: "
     "https://maps.google.com/?q=-1.3325,36.8685. Free secured parking for "
     "all guests. 25 minutes from JKIA, 20 minutes from Westlands."),

    ("hours",
     "Front desk: 24/7. Urban Lounge service: 17:00–02:00 daily "
     "(Friday–Saturday until 04:00). Restaurant: 06:30–23:00. Pool: "
     "06:00–22:00. Check-in from 14:00, check-out by 11:00. Late check-out "
     "after 11:00 attracts a 50% room-rate charge."),

    ("contact",
     "Reservations and concierge WhatsApp/calls: +254 715 540 653. Email: "
     "stay@sovereignsuites.co.ke. For corporate rates or events ask to "
     "speak to Wanjiru, the Guest Relations Manager."),

    # ── Suites / rooms ─────────────────────────────────────────────────
    ("suite-deluxe-executive",
     "Deluxe Executive Suite: KES 15,000 per night. Deposit to confirm: "
     "KES 5,000. King bed, ensuite rain shower, high-speed Wi-Fi, executive "
     "workspace, full pool access, and complimentary continental breakfast "
     "for two. 38 sqm. Photo: "
     "https://images.unsplash.com/photo-1566665797739-1674de7a421a"),

    ("suite-penthouse-oasis",
     "The Penthouse Oasis: KES 35,000 per night. Deposit to confirm: "
     "KES 10,000. Panoramic Nairobi skyline, private wrap-around balcony, "
     "jacuzzi, king bed, separate lounge, fully stocked mini-bar, "
     "complimentary breakfast for two. 72 sqm — our signature suite. Photo: "
     "https://images.unsplash.com/photo-1582719508461-905c673771fd"),

    ("suite-extras",
     "Extra adult in any suite: KES 2,500/night including breakfast. "
     "Children under 12 stay free when sharing parents' bed. Airport "
     "transfer from JKIA: KES 2,500 one way (saloon car), KES 4,500 (SUV). "
     "Early check-in before 14:00 subject to availability — half-day rate "
     "applies if before 09:00."),

    # ── VIP lounge / table reservations ────────────────────────────────
    ("vip-lounge-v8",
     "VIP Lounge V8 — our flagship private table. Seats up to 10 PAX. "
     "Minimum spend: KES 25,000. Reservation deposit: KES 5,000 (deductible "
     "from your bill). Dedicated server, premium leather seating, immediate "
     "access to the main lounge, complimentary first round of mixers. "
     "Photo: https://images.unsplash.com/photo-1560624052-449f5ddf0c31"),

    ("vip-lounge-policy",
     "VIP table reservations: deposits are non-refundable if cancelled "
     "within 6 hours of the reservation time. Tables are held for 45 "
     "minutes past the reserved start time, after which they may be "
     "released. Dress code: smart casual — no sportswear or open sandals "
     "after 19:00."),

    # ── Food & beverage packages ───────────────────────────────────────
    ("platter-sovereign",
     "The Sovereign Platter: KES 4,500. Grilled prime beef cuts, chicken "
     "wings, lamb chops, potato wedges, mint chutney, and a side of fresh "
     "kachumbari. Serves 2–3 generously. Allow 25 minutes from order."),

    ("beverage-gold-vip",
     "Gold VIP Beverage Package: KES 18,000. One bottle Johnnie Walker "
     "Gold Label (70cl), four mixers (your choice — Coke, Sprite, Soda, "
     "Tonic), unlimited ice, served bottle-service style with sparkler "
     "presentation. Pairs perfectly with VIP Lounge V8."),

    ("beverage-options",
     "Other premium bottles available: Johnnie Walker Black KES 9,500, "
     "Hennessy VS KES 14,000, Hendrick's Gin KES 8,500, Moët & Chandon "
     "Brut KES 16,500, Don Julio Reposado KES 22,000. All bottle service "
     "includes mixers and ice. Wine list available on request."),

    ("food-light-bites",
     "Light bites menu: chicken wings (8 pcs) KES 1,200, beef samosas "
     "(6 pcs) KES 850, fries with truffle aioli KES 700, mozzarella sticks "
     "KES 1,100, mixed bruschetta board KES 1,500. Vegetarian options "
     "available — ask the server."),

    # ── Booking & payment flow ─────────────────────────────────────────
    ("booking-flow",
     "To book: tell me the date(s), suite or table, and number of guests. "
     "I'll check availability, confirm the rate, and send an M-Pesa STK "
     "prompt for the deposit. Once the deposit is received the reservation "
     "is locked — you'll get a confirmation here and an email receipt."),

    ("payment-methods",
     "We accept M-Pesa (instant STK push to your phone), card on arrival, "
     "and corporate bank transfer for advance bookings of 3+ nights. All "
     "deposits are processed via IntaSend M-Pesa. Cancellation refunds "
     "(where applicable) are returned to the same M-Pesa number within 48 "
     "hours."),

    ("cancellation-policy",
     "Suite bookings: fully refundable up to 24 hours before check-in. "
     "Within 24 hours: deposit forfeited, balance refunded. VIP Lounge "
     "tables: deposits non-refundable within 6 hours of the reservation. "
     "No-shows forfeit the full deposit."),

    ("group-bookings",
     "For groups of 6+ rooms or corporate events ask to speak to Wanjiru "
     "(Guest Relations Manager). Corporate rates start 15% off rack rate "
     "for stays of 5+ nights or 4+ rooms in one block. We host birthdays, "
     "anniversary dinners, and private functions of up to 80 PAX."),

    # ── Amenities ──────────────────────────────────────────────────────
    ("amenity-pool",
     "Heated rooftop infinity pool open 06:00–22:00. Free for in-house "
     "guests. Day pass for non-residents: KES 1,500 (includes one welcome "
     "cocktail and pool towel). Towels and lockers provided."),

    ("amenity-spa",
     "Sovereign Spa: full-body massage (60 min) KES 4,500, facial KES "
     "3,500, mani+pedi KES 2,800, couples' massage (60 min) KES 8,500. "
     "Book 24 hours in advance. In-suite massage available — add KES 1,000."),

    ("amenity-gym",
     "Fitness centre open 05:00–22:00 — free for in-house guests. Cardio "
     "deck, free weights, and a small studio for yoga (Tue/Thu 07:00, "
     "Sat 09:00 — free for guests, KES 1,500 drop-in for outsiders)."),

    ("amenity-wifi",
     "Complimentary high-speed Wi-Fi throughout the property (200 Mbps "
     "down). Network: SovereignGuest. Password issued at check-in. "
     "Co-working desks in the lobby — quiet zone before 17:00."),

    # ── Events / entertainment ─────────────────────────────────────────
    ("events-weekly",
     "Weekly nights: Wednesday — live afro-jazz from 20:00 (no cover). "
     "Friday — international DJs from 22:00 (cover KES 1,000, free for "
     "in-house guests and VIP table holders). Saturday — Sovereign "
     "Saturdays themed nights from 22:00."),

    ("events-private",
     "Private events: lounge buyout (full venue, ~120 PAX) from KES "
     "350,000 minimum spend. Suite + lounge combos for bachelor/bachelorette "
     "weekends — bespoke quotes from KES 180,000 (3 suites + V8 table + "
     "platter package)."),

    # ── Languages & communication ──────────────────────────────────────
    ("languages",
     "Our staff speak English, Kiswahili, and Sheng fluently. We also have "
     "front-desk team members conversant in French and Mandarin (notify in "
     "advance for guaranteed scheduling)."),

    # ── Safety & hygiene ───────────────────────────────────────────────
    ("safety",
     "24-hour security with armed guards at all entry points. CCTV "
     "throughout common areas. Each suite has a digital safe. We do not "
     "share guest information with third parties under any circumstance — "
     "discretion is part of the brand."),

    ("hygiene",
     "Suites cleaned daily with hospital-grade disinfectant. All bedding "
     "changed between guests. Lounge glassware sanitised after each use. "
     "Kitchen and bar inspected and rated A by NCC public health."),

    # ── Additional suite tier ──────────────────────────────────────────
    ("suite-junior",
     "Junior Suite: KES 9,500 per night. Deposit to confirm: KES 3,000. "
     "Queen bed, ensuite shower, work desk, high-speed Wi-Fi, full pool "
     "and gym access, continental breakfast for one (second person KES "
     "750). 28 sqm — our entry-tier suite, ideal for solo business "
     "travellers."),

    ("suite-twin-business",
     "Twin Business Suite: KES 12,000 per night. Two single beds, ensuite "
     "shower, executive workspace, breakfast for two. 34 sqm. Popular for "
     "colleagues travelling together. Deposit: KES 4,000."),

    ("suite-family",
     "Family Suite: KES 22,000 per night. King bed + sofa bed (sleeps 4), "
     "two bathrooms, kitchenette with microwave and kettle, breakfast for "
     "four, in-room baby cot available free on request. 58 sqm. Deposit: "
     "KES 7,500."),

    # ── Check-in / check-out specifics ─────────────────────────────────
    ("checkin-checkout",
     "Standard check-in is from 14:00 (2 pm). Standard check-out is by "
     "11:00 (11 am). Both timings are East Africa Time (EAT). Photo ID is "
     "required at check-in. We accept Kenyan ID, passport, or driving "
     "licence."),

    ("early-checkin",
     "Early check-in is subject to availability. Free if the suite is "
     "ready when you arrive. Guaranteed early check-in (before 09:00) "
     "attracts a half-day rate of 50% of the nightly rate."),

    ("late-checkout",
     "Late check-out request: up to 13:00 free if available, request at "
     "front desk by 09:00 on the day. After 13:00 a 50% room-rate charge "
     "applies. Past 17:00 a full night is charged."),

    # ── Parking ────────────────────────────────────────────────────────
    ("parking",
     "Free secured parking inside the compound for all suite and lounge "
     "guests. 40 bays under CCTV with 24/7 manned security. Valet service "
     "available on Fridays and Saturdays from 19:00 (tip-based, suggested "
     "KES 200)."),

    ("parking-evs",
     "Two EV charging bays (Type 2, 22 kW AC) at the eastern end of the "
     "car park. Free for in-house guests, KES 500 per session for lounge-"
     "only visitors. Book the bay at the front desk on arrival."),

    # ── Wi-Fi technicals ───────────────────────────────────────────────
    ("wifi-details",
     "Wi-Fi: 200 Mbps fibre, dual-band 2.4 GHz + 5 GHz. SSID "
     "SovereignGuest. Password rotated weekly — printed on the welcome "
     "card in your suite. Separate SSID SovereignConference for events "
     "with 500 Mbps dedicated."),

    # ── Children / family policy ───────────────────────────────────────
    ("kids-policy",
     "Children are warmly welcomed in suites. Under 12 stay free sharing "
     "parents' bed. Baby cot available on request — free, subject to "
     "availability (call ahead). The lounge and pool deck after 19:00 are "
     "strictly 18+."),

    ("kids-pool-hours",
     "Family pool hours: 10:00–17:00. After 17:00 the rooftop pool deck "
     "becomes 18+ as the lounge service begins. Kids' poolside snacks: "
     "chicken nuggets KES 600, mini margherita pizza KES 800, fresh "
     "juice KES 350."),

    # ── Pets ───────────────────────────────────────────────────────────
    ("pets-policy",
     "We do not host pets in the suites or lounge — assistance dogs "
     "(certified guide / service animals) excepted, free of charge, with "
     "advance notice."),

    # ── Smoking ────────────────────────────────────────────────────────
    ("smoking-policy",
     "All suites and indoor areas are strictly non-smoking. Designated "
     "smoking zones: the rooftop lounge terrace (after 17:00) and the "
     "ground-floor garden corner. Cigars permitted on the rooftop only. "
     "Smoking inside a suite attracts a KES 25,000 deep-clean charge."),

    # ── Airport transfer detail ────────────────────────────────────────
    ("airport-transfer",
     "Airport transfers to/from JKIA — saloon car (up to 3 pax): KES "
     "2,500 one way. SUV (up to 5 pax): KES 4,500 one way. Premium "
     "Mercedes E-Class: KES 7,500 one way. Book at least 4 hours ahead. "
     "Driver waits 60 minutes free after landing."),

    ("airport-wilson",
     "Wilson Airport transfers: saloon KES 1,800 one way, SUV KES 3,200. "
     "20 minutes from the hotel. Useful for domestic Safarilink / "
     "AirKenya flights."),

    # ── Breakfast detail ───────────────────────────────────────────────
    ("breakfast-hours",
     "Breakfast served 06:30–10:30 in the ground-floor restaurant. "
     "Complimentary for Deluxe, Penthouse, Twin, and Family Suite guests. "
     "Continental + à la carte (eggs to order, mandazi, fresh juices, "
     "Kenyan tea, espresso bar)."),

    ("breakfast-inroom",
     "In-suite breakfast available — add KES 500 per person. Order via "
     "front desk by 22:00 the night before; delivery within your chosen "
     "30-minute window from 06:30."),

    # ── Room service / dining hours ────────────────────────────────────
    ("room-service",
     "Room service 06:30–23:00 daily. Late-night menu (lighter selection) "
     "23:00–02:00 — burgers, wings, fries, sandwiches, and a curated "
     "drinks list. Delivery charge waived for Penthouse Oasis guests."),

    # ── Laundry ────────────────────────────────────────────────────────
    ("laundry",
     "Laundry & dry-cleaning: shirts KES 350, suits KES 1,200, dresses "
     "KES 900, trousers KES 450. Same-day service if dropped before 09:00. "
     "Express 4-hour service: +50%. Pickup from your suite — call front "
     "desk."),

    # ── Cancellation extras ────────────────────────────────────────────
    ("no-show-policy",
     "If you don't arrive on the booked date without notice, the full "
     "deposit is forfeited and the reservation is released. Subsequent "
     "nights are also charged unless cancelled before 14:00 on the booked "
     "day. To preserve the booking just message us — we're flexible if "
     "we know."),

    ("rescheduling",
     "You can reschedule a suite booking once, free of charge, up to 24 "
     "hours before check-in — the deposit transfers to the new date. "
     "Second reschedule attracts a 20% admin fee. Subject to availability "
     "at the new rate."),

    # ── Payment specifics ──────────────────────────────────────────────
    ("mpesa-till",
     "M-Pesa Paybill: 4071234 (Business Number), Account: your phone "
     "number or booking reference. Deposits processed via IntaSend STK "
     "push directly to your phone — no need to enter the till manually."),

    ("card-payments",
     "Card payments accepted at the front desk and lounge bar: Visa, "
     "Mastercard, American Express. Contactless and Apple/Google Pay "
     "supported. No surcharge on card transactions."),

    ("corporate-billing",
     "Corporate billing arrangements for repeat clients — minimum 5 "
     "nights per month committed. Monthly invoicing, NET-14 payment terms, "
     "12% off rack rate. Email accounts@sovereignsuites.co.ke to set up."),

    # ── Group / corporate ──────────────────────────────────────────────
    ("group-rates-tiers",
     "Group discount tiers: 3 rooms 5% off, 5 rooms 10% off, 8 rooms 15% "
     "off, 12+ rooms 20% off (subject to availability). All same-stay "
     "dates. Apply at booking — Wanjiru will issue a group reference."),

    ("conferencing",
     "Boardroom for up to 14 PAX: KES 18,000 half-day, KES 28,000 full-"
     "day. Includes flipchart, 65\" smart screen, fibre Wi-Fi, mineral "
     "water, espresso bar refills. Full-day rate adds a working lunch."),

    # ── Lounge specifics ───────────────────────────────────────────────
    ("lounge-dress-code",
     "Lounge dress code: smart casual. No sportswear (tracksuits, jerseys), "
     "no open sandals or slippers after 19:00, no torn denim on Fridays "
     "and Saturdays. Blazers welcome, ties optional. Reservation holders "
     "set the tone."),

    ("lounge-table-tiers",
     "Lounge table tiers — Standard table (4 PAX) minimum spend KES "
     "8,000, no deposit. Premium booth (6 PAX) minimum KES 15,000, "
     "deposit KES 3,000. VIP Lounge V8 (10 PAX) minimum KES 25,000, "
     "deposit KES 5,000. Bottle service available across all tiers."),

    ("lounge-entry",
     "Lounge entry: free Mon–Thu and Sun. Friday cover KES 1,000, "
     "Saturday cover KES 1,500. Free for in-house guests, VIP table "
     "holders, and anyone with a confirmed bottle-service reservation."),

    # ── Drinks menu — expanded ─────────────────────────────────────────
    ("cocktails",
     "Signature cocktails KES 950 each: Sovereign Sour (whisky, lemon, "
     "honey), Mombasa Mule (vodka, ginger, lime), Skyline Spritz "
     "(prosecco, Aperol, soda), Nairobi Negroni (gin, Campari, vermouth)."),

    ("beer-menu",
     "Beer menu: Tusker / Tusker Lite / Tusker Cider KES 350, White Cap "
     "KES 350, Heineken / Guinness KES 450, craft IPA (Big 5) KES 550, "
     "Corona KES 600. Buckets of 5: 10% off."),

    ("wine-menu",
     "House wines: red / white / rosé KES 650 a glass, KES 3,200 a bottle "
     "(Stellenbosch). Reserve list: Meerlust Rubicon KES 8,500, Chablis "
     "Grand Cru KES 11,000, Mumm Cordon Rouge KES 12,000."),

    ("soft-drinks",
     "Soft drinks: Coke / Sprite / Fanta KES 200, Schweppes mixers (tonic, "
     "soda, ginger) KES 300, Red Bull KES 450, fresh juice (mango, "
     "passion, pineapple) KES 350, dasani water KES 200."),

    ("shisha",
     "Shisha service: KES 2,500 per pot. Flavours: double apple, mint, "
     "watermelon, grape, blueberry, gum. Coal refills free for the first "
     "hour. Available only at lounge tables — no in-suite shisha."),

    # ── Food menu — expanded ───────────────────────────────────────────
    ("food-mains",
     "Mains menu: grilled fillet steak (250 g) KES 3,200, butter chicken "
     "with naan KES 1,950, seafood linguine KES 2,400, vegetable biryani "
     "KES 1,600, beef burger with fries KES 1,400, club sandwich KES "
     "1,100."),

    ("food-nyama-platter",
     "Nyama Platter (Kenyan grill): KES 3,800. Goat ribs, beef nyama "
     "choma, chicken thighs, kachumbari, ugali, and our house-made pili-"
     "pili sauce. Serves 2 generously."),

    ("food-vegetarian",
     "Vegetarian options: stuffed avocado salad KES 950, mushroom risotto "
     "KES 1,650, paneer tikka masala KES 1,500, halloumi burger KES 1,300, "
     "vegan poke bowl KES 1,750."),

    ("food-desserts",
     "Desserts: chocolate fondant KES 750, crème brûlée KES 700, malva "
     "pudding KES 650, mango sorbet KES 500, cheese board (3 selections) "
     "KES 1,500."),

    # ── Location / directions ──────────────────────────────────────────
    ("directions-cbd",
     "From Nairobi CBD: head south on Mombasa Road past the Nyayo "
     "Stadium roundabout, continue past General Motors, look for the "
     "Airtel HQ landmark on your right after roughly 6 km. Our gate is "
     "200 m past it on the same side. Travel time: 20–35 min depending "
     "on traffic."),

    ("directions-westlands",
     "From Westlands: take Waiyaki Way → Uhuru Highway → Mombasa Road. "
     "Total ~14 km, 25–40 min in traffic. Alternative: Lang'ata Road via "
     "Wilson Airport — slightly longer in distance but lighter peak-hour "
     "traffic."),

    ("directions-jkia",
     "From JKIA: 9 km, ~25 min in normal traffic. Exit JKIA → Mombasa "
     "Road northbound → after South B turn-off look for Airtel HQ on the "
     "left and we are 200 m past. Ask any boda or taxi for 'Sovereign "
     "Suites, Mombasa Road, next to Airtel'."),

    ("nearby",
     "Nearby: Nyayo National Stadium 7 km, SGR Nairobi Terminus 12 km, "
     "Wilson Airport 6 km, Carnivore Restaurant 8 km, Galleria Mall 9 km. "
     "We arrange transport to all on request — flat KES 1,500 within a "
     "10 km radius."),

    # ── Accessibility ──────────────────────────────────────────────────
    ("accessibility",
     "Wheelchair access throughout ground floor, restaurant, pool deck, "
     "and lounge. One fully accessible Deluxe Suite on ground level "
     "(roll-in shower, grab rails). Lift to all floors. Service-animal "
     "friendly."),

    # ── Photography / privacy ──────────────────────────────────────────
    ("photography-policy",
     "Personal photography welcome throughout the property. Professional "
     "shoots (paid models, lighting rigs) require advance approval — "
     "complimentary for in-house guests, KES 15,000 location fee for "
     "external shoots. The lounge after 19:00 is a no-paparazzi zone — "
     "guest discretion guaranteed."),

    # ── Lost & found ───────────────────────────────────────────────────
    ("lost-and-found",
     "Lost items are logged at the front desk and held for 60 days. "
     "Email stay@sovereignsuites.co.ke with a description and your stay "
     "dates. We can courier items locally (Nairobi) at cost — typically "
     "KES 350–800 via Sendy/Glovo."),

    # ── Currency / FX ──────────────────────────────────────────────────
    ("currency",
     "All published rates are in Kenya Shillings (KES). We accept cash "
     "in KES, USD, EUR, and GBP at the daily mid-market rate. Change is "
     "issued in KES. Card and M-Pesa transactions are processed in KES."),

    # ── Sustainability ────────────────────────────────────────────────
    ("sustainability",
     "Solar-supplemented hot water across the building, refillable "
     "glass-bottle drinking water in all suites (no single-use plastic), "
     "linen-reuse programme (towel on rack = re-use), and locally-"
     "sourced produce on the breakfast menu."),

    # ── Loyalty ────────────────────────────────────────────────────────
    ("loyalty-programme",
     "Sovereign Circle loyalty: every 5th night free at the same suite "
     "tier (within 12 months), early check-in guaranteed, complimentary "
     "spa upgrade on milestone stays. Free to join — ask at check-in or "
     "say 'join Sovereign Circle' anytime."),

    # ── FAQ catch-alls ─────────────────────────────────────────────────
    ("faq-extra-bed",
     "Extra bed in any suite: KES 2,500 per night including breakfast. "
     "Subject to suite size — Junior and Twin do not accommodate an "
     "extra bed; Deluxe, Penthouse, and Family do."),

    ("faq-iron-board",
     "Iron and ironing board available free in every suite (in the "
     "wardrobe). Pressing service via housekeeping: KES 250 per shirt, "
     "1-hour turnaround if dropped before 18:00."),

    ("faq-medical",
     "On-call doctor available 24/7 — consultation KES 3,500, billed to "
     "the room. Nairobi Hospital is 12 minutes away; The Karen Hospital "
     "20 minutes. Ambulance via AAR or Avenue Health summoned by the "
     "front desk on request."),
]


async def seed() -> int:
    settings = get_settings()
    meta_pid = (settings.meta_wa_phone_number_id or "1113487341852916").strip()

    texts = [content for _, content in KB_ENTRIES]
    sources = [src for src, _ in KB_ENTRIES]

    print(f"Embedding {len(texts)} Sovereign Suites entries via nomic-embed-text…")
    vectors = await embed_texts(texts)
    print(f"  ✓ {len(vectors)} embeddings (dim={len(vectors[0]) if vectors else 0})")

    async with SessionLocal() as db:
        # ── 1. Free the Meta phone_number_id from any previous tenant so
        #      Sovereign can claim it (unique constraint).
        await db.execute(text(
            "UPDATE businesses SET meta_wa_phone_number_id = NULL "
            "WHERE meta_wa_phone_number_id = :pid AND slug <> 'sovereign-suites'"
        ), {"pid": meta_pid})

        # NOTE: Previously this seed also deactivated all non-Sovereign
        # tenants so the default-business resolver (oldest active) would
        # pick Sovereign for un-routed mock channels. That clause was
        # removed once the sticky-tenant resolver landed — newly-onboarded
        # merchants via /admin/businesses now correctly survive a re-seed.

        # ── 2. Sovereign Suites tenant ───────────────────────────────
        biz = (await db.execute(
            select(Business).where(Business.slug == "sovereign-suites")
        )).scalar_one_or_none()

        if biz is None:
            biz = Business(
                slug="sovereign-suites",
                name="The Sovereign Suites & Urban Lounge",
                industry="hospitality (boutique hotel + lounge)",
                location="Mombasa Road, Nairobi (next to Airtel HQ turn-off)",
                meta_wa_phone_number_id=meta_pid,
                contact_phone="+254715540653",
                contact_email="stay@sovereignsuites.co.ke",
                brand_voice=SOVEREIGN_BRAND_VOICE,
                greeting_template=SOVEREIGN_GREETING,
                language_primary="en",
                language_secondary="sw",
                profile={
                    "timezone": "Africa/Nairobi",
                    "currency": "KES",
                    "payment_provider": "intasend",
                    "vertical": "hospitality",
                    "maps_pin": "https://maps.google.com/?q=-1.3325,36.8685",
                    "default_deposit_rules": {
                        "suite-deluxe-executive": 5000,
                        "suite-penthouse-oasis": 10000,
                        "vip-lounge-v8": 5000,
                    },
                },
                active=True,
                latitude=-1.332500,
                longitude=36.868500,
            )
            db.add(biz)
            await db.flush()
            print(f"  ✓ Created tenant: {biz.name}")
        else:
            biz.name = "The Sovereign Suites & Urban Lounge"
            biz.industry = "hospitality (boutique hotel + lounge)"
            biz.location = "Mombasa Road, Nairobi (next to Airtel HQ turn-off)"
            biz.meta_wa_phone_number_id = meta_pid
            biz.contact_phone = "+254715540653"
            biz.contact_email = "stay@sovereignsuites.co.ke"
            biz.brand_voice = SOVEREIGN_BRAND_VOICE
            biz.greeting_template = SOVEREIGN_GREETING
            biz.active = True
            if biz.latitude is None:
                biz.latitude = -1.332500
            if biz.longitude is None:
                biz.longitude = 36.868500
            # Force-merge the vertical override + deposit rules in case the
            # row was created by an older seed without them.
            cur = dict(biz.profile or {})
            cur.update({
                "timezone": "Africa/Nairobi",
                "currency": "KES",
                "payment_provider": "intasend",
                "vertical": "hospitality",
                "maps_pin": "https://maps.google.com/?q=-1.3325,36.8685",
                "default_deposit_rules": {
                    "suite-deluxe-executive": 5000,
                    "suite-penthouse-oasis": 10000,
                    "vip-lounge-v8": 5000,
                },
            })
            biz.profile = cur
            await db.flush()
            print(f"  ✓ Refreshed tenant: {biz.name}")

        # ── 3. Wipe and re-seed this tenant's KB ─────────────────────
        await db.execute(
            text("DELETE FROM knowledge_base WHERE business_id = :bid"),
            {"bid": str(biz.id)},
        )
        # Also clear any orphan (null business_id) rows from older seeds.
        await db.execute(text("DELETE FROM knowledge_base WHERE business_id IS NULL"))

        for src, content, vec in zip(sources, texts, vectors):
            db.add(KnowledgeChunk(
                business_id=biz.id,
                source=src,
                content=content,
                embedding=vec,
            ))
        await db.commit()

    print(f"  ✓ Wrote {len(KB_ENTRIES)} KB rows for {biz.name}")
    print(f"  ✓ Routing: Meta phone_number_id {meta_pid} → {biz.slug}")
    return len(KB_ENTRIES)


if __name__ == "__main__":
    n = asyncio.run(seed())
    print(f"\nAlpha seeded — {n} entries. Sovereign Suites is now the active tenant.")
