"""Enrich Palm Cafe with a real-world KB (menu, hours, location, policies,
payments, events) so the agent has actual facts to ground on. Idempotent —
re-running replaces this tenant's KB rows.

Run: python scripts/seed_palm_cafe.py
"""
from __future__ import annotations

import asyncio
from sqlalchemy import select, text

from app.ai.rag import embed_texts
from app.core.config import get_settings  # noqa: F401  (ensures .env loaded)
from app.db.models import Business, KnowledgeChunk
from app.db.session import SessionLocal


KB_ENTRIES: list[tuple[str, str]] = [
    ("about",
     "Palm Cafe is an independent neighbourhood cafe on Argwings Kodhek "
     "Road in Kilimani, Nairobi — next door to Yaya Centre. We serve "
     "specialty coffee from Kenyan single-origin farms, all-day brunch, "
     "fresh pastries, and a relaxed lunch menu. Indoor seating for 32, "
     "outdoor courtyard for 18, free Wi-Fi, and a dedicated work-friendly "
     "corner with power outlets at every seat."),

    ("hours",
     "Opening hours: Monday to Saturday 07:00 to 21:00. Sunday brunch only, "
     "08:00 to 16:00. Last food order 30 minutes before closing. Public "
     "holidays follow Sunday hours unless otherwise posted on our Instagram "
     "@palmcafe.ke."),

    ("location",
     "Address: Argwings Kodhek Road, Kilimani, Nairobi (next to the Yaya "
     "Centre roundabout, opposite Adams Arcade matatu stage). Free street "
     "parking on Argwings Kodhek, paid basement at Yaya KES 100/hour. "
     "Google Maps pin: https://maps.google.com/?q=-1.2949,36.7868. We are "
     "wheelchair accessible via the main entrance."),

    ("menu-coffee",
     "Coffee menu (all KES): Espresso 250, Macchiato 300, Americano 300, "
     "Cappuccino 350, Latte 400, Flat White 400, Mocha 450, Cortado 380, "
     "Iced Coffee 400, Iced Latte 450, Frappuccino (vanilla / caramel / "
     "mocha) 550. Decaf available on request, same price. Oat / almond / "
     "soy milk swap: +KES 80."),

    ("menu-tea-other",
     "Tea & other hot drinks (KES): Black tea 200, Kenyan masala chai 350, "
     "Lemongrass-ginger tea 300, Hot chocolate 400, Kahawa ya tangawizi "
     "(ginger coffee) 300, Matcha latte 500."),

    ("menu-cold-drinks",
     "Cold drinks (KES): Fresh juice (mango / passion / pineapple / "
     "orange / watermelon) 350, House lemonade 350, Mixed berry smoothie "
     "500, Avocado-banana smoothie 500, Sparkling water 250, Coke / Fanta "
     "/ Stoney 200."),

    ("menu-breakfast",
     "Breakfast (served all day, KES): Buttermilk pancakes with maple "
     "syrup 600, Avocado toast with poached egg 750, Eggs Benedict 950, "
     "Full English (eggs / bacon / sausage / beans / toast / mushrooms) "
     "1,100, Spanish omelette 700, Mandazi (3 pieces) 250, Beef samosa "
     "(2 pieces) 200, Granola bowl with yoghurt and fruit 650."),

    ("menu-lunch",
     "Lunch & all-day mains (KES): Caesar salad with grilled chicken 850, "
     "Halloumi & roast veg salad 800, Grilled chicken club sandwich 950, "
     "Beef burger with hand-cut chips 1,200, Spicy chicken wrap 850, "
     "Fish & chips (tilapia) 1,100, Pasta arrabbiata 950, Pasta alfredo "
     "with chicken 1,150, Vegetarian pizza (10\") 1,000."),

    ("menu-pastries",
     "Pastries & cake (KES): Plain croissant 350, Chocolate croissant "
     "400, Almond croissant 450, Chocolate muffin 300, Blueberry muffin "
     "350, Carrot cake slice 450, NY cheesecake slice 500, Chocolate "
     "brownie 350, Cinnamon roll 400. All baked on-site daily."),

    ("menu-kids",
     "Kids menu (under 12, KES): Mini pancakes with honey 350, Chicken "
     "nuggets with chips 500, Mac & cheese 450, Grilled cheese sandwich "
     "400, Babychino (frothed milk) 100, Fruit cup 200."),

    ("dietary",
     "Dietary notes: Vegetarian and vegan options clearly labelled on the "
     "in-house menu. Gluten-free bread available (+KES 100). We can adjust "
     "most dishes — just ask the team. Halal-certified chicken and beef "
     "from Kenchic and Choppies. Nut warning: pastries are baked in a "
     "kitchen that uses tree nuts."),

    ("reservations",
     "Reservations: Walk-ins welcome any time. For tables of 4+ guests "
     "please book ahead, especially Friday-Sunday brunch (08:00-12:00 "
     "fills fastest). Tables held for 15 minutes after the booking time. "
     "Same-day bookings via WhatsApp +254 712 000 000 or via this chat. "
     "No deposit required for groups under 8."),

    ("private-events",
     "Private events: We host birthdays, baby showers, small corporate "
     "breakfasts, and book clubs. Courtyard buyout (up to 30 guests) "
     "KES 15,000 venue fee + food. Indoor partial buyout (up to 20) "
     "KES 8,000. Two hours notice for catering set-ups. Custom cake "
     "orders from KES 3,500 (48 hours notice)."),

    ("delivery",
     "Delivery: Available via Glovo, Bolt Food, and Uber Eats. Average "
     "delivery 25-40 minutes within Kilimani / Hurlingham / Lavington / "
     "Kileleshwa. We do NOT take direct delivery orders by phone — please "
     "use the apps so couriers can be dispatched properly."),

    ("payments",
     "Payments accepted: M-Pesa Till 5247821 (display name PALM CAFE), "
     "Visa, Mastercard, and cash (KES only). No service charge added to "
     "the bill; tips appreciated. We issue ETR receipts on request."),

    ("wifi-work",
     "Wi-Fi & work: Free Wi-Fi network 'PalmGuest', password printed on "
     "every receipt. Power outlets at all window seats and the back "
     "counter. We don't impose a minimum spend for working but please "
     "vacate window seats 12:00-14:00 on weekdays so lunch guests can "
     "be seated."),

    ("pets-children",
     "Pets & children: Well-behaved dogs welcome in the outdoor courtyard "
     "only (water bowl provided). High chairs and a small kids' play "
     "corner indoors. We are family-friendly but ask that children stay "
     "seated during peak hours."),

    ("loyalty",
     "Loyalty: Buy 9 coffees, get the 10th free. We log your purchases "
     "against your phone number automatically — no card to lose. Stamps "
     "expire 12 months from the first purchase."),

    ("photos",
     "Visual menu and venue photos available on our Instagram @palmcafe.ke "
     "and our website palmcafe.co.ke. If a customer asks to see the "
     "courtyard, the latte art, or a specific dish, point them to the "
     "Instagram highlight reels labelled 'Courtyard', 'Coffee', 'Brunch', "
     "and 'Events'."),

    ("contact",
     "Contact: WhatsApp / phone +254 712 000 000. Email "
     "hello@palmcafe.co.ke. Manager: Wanjiku Mwangi. Best response time "
     "is during opening hours."),
]


