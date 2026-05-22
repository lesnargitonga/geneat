"""Seed the 'Palm Café Nairobi' demo tenant — a polished reference business
used for sales demos, screenshots, and load testing.

This script is **idempotent**: running it twice leaves the database in the
same state. Existing rows are updated (not duplicated), the KB is fully
re-embedded only when content changes, and customers/conversations are
recreated only if missing.

Usage:
    PYTHONPATH=. ./.venv/bin/python scripts/seed_demo_tenant.py
    PYTHONPATH=. ./.venv/bin/python scripts/seed_demo_tenant.py --wipe-conversations
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Sequence

from sqlalchemy import delete, select

from app.ai.rag import ingest_text
from app.db.models import (
    Business,
    Channel,
    Conversation,
    ConvStatus,
    Customer,
    KnowledgeChunk,
    Message,
    Sender,
)
from app.db.session import SessionLocal

SLUG = "palm-cafe"
NAME = "Palm Café Nairobi"
INDUSTRY = "restaurant"
LOCATION = "Westlands, Nairobi (HQ) — also in Kilimani & Karen"
CONTACT_PHONE = "+254700111222"
CONTACT_EMAIL = "hello@palmcafe.co.ke"
LANG_PRIMARY = "en"
LANG_SECONDARY = "sw"
LATITUDE = -1.2676   # Westlands
LONGITUDE = 36.8108

BRAND_VOICE = (
    "Warm, welcoming, and a little playful — the way a friendly host greets a "
    "regular. Keep messages short (1–3 sentences), use first names when you have "
    "them, and never sound corporate. We're Nairobi-proud: feel free to slip in "
    "a Swahili greeting (jambo, karibu, asante sana) when it fits. Always confirm "
    "specifics (location, time, party size) before promising a booking. Default "
    "currency is KES; pricing is inclusive of VAT."
)

GREETING_TEMPLATE = (
    "Jambo! 👋 Karibu Palm Café — I can help you book a table, share our menu, "
    "or answer anything about our Westlands, Kilimani, and Karen locations. "
    "What can I do for you today?"
)

# Rich profile JSON — the admin console renders this in the Profile tab and
# the AI can reference it via tools.
PROFILE: dict = {
    "tagline": "Slow-roasted Kenyan coffee. Honest food. Three sunny rooms in Nairobi.",
    "founded": 2018,
    "founder": "Wanjiru Mbogo",
    "website": "https://palmcafe.co.ke",
    "instagram": "@palmcafe.nairobi",
    "facebook": "PalmCafeNairobi",
    "twitter": "@palmcafe_ke",
    "currency": "KES",
    "vat_inclusive": True,
    "payment_methods": ["M-Pesa", "Visa", "Mastercard", "Cash"],
    "mpesa_paybill": "522533",
    "mpesa_account": "PALMCAFE",
    "reservation_lead_minutes": 60,
    "max_party_size_walkin": 6,
    "max_party_size_reservation": 24,
    "dietary": {
        "vegetarian": True,
        "vegan": True,
        "gluten_free": True,
        "halal": True,
        "kosher": False,
    },
    "wifi": True,
    "outdoor_seating": True,
    "parking": "Free underground parking at Westlands & Karen; street parking at Kilimani.",
    "accessibility": "Step-free entrance and accessible restrooms at all locations.",
    "kids_friendly": True,
    "dog_friendly": "Karen only (garden seating).",
    "delivery": {
        "in_house_radius_km": 5,
        "platforms": ["Glovo", "Bolt Food", "Jumia Food"],
        "min_order_kes": 800,
    },
    "private_events": {
        "available": True,
        "capacity_max": 80,
        "lead_time_days": 5,
        "deposit_pct": 30,
    },
    "locations": [
        {
            "id": "westlands",
            "name": "Westlands (Flagship)",
            "address": "Mpaka Road, Westlands, Nairobi",
            "phone": "+254700111222",
            "hours": {
                "mon": "07:00–22:00",
                "tue": "07:00–22:00",
                "wed": "07:00–22:00",
                "thu": "07:00–22:00",
                "fri": "07:00–23:30",
                "sat": "08:00–23:30",
                "sun": "08:00–21:00",
            },
            "lat": -1.2676,
            "lng": 36.8108,
            "seats": 90,
            "features": ["parking", "wifi", "private_room", "rooftop"],
        },
        {
            "id": "kilimani",
            "name": "Kilimani",
            "address": "Yaya Centre, Argwings Kodhek Road, Kilimani",
            "phone": "+254700111333",
            "hours": {
                "mon": "07:30–21:30",
                "tue": "07:30–21:30",
                "wed": "07:30–21:30",
                "thu": "07:30–21:30",
                "fri": "07:30–22:30",
                "sat": "08:00–22:30",
                "sun": "08:30–20:30",
            },
            "lat": -1.2921,
            "lng": 36.7853,
            "seats": 60,
            "features": ["wifi", "co_working"],
        },
        {
            "id": "karen",
            "name": "Karen Garden",
            "address": "Marula Lane, off Karen Road, Karen",
            "phone": "+254700111444",
            "hours": {
                "mon": "08:00–21:00",
                "tue": "08:00–21:00",
                "wed": "08:00–21:00",
                "thu": "08:00–21:00",
                "fri": "08:00–22:00",
                "sat": "08:00–22:00",
                "sun": "08:30–20:00",
            },
            "lat": -1.3198,
            "lng": 36.7081,
            "seats": 70,
            "features": ["parking", "garden", "dog_friendly", "kids_play_area"],
        },
    ],
}

# ── Knowledge base content ──────────────────────────────────────────────
# Each item becomes one KB chunk. Keep each entry self-contained and
# answer-shaped so embeddings find them on natural queries.

KB_MENU: list[str] = [
    # Breakfast
    "BREAKFAST — Served 07:00 to 11:30 daily at every location.\n"
    "• Palm Sunrise Plate — two free-range eggs any style, smashed avocado on sourdough, "
    "house-cured bacon, roasted tomato, hash. KES 950.\n"
    "• Mandazi & Masala Chai — three light cardamom mandazi, traditional spiced milk tea. KES 380.\n"
    "• Coconut Coast Granola — house-toasted oats, coconut, cashews, mango, passion-fruit yoghurt. KES 620 (vegan).\n"
    "• Eggs Benedict, Nyali style — poached eggs, kachumbari hollandaise, smoked sailfish, English muffin. KES 1,150.\n"
    "• Ugali Chips & Eggs — crispy ugali fries, two eggs, kachumbari, chili-coriander mayo. KES 720 (GF).",
    # Lunch
    "LUNCH — Served 12:00 to 16:00 daily at every location.\n"
    "• Nyama Choma Bowl — slow-grilled goat, ugali, kachumbari, sukuma. KES 1,450.\n"
    "• Westlands Burger — 200g grass-fed beef, smoked-cheddar, caramelised onion, brioche, hand-cut fries. KES 1,300.\n"
    "• Sukuma & Coconut Curry — braised greens, coconut, ginger, brown rice. KES 850 (vegan, GF).\n"
    "• Coast Fish Tacos — beer-battered tilapia, pineapple salsa, lime-aioli, three soft tacos. KES 1,100.\n"
    "• Caesar Mbuzi — chargrilled goat-loin, baby gem, anchovy dressing, parmesan, croutons. KES 1,250.\n"
    "• Garden Buddha Bowl — quinoa, roast pumpkin, beetroot, avocado, tahini. KES 980 (vegan, GF).",
    # Dinner
    "DINNER — Served 18:00 to closing. Reservations recommended Fri & Sat.\n"
    "• Pili-Pili Prawns — Mombasa-style coconut-chili prawns, coconut rice. KES 1,950.\n"
    "• Tamarind Lamb Shank — slow-braised, pomegranate, herb couscous. KES 2,100.\n"
    "• Wild Mushroom Risotto — porcini, parmesan, truffle oil, crispy sage. KES 1,450 (vegetarian).\n"
    "• Sailfish a la Plancha — sustainably caught, charred kale, lemon-caper butter. KES 1,850 (GF).\n"
    "• 8-Hour Beef Short Rib — molasses glaze, smoked-bone-marrow mash, gremolata. KES 2,400.\n"
    "• Whole Roast Cauliflower — za'atar, tahini, pomegranate, herbs. KES 1,150 (vegan, GF).",
    # Coffee
    "COFFEE — All beans are single-origin Kenyan, roasted weekly at our Karen roastery.\n"
    "• Espresso — KES 220 / Double KES 280.\n"
    "• Macchiato / Cortado — KES 280.\n"
    "• Flat White / Cappuccino / Latte — KES 350 (oat / almond / coconut +KES 60).\n"
    "• Cold Brew — 12-hour, served over ice. KES 380.\n"
    "• Mocha — single-origin Kenyan cocoa. KES 420.\n"
    "• Pour-over (V60 or Chemex) — choose Nyeri AA, Kirinyaga Peaberry, or Kiambu SL28. KES 480.\n"
    "• Take-home beans, 250g — KES 1,200 (whole or ground).",
    # Pastries
    "PASTRIES & BAKES — Made fresh every morning at our Westlands kitchen.\n"
    "• Butter Croissant — KES 280.\n"
    "• Pain au Chocolat — KES 320.\n"
    "• Almond Croissant — KES 360.\n"
    "• Sourdough Loaf (whole) — KES 550.\n"
    "• Banana-Cardamom Loaf — KES 380 / slice.\n"
    "• Passionfruit Cheesecake — KES 480 / slice.\n"
    "• Dark Chocolate Brownie — KES 320 (GF).",
    # Drinks
    "DRINKS & COCKTAILS — Bar open from 17:00 (Westlands & Karen only).\n"
    "• Tusker (cold) — KES 350.\n"
    "• Dawa — Kenyan vodka, lime, honey, ginger. KES 650 (our signature).\n"
    "• Hibiscus Gin Spritz — house-infused hibiscus gin, prosecco, soda. KES 750.\n"
    "• Tamarind Margarita — tequila, tamarind, salt rim. KES 720.\n"
    "• Coconut Cold Brew Martini — KES 780.\n"
    "• Sundowner Wine Flight — three glasses, South African & Italian. KES 1,400.\n"
    "• Mocktails (Hibiscus Cooler, Coconut Pineapple Smash, Virgin Dawa) — KES 380.",
]

KB_POLICIES: list[str] = [
    # Hours
    "HOURS — Westlands: Mon-Thu 07:00–22:00, Fri 07:00–23:30, Sat 08:00–23:30, Sun 08:00–21:00. "
    "Kilimani: Mon-Thu 07:30–21:30, Fri 07:30–22:30, Sat 08:00–22:30, Sun 08:30–20:30. "
    "Karen: Mon-Thu 08:00–21:00, Fri-Sat 08:00–22:00, Sun 08:30–20:00. "
    "Public holidays: we usually open from 09:00; check our Instagram @palmcafe.nairobi for any special-day adjustments.",
    # Reservations
    "RESERVATIONS — We hold tables for up to 15 minutes past the reservation time. "
    "For parties of 7+ we ask for a credit-card guarantee or 50% deposit. "
    "Friday & Saturday dinner books up early — please reserve at least 24 hours ahead. "
    "Lead time is 60 minutes (we can usually take you sooner, just ask). "
    "Walk-ins are always welcome for parties of 6 or fewer.",
    # Cancellations
    "CANCELLATIONS — Cancel for free up to 4 hours before your reservation by replying here or calling the location directly. "
    "Within 4 hours, a KES 500/person fee applies. No-shows are charged the deposit in full. "
    "We're flexible — if it's an emergency, just let us know.",
    # Private events
    "PRIVATE EVENTS — Westlands has a private room (up to 24 seated, 35 standing). "
    "Karen's garden hosts up to 80 standing for outdoor events. "
    "We need 5 days' notice and a 30% deposit. Menus from KES 2,500/person. "
    "Email events@palmcafe.co.ke or ask here and we'll connect you with Wanjiru, our owner.",
    # Dietary
    "DIETARY — Every menu item is marked V (vegetarian), VG (vegan), or GF (gluten-free) in our printed menus. "
    "All kitchens handle wheat, dairy, eggs, nuts, and fish — we cannot guarantee zero cross-contact, but we take allergies seriously: tell us at booking and the chef will personally manage your order. "
    "We have certified halal beef, lamb, and chicken. Pork is served only at Westlands (clearly labelled).",
    # Payments
    "PAYMENTS — We accept M-Pesa (Paybill 522533, Account: PALMCAFE), Visa, Mastercard, and cash (KES only). "
    "Service is included in the menu price; tips are appreciated and split equally with the team. "
    "We are happy to split bills across multiple cards / M-Pesa numbers — just tell your server.",
    # Delivery
    "DELIVERY — We deliver in-house within 5 km of Westlands and Karen (minimum order KES 800). "
    "We're also on Glovo, Bolt Food, and Jumia Food (full menu, same prices). "
    "Average in-house delivery time is 35 minutes. Order from here and we'll send you a tracking link.",
    # Parking & accessibility
    "PARKING & ACCESS — Westlands and Karen have free underground/private parking. "
    "Kilimani uses Yaya Centre's paid parking (KES 100/2 hrs). "
    "All three locations are step-free with accessible restrooms. "
    "Karen is dog-friendly in the garden section. Highchairs available at every location.",
    # Wi-Fi
    "WIFI — Free at every location. Network: 'PalmCafe-Guest', password is the date in DDMM format (e.g. for 18 May use 1805). "
    "Kilimani is our work-friendly spot — power outlets at every table, no time limits.",
    # Loyalty
    "LOYALTY — Buy 10 coffees, get the 11th free. Ask any barista to scan your phone or download the Palm Café app. "
    "Birthday month? Show ID and get a free pastry with any drink, any visit, all month long.",
    # Sourcing
    "SOURCING — Coffee from Nyeri, Kirinyaga, and Kiambu smallholders we visit twice a year. "
    "Vegetables from Karen-area organic farms (we list them on the back of the menu). "
    "Beef & lamb halal-certified from Ngong. Fish line-caught from Watamu, delivered overnight on ice. "
    "Sourdough fermented 48 hours with our 6-year-old starter (named 'Mabel').",
    # Sustainability
    "SUSTAINABILITY — All packaging is plant-based / compostable; bring your own cup and get KES 50 off any drink. "
    "Coffee grounds go to local urban farms. We donate unsold pastries daily to Joy Children's Home in Westlands. "
    "Our 2025 goal: zero waste to landfill across all three locations.",
    # Lost & found, contact
    "CONTACT — General: hello@palmcafe.co.ke. Events: events@palmcafe.co.ke. Careers: jobs@palmcafe.co.ke. "
    "WhatsApp: +254 700 111 222 (all locations, 07:00–22:00). "
    "Lost something? Call your location directly — we hold items for 30 days.",
]


# ── Fake conversations ──────────────────────────────────────────────────
# Each tuple = (customer_phone, customer_name, channel, status, ai_paused,
#               messages [(sender, text, minutes_ago)]).
# The most recent activity should be the smallest minutes_ago.

NOW = datetime.now(timezone.utc)


def m(sender: Sender, text: str, minutes_ago: int) -> tuple[Sender, str, int]:
    return (sender, text, minutes_ago)


FAKE_CONVERSATIONS: list[dict] = [
    # 1 — Active reservation request, AI handled cleanly
    {
        "phone": "+254700123456",
        "name": "Aisha Hassan",
        "channel": Channel.whatsapp,
        "status": ConvStatus.active,
        "ai_paused": False,
        "messages": [
            m(Sender.user, "Hey can I book a table for 4 at Westlands Saturday 8pm?", 18),
            m(Sender.ai, "Jambo Aisha 👋 Saturday 8pm at Westlands for 4 — let me check. We have a window seat available. Any dietary notes I should share with the kitchen?", 17),
            m(Sender.user, "One of us is vegan, otherwise no", 15),
            m(Sender.ai, "Perfect — our Garden Buddha Bowl, Sukuma Coconut Curry, and Whole Roast Cauliflower are all vegan favourites. I'll note it. Your table is confirmed for Sat 8pm, party of 4, Westlands. We'll hold it 15 minutes past 8. Anything else?", 14),
            m(Sender.user, "Nope thank you!", 13),
            m(Sender.ai, "Karibu — see you Saturday 🌴", 12),
        ],
    },
    # 2 — Active menu question, mid-flow
    {
        "phone": "+254722987654",
        "name": "Brian Otieno",
        "channel": Channel.whatsapp,
        "status": ConvStatus.active,
        "ai_paused": False,
        "messages": [
            m(Sender.user, "Do you have anything gluten-free for lunch?", 6),
            m(Sender.ai, "Yes, a few favourites — Ugali Chips & Eggs (GF), Sukuma Coconut Curry (GF, vegan), Garden Buddha Bowl (GF, vegan), and Sailfish a la Plancha (GF). Which location are you near?", 5),
            m(Sender.user, "Karen", 2),
            m(Sender.ai, "Karen has all four today. Lunch service runs till 16:00. Want me to hold a table?", 1),
        ],
    },
    # 3 — ESCALATED to human (allergy concern)
    {
        "phone": "+254733456789",
        "name": "Priya Shah",
        "channel": Channel.whatsapp,
        "status": ConvStatus.human_escalated,
        "ai_paused": True,
        "messages": [
            m(Sender.user, "Hi, my daughter has a severe peanut allergy. Are your kitchens nut-free?", 38),
            m(Sender.ai, "Hi Priya — peanut safety is something we take very seriously. Our kitchens DO handle nuts, so I can't promise zero cross-contact, but we can absolutely manage her order safely. Let me get our chef on this directly so you have a real person to talk to.", 36),
            m(Sender.system, "Escalated to human agent — allergy concern, Karen location", 35),
        ],
    },
    # 4 — M-Pesa receipt / order followup, resolved
    {
        "phone": "+254711222333",
        "name": "James Mwangi",
        "channel": Channel.whatsapp,
        "status": ConvStatus.resolved,
        "ai_paused": False,
        "messages": [
            m(Sender.user, "I paid via M-Pesa for delivery — confirmation REH4XK9P21. Order hasn't arrived?", 95),
            m(Sender.ai, "Hi James, let me check that. One moment.", 94),
            m(Sender.ai, "Found it — your order left Westlands at 18:42. Rider Daniel, +254 712 555 098. ETA 9 minutes. Want me to share live tracking?", 92),
            m(Sender.user, "Yes please", 91),
            m(Sender.ai, "Sent. Thanks for your patience! Anything else when it arrives?", 90),
            m(Sender.user, "All good, thanks!", 60),
            m(Sender.ai, "Karibu! Enjoy 🌴", 59),
        ],
    },
    # 5 — Cold lead, abandoned
    {
        "phone": "+254755111222",
        "name": "Zawadi K.",
        "channel": Channel.whatsapp,
        "status": ConvStatus.abandoned,
        "ai_paused": False,
        "messages": [
            m(Sender.user, "Hey what time do you guys open", 4320),
            m(Sender.ai, "Jambo! Westlands and Kilimani open at 07:00, Karen at 08:00, daily. Anything you'd like to plan?", 4319),
        ],
    },
    # 6 — Web chat (mock channel), private event enquiry
    {
        "phone": "+254799887766",
        "name": "Lillian Wairimu",
        "channel": Channel.mock,
        "status": ConvStatus.active,
        "ai_paused": False,
        "messages": [
            m(Sender.user, "Hi! Looking to host a 50-person birthday in late June, garden setting. Karen?", 240),
            m(Sender.ai, "Hi Lillian! Karen's garden is perfect for that — capacity 80 standing, 50 seated comfortably. Late June is open right now. Our events package starts at KES 2,500/person. Want me to connect you with Wanjiru, our owner, for the menu and quote?", 239),
            m(Sender.user, "Yes please. We're thinking sundowner-cocktail style, then a buffet.", 237),
            m(Sender.ai, "Lovely. I'll have Wanjiru send a proposal today — usually within 4 working hours. Could I get the date, and a rough budget per head so she can tailor it?", 236),
            m(Sender.user, "Saturday June 21, around KES 3,500/person", 235),
            m(Sender.ai, "Got it — Sat 21 Jun, ~50 guests, sundowner + buffet, ~KES 3,500/head. Forwarding now. Wanjiru will email you directly. 🎉", 234),
        ],
    },
    # 7 — Quick coffee question, resolved
    {
        "phone": "+254700556677",
        "name": "Mark D.",
        "channel": Channel.mock,
        "status": ConvStatus.resolved,
        "ai_paused": False,
        "messages": [
            m(Sender.user, "do you sell beans to take home", 1440),
            m(Sender.ai, "Yes — 250g bags of single-origin Kenyan beans (Nyeri AA, Kirinyaga Peaberry, Kiambu SL28), KES 1,200. Whole or ground. Available at all three locations.", 1439),
            m(Sender.user, "perfect, will swing by Westlands", 1438),
            m(Sender.ai, "Karibu 🌴", 1437),
        ],
    },
    # 8 — Active: human took over already (staff replying)
    {
        "phone": "+254788445566",
        "name": "Sandra Njeri",
        "channel": Channel.whatsapp,
        "status": ConvStatus.active,
        "ai_paused": True,
        "messages": [
            m(Sender.user, "Hi, we left a leather wallet on the patio at Karen last night", 480),
            m(Sender.ai, "Hi Sandra, I'll get the Karen team to check our lost & found right now. One moment.", 479),
            m(Sender.agent, "Hi Sandra, this is Brian at Karen — yes, we found a brown leather wallet on Table 14. ID matches your name. Want to swing by today? We close at 21:00.", 460),
            m(Sender.user, "Oh thank god — yes I'll be there by 7", 455),
            m(Sender.agent, "See you then 👍", 454),
        ],
    },
]


# ── DB helpers ──────────────────────────────────────────────────────────


async def upsert_business(db) -> Business:
    biz = (
        await db.execute(select(Business).where(Business.slug == SLUG))
    ).scalar_one_or_none()
    if biz is None:
        biz = Business(slug=SLUG)
        db.add(biz)
    biz.name = NAME
    biz.industry = INDUSTRY
    biz.location = LOCATION
    biz.contact_phone = CONTACT_PHONE
    biz.contact_email = CONTACT_EMAIL
    biz.brand_voice = BRAND_VOICE
    biz.greeting_template = GREETING_TEMPLATE
    biz.language_primary = LANG_PRIMARY
    biz.language_secondary = LANG_SECONDARY
    biz.latitude = LATITUDE
    biz.longitude = LONGITUDE
    biz.profile = PROFILE
    biz.active = True
    await db.flush()
    return biz


async def reset_and_ingest_kb(db, business_id: uuid.UUID) -> int:
    await db.execute(
        delete(KnowledgeChunk).where(KnowledgeChunk.business_id == business_id)
    )
    n = 0
    n += await ingest_text(db, business_id=business_id, source="menu", chunks=KB_MENU)
    n += await ingest_text(db, business_id=business_id, source="policies", chunks=KB_POLICIES)
    return n


async def upsert_customer(db, phone: str, name: str) -> Customer:
    c = (
        await db.execute(select(Customer).where(Customer.phone_number == phone))
    ).scalar_one_or_none()
    if c is None:
        c = Customer(phone_number=phone, name=name)
        db.add(c)
        await db.flush()
    else:
        if not c.name:
            c.name = name
    return c


async def seed_conversation(
    db,
    business_id: uuid.UUID,
    spec: dict,
) -> None:
    customer = await upsert_customer(db, spec["phone"], spec["name"])

    # Find any existing conversation for this customer+business — wipe & rebuild
    existing = (
        await db.execute(
            select(Conversation).where(
                Conversation.customer_id == customer.id,
                Conversation.business_id == business_id,
                Conversation.channel == spec["channel"],
            )
        )
    ).scalars().all()
    for c in existing:
        await db.delete(c)
    await db.flush()

    msgs: Sequence[tuple[Sender, str, int]] = spec["messages"]
    last_minutes = min(mm[2] for mm in msgs)
    conv = Conversation(
        customer_id=customer.id,
        business_id=business_id,
        channel=spec["channel"],
        status=spec["status"],
        ai_paused=spec.get("ai_paused", False),
        last_activity_at=NOW - timedelta(minutes=last_minutes),
        created_at=NOW - timedelta(minutes=max(mm[2] for mm in msgs)),
    )
    db.add(conv)
    await db.flush()

    for sender, content, minutes_ago in msgs:
        db.add(
            Message(
                conversation_id=conv.id,
                sender=sender,
                content=content,
                language="en",
                timestamp=NOW - timedelta(minutes=minutes_ago),
            )
        )
    await db.flush()


async def main(argv: argparse.Namespace) -> int:
    async with SessionLocal() as db:
        print("→ Upserting business 'palm-cafe'...")
        biz = await upsert_business(db)
        await db.commit()
        await db.refresh(biz)
        print(f"  ✓ {biz.name} (id={biz.id}, slug={biz.slug})")

        print("→ Re-embedding knowledge base...")
        n = await reset_and_ingest_kb(db, biz.id)
        await db.commit()
        print(f"  ✓ {n} KB chunks ingested ({len(KB_MENU)} menu + {len(KB_POLICIES)} policy)")

        print("→ Seeding fake conversations...")
        for spec in FAKE_CONVERSATIONS:
            await seed_conversation(db, biz.id, spec)
        await db.commit()
        print(f"  ✓ {len(FAKE_CONVERSATIONS)} conversations seeded")

    print()
    print("Demo tenant ready. Try:")
    print("  • Open the admin SPA → Businesses → Palm Café Nairobi")
    print("  • Dashboard → Escalation queue (Priya Shah's allergy thread)")
    print("  • Try the chat widget on the demo-site once it's running")
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--wipe-conversations", action="store_true",
                   help="(reserved) currently always rebuilds the demo conversations")
    rc = asyncio.run(main(p.parse_args()))
    sys.exit(rc)
