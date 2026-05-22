"""Seed the knowledge_base for a demo Kenya SME so the agent has something
real to talk about.

The reference business is **Asha Beauty & Wellness Hub** in Westlands,
Nairobi. Wide service catalogue + clear pricing + booking policy gives the
agent enough surface area for any demo scenario (info, recommend, book,
pay, escalate).

Run:
    python scripts/seed_demo.py            # idempotent — wipes & re-seeds
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Ensure project root on sys.path when run as `python scripts/seed_demo.py`
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text, select  # noqa: E402

from app.ai.rag import embed_texts  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.db.models import Business, KnowledgeChunk  # noqa: E402


# Each entry becomes one row in knowledge_base. Keep entries 1–4 sentences —
# short enough to embed cleanly, long enough to carry a complete fact.
KB_ENTRIES: list[tuple[str, str]] = [
    # ── About / brand ──────────────────────────────────────────────────
    ("about",
     "Asha Beauty & Wellness Hub is a premium salon and spa in Westlands, "
     "Nairobi. We've been open since 2019 and serve over 800 regular "
     "clients across hair, nails, skincare, and massage. Our promise: clean, "
     "calm, on-time, and same-day M-Pesa receipts."),

    ("location",
     "We're located on the 2nd floor of Sarit Centre, Westlands, Nairobi. "
     "Free parking validated for 2 hours with any service over KES 1,500. "
     "Google Maps: search 'Asha Beauty Westlands'. Landmark: opposite the "
     "Java House entrance."),

    ("hours",
     "Opening hours: Monday to Saturday 09:00–20:00, Sunday 10:00–18:00. "
     "Last booking 90 minutes before close. We are closed on public holidays "
     "except Madaraka Day and Mashujaa Day (10:00–16:00)."),

    ("contact",
     "WhatsApp and calls: +254 715 540 653. Email: book@ashabeauty.co.ke. "
     "For complaints or feedback ask to speak to Wanjiru, the salon manager."),

    # ── Hair services ──────────────────────────────────────────────────
    ("hair-wash-blowdry",
     "Wash & blow-dry: KES 1,500 (short hair) / KES 2,000 (medium) / "
     "KES 2,500 (long). Takes 45–60 minutes. Includes scalp massage and "
     "argan-oil finish."),

    ("hair-braiding",
     "Braiding: knotless braids KES 4,500, box braids KES 3,500, cornrows "
     "KES 1,800, twist-outs KES 2,800. Hair extensions extra (KES 800–"
     "2,500 depending on brand). Average duration 3–5 hours."),

    ("hair-treatment",
     "Deep-conditioning treatment: KES 2,500. Keratin treatment: "
     "KES 8,500 (lasts 3–4 months). Olaplex bond repair: KES 3,200. All "
     "treatments include wash and blow-dry."),

    ("hair-colour",
     "Hair colour: full head KES 5,500, root touch-up KES 3,500, highlights "
     "KES 6,500, balayage KES 8,000. We use L'Oréal Majirel and Wella "
     "Koleston. Patch test required for first-time clients (free, 48 hours "
     "before)."),

    ("hair-men",
     "Men's grooming: haircut KES 800, beard trim KES 500, haircut + beard "
     "KES 1,200, hot-towel shave KES 1,000. Walk-ins welcome Tue–Fri."),

    # ── Nails ──────────────────────────────────────────────────────────
    ("nails-manicure",
     "Manicure: classic KES 1,200, gel KES 2,000, French gel KES 2,300, "
     "acrylic full-set KES 3,500, acrylic refill KES 2,200. All include "
     "cuticle care and hand massage."),

    ("nails-pedicure",
     "Pedicure: classic KES 1,800, gel KES 2,500, spa pedicure with paraffin "
     "KES 3,200. Add nail art KES 200 per nail. Takes 60–75 minutes."),

    # ── Skin / face ────────────────────────────────────────────────────
    ("facials",
     "Facials: classic cleansing KES 3,500, hydrating KES 4,500, anti-aging "
     "KES 6,000, chemical peel KES 7,500, microdermabrasion KES 8,000. "
     "Consultation is free; we use Dermalogica and Image Skincare."),

    ("waxing",
     "Waxing: upper lip KES 500, full face KES 1,800, eyebrows KES 700, "
     "underarms KES 1,200, half-leg KES 1,800, full-leg KES 3,000, "
     "Brazilian KES 3,500. We use hot wax for sensitive areas."),

    ("eyelash",
     "Eyelash extensions: classic full set KES 4,500, hybrid KES 5,500, "
     "volume KES 6,500. Refills (within 3 weeks): KES 2,500. Lash lift + "
     "tint KES 3,800. Lasts 3–4 weeks with proper care."),

    # ── Massage / wellness ─────────────────────────────────────────────
    ("massage",
     "Massage: Swedish 60-min KES 4,500 / 90-min KES 6,500. Deep tissue "
     "60-min KES 5,500 / 90-min KES 7,500. Hot stone 90-min KES 8,000. "
     "Couples room available (book 24h ahead)."),

    ("packages",
     "Signature packages: 'Bridal Glow' (hair, makeup, mani-pedi, facial) "
     "KES 18,000 — usually KES 22,500. 'Recharge Sunday' (60-min massage + "
     "facial + pedicure) KES 11,000 — save KES 2,300. 'Gentleman's Hour' "
     "(haircut + beard + facial + manicure) KES 4,500."),

    # ── Policies ───────────────────────────────────────────────────────
    ("booking-policy",
     "Bookings are confirmed once we send the booking ID via WhatsApp. "
     "Please arrive 5 minutes early. Late by more than 15 minutes and we "
     "may need to shorten or reschedule your service. Booking via this "
     "chat is free; no deposit required for services under KES 5,000."),

    ("cancellation",
     "Cancellation policy: free cancellation up to 4 hours before your "
     "appointment. Within 4 hours: 50% of service fee. No-show: full fee. "
     "You can reschedule anytime via WhatsApp without penalty."),

    ("payment",
     "Payment: we send an M-Pesa STK push to your phone right after booking "
     "or service. You can also pay on arrival via M-Pesa Paybill 247247 "
     "Account 5540653, card (Visa/Mastercard), or cash. Receipts auto-sent "
     "on WhatsApp."),

    ("loyalty",
     "Loyalty programme: every 6th service of the same category is 50% off. "
     "Refer a friend, both get KES 500 credit. Birthday month: free upgrade "
     "on any service. We track this automatically — no card to carry."),

    # ── FAQs / objection handling ──────────────────────────────────────
    ("hygiene",
     "Hygiene: all tools are sterilised in a UV cabinet between clients, "
     "single-use buffers and files, and we use fresh towels per client. We "
     "are licensed by Nairobi City County (Permit #SAL/2024/2871)."),

    ("kids",
     "Children: kids' haircut (under 12) KES 600. We can do braids for kids "
     "(50% off adult rates) if a parent is present. We don't offer chemical "
     "treatments, gel/acrylic nails, or waxing for under-16s."),

    ("gift-cards",
     "Gift cards: available in any amount from KES 1,000 upwards. Sent via "
     "WhatsApp as a unique code, redeemable any day, valid for 12 months. "
     "Popular bundles: KES 5,000, KES 10,000, KES 18,000 (Bridal Glow)."),

    ("home-service",
     "Home service: available within Nairobi for parties of 2+ guests, "
     "weekdays only, minimum spend KES 8,000. Travel fee KES 1,500 within "
     "15km, KES 2,500 beyond. Hair, nails, makeup and massage all available."),

    ("walk-ins",
     "Walk-ins are welcome but appointments are prioritised. On Fridays "
     "and Saturdays we strongly recommend booking — most slots fill 24 "
     "hours ahead. Tuesday and Wednesday mornings usually have same-day "
     "availability."),

    ("bridal",
     "Bridal services: trial session KES 6,000 (deducted from wedding day "
     "fee). Wedding-day package starts at KES 25,000 (bride + 2 attendants, "
     "hair + makeup, 4 hours). Mobile service available for venues within "
     "30km of Nairobi."),
]


async def seed() -> int:
    settings = get_settings()
    texts = [content for _, content in KB_ENTRIES]
    sources = [src for src, _ in KB_ENTRIES]

    print(f"Embedding {len(texts)} knowledge entries via nomic-embed-text…")
    vectors = await embed_texts(texts)
    print(f"  ✓ {len(vectors)} embeddings (dim={len(vectors[0]) if vectors else 0})")

    async with SessionLocal() as db:
        # ── Business (tenant) row ────────────────────────────────────
        meta_pid = getattr(settings, "meta_wa_phone_number_id", None) or "1113487341852916"
        biz = (await db.execute(
            select(Business).where(Business.slug == "asha-beauty")
        )).scalar_one_or_none()
        if biz is None:
            biz = Business(
                slug="asha-beauty",
                name="Asha Beauty & Wellness Hub",
                industry="salon-spa",
                location="2nd floor Sarit Centre, Westlands, Nairobi",
                meta_wa_phone_number_id=str(meta_pid),
                contact_phone="+254715540653",
                contact_email="book@ashabeauty.co.ke",
                brand_voice=(
                    "You are Asha — the warm, sharp, decisive front-desk concierge "
                    "for Asha Beauty & Wellness Hub, a premium salon and spa in "
                    "Westlands, Nairobi. You speak like a real person: friendly but "
                    "professional, fast with prices, never pushy, never apologetic "
                    "by default. You quietly take pride in same-day M-Pesa receipts, "
                    "punctuality, and clean hygiene. You handle Kenyan English, "
                    "Kiswahili Sanifu, and Sheng fluently — matching the customer."
                ),
                greeting_template="Karibu Asha Beauty 💆🏽‍♀️ How can I help you today?",
                language_primary="en",
                language_secondary="sw",
                profile={"timezone": "Africa/Nairobi", "currency": "KES"},
                active=True,
            )
            db.add(biz)
            await db.flush()
            print(f"  ✓ Created business: {biz.name} (id={biz.id})")
        else:
            # Update fields in case the seed config changed.
            biz.meta_wa_phone_number_id = str(meta_pid)
            biz.contact_phone = "+254715540653"
            await db.flush()
            print(f"  ✓ Reusing business: {biz.name} (id={biz.id})")

        # ── Knowledge base — idempotent re-seed for this tenant ──────
        await db.execute(text(
            "DELETE FROM knowledge_base WHERE business_id = :bid OR business_id IS NULL"
        ), {"bid": str(biz.id)})
        for src, content, vec in zip(sources, texts, vectors):
            db.add(KnowledgeChunk(
                business_id=biz.id,
                source=src,
                content=content,
                embedding=vec,
            ))
        await db.commit()

    print(f"  ✓ Wrote {len(KB_ENTRIES)} rows to knowledge_base for {biz.name}")
    print(f"  ✓ Wrote {len(KB_ENTRIES)} rows to knowledge_base")
    return len(KB_ENTRIES)


if __name__ == "__main__":
    n = asyncio.run(seed())
    print(f"\nDone. Knowledge base populated with {n} entries.")
