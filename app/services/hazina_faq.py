"""Hazina Nomads deterministic FAQ handler.

Answers every factual / info / policy question without touching the LLM.
Covers: brand story, delivery times, returns policy, payment methods, contact,
engraving, prices, availability, order process, min order, and a hard catch-all.

call ``try_hazina_faq`` in try_hazina_automation (gift_automation.py) before the
final ``return None`` so the LLM is NEVER invoked for Hazina WhatsApp turns.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.hazina_catalog import (
    ENGRAVING_FEE_KES,
    ENGRAVING_FEE_USD,
    HAZINA_COLLECTIONS,
    HAZINA_CONTACT_EMAIL,
    HAZINA_CONTACT_WHATSAPP,
    MIN_CUSTOM_ITEMS,
    PACKAGING_FEE_KES,
    PACKAGING_FEE_USD,
)
from app.services.gift_automation import (
    HAZINA_PRODUCTS,
    GiftAutomationResult,
    _catalog_reply,
    _price_label,
)

# ---------------------------------------------------------------------------
# Detection patterns
# ---------------------------------------------------------------------------

_ABOUT_RE = re.compile(
    r"\b(?:what (?:is|are|does)|who (?:is|are)|tell me about|about you|about hazina|"
    r"describe (?:your|hazina)|what do you do|who are you|your (?:brand|story|mission)|"
    r"what'?s? hazina|explain hazina|hazina nomads\??)\b",
    re.IGNORECASE,
)

_DELIVERY_INFO_RE = re.compile(
    r"\b(?:how long|lead time|delivery time|when (?:will|can)|how fast|"
    r"shipping time|dispatch|how do you deliver|delivery options|"
    r"how (?:does|do) (?:delivery|shipping)|deliver to|"
    r"outside kenya|internationally|same.?day|next.?day|days? to deliver|"
    r"time(?:frame|line) for delivery|how (?:many|much) (?:days?|hours?)|"
    r"delivery (?:schedule|timeline|window|process))\b",
    re.IGNORECASE,
)

_RETURNS_RE = re.compile(
    r"\b(?:return(?:s|ed|ing)?|refund(?:s|ed)?|exchange|replace(?:ment)?|"
    r"wrong item|damaged|defective|broken|not happy|complaint|issue with|"
    r"problem with|bad (?:quality|item|product)|money back|get my money)\b",
    re.IGNORECASE,
)

_PAYMENT_HOW_RE = re.compile(
    r"\b(?:how (?:do i|can i|to) pay|payment method|accept (?:visa|mastercard|card|mpesa)|"
    r"do you (?:accept|take)|can i pay with|ways to pay|pay(?:ment)? (?:options?|methods?)|"
    r"pay with|do you use|mpesa|m-pesa stk|currency|usd|dollars?)\b",
    re.IGNORECASE,
)

_CONTACT_RE = re.compile(
    r"\b(?:contact(?: (?:you|us|number|info|details?))?|phone(?: number)?|email|"
    r"reach (?:you|us)|get in touch|whatsapp(?: number)?|social media|instagram|"
    r"speak to (?:someone|a person|human|an agent|the team)|human agent|real person|"
    r"chat (?:to|with) (?:someone|a person|human|the team)|"
    r"talk to (?:someone|a person|human|the team)|website|find you online)\b",
    re.IGNORECASE,
)

_ENGRAVING_INFO_RE = re.compile(
    r"\b(?:engrav(?:e|ing|ed)?|monogram(?:ming)?|personali[sz](?:e|ing|ation)|"
    r"initials|name on (?:it|the|a)|carve|inscri\w+|stamp(?:ed)? (?:with|my)|"
    r"add (?:a )?name|custom(?:is|iz)e (?:the|a|with)|how (?:does|do) (?:the )?engrav)\b",
    re.IGNORECASE,
)

_MIN_ORDER_RE = re.compile(
    r"\b(?:minimum order|min order|order (?:quantity|minimum)|can i order (?:one|1|just)|"
    r"single piece|just one|one (?:gift|box|item|piece)|how many do i need|"
    r"order (?:one|1|a single)|buy (?:one|1|just one|a single))\b",
    re.IGNORECASE,
)

_HOW_TO_ORDER_RE = re.compile(
    r"\b(?:how (?:do i|can i|to) (?:place an order|order|buy|purchase)|"
    r"steps? to (?:order|buy|purchase)|ordering process|how (?:does|do) (?:it work|ordering|buying)|"
    r"process of (?:ordering|buying)|guide me|walk me through|"
    r"start (?:an order|ordering|buying)|how to (?:start|begin))\b",
    re.IGNORECASE,
)

_PRICE_QUERY_RE = re.compile(
    r"\b(?:how much|price(?:s)?|cost(?:s)?|bei|how expensive|pricing|"
    r"what (?:is|does|are) .{0,40}(?:cost|price)|"
    r"price of|cost of|what'?s? (?:it|the) (?:price|cost))\b",
    re.IGNORECASE,
)

_AVAILABILITY_SPECIFIC_RE = re.compile(
    r"\b(?:in stock|available|do you (?:have|sell|stock|carry)|is (?:the|this|that)|"
    r"are (?:these|those|they) available|have you (?:got|have)|can i (?:get|order|buy)|"
    r"mnao|unao|una\b|mna\b|je mna|je una)\b",
    re.IGNORECASE,
)

_OFF_CATALOG_RE = re.compile(
    r"\b(?:masks?|curios?|sculptures?|paintings?|cloths?|textiles?|shirts?|kanga|"
    r"kikoi|kiondo|baskets?|candles?|soaps?|oils?|perfume|jewel(?:ry|lery)|"
    r"necklace|bracelet|earrings?|ring(?:s)?|ceramics?|pottery|glassware)\b",
    re.IGNORECASE,
)

_COMPLAINT_RE = re.compile(
    r"\b(?:my order (?:hasn'?t|has not|never) (?:arrived|come)|"
    r"still waiting|where is my order|not delivered|lost (?:package|order|parcel)|"
    r"package (?:missing|lost|damaged)|received (?:wrong|broken|damaged)|"
    r"i (?:never|didn'?t) receive|oda (?:haijafika|imepotea|imekuwa na shida))\b",
    re.IGNORECASE,
)

_CUSTOM_PROCESS_RE = re.compile(
    r"\b(?:how (?:does|do) (?:custom|bespoke|sourcing|the brief)|"
    r"explain (?:custom|bespoke|the process|how it works)|"
    r"what is (?:bespoke|custom sourcing|the brief process)|"
    r"tell me (?:about|more about) (?:bespoke|custom|sourcing)|"
    r"sourcing (?:process|brief|how))\b",
    re.IGNORECASE,
)

_JKIA_DETAIL_RE = re.compile(
    r"\b(?:jkia|airport|terminal|departure (?:lounge|gate|drop)|"
    r"how (?:does|do) (?:jkia|airport|departure) (?:delivery|drop|handoff) work|"
    r"jkia (?:process|details?|how)|can you (?:deliver|drop) (?:at|to) (?:the )?airport)\b",
    re.IGNORECASE,
)

_DHL_DETAIL_RE = re.compile(
    r"\b(?:how (?:does|do) (?:dhl|international|global export|shipping|export) work|"
    r"dhl (?:process|details?|how|rates?|cost)|international (?:shipping|delivery) (?:how|process|cost|rate)|"
    r"global export (?:how|process|cost)|ship (?:to|abroad|internationally|outside kenya)|"
    r"export (?:process|how|details?)|customs? (?:clearance|fees?|duty))\b",
    re.IGNORECASE,
)

_WARRANTY_RE = re.compile(
    r"\b(?:warrant(?:y|ied)|guarantee(?:d)?|quality (?:assurance|guarantee)|"
    r"how (?:long does|is) (?:the )?(?:warranty|guarantee))\b",
    re.IGNORECASE,
)

_GIFT_WRAP_RE = re.compile(
    r"\b(?:gift wrap(?:ping|ped)?|packaging|box|how (?:is it|are they) (?:packaged|wrapped|sent)|"
    r"comes? (?:in a box|boxed|wrapped|in packaging)|unboxing|presentation)\b",
    re.IGNORECASE,
)

_LANGUAGE_SWITCH_RE = re.compile(
    r"\b(?:ongea kiswahili|speak (?:swahili|in swahili)|kiswahili(?:\s+please)?|"
    r"nijibu kiswahili|niambie kiswahili|switch to swahili|in english please|speak english)\b",
    re.IGNORECASE,
)

_BULK_PRICE_RE = re.compile(
    r"\b(?:bulk (?:pricing|discount|rate|order)|discount for (?:bulk|many|multiple|large)|"
    r"order many|quantity discount|volume (?:pricing|discount)|"
    r"if i buy (?:many|more|multiple|several)|price for (?:\d+|many|multiple))\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Reply builders
# ---------------------------------------------------------------------------

def _hazina_about_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "*Hazina Nomads* ni huduma ya zawadi za kifahari ya Afrika Mashariki. Tunajumuisha:\n\n"
            "🎁 *Bespoke Curation* — vipande vya mkono vilivyochaguliwa kutoka pwani ya Kiswahili\n"
            "✈️ *Seamless Logistics* — uwasilishaji kwa hoteli, JKIA, au ndani ya Nairobi\n"
            "🌍 *Global Export* — usafirishaji wa kimataifa kwa DHL\n\n"
            "Kila kipande ni cha mafundi wa pwani ya Afrika Mashariki."
        )
    return (
        "*Hazina Nomads* is a premium East African gift concierge. We offer:\n\n"
        "🎁 *Bespoke Curation* — handpicked Swahili Coast artisan pieces\n"
        "✈️ *Seamless Logistics* — delivery to hotels, JKIA, or anywhere in Nairobi\n"
        "🌍 *Global Export* — insured international shipping via DHL\n\n"
        "Every piece is artisan-crafted and sourced from the Swahili Coast."
    )


def _hazina_delivery_info_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "⏱ *Nyakati za uwasilishaji:*\n\n"
            "• *JKIA / airport handoff* — masaa 4–12 kabla ya kuondoka\n"
            "• *Hotel / local handoff* — masaa 2–8 kulingana na eneo\n"
            "• *DHL Global Export* — siku 3–7 baada ya uthibitisho wa bei\n\n"
            "⚙️ *Lead time ya kuandaa:*\n"
            "• Vitu vya kawaida — masaa 24–48\n"
            "• Uchoraji maalum (engraving) — masaa 48–72\n\n"
            "Niambie mahali na muda wako na nitahesabu wakati halisi."
        )
    return (
        "⏱ *Delivery timelines:*\n\n"
        "• *JKIA / airport handoff* — 4–12 hours before your departure\n"
        "• *Hotel / local handoff* — 2–8 hours depending on location\n"
        "• *DHL Global Export* — 3–7 business days after cost confirmation\n\n"
        "⚙️ *Preparation lead time:*\n"
        "• Standard pieces — 24–48 hours\n"
        "• Bespoke engraving — add 48–72 hours\n\n"
        "Share your location and timing and I'll confirm the exact window."
    )


def _hazina_returns_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "↩️ *Sera ya kurudisha bidhaa:*\n\n"
            "Ikiwa umepokea kitu kibaya au kilichoharibiwa, wasiliana nasi ndani ya saa 48 "
            "na picha — tutashughulikia ubadilishaji au fidia bila malipo.\n\n"
            "Bidhaa za kibinafsi (uchoraji, custom brief) hazirudi isipokuwa hitilafu ilitokea "
            "kwa upande wetu."
        )
    return (
        "↩️ *Returns & refunds:*\n\n"
        "If you receive a damaged or incorrect item, contact us within 48 hours with a photo "
        "and we will arrange a full replacement or refund at no cost.\n\n"
        "Personalised pieces (engravings, custom briefs) are non-refundable unless "
        "the error is on our side."
    )


def _hazina_payment_methods_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "💳 *Njia za malipo:*\n\n"
            "• *M-Pesa STK (KES)* — tunatuma prompt moja kwa moja kwa simu yako; "
            "weka PIN kukamilisha\n"
            "• *Kadi ya kimataifa (USD)* — Visa, Mastercard, Apple Pay kupitia kiungo salama\n\n"
            "Unachagua njia yako unapothibitisha oda. Hatuweki ada za ziada za malipo."
        )
    return (
        "💳 *Payment methods:*\n\n"
        "• *M-Pesa STK (KES)* — we push the prompt directly to your phone; "
        "just enter your PIN to complete\n"
        "• *International card (USD)* — Visa, Mastercard, Apple Pay via secure checkout link\n\n"
        "You choose your preferred method when you confirm the order. No extra payment fees."
    )


def _hazina_contact_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "📞 *Wasiliana nasi:*\n\n"
            f"• *WhatsApp* — {HAZINA_CONTACT_WHATSAPP} (nambari hii)\n"
            f"• *Email* — {HAZINA_CONTACT_EMAIL}\n"
            "• *Portal* — hazina.lesnarai.co.ke\n\n"
            "Kwa mambo ya haraka au corporate, andika *'connect agent'* na nitawasiliana na mtaalam haraka."
        )
    return (
        "📞 *Contact us:*\n\n"
        f"• *WhatsApp* — {HAZINA_CONTACT_WHATSAPP} (this number)\n"
        f"• *Email* — {HAZINA_CONTACT_EMAIL}\n"
        "• *Portal* — hazina.lesnarai.co.ke\n\n"
        "For urgent matters or corporate inquiries, type *'connect agent'* "
        "and I'll connect you with a specialist straight away."
    )


def _hazina_engraving_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "✍️ *Uchoraji maalum (Engraving):*\n\n"
            f"Bei: KES {ENGRAVING_FEE_KES:,} / USD {int(ENGRAVING_FEE_USD)} kwa kila kipande\n\n"
            "Inafanya kazi vizuri zaidi kwa:\n"
            "• The Nomad Leather Set (passport holder & luggage tag)\n"
            "• The Safari Romance Box (leather tag)\n"
            "• Vipande vingine vya ngozi\n\n"
            "Weka jina au initials unapotoa oda — tunafanya ndani ya masaa 24–48 zaidi. "
            "Angalizo: uchoraji hautumiwi kwa Kenya Edit au Highland Treasure."
        )
    return (
        "✍️ *Bespoke engraving / monogramming:*\n\n"
        f"Fee: KES {ENGRAVING_FEE_KES:,} / USD {int(ENGRAVING_FEE_USD)} per piece\n\n"
        "Works best on:\n"
        "• The Nomad Leather Set (passport holder & luggage tag)\n"
        "• The Safari Romance Box (leather luggage tag)\n"
        "• Other leather pieces\n\n"
        "Just mention the name or initials when ordering — we turn it around in 24–48 additional hours. "
        "Note: engraving is not available on food/coffee gift sets."
    )


def _hazina_min_order_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "✅ Tunakubali oda moja ya collection yoyote.\n\n"
            f"Kwa *custom box*, unahitaji angalau vitu {MIN_CUSTOM_ITEMS} kutoka catalog. "
            "Unaweza ongeza packaging ya ziada (KES {PACKAGING_FEE_KES:,} / USD {int(PACKAGING_FEE_USD)}) "
            "kwa muundo mzuri zaidi."
        ).format(PACKAGING_FEE_KES=PACKAGING_FEE_KES, PACKAGING_FEE_USD=PACKAGING_FEE_USD)
    return (
        "✅ We accept single-piece orders for any signature collection.\n\n"
        f"For a *custom box*, you need at least {MIN_CUSTOM_ITEMS} treasures from the catalog. "
        f"You can also add premium packaging "
        f"(KES {PACKAGING_FEE_KES:,} / USD {int(PACKAGING_FEE_USD)}) for a premium unboxing experience."
    )


def _hazina_how_to_order_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "🛒 *Jinsi ya kuagiza:*\n\n"
            "1️⃣ Chagua collection kutoka menu hapa chini\n"
            "2️⃣ Nipe jina lako la oda\n"
            "3️⃣ Niambie aina ya delivery (hotel, JKIA, au international)\n"
            "4️⃣ Niambie eneo halisi na muda\n"
            "5️⃣ Chagua njia ya malipo (M-Pesa KES au kadi USD)\n"
            "6️⃣ Thibitisha — nitatuma STK au link ya malipo\n\n"
            "Mchakato wote hufanyika hapa ndani ya WhatsApp — hakuna app ya kuhitajika."
        )
    return (
        "🛒 *How to place an order:*\n\n"
        "1️⃣ Pick a collection from the menu below\n"
        "2️⃣ Give me the name for the order\n"
        "3️⃣ Tell me the delivery channel (hotel, JKIA, or international)\n"
        "4️⃣ Share the exact location and timing\n"
        "5️⃣ Choose payment (M-Pesa KES or card USD)\n"
        "6️⃣ Confirm — I'll send the STK or payment link\n\n"
        "The entire process happens right here in WhatsApp — no app needed."
    )


def _hazina_price_reply(text: str, *, is_sw: bool) -> str:
    """Return prices for matched products, or the full price list."""
    lowered = (text or "").lower()
    matches: list[dict] = []
    for row in HAZINA_COLLECTIONS:
        name_lower = row["name"].lower()
        tokens = [tok for tok in name_lower.split() if len(tok) >= 4]
        if any(tok in lowered for tok in tokens) or name_lower in lowered:
            matches.append(row)
    if len(matches) == 1:
        row = matches[0]
        if is_sw:
            return (
                f"*{row['name']}*: {_price_label(usd=row['price_usd'], kes=row['price_kes'])}.\n"
                f"{row['contents']}\n\nNiambie ukitaka kuagiza au tuma 'menu' kuona collections zote."
            )
        return (
            f"*{row['name']}*: {_price_label(usd=row['price_usd'], kes=row['price_kes'])}.\n"
            f"{row['contents']}\n\nLet me know if you'd like to order, or type 'menu' to browse all collections."
        )
    # Full price list
    lines = [
        f"• *{row['name']}* — {_price_label(usd=row['price_usd'], kes=row['price_kes'])}"
        for row in HAZINA_COLLECTIONS
    ]
    if is_sw:
        return "💰 *Bei zetu:*\n\n" + "\n".join(lines) + "\n\nChagua collection hapa chini kuona maelezo zaidi."
    return "💰 *Our prices:*\n\n" + "\n".join(lines) + "\n\nPick a collection below to see full details."


def _hazina_availability_reply(text: str, *, is_sw: bool) -> str:
    """Confirm availability for matched products or general stock."""
    lowered = (text or "").lower()
    for row in HAZINA_COLLECTIONS:
        name_lower = row["name"].lower()
        tokens = [tok for tok in name_lower.split() if len(tok) >= 4]
        if any(tok in lowered for tok in tokens) or name_lower in lowered:
            jkia_note = (
                " (JKIA handoff pekee)" if row.get("jkia_only") else ""
            ) if is_sw else (
                " (JKIA handoff only)" if row.get("jkia_only") else ""
            )
            if is_sw:
                return (
                    f"✅ *{row['name']}*{jkia_note} — ipo katika stock yetu. "
                    f"{_price_label(usd=row['price_usd'], kes=row['price_kes'])}. "
                    "Niambie ukitaka kuagiza."
                )
            return (
                f"✅ *{row['name']}*{jkia_note} — yes, in our collection. "
                f"{_price_label(usd=row['price_usd'], kes=row['price_kes'])}. "
                "Let me know if you'd like to order."
            )
    if is_sw:
        return (
            "✅ Collections zetu zote zinapatikana — vipande vyote viko tayari. "
            "Chagua collection hapa chini, au niambie unatafuta nini na nitakusaidia."
        )
    return (
        "✅ All our signature collections are available — pieces are ready to dispatch. "
        "Pick a collection below, or tell me what you're looking for and I'll help."
    )


def _hazina_off_catalog_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "Hiyo si katika collections zetu za sasa. Tunashughulikia *Bespoke Curation* — "
            "ikiwa una kitu maalum unachotaka, niambie mpokeaji, tukio, na bajeti na "
            "timu yetu ya sourcing itapata kipande sahihi."
        )
    return (
        "That item is not in our current signature collections. We do *Bespoke Curation* though — "
        "if you have something specific in mind, share the recipient, occasion, and budget and "
        "our sourcing team will find the right piece."
    )


def _hazina_complaint_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "Pole sana kwa hilo. Nitatuma tatizo lako kwa timu yetu ya concierge — "
            "mtu atawasiliana nawe hapa hivi karibuni. "
            "Ikiwa una picha au nambari ya oda (HN-ORD-...), tafadhali zishiriki ili tuweze kukusaidia haraka."
        )
    return (
        "I'm sorry to hear that. I'm escalating this to our concierge team — "
        "someone will follow up on this thread shortly. "
        "If you have a photo or your order reference (HN-ORD-...), please share it so we can resolve this quickly."
    )


def _hazina_custom_process_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "🎨 *Jinsi ya Bespoke Curation inavyofanya kazi:*\n\n"
            "1️⃣ Niambie mpokeaji, tukio, na bajeti yako ya takriban\n"
            "2️⃣ Timu yetu ya sourcing hupata vipande vya mkono kutoka kwa mafundi wa pwani\n"
            "3️⃣ Unapitia orodha na kuidhinisha\n"
            "4️⃣ Tunatekeleza packing maalum — uchoraji, kadi ya mkono, na sanduku la Hazina\n"
            "5️⃣ Unamaliza malipo — tunatoa kwa uwasilishaji wowote unaochagua\n\n"
            "Angalizo: oda za custom zinahitaji angalau vitu 2 kutoka catalog yetu."
        )
    return (
        "🎨 *How Bespoke Curation works:*\n\n"
        "1️⃣ Tell us the recipient, occasion, and rough budget\n"
        "2️⃣ Our sourcing team handpicks pieces from Swahili Coast artisans\n"
        "3️⃣ You review and approve the shortlist\n"
        "4️⃣ We execute: bespoke packing, hand-written card, Hazina gift box\n"
        "5️⃣ You complete payment — we dispatch via your chosen delivery channel\n\n"
        "Note: custom boxes require at least 2 pieces from our catalog."
    )


def _hazina_jkia_detail_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "✈️ *JKIA Departure Handoff:*\n\n"
            "Hii ni huduma yetu ya Seamless Logistics:\n\n"
            "• Tunakufikia JKIA Terminal 1A au 1E (au kukubaliana na terminal yako)\n"
            "• Lead time: masaa 4–12 kabla ya kuondoka\n"
            "• Lazima ujue terminal yako na muda wa ndege\n"
            "• Huhitaji kutoka kwenye foleni — tunafikia mahali ulipokubali\n\n"
            "Niambie terminal yako na muda wa ndege na tutapanga haraka."
        )
    return (
        "✈️ *JKIA Departure Handoff:*\n\n"
        "This is our Seamless Logistics service:\n\n"
        "• We meet you at JKIA Terminal 1A or 1E (or agree on your terminal)\n"
        "• Lead time: 4–12 hours before your departure\n"
        "• You must know your terminal and flight time\n"
        "• No queue-jumping needed — we meet you at an agreed spot airside\n\n"
        "Share your terminal and flight time and we'll coordinate quickly."
    )


def _hazina_dhl_detail_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "🌍 *Global Export (DHL):*\n\n"
            "Hii ni huduma yetu ya usafirishaji wa kimataifa:\n\n"
            "• Tunatumia DHL au courier wa insured kulingana na eneo\n"
            "• Tunaunga mkono: EU, UK, UAE, USA, Asia, na zaidi\n"
            "• Bei ya usafirishaji inategemea uzito, eneo, na haraka — tunatoa bei kabla ya malipo\n"
            "• Kawaida siku 3–7 za kazi baada ya dispatch\n"
            "• Tunaandaa fomu zote za forodha\n\n"
            "Niambie nchi, mji, na anwani — nitatoa estimate ya bei na muda."
        )
    return (
        "🌍 *Global Export (DHL):*\n\n"
        "This is our international shipping service:\n\n"
        "• We use DHL or an insured courier depending on destination\n"
        "• We ship to: EU, UK, UAE, USA, Asia, and beyond\n"
        "• Shipping cost depends on weight, destination, and speed — we quote before payment\n"
        "• Typically 3–7 business days after dispatch\n"
        "• We prepare all customs documentation\n\n"
        "Share the destination country, city, and address and I'll provide a cost and timeline estimate."
    )


def _hazina_warranty_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "Vipande vyetu vya mkono vimejaribiwa kwa ubora wa juu. Ikiwa umepokea "
            "kitu chenye hitilafu ya utengenezaji, tunarekebisha au kubadilisha bila ada "
            "ndani ya siku 7 za kupokea. "
            "Wasiliana nasi na picha na tutashughulikia haraka."
        )
    return (
        "Our artisan pieces are quality-checked before dispatch. If you receive an item "
        "with a manufacturing defect, we'll repair or replace it at no cost within 7 days "
        "of receipt. Contact us with a photo and we'll sort it right away."
    )


def _hazina_gift_wrap_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "🎁 *Packaging:*\n\n"
            "Kila collection inakuja ndani ya sanduku la Hazina Nomads lenye:\n"
            "• Karatasi maalum ya wrapping\n"
            "• Kadi ya brand story iliyoandikwa kwa mkono\n"
            "• Tissue paper na ribbon\n\n"
            f"Premium packaging ya ziada inapatikana kwa KES {PACKAGING_FEE_KES:,} / "
            f"USD {int(PACKAGING_FEE_USD)} kwa muundo mzuri zaidi."
        )
    return (
        "🎁 *Packaging:*\n\n"
        "Every collection arrives in a Hazina Nomads gift box with:\n"
        "• Branded wrapping paper\n"
        "• Hand-written brand story card\n"
        "• Tissue paper and ribbon\n\n"
        f"Premium packaging upgrade available at KES {PACKAGING_FEE_KES:,} / "
        f"USD {int(PACKAGING_FEE_USD)} for a more impressive unboxing experience."
    )


def _hazina_bulk_price_reply(*, is_sw: bool) -> str:
    if is_sw:
        return (
            "Kwa oda za wingi na zawadi za kampuni, timu yetu ya concierge wakuu "
            "inashughulikia bei maalum, ratiba, na mipangilio ya utoaji. "
            "Andika *'corporate'* au *'connect agent'* na nitawaunganisha na mtaalam haraka."
        )
    return (
        "For bulk orders and corporate gifting, our senior concierge team handles "
        "custom pricing, timelines, and delivery arrangements. "
        "Type *'corporate'* or *'connect agent'* and I'll connect you with a specialist right away."
    )


def _hazina_language_reply(text: str, *, is_sw: bool) -> str:
    lowered = (text or "").lower()
    if "english" in lowered:
        return (
            "Of course — I'll reply in English from here. "
            "How can I help? Just say 'menu' to see our collections."
        )
    if is_sw or "swahili" in lowered or "kiswahili" in lowered:
        return (
            "Karibu! Nitaendelea kujibu kwa Kiswahili. "
            "Sema 'menu' kuona collections, au niambie unavyohitaji."
        )
    return (
        "I can assist in English or Swahili — just reply naturally in either language. "
        "What can I help you with?"
    )


# ---------------------------------------------------------------------------
# Dataclass + public entry point
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class HazinaFaqResult:
    reply: str
    safety_flag: str
    interactive: dict | None = None
    escalated: bool = False


async def try_hazina_faq(
    db: AsyncSession,
    *,
    text: str,
    customer,
    conversation_id: uuid.UUID,
    business_id: uuid.UUID | None,
    language: str | None,
    business_slug: str | None,
) -> HazinaFaqResult | None:
    """Return a deterministic FAQ reply, or None if not an FAQ turn.

    Imported and called inside ``try_hazina_automation`` before the final
    ``return None`` so the LLM is never reached for Hazina WhatsApp turns.
    """
    from app.services.whatsapp_menus import (
        back_to_menu_payload,
        main_menu_payload,
        product_list_payload,
    )

    body = (text or "").strip()
    if not body:
        return None

    is_sw = (language or "").lower().startswith(("sw", "she")) or (
        (getattr(customer, "preferred_language", None) or "").lower().startswith(("sw", "she"))
    )

    main_menu = main_menu_payload(
        business_name="Hazina Nomads",
        language=language,
        business_slug=business_slug,
    )

    # ── Language / locale switch ────────────────────────────────────────────
    if _LANGUAGE_SWITCH_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_language_reply(body, is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_language",
            interactive=main_menu,
        )

    # ── Brand / about ───────────────────────────────────────────────────────
    if _ABOUT_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_about_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_about",
            interactive=main_menu,
        )

    # ── Complaint / issue ───────────────────────────────────────────────────
    if _COMPLAINT_RE.search(body):
        from app.services.hazina_escalation import hazina_desk_reply, open_hazina_desk_issue

        await open_hazina_desk_issue(
            db,
            customer_id=customer.id,
            business_id=business_id,
            reason="customer_complaint",
            msisdn=getattr(customer, "phone_number", None),
        )
        return HazinaFaqResult(
            reply=_hazina_complaint_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_complaint",
            escalated=True,
        )

    # ── JKIA / airport delivery detail ─────────────────────────────────────
    if _JKIA_DETAIL_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_jkia_detail_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_jkia",
            interactive=main_menu,
        )

    # ── DHL / international detail ──────────────────────────────────────────
    if _DHL_DETAIL_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_dhl_detail_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_dhl",
            interactive=main_menu,
        )

    # ── General delivery info ───────────────────────────────────────────────
    if _DELIVERY_INFO_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_delivery_info_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_delivery",
            interactive=main_menu,
        )

    # ── Returns / refunds ───────────────────────────────────────────────────
    if _RETURNS_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_returns_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_returns",
            interactive=main_menu,
        )

    # ── Warranty / quality ──────────────────────────────────────────────────
    if _WARRANTY_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_warranty_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_warranty",
            interactive=main_menu,
        )

    # ── Gift wrapping / packaging ───────────────────────────────────────────
    if _GIFT_WRAP_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_gift_wrap_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_giftwrap",
            interactive=main_menu,
        )

    # ── Payment methods ─────────────────────────────────────────────────────
    if _PAYMENT_HOW_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_payment_methods_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_payment_methods",
            interactive=main_menu,
        )

    # ── Contact info ────────────────────────────────────────────────────────
    if _CONTACT_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_contact_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_contact",
            interactive=main_menu,
        )

    # ── Engraving / personalisation info ───────────────────────────────────
    if _ENGRAVING_INFO_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_engraving_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_engraving",
            interactive=product_list_payload(language=language),
        )

    # ── Minimum order ───────────────────────────────────────────────────────
    if _MIN_ORDER_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_min_order_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_min_order",
            interactive=product_list_payload(language=language),
        )

    # ── How to order (process) ──────────────────────────────────────────────
    if _HOW_TO_ORDER_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_how_to_order_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_how_to_order",
            interactive=product_list_payload(language=language),
        )

    # ── Bulk / volume pricing ───────────────────────────────────────────────
    if _BULK_PRICE_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_bulk_price_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_bulk_price",
            interactive=main_menu,
        )

    # ── Bespoke / custom process ────────────────────────────────────────────
    if _CUSTOM_PROCESS_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_custom_process_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_custom_process",
            interactive=product_list_payload(language=language),
        )

    # ── Price queries ───────────────────────────────────────────────────────
    if _PRICE_QUERY_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_price_reply(body, is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_price",
            interactive=product_list_payload(language=language),
        )

    # ── Availability queries ────────────────────────────────────────────────
    if _AVAILABILITY_SPECIFIC_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_availability_reply(body, is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_availability",
            interactive=product_list_payload(language=language),
        )

    # ── Off-catalog product query ("do you have X?") ────────────────────────
    if _OFF_CATALOG_RE.search(body):
        return HazinaFaqResult(
            reply=_hazina_off_catalog_reply(is_sw=is_sw),
            safety_flag="deterministic:hazina_faq_off_catalog",
            interactive=product_list_payload(language=language),
        )

    return None
