"""Seed the **Gen-Eat @ USIU** demo ecosystem — four campus cafés, each its
own tenant in the platform, plus realistic student conversations.

Run after a fresh DB or whenever you want to reset the demo state:

    PYTHONPATH=. ./.venv/bin/python scripts/seed_geneat_demo.py

The script is idempotent: tenants are upserted by slug, KB is fully
re-embedded each run, and demo conversations are rebuilt (any existing
conversations for those phone numbers + tenants are wiped first).

Requires a working embedder (set via EMBED_PROVIDER in .env, defaults to
local Ollama nomic-embed-text).
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Sequence

from sqlalchemy import delete, select

from app.ai.rag import ingest_text
from app.core.config import get_settings
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

NOW = datetime.now(timezone.utc)
LILY_POND_CONTACT_PHONE = os.getenv("LILY_POND_CONTACT_PHONE", "+15556578220")

# Shared profile defaults — copied into every café's profile.locations[0]
# so the consumer portal can render them.
CAMPUS_NAME = "USIU-Africa"
CAMPUS_LOCATION = "Kasarani, Nairobi"
PLATFORM_BRAND = "Gen-Eat"


# ────────────────────────────────────────────────────────────────────────
# CAFÉ DEFINITIONS — each is its own tenant
# ────────────────────────────────────────────────────────────────────────


CAFES: list[dict] = [
    # ── 1. Lily Pond Café — flagship, outdoor seating, signature coffee ──
    {
        "slug": "lily-pond-cafe",
        "name": "Lily Pond Café",
        "industry": "campus-cafe",
        "location": "Beside the Lily Pond, USIU-Africa",
        "contact_phone": LILY_POND_CONTACT_PHONE,
        "contact_email": "lilypond@gen-eat.app",
        "lat": -1.2196,
        "lng": 36.8859,
        "brand_voice": (
            "Friendly campus voice — talks to students like a slightly older sibling "
            "who works in the café and knows everyone by face. Keep it short (1–2 lines), "
            "use first names when you have them, drop the occasional 'wewe' or 'sasa' "
            "when the energy fits. Always confirm pickup time and queue. Default currency KES."
        ),
        "greeting": (
            "Hi, welcome to Lily Pond. I can help with the menu, prices, item photos, "
            "or an order."
        ),
        "profile": {
            "tagline": "USIU's pondside hangout. Coffee that actually matters.",
            "category": "Coffee · Brunch · Outdoor",
            "hero_emoji": "☕",
            "color": "#F59E0B",
            "tags": ["coffee", "brunch", "outdoor", "wifi", "study"],
            "hours_summary": "Mon–Fri 07:00–21:00 · Sat 09:00–18:00 · Closed Sun",
            "hours": {
                "mon": "07:00–21:00", "tue": "07:00–21:00", "wed": "07:00–21:00",
                "thu": "07:00–21:00", "fri": "07:00–21:00",
                "sat": "09:00–18:00", "sun": "closed",
            },
            "seats": 60,
            "features": ["wifi", "outdoor_seating", "card_payments", "mpesa"],
            "mpesa_till": "522001",
            "mpesa_paybill": None,
            "avg_prep_minutes": 8,
            "pickup_only": True,
            "delivery_enabled": False,
            "photo_query": "outdoor coffee shop students",
        },
    },
    # ── 2. Library Bites — fast grab-and-go ──
    {
        "slug": "library-bites",
        "name": "Library Bites",
        "industry": "campus-cafe",
        "location": "Ground floor, USIU Library (LRC)",
        "contact_phone": "+254700910002",
        "contact_email": "library@gen-eat.app",
        "lat": -1.2199,
        "lng": 36.8853,
        "brand_voice": (
            "Quick, efficient, no fluff. You're competing with the bell — get the "
            "order in fast. Short replies (1 line where possible). No emojis except 📚⏱️."
        ),
        "greeting": "📚 Library Bites. What and what time? I'll have it on the counter.",
        "profile": {
            "tagline": "Order in 30 seconds. Pick up between classes.",
            "category": "Grab & Go · Snacks · Coffee",
            "hero_emoji": "🥪",
            "color": "#10B981",
            "tags": ["grab-and-go", "fast", "snacks", "exam-fuel"],
            "hours_summary": "Mon–Fri 06:30–22:00 · Sat 08:00–20:00 · Sun 10:00–18:00",
            "hours": {
                "mon": "06:30–22:00", "tue": "06:30–22:00", "wed": "06:30–22:00",
                "thu": "06:30–22:00", "fri": "06:30–22:00",
                "sat": "08:00–20:00", "sun": "10:00–18:00",
            },
            "seats": 16,
            "features": ["mpesa", "fast_pickup", "exam_week_extended_hours"],
            "mpesa_till": "522002",
            "mpesa_paybill": None,
            "avg_prep_minutes": 3,
            "pickup_only": True,
            "delivery_enabled": False,
            "photo_query": "sandwich coffee grab and go counter",
        },
    },
    # ── 3. Pavilion Grill — sit-down lunch, burgers, big portions ──
    {
        "slug": "pavilion-grill",
        "name": "Pavilion Grill",
        "industry": "campus-cafe",
        "location": "Pavilion, USIU-Africa main lawn",
        "contact_phone": "+254700910003",
        "contact_email": "pavilion@gen-eat.app",
        "lat": -1.2193,
        "lng": 36.8862,
        "brand_voice": (
            "Hearty, hospitable, a little proud of the grill. Talks like the chef "
            "himself stepped over. Slight humour. Always upsell sides honestly. "
            "Use 'boss', 'chief', 'bro/sis' sparingly — match the student's energy."
        ),
        "greeting": (
            "Karibu Pavilion 🔥 We're on the grill from 11. What you ordering, chief?"
        ),
        "profile": {
            "tagline": "Real grill on campus. Bring your appetite.",
            "category": "Burgers · Grill · Lunch · Dinner",
            "hero_emoji": "🍔",
            "color": "#EF4444",
            "tags": ["burgers", "grill", "lunch", "dinner", "group-orders"],
            "hours_summary": "Mon–Sat 11:00–22:00 · Sun 12:00–20:00",
            "hours": {
                "mon": "11:00–22:00", "tue": "11:00–22:00", "wed": "11:00–22:00",
                "thu": "11:00–22:00", "fri": "11:00–23:00",
                "sat": "11:00–23:00", "sun": "12:00–20:00",
            },
            "seats": 80,
            "features": ["card_payments", "mpesa", "group_orders", "delivery_to_dorms"],
            "mpesa_till": "522003",
            "mpesa_paybill": None,
            "avg_prep_minutes": 15,
            "pickup_only": False,
            "delivery_enabled": True,
            "photo_query": "burger grill restaurant",
        },
    },
    # ── 4. Block A Express — quick coffee + pastries near classrooms ──
    {
        "slug": "block-a-express",
        "name": "Block A Express",
        "industry": "campus-cafe",
        "location": "Block A entrance, USIU-Africa",
        "contact_phone": "+254700910004",
        "contact_email": "blocka@gen-eat.app",
        "lat": -1.2197,
        "lng": 36.8856,
        "brand_voice": (
            "Cheerful and rapid. Almost text-message energy. Use emojis liberally "
            "(☕🥐⚡). One-line replies. Always quote the queue time."
        ),
        "greeting": "Hey ☕ Block A here. Order in 10 sec, ready in 5 ⚡",
        "profile": {
            "tagline": "Coffee + pastries · between every class.",
            "category": "Coffee · Pastries",
            "hero_emoji": "🥐",
            "color": "#8B5CF6",
            "tags": ["coffee", "pastries", "fast", "morning"],
            "hours_summary": "Mon–Fri 06:45–19:00 · Sat 08:00–14:00 · Closed Sun",
            "hours": {
                "mon": "06:45–19:00", "tue": "06:45–19:00", "wed": "06:45–19:00",
                "thu": "06:45–19:00", "fri": "06:45–19:00",
                "sat": "08:00–14:00", "sun": "closed",
            },
            "seats": 8,
            "features": ["mpesa", "fast_pickup", "loyalty_card"],
            "mpesa_till": "522004",
            "mpesa_paybill": None,
            "avg_prep_minutes": 4,
            "pickup_only": True,
            "delivery_enabled": False,
            "photo_query": "coffee pastry takeaway counter",
        },
    },
]


# ────────────────────────────────────────────────────────────────────────
# KNOWLEDGE BASES — one menu/policy bundle per café
# ────────────────────────────────────────────────────────────────────────


KB: dict[str, dict[str, list[str]]] = {
    "lily-pond-cafe": {
        "menu": [
            "LIVE DEMO — Demo Espresso KES 10. Tiny proof coffee item for "
            "WhatsApp order and M-Pesa STK demos during pitches. Also known as "
            "10 bob, ten bob, and the demo order.",
            "COFFEE — All beans single-origin Kenyan, roasted weekly.\n"
            "• Espresso KES 120 / Double KES 160. Macchiato/Cortado KES 170. "
            "Flat White / Cappuccino / Latte KES 220 (oat/almond +KES 40). "
            "Cold Brew KES 250. Pour-over (Nyeri AA / Kirinyaga PB) KES 320. "
            "Mocha KES 280. Take-home 250g beans KES 850.",
            "BREAKFAST — Served 07:00–11:30.\n"
            "• Avocado Toast on Sourdough KES 450 (V) — add poached egg +KES 80.\n"
            "• Mandazi & Masala Chai KES 230 — three light mandazi + spiced milk tea.\n"
            "• Big Pond Plate KES 620 — two eggs, bacon, beans, toast, hash, grilled tomato.\n"
            "• Coconut Granola Bowl KES 380 (vegan).\n"
            "• Pancake Stack KES 420 — banana, honey, butter.",
            "LUNCH — Served 12:00–17:00.\n"
            "• Chicken Caesar Wrap KES 480.\n"
            "• Halloumi & Avo Bowl KES 520 (V) — quinoa, beetroot, tahini.\n"
            "• Sukuma & Coconut Curry KES 420 (vegan, GF) with brown rice.\n"
            "• Sweet Potato Fries KES 250.\n"
            "• Soup of the day KES 280 — ask staff.",
            "PASTRIES — Baked fresh on-site every morning.\n"
            "• Butter Croissant KES 180. Pain au Chocolat KES 220. "
            "Almond Croissant KES 250. Banana-Cardamom Loaf KES 220/slice. "
            "Chocolate Brownie KES 200 (GF). Lemon Tart KES 240.",
        ],
        "policies": [
            "DEMO ESPRESSO ORDER — Demo Espresso KES 10 is a real tiny proof order for "
            "Lily Pond demos. If a customer asks for Demo Espresso, 10 bob, ten bob, or "
            "the demo order, ask for or use their name and send the M-Pesa STK prompt. "
            "Do not describe internal tools or implementation details to customers.",
            "CUSTOMER MENU SUMMARY — Coffee options include Espresso, Double Espresso, "
            "Macchiato, Cortado, Flat White, Cappuccino, Latte, Cold Brew, Pour-over, "
            "Mocha, and take-home beans. Food options include Avocado Toast, Mandazi "
            "& Masala Chai, Big Pond Plate, Coconut Granola Bowl, Pancake Stack, "
            "Chicken Caesar Wrap, Halloumi & Avo Bowl, Sukuma & Coconut Curry, "
            "Sweet Potato Fries, Soup of the Day, Butter Croissant, Pain au Chocolat, "
            "Almond Croissant, Banana-Cardamom Loaf, Chocolate Brownie, and Lemon Tart.",
            "PICKUP & QUEUE — Average prep is 8 minutes. Order on WhatsApp 10 min before "
            "you arrive and skip the queue. We'll text 'ready' when your order is at the pickup shelf.",
            "PAYMENT — M-Pesa Till 522001 (Lily Pond Café) or card. Show the M-Pesa SMS at pickup. "
            "We accept Visa, Mastercard, Amex. No cash after 19:00.",
            "HOURS — Mon-Fri 07:00–21:00, Sat 09:00–18:00, closed Sunday. "
            "Exam week: we open at 06:30 and stay till 23:00.",
            "STUDY POLICY — Outdoor seating is unlimited; indoor tables have a 90-minute limit during peak (12:00–14:00, 17:00–19:00). "
            "Wi-Fi is free — network 'GenEat-LilyPond', no password.",
            "LOYALTY — Show your USIU ID + register your number once: every 10th drink free. "
            "Bring your own cup: KES 30 off any drink.",
            "GROUP ORDERS — Pre-order on WhatsApp for groups of 4+ at least 30 minutes ahead. "
            "Single pickup, single payment, easy splits via the order link.",
            "ALLERGENS — Kitchen handles wheat, dairy, eggs, nuts, sesame. Vegan & GF items clearly marked. "
            "Tell us at order time and we'll personally manage your prep.",
            "CONTACT — Live demo WhatsApp +1 555-657-8220. In emergencies (e.g. spilled coffee on your laptop), shout for any barista.",
        ],
    },
    "library-bites": {
        "menu": [
            "GRAB-AND-GO MEALS — Prepped fresh every morning, on the cold shelf.\n"
            "• Chicken Mayo Sandwich KES 280. Veggie Wrap KES 240. "
            "Tuna Crunch Baguette KES 320. Cheese & Tomato Toastie KES 220. "
            "Beef Samosa (2) KES 180. Sausage Roll KES 200. Egg Mayo Wrap KES 220.",
            "SNACKS & SWEETS — Always stocked. Perfect for exam week.\n"
            "• Crisps (various) KES 80. Chocolate bars KES 120. "
            "Energy bars KES 180. Bananas KES 30. Apples KES 50. "
            "Mandazi (2) KES 80. Doughnut KES 100. Cookies KES 60 each.",
            "DRINKS — From the chiller and the espresso machine.\n"
            "• Bottled water (500ml) KES 80. Soda (can) KES 100. "
            "Juice (Del Monte 250ml) KES 120. Espresso KES 100. "
            "Black coffee KES 120. Latte KES 180 (oat +KES 30). "
            "Tea (chai/black/green) KES 80. Energy drink KES 200.",
            "EXAM-WEEK SPECIALS — Brain Fuel Box KES 350 = wrap + fruit + water + bar.\n"
            "Power-Hour Combo KES 250 = coffee + sandwich (any). "
            "Coupon valid only with USIU ID, weekdays 10:00–14:00 and 18:00–22:00 during exam weeks.",
        ],
        "policies": [
            "SPEED — We're built for fast pickup. Average prep is 3 minutes. "
            "Order on WhatsApp, show the order number at the counter, grab and go.",
            "QUIET HOURS — Library is silent zone — please don't take calls at the counter. "
            "We use WhatsApp for everything so you can order without breaking quiet hours.",
            "HOURS — Mon-Fri 06:30–22:00. Sat 08:00–20:00. Sun 10:00–18:00. "
            "Exam weeks: 24-hour service Sun-Thu (we put up a sign).",
            "PAYMENT — M-Pesa Till 522002 only. No cash, no card (keeps the queue moving). "
            "Show the green-tick SMS to the staff and you're out the door.",
            "ALLERGENS — All sandwich labels show allergens (wheat, dairy, eggs, nuts, fish). "
            "Vegan and GF options have a green sticker.",
            "LOST & FOUND — We keep found items for 7 days behind the counter. "
            "Lost something? Drop a WhatsApp — we'll check the bin and reply.",
            "CONTACT — WhatsApp +254 700 910 002. Outside hours: leave a message, we reply at open.",
        ],
    },
    "pavilion-grill": {
        "menu": [
            "BURGERS — All beef is grass-fed from Ngong farms. Halal-certified.\n"
            "• Pavilion Classic KES 580 — 150g beef, cheddar, lettuce, tomato, onion, brioche.\n"
            "• Double Smash KES 780 — 2x 100g smashed patties, American cheese, pickles, brioche.\n"
            "• Chicken Tikka Burger KES 550 — marinated, mint-yogurt, brioche.\n"
            "• Mushroom & Halloumi Burger KES 520 (V).\n"
            "• Black-Bean Burger KES 480 (vegan).\n"
            "All burgers come with hand-cut fries.",
            "GRILL PLATES — Served from 12:00.\n"
            "• Chicken Skewers (3) KES 620 — coriander-lime marinade, rice + salad.\n"
            "• Nyama Choma Platter KES 880 — goat ribs, ugali, kachumbari, sukuma. (For 1.)\n"
            "• Tilapia Grilled Whole KES 750 — chips OR ugali + kachumbari.\n"
            "• Beef Ribs Half-Rack KES 1,150.\n"
            "• Vegetarian Skewers Plate KES 580 — halloumi, peppers, mushroom, rice.",
            "SIDES — Add to any order.\n"
            "• Fries KES 180 / Loaded Cheese Fries KES 280. Onion Rings KES 220. "
            "Sukuma KES 120. Ugali KES 100. Rice KES 150. Coleslaw KES 100. "
            "Garlic Bread KES 150.",
            "DRINKS & SHAKES — Bar opens at 17:00 (selected days).\n"
            "• Soda KES 150. Bottled water KES 100. Juice KES 200. "
            "Milkshakes (vanilla, choc, strawberry, peanut-butter) KES 320. "
            "Tusker (after 17:00, Thu–Sat) KES 350. "
            "Soft mocktails (Hibiscus Cooler, Virgin Mojito) KES 280.",
        ],
        "policies": [
            "GROUP ORDERS — Our specialty. WhatsApp us 30 min ahead with the breakdown "
            "(names + items) and we'll line everything up. One M-Pesa link splits the bill.",
            "DELIVERY TO DORMS — Free delivery to USIU dorms above KES 800 (otherwise +KES 100). "
            "ETA 25 minutes from the time M-Pesa is confirmed.",
            "HOURS — Mon-Thu 11:00–22:00. Fri-Sat 11:00–23:00. Sun 12:00–20:00. "
            "Grill closes 30 min before service ends.",
            "PAYMENT — M-Pesa Till 522003 or card (Visa/Mastercard). "
            "Cash accepted till 21:00. Split-bills are easy — just tell the cashier.",
            "ALLERGENS — Kitchen handles wheat, dairy, eggs, fish, sesame. "
            "Beef, chicken, goat are halal-certified. Vegan & GF items clearly marked. "
            "Tell us at order time and the chef will personally manage your prep.",
            "RESERVATIONS — For 6+ people, WhatsApp us 2 hours ahead. "
            "We hold tables 15 minutes past the booking time.",
            "EVENTS — Hosting a club mixer or birthday? We do private bookings (up to 50). "
            "WhatsApp us for the events menu — from KES 800/person.",
            "CONTACT — WhatsApp +254 700 910 003.",
        ],
    },
    "block-a-express": {
        "menu": [
            "COFFEE & TEA — Fast, hot, dependable. ⚡\n"
            "• Espresso KES 100 ⚡ Macchiato KES 140 ⚡ Americano KES 130 ⚡\n"
            "• Cappuccino / Latte / Flat White KES 200 (oat +KES 30) ⚡\n"
            "• Hot Chocolate KES 220 ⚡ Chai Latte KES 200 ⚡\n"
            "• Tea (chai / black / green / lemon) KES 80 ⚡",
            "PASTRIES & SNACKS — Delivered every morning from our Lily Pond bakery.\n"
            "• Butter Croissant KES 150. Pain au Chocolat KES 200. "
            "Almond Croissant KES 220. Cheese-and-Ham Twist KES 180. "
            "Banana-Cardamom Slice KES 200. Cinnamon Roll KES 220. "
            "Dark Chocolate Brownie KES 180.",
            "QUICK BITES — On the counter all day.\n"
            "• Cheese-Tomato Toastie KES 200. Ham & Cheese Croissant KES 240. "
            "Veggie Wrap KES 220. Yogurt Parfait KES 280. Fruit Cup KES 180. "
            "Energy bars KES 180. Banana KES 30.",
        ],
        "policies": [
            "SPEED — Average prep 4 min. Order on WhatsApp before you leave class — pickup before the bell. ⚡",
            "HOURS — Mon-Fri 06:45–19:00. Sat 08:00–14:00. Closed Sunday.",
            "PAYMENT — M-Pesa Till 522004 only. No cash. Show the SMS, grab and go.",
            "LOYALTY — Buy 10 drinks, get the 11th free. Reply 'card' on WhatsApp once "
            "to start counting — we use your phone number.",
            "BRING YOUR CUP — KES 25 off any drink with your own cup. ♻️",
            "ALLERGENS — All pastries handle wheat, dairy, eggs, nuts. Plant-milk options for every drink. Ask if unsure.",
            "CONTACT — WhatsApp +254 700 910 004.",
        ],
    },
}


# ────────────────────────────────────────────────────────────────────────
# DEMO CONVERSATIONS — at least one per café, mix of statuses + channels
# ────────────────────────────────────────────────────────────────────────


def m(s: Sender, text: str, ago_min: int) -> tuple[Sender, str, int]:
    return (s, text, ago_min)


DEMO_CONVERSATIONS: list[dict] = [
    # ── Lily Pond ──
    {
        "cafe": "lily-pond-cafe",
        "phone": "+254712100201",
        "name": "Brian Otieno",
        "channel": Channel.whatsapp,
        "status": ConvStatus.active,
        "ai_paused": False,
        "messages": [
            m(Sender.user, "morning, can i grab a flat white + almond croissant at 9:15?", 14),
            m(Sender.ai, "Sasa Brian ☕ Flat white + almond croissant for 9:15 — booked. KES 470, M-Pesa Till 522001. I'll text you when it's on the shelf.", 13),
            m(Sender.user, "perfect, paying now", 12),
            m(Sender.ai, "Got the green tick ✅ Ready by 9:13. Karibu!", 11),
        ],
    },
    {
        "cafe": "lily-pond-cafe",
        "phone": "+254723500988",
        "name": "Aisha Hassan",
        "channel": Channel.mock,
        "status": ConvStatus.resolved,
        "ai_paused": False,
        "messages": [
            m(Sender.user, "do you have oat milk", 6 * 60),
            m(Sender.ai, "Yes! Oat, almond, and coconut — KES 40 extra on any drink.", 6 * 60 - 1),
            m(Sender.user, "asante!", 6 * 60 - 2),
        ],
    },
    # ── Library Bites ──
    {
        "cafe": "library-bites",
        "phone": "+254734220019",
        "name": "Cynthia Wambui",
        "channel": Channel.whatsapp,
        "status": ConvStatus.active,
        "ai_paused": False,
        "messages": [
            m(Sender.user, "exam in 20. need brain fuel box + redbull", 4),
            m(Sender.ai, "Brain Fuel Box KES 350 + Energy drink KES 200 = KES 550. Till 522002. Ready in 3.", 3),
            m(Sender.user, "paid", 2),
            m(Sender.ai, "Counter, your name on top 📚 You got this.", 1),
        ],
    },
    {
        "cafe": "library-bites",
        "phone": "+254710444556",
        "name": "Daniel Kiprop",
        "channel": Channel.whatsapp,
        "status": ConvStatus.human_escalated,
        "ai_paused": True,
        "messages": [
            m(Sender.user, "i think one of your wraps had nuts in it, my friend's allergic", 42),
            m(Sender.ai, "I'm sorry Daniel — that's serious. Which wrap was it and when? I'm pulling in the manager right now.", 41),
            m(Sender.user, "veggie wrap from the cold shelf around 11. she's okay just very itchy", 40),
            m(Sender.system, "Escalated to human agent — allergen incident, Library Bites", 39),
        ],
    },
    # ── Pavilion Grill ──
    {
        "cafe": "pavilion-grill",
        "phone": "+254700556677",
        "name": "Mark Demir",
        "channel": Channel.whatsapp,
        "status": ConvStatus.active,
        "ai_paused": False,
        "messages": [
            m(Sender.user, "group order for our project meeting, 6 ppl, 1pm", 32),
            m(Sender.ai, "Got it boss 🔥 Send me everyone's pick (name + item + drink). I'll line it up for 12:55 pickup or table for 6 — your call.", 31),
            m(Sender.user, "table for 6 please. ill send the list in 5", 30),
            m(Sender.ai, "Table held till 13:15. Send the list when ready 👨‍🍳", 29),
        ],
    },
    {
        "cafe": "pavilion-grill",
        "phone": "+254755881122",
        "name": "Zawadi K.",
        "channel": Channel.whatsapp,
        "status": ConvStatus.resolved,
        "ai_paused": False,
        "messages": [
            m(Sender.user, "do you deliver to tyrus block?", 24 * 60),
            m(Sender.ai, "Yes — free above KES 800, otherwise KES 100. 25 min ETA from M-Pesa.", 24 * 60 - 1),
            m(Sender.user, "Pavilion classic + fries + soda. confirm price?", 24 * 60 - 2),
            m(Sender.ai, "Pavilion Classic 580 + Fries 180 + Soda 150 = KES 910. Free delivery. Till 522003.", 24 * 60 - 3),
            m(Sender.user, "paid", 24 * 60 - 4),
            m(Sender.ai, "On the grill 🔥 ETA 25 min. Track in this chat.", 24 * 60 - 5),
        ],
    },
    # ── Block A Express ──
    {
        "cafe": "block-a-express",
        "phone": "+254744111222",
        "name": "Lillian Wairimu",
        "channel": Channel.whatsapp,
        "status": ConvStatus.active,
        "ai_paused": False,
        "messages": [
            m(Sender.user, "double espresso + cinnamon roll for 10:55", 8),
            m(Sender.ai, "⚡ Double esp 160 + cinnamon roll 220 = KES 380. Till 522004. Ready 10:53.", 7),
            m(Sender.user, "paid 🙏", 6),
            m(Sender.ai, "On the counter ⚡ Name on the lid.", 5),
        ],
    },
    {
        "cafe": "block-a-express",
        "phone": "+254788445566",
        "name": "Sandra Njeri",
        "channel": Channel.whatsapp,
        "status": ConvStatus.resolved,
        "ai_paused": False,
        "messages": [
            m(Sender.user, "11th drink — is mine free yet?", 3 * 60),
            m(Sender.ai, "Let me check ⚡ Yes! You've had 10. Next order on the house — just say 'loyalty' at the counter.", 3 * 60 - 1),
            m(Sender.user, "🙌", 3 * 60 - 2),
        ],
    },
]


# ────────────────────────────────────────────────────────────────────────
# DB helpers
# ────────────────────────────────────────────────────────────────────────


async def upsert_business(db, spec: dict) -> Business:
    biz = (
        await db.execute(select(Business).where(Business.slug == spec["slug"]))
    ).scalar_one_or_none()
    if biz is None:
        biz = Business(slug=spec["slug"])
        db.add(biz)
    biz.name = spec["name"]
    biz.industry = spec["industry"]
    biz.location = spec["location"]
    biz.contact_phone = spec["contact_phone"]
    biz.contact_email = spec["contact_email"]
    if spec["slug"] == "lily-pond-cafe":
        meta_phone_id = (get_settings().meta_wa_phone_number_id or "").strip()
        if meta_phone_id:
            rows = (
                await db.execute(
                    select(Business).where(
                        Business.meta_wa_phone_number_id == meta_phone_id,
                        Business.slug != spec["slug"],
                    )
                )
            ).scalars().all()
            for other in rows:
                other.meta_wa_phone_number_id = None
            biz.meta_wa_phone_number_id = meta_phone_id
    biz.brand_voice = spec["brand_voice"]
    biz.greeting_template = spec["greeting"]
    biz.language_primary = "en"
    biz.language_secondary = "sw"
    biz.latitude = spec["lat"]
    biz.longitude = spec["lng"]
    profile = dict(spec["profile"])
    profile.update({
        "campus": CAMPUS_NAME,
        "campus_location": CAMPUS_LOCATION,
        "platform": PLATFORM_BRAND,
    })
    biz.profile = profile
    biz.active = True
    await db.flush()
    return biz


async def reset_kb(db, business_id: uuid.UUID, slug: str) -> int:
    await db.execute(
        delete(KnowledgeChunk).where(KnowledgeChunk.business_id == business_id)
    )
    bundles = KB[slug]
    total = 0
    for source, chunks in bundles.items():
        total += await ingest_text(
            db, business_id=business_id, source=source, chunks=chunks
        )
    return total


async def upsert_customer(db, phone: str, name: str) -> Customer:
    c = (
        await db.execute(select(Customer).where(Customer.phone_number == phone))
    ).scalar_one_or_none()
    if c is None:
        c = Customer(phone_number=phone, name=name)
        db.add(c)
        await db.flush()
    elif not c.name:
        c.name = name
    return c


async def seed_conversation(db, business_id: uuid.UUID, spec: dict) -> None:
    customer = await upsert_customer(db, spec["phone"], spec["name"])
    existing = (
        await db.execute(
            select(Conversation).where(
                Conversation.customer_id == customer.id,
                Conversation.business_id == business_id,
            )
        )
    ).scalars().all()
    for c in existing:
        await db.delete(c)
    await db.flush()

    msgs: Sequence[tuple[Sender, str, int]] = spec["messages"]
    last_ago = min(m[2] for m in msgs)
    first_ago = max(m[2] for m in msgs)
    conv = Conversation(
        customer_id=customer.id,
        business_id=business_id,
        channel=spec["channel"],
        status=spec["status"],
        ai_paused=spec.get("ai_paused", False),
        last_activity_at=NOW - timedelta(minutes=last_ago),
        created_at=NOW - timedelta(minutes=first_ago),
    )
    db.add(conv)
    await db.flush()
    for sender, content, ago in msgs:
        db.add(Message(
            conversation_id=conv.id,
            sender=sender,
            content=content,
            language="en",
            timestamp=NOW - timedelta(minutes=ago),
        ))
    await db.flush()


# ────────────────────────────────────────────────────────────────────────


async def main(_argv: argparse.Namespace) -> int:
    slug_to_id: dict[str, uuid.UUID] = {}
    async with SessionLocal() as db:
        print(f"→ Seeding {PLATFORM_BRAND} @ {CAMPUS_NAME} demo ecosystem")
        print(f"  Cafés: {len(CAFES)}")
        print()
        for spec in CAFES:
            biz = await upsert_business(db, spec)
            await db.commit()
            await db.refresh(biz)
            slug_to_id[spec["slug"]] = biz.id
            print(f"  ✓ {biz.name:<22} slug={biz.slug}")
        print()
        print("→ Re-embedding KBs...")
        for slug, bid in slug_to_id.items():
            n = await reset_kb(db, bid, slug)
            await db.commit()
            print(f"  ✓ {slug:<22} {n} chunks")
        print()
        print("→ Seeding demo conversations...")
        by_cafe: dict[str, int] = {s["slug"]: 0 for s in CAFES}
        for spec in DEMO_CONVERSATIONS:
            await seed_conversation(db, slug_to_id[spec["cafe"]], spec)
            by_cafe[spec["cafe"]] += 1
        await db.commit()
        for slug, n in by_cafe.items():
            print(f"  ✓ {slug:<22} {n} conversations")

    print()
    print("─" * 60)
    print(f"  {PLATFORM_BRAND} demo ready. Open the admin SPA:")
    print(f"     Dashboard → 4 tenants, 1 escalation queued")
    print(f"     Businesses → drill into any café")
    print("─" * 60)
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    rc = asyncio.run(main(p.parse_args()))
    sys.exit(rc)