async def main() -> int:
    texts_list = [c for _, c in KB_ENTRIES]
    sources = [s for s, _ in KB_ENTRIES]
    print(f"Embedding {len(texts_list)} entries for Palm Cafe…")
    vectors = await embed_texts(texts_list)
    print(f"  ✓ {len(vectors)} vectors (dim={len(vectors[0])})")

    async with SessionLocal() as db:
        biz = (await db.execute(
            select(Business).where(Business.slug == "palm-cafe")
        )).scalar_one_or_none()
        if biz is None:
            biz = Business(
                slug="palm-cafe",
                name="Palm Cafe",
                industry="restaurant",
                location="Argwings Kodhek Road, Kilimani, Nairobi",
                contact_phone="+254712000000",
                contact_email="hello@palmcafe.co.ke",
                brand_voice=(
                    "You are the warm, attentive front-of-house host at Palm "
                    "Cafe — an independent neighbourhood cafe in Kilimani, "
                    "Nairobi. You speak like a real Nairobi barista-host: "
                    "friendly, brief, never pushy, quietly proud of the "
                    "single-origin Kenyan beans and the all-day brunch. You "
                    "answer in fluent Kenyan English, Kiswahili Sanifu, or "
                    "Sheng, matching the customer. You never invent prices "
                    "or items not on the menu."
                ),
                greeting_template=None,
                language_primary="en",
                language_secondary="sw",
                profile={"timezone": "Africa/Nairobi", "currency": "KES"},
                active=True,
                latitude=-1.2949,
                longitude=36.7868,
            )
            db.add(biz)
            await db.flush()
            print(f"  ✓ Created Palm Cafe tenant (id={biz.id})")
        else:
            biz.location = "Argwings Kodhek Road, Kilimani, Nairobi"
            biz.contact_email = "hello@palmcafe.co.ke"
            biz.latitude = -1.2949
            biz.longitude = 36.7868
            biz.brand_voice = (
                "You are the warm, attentive front-of-house host at Palm "
                "Cafe — an independent neighbourhood cafe in Kilimani, "
                "Nairobi. You speak like a real Nairobi barista-host: "
                "friendly, brief, never pushy, quietly proud of the "
                "single-origin Kenyan beans and the all-day brunch. You "
                "answer in fluent Kenyan English, Kiswahili Sanifu, or "
                "Sheng, matching the customer. You never invent prices "
                "or items not on the menu."
            )
            await db.flush()
            print(f"  ✓ Updating existing Palm Cafe tenant (id={biz.id})")

        # Idempotent KB refresh — drop existing rows for THIS tenant.
        await db.execute(
            text("DELETE FROM knowledge_base WHERE business_id = :bid"),
            {"bid": str(biz.id)},
        )
        for src, content, vec in zip(sources, texts_list, vectors):
            db.add(KnowledgeChunk(
                business_id=biz.id, source=src, content=content, embedding=vec,
            ))
        await db.commit()
    print(f"  ✓ Wrote {len(KB_ENTRIES)} KB rows for Palm Cafe")
    return len(KB_ENTRIES)


if __name__ == "__main__":
    n = asyncio.run(main())
    print(f"Done — {n} Palm Cafe KB entries indexed.")
