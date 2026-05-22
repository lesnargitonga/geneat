// Single source of truth for the consumer portal. Mirrors the seed in
// scripts/seed_geneat_demo.py — keep in sync.

export type MenuItem = {
  name: string;
  price: number;
  /** Single emoji used as the placeholder thumb when `image` is absent. */
  emoji?: string;
  /** Optional path under /public (e.g. "/menu/lily-pond-cafe/flat-white.jpg")
   *  or remote https URL. When present, renders instead of the emoji card. */
  image?: string;
  /** Optional short note shown under the name on the full menu. */
  note?: string;
  /** Diet badges shown as small chips. */
  badges?: ("V" | "vegan" | "GF" | "halal" | "new" | "spicy")[];
};

export type MenuSection = {
  title: string;
  blurb?: string;
  items: MenuItem[];
};

export type Cafe = {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  hero_emoji: string;
  color: string;            // brand accent per café
  location: string;
  phone: string;             // WhatsApp dial
  whatsapp: string;          // wa.me link target (no +, no spaces)
  email: string;
  mpesa_till: string;
  avg_prep_minutes: number;
  hours: Record<"mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun", string>;
  hours_summary: string;
  tags: string[];
  features: string[];
  photo: string;             // Unsplash URL
  highlights: string[];      // 3 bullet quick-look items for the card
  menuPreview: MenuItem[];   // 4-item teaser on the detail hero
  menuFull: MenuSection[];   // full grouped menu shown below the fold
  askPrompts: string[];      // sample questions shown above the chat widget
  lat: number;
  lng: number;
  /** Optional flagship-demo fields (currently only Lily Pond). */
  featured?: boolean;
  story?: { headline: string; body: string; owner?: string; quote?: string };
  gallery?: { src: string; caption?: string }[];
  testimonials?: { name: string; role?: string; text: string; rating?: number }[];
  todaysSpecials?: { name: string; price: number; note?: string; emoji?: string }[];
  stats?: { label: string; value: string }[];
};

const LILY_POND_WHATSAPP =
  process.env.NEXT_PUBLIC_LILY_POND_WHATSAPP || "15556578220";
const LILY_POND_DISPLAY_PHONE =
  process.env.NEXT_PUBLIC_LILY_POND_DISPLAY_PHONE || "+1 555-657-8220";

export const CAFES: Cafe[] = [
  {
    slug: "lily-pond-cafe",
    name: "Lily Pond Café",
    tagline: "USIU's pondside hangout. Coffee that actually matters.",
    category: "Coffee · Brunch · Outdoor",
    hero_emoji: "☕",
    color: "#F59E0B",
    location: "Beside the Lily Pond",
    phone: LILY_POND_DISPLAY_PHONE,
    whatsapp: LILY_POND_WHATSAPP,
    email: "lilypond@gen-eat.app",
    mpesa_till: "522001",
    avg_prep_minutes: 8,
    hours: {
      mon: "07:00–21:00", tue: "07:00–21:00", wed: "07:00–21:00",
      thu: "07:00–21:00", fri: "07:00–21:00",
      sat: "09:00–18:00", sun: "closed",
    },
    hours_summary: "Mon–Fri 07:00–21:00 · Sat 09:00–18:00",
    tags: ["coffee", "brunch", "outdoor", "study"],
    features: ["Wi-Fi", "Outdoor seating", "Card + M-Pesa"],
    photo: "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=1200&auto=format&fit=crop",
    highlights: [
      "Single-origin Kenyan beans",
      "60 outdoor seats by the pond",
      "Pre-order, skip the queue",
    ],
    menuPreview: [
      { name: "Demo Espresso", price: 10, emoji: "☕", note: "Live pitch test item" },
      { name: "Flat White", price: 220, emoji: "☕", image: "https://images.unsplash.com/photo-1517256673644-36ad11246d21?w=400&auto=format&fit=crop&q=80" },
      { name: "Avocado Toast", price: 450, emoji: "🥑", image: "https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=400&auto=format&fit=crop&q=80" },
      { name: "Almond Croissant", price: 250, emoji: "🥐", image: "https://images.unsplash.com/photo-1623334044303-241021148842?w=400&auto=format&fit=crop&q=80" },
    ],
    menuFull: [
      {
        title: "Coffee",
        blurb: "Single-origin Kenyan beans, roasted weekly. Oat / almond +KES 40.",
        items: [
          { name: "Demo Espresso", price: 10, emoji: "☕", note: "Live demo order for WhatsApp + M-Pesa proof" },
          { name: "Espresso", price: 120, emoji: "☕", image: "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400&auto=format&fit=crop&q=80" },
          { name: "Flat White", price: 220, emoji: "☕", image: "https://images.unsplash.com/photo-1517256673644-36ad11246d21?w=400&auto=format&fit=crop&q=80" },
          { name: "Cold Brew", price: 250, emoji: "🧊", image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400&auto=format&fit=crop&q=80" },
          { name: "Pour-over · Nyeri AA", price: 320, emoji: "🫖", note: "Single-origin, served black", image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&auto=format&fit=crop&q=80" },
        ],
      },
      {
        title: "Breakfast · 07:00–11:30",
        items: [
          { name: "Avocado Toast on Sourdough", price: 450, emoji: "🥑", badges: ["V"], note: "Add poached egg +KES 80", image: "https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=400&auto=format&fit=crop&q=80" },
          { name: "Mandazi & Masala Chai", price: 230, emoji: "🫖", image: "https://images.unsplash.com/photo-1571069090147-fc0e84f9d8d2?w=400&auto=format&fit=crop&q=80" },
          { name: "Big Pond Plate", price: 620, emoji: "🍳", note: "Eggs, bacon, beans, toast, hash, tomato", image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&auto=format&fit=crop&q=80" },
          { name: "Coconut Granola Bowl", price: 380, emoji: "🥣", badges: ["vegan"], image: "https://images.unsplash.com/photo-1517022812141-23620dba5c23?w=400&auto=format&fit=crop&q=80" },
          { name: "Pancake Stack", price: 420, emoji: "🥞", note: "Banana, honey, butter", image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&auto=format&fit=crop&q=80" },
        ],
      },
      {
        title: "Lunch · 12:00–17:00",
        items: [
          { name: "Chicken Caesar Wrap", price: 480, emoji: "🌯", image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&auto=format&fit=crop&q=80" },
          { name: "Halloumi & Avo Bowl", price: 520, emoji: "🥗", badges: ["V"], note: "Quinoa, beetroot, tahini", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&auto=format&fit=crop&q=80" },
          { name: "Sukuma & Coconut Curry", price: 420, emoji: "🍛", badges: ["vegan", "GF"], image: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&auto=format&fit=crop&q=80" },
          { name: "Sweet Potato Fries", price: 250, emoji: "🍠", image: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=400&auto=format&fit=crop&q=80" },
        ],
      },
      {
        title: "Pastries · baked on-site",
        items: [
          { name: "Butter Croissant", price: 180, emoji: "🥐", image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&auto=format&fit=crop&q=80" },
          { name: "Pain au Chocolat", price: 220, emoji: "🍫", image: "https://images.unsplash.com/photo-1623334044303-241021148842?w=400&auto=format&fit=crop&q=80" },
          { name: "Almond Croissant", price: 250, emoji: "🥐", image: "https://images.unsplash.com/photo-1581375321224-79da6fd32f6e?w=400&auto=format&fit=crop&q=80" },
          { name: "Lemon Tart", price: 240, emoji: "🍋", image: "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&auto=format&fit=crop&q=80" },
        ],
      },
    ],
    askPrompts: [
      "Order the KES 10 demo espresso",
      "What's good for breakfast under KES 300?",
      "Do you have vegan options?",
      "Can I pre-order a flat white for 9am?",
    ],
    lat: -1.2196,
    lng: 36.8859,
    featured: true,
    story: {
      headline: "Roasted on campus. Run by students, for students.",
      body: "We started Lily Pond in 2022 with one espresso machine, a folding table, and a bet that USIU deserved better than instant coffee between lectures. Today we roast our beans weekly from farms in Nyeri and Kirinyaga, bake every croissant on-site at 5am, and seat 60 people around the pond. Two scholarships funded last semester — every cup counts.",
      owner: "Wanjiku & Brian · co-founders",
      quote: "If your lecturer overruns by 3 minutes, your latte's still hot. That's the promise.",
    },
    gallery: [
      { src: "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=1200&auto=format&fit=crop&q=80", caption: "Outdoor seating by the pond" },
      { src: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1200&auto=format&fit=crop&q=80", caption: "Latte art from our espresso bar" },
      { src: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&auto=format&fit=crop&q=80", caption: "Roasting Nyeri AA beans, Tuesdays" },
      { src: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=1200&auto=format&fit=crop&q=80", caption: "Pastries out of the oven, 06:45" },
    ],
    testimonials: [
      { name: "Achieng O.", role: "4th yr · IBA", text: "Pre-ordered before my 8am — coffee was on the shelf when I walked in. Game changer.", rating: 5 },
      { name: "David K.", role: "2nd yr · IT", text: "The almond croissant is unreasonably good. WhatsApp ordering means I never queue.", rating: 5 },
      { name: "Prof. M.", role: "Faculty", text: "Reliable, fast, and the staff actually remember your order. The campus needed this.", rating: 5 },
    ],
    todaysSpecials: [
      { name: "Demo Espresso", price: 10, note: "Live proof item for WhatsApp + M-Pesa STK", emoji: "☕" },
      { name: "Pour-over flight of 3", price: 540, note: "Nyeri AA · Kirinyaga PB · Mt Kenya washed", emoji: "🫖" },
      { name: "Avo Toast + Flat White combo", price: 599, note: "Save KES 71 — until 11:30", emoji: "🥑" },
    ],
    stats: [
      { label: "avg pickup time", value: "8 min" },
      { label: "orders this week", value: "1,240+" },
      { label: "5-star reviews", value: "97%" },
      { label: "on M-Pesa", value: "Till 522001" },
    ],
  },
  {
    slug: "library-bites",
    name: "Library Bites",
    tagline: "Order in 30 seconds. Pick up between classes.",
    category: "Grab & Go · Snacks · Coffee",
    hero_emoji: "🥪",
    color: "#10B981",
    location: "Ground floor, USIU Library",
    phone: "+254 700 910 002",
    whatsapp: "254700910002",
    email: "library@gen-eat.app",
    mpesa_till: "522002",
    avg_prep_minutes: 3,
    hours: {
      mon: "06:30–22:00", tue: "06:30–22:00", wed: "06:30–22:00",
      thu: "06:30–22:00", fri: "06:30–22:00",
      sat: "08:00–20:00", sun: "10:00–18:00",
    },
    hours_summary: "Mon–Fri 06:30–22:00 · Sat–Sun 08:00–20:00",
    tags: ["fast", "snacks", "exam-fuel"],
    features: ["M-Pesa only", "3-min prep", "24h during exam week"],
    photo: "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=1200&auto=format&fit=crop",
    highlights: [
      "Average prep: 3 minutes",
      "WhatsApp ordering keeps the library quiet",
      "Brain-Fuel Box KES 350 during exams",
    ],
    menuPreview: [
      { name: "Brain Fuel Box", price: 350, emoji: "🧠", image: "https://images.unsplash.com/photo-1565299543923-37dd37887442?w=400&auto=format&fit=crop&q=80" },
      { name: "Chicken Mayo Sandwich", price: 280, emoji: "🥪", image: "https://images.unsplash.com/photo-1528736235302-52922df5c122?w=400&auto=format&fit=crop&q=80" },
      { name: "Latte", price: 180, emoji: "☕", image: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400&auto=format&fit=crop&q=80" },
      { name: "Energy Drink", price: 200, emoji: "⚡", image: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=400&auto=format&fit=crop&q=80" },
    ],
    menuFull: [
      {
        title: "Grab-and-Go Meals",
        blurb: "Prepped fresh every morning. Take it, pay, leave in 30 seconds.",
        items: [
          { name: "Chicken Mayo Sandwich", price: 280, emoji: "🥪", image: "https://images.unsplash.com/photo-1528736235302-52922df5c122?w=400&auto=format&fit=crop&q=80" },
          { name: "Veggie Wrap", price: 240, emoji: "🌯", badges: ["V"], image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&auto=format&fit=crop&q=80" },
          { name: "Tuna Crunch Baguette", price: 320, emoji: "🥖", image: "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&auto=format&fit=crop&q=80" },
          { name: "Cheese & Tomato Toastie", price: 220, emoji: "🧀", image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&auto=format&fit=crop&q=80" },
          { name: "Beef Samosa (2)", price: 180, emoji: "🥟", image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80" },
          { name: "Egg Mayo Wrap", price: 220, emoji: "🍳", image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&auto=format&fit=crop&q=80" },
        ],
      },
      {
        title: "Drinks · espresso bar + chiller",
        items: [
          { name: "Latte", price: 180, emoji: "☕", image: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400&auto=format&fit=crop&q=80" },
          { name: "Black Coffee", price: 120, emoji: "☕", image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&auto=format&fit=crop&q=80" },
          { name: "Energy Drink", price: 200, emoji: "⚡", image: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=400&auto=format&fit=crop&q=80" },
          { name: "Del Monte Juice", price: 120, emoji: "🧃", image: "https://images.unsplash.com/photo-1546173159-315724a31696?w=400&auto=format&fit=crop&q=80" },
        ],
      },
      {
        title: "Exam-Week Specials",
        blurb: "USIU ID + weekday 10–14:00 / 18–22:00 during exam weeks.",
        items: [
          { name: "Brain Fuel Box", price: 350, emoji: "🧠", note: "Wrap + fruit + water + bar", badges: ["new"], image: "https://images.unsplash.com/photo-1565299543923-37dd37887442?w=400&auto=format&fit=crop&q=80" },
          { name: "Power-Hour Combo", price: 250, emoji: "🔋", note: "Any coffee + any sandwich", image: "https://images.unsplash.com/photo-1481070555726-e2fe8357725c?w=400&auto=format&fit=crop&q=80" },
        ],
      },
    ],
    askPrompts: [
      "What's the fastest hot drink right now?",
      "Show me the brain fuel box",
      "Are samosas still warm?",
      "Cheapest combo under KES 300?",
    ],
    lat: -1.2199,
    lng: 36.8853,
  },
  {
    slug: "pavilion-grill",
    name: "Pavilion Grill",
    tagline: "Real grill on campus. Bring your appetite.",
    category: "Burgers · Grill · Lunch",
    hero_emoji: "🍔",
    color: "#EF4444",
    location: "Pavilion, USIU main lawn",
    phone: "+254 700 910 003",
    whatsapp: "254700910003",
    email: "pavilion@gen-eat.app",
    mpesa_till: "522003",
    avg_prep_minutes: 15,
    hours: {
      mon: "11:00–22:00", tue: "11:00–22:00", wed: "11:00–22:00",
      thu: "11:00–22:00", fri: "11:00–23:00",
      sat: "11:00–23:00", sun: "12:00–20:00",
    },
    hours_summary: "Mon–Sat 11:00–22:00 · Sun 12:00–20:00",
    tags: ["burgers", "grill", "group-orders"],
    features: ["Group orders", "Delivery to dorms", "Halal grill"],
    photo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&auto=format&fit=crop",
    highlights: [
      "Group orders split on one M-Pesa link",
      "Free delivery to dorms above KES 800",
      "Grass-fed, halal-certified Ngong beef",
    ],
    menuPreview: [
      { name: "Pavilion Classic Burger", price: 580, emoji: "🍔", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80" },
      { name: "Double Smash", price: 780, emoji: "🍔", image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&auto=format&fit=crop&q=80" },
      { name: "Nyama Choma Platter", price: 880, emoji: "🥩", image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop&q=80" },
      { name: "Chicken Tikka Burger", price: 550, emoji: "🍗", image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&auto=format&fit=crop&q=80" },
    ],
    menuFull: [
      {
        title: "Burgers",
        blurb: "All beef grass-fed from Ngong farms. Halal-certified. Comes with hand-cut fries.",
        items: [
          { name: "Pavilion Classic", price: 580, emoji: "🍔", note: "150g beef, cheddar, lettuce, tomato, brioche", badges: ["halal"], image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80" },
          { name: "Double Smash", price: 780, emoji: "🍔", note: "2× 100g smashed patties, American cheese, pickles", badges: ["halal"], image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&auto=format&fit=crop&q=80" },
          { name: "Chicken Tikka Burger", price: 550, emoji: "🍗", note: "Marinated, mint-yogurt, brioche", badges: ["halal"], image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&auto=format&fit=crop&q=80" },
          { name: "Mushroom & Halloumi", price: 520, emoji: "🍄", badges: ["V"], image: "https://images.unsplash.com/photo-1525059696034-4fc25a86c1a8?w=400&auto=format&fit=crop&q=80" },
          { name: "Black-Bean Burger", price: 480, emoji: "🌱", badges: ["vegan"], image: "https://images.unsplash.com/photo-1610614819513-58e34989848b?w=400&auto=format&fit=crop&q=80" },
        ],
      },
      {
        title: "Grill Plates · from 12:00",
        items: [
          { name: "Chicken Skewers (3)", price: 620, emoji: "🍢", note: "Coriander-lime marinade, rice + salad", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80" },
          { name: "Nyama Choma Platter", price: 880, emoji: "🥩", note: "Goat ribs, ugali, kachumbari, sukuma", badges: ["halal"], image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop&q=80" },
          { name: "Tilapia Grilled Whole", price: 750, emoji: "🐟", note: "Chips or ugali + kachumbari", image: "https://images.unsplash.com/photo-1535399831218-d4db1f8b4c75?w=400&auto=format&fit=crop&q=80" },
          { name: "Beef Ribs · half-rack", price: 1150, emoji: "🍖", badges: ["halal"], image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop&q=80" },
        ],
      },
      {
        title: "Sides & Shakes",
        items: [
          { name: "Loaded Cheese Fries", price: 280, emoji: "🍟", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&auto=format&fit=crop&q=80" },
          { name: "Onion Rings", price: 220, emoji: "🧅", image: "https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&auto=format&fit=crop&q=80" },
          { name: "Peanut-Butter Shake", price: 320, emoji: "🥤", image: "https://images.unsplash.com/photo-1577805947697-89e18249d767?w=400&auto=format&fit=crop&q=80" },
          { name: "Hibiscus Cooler", price: 280, emoji: "🌺", note: "Mocktail · alcohol-free", image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&auto=format&fit=crop&q=80" },
        ],
      },
    ],
    askPrompts: [
      "Group order for 6, delivered to dorm B?",
      "How spicy is the Tikka burger?",
      "Halal certified meat?",
      "Reserve a table for 8 at 7pm",
    ],
    lat: -1.2193,
    lng: 36.8862,
  },
  {
    slug: "block-a-express",
    name: "Block A Express",
    tagline: "Coffee + pastries · between every class.",
    category: "Coffee · Pastries",
    hero_emoji: "🥐",
    color: "#8B5CF6",
    location: "Block A entrance",
    phone: "+254 700 910 004",
    whatsapp: "254700910004",
    email: "blocka@gen-eat.app",
    mpesa_till: "522004",
    avg_prep_minutes: 4,
    hours: {
      mon: "06:45–19:00", tue: "06:45–19:00", wed: "06:45–19:00",
      thu: "06:45–19:00", fri: "06:45–19:00",
      sat: "08:00–14:00", sun: "closed",
    },
    hours_summary: "Mon–Fri 06:45–19:00 · Sat 08:00–14:00",
    tags: ["coffee", "pastries", "fast"],
    features: ["M-Pesa only", "Loyalty card", "Bring-your-cup discount"],
    photo: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=1200&auto=format&fit=crop",
    highlights: [
      "Order before you leave class",
      "Loyalty: 10 drinks → 11th free",
      "KES 25 off with your own cup",
    ],
    menuPreview: [
      { name: "Double Espresso", price: 160, emoji: "☕", image: "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400&auto=format&fit=crop&q=80" },
      { name: "Cappuccino", price: 200, emoji: "☕", image: "https://images.unsplash.com/photo-1572286258217-215cf8e7ea5a?w=400&auto=format&fit=crop&q=80" },
      { name: "Cinnamon Roll", price: 220, emoji: "🥯", image: "https://images.unsplash.com/photo-1559620192-032c4bc4674e?w=400&auto=format&fit=crop&q=80" },
      { name: "Pain au Chocolat", price: 200, emoji: "🍫", image: "https://images.unsplash.com/photo-1623334044303-241021148842?w=400&auto=format&fit=crop&q=80" },
    ],
    menuFull: [
      {
        title: "Coffee & Tea ⚡",
        blurb: "Fast, hot, dependable. Oat / almond +KES 30.",
        items: [
          { name: "Espresso", price: 100, emoji: "☕", image: "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400&auto=format&fit=crop&q=80" },
          { name: "Americano", price: 130, emoji: "☕", image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&auto=format&fit=crop&q=80" },
          { name: "Cappuccino", price: 200, emoji: "☕", image: "https://images.unsplash.com/photo-1572286258217-215cf8e7ea5a?w=400&auto=format&fit=crop&q=80" },
          { name: "Flat White", price: 200, emoji: "☕", image: "https://images.unsplash.com/photo-1517256673644-36ad11246d21?w=400&auto=format&fit=crop&q=80" },
          { name: "Chai Latte", price: 200, emoji: "🫖", image: "https://images.unsplash.com/photo-1571069090147-fc0e84f9d8d2?w=400&auto=format&fit=crop&q=80" },
          { name: "Hot Chocolate", price: 220, emoji: "🍫", image: "https://images.unsplash.com/photo-1542990253-0b8be3a9e6f7?w=400&auto=format&fit=crop&q=80" },
        ],
      },
      {
        title: "Pastries · from our Lily Pond bakery",
        items: [
          { name: "Butter Croissant", price: 150, emoji: "🥐", image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&auto=format&fit=crop&q=80" },
          { name: "Pain au Chocolat", price: 200, emoji: "🍫", image: "https://images.unsplash.com/photo-1623334044303-241021148842?w=400&auto=format&fit=crop&q=80" },
          { name: "Almond Croissant", price: 220, emoji: "🥐", image: "https://images.unsplash.com/photo-1581375321224-79da6fd32f6e?w=400&auto=format&fit=crop&q=80" },
          { name: "Cinnamon Roll", price: 220, emoji: "🥯", image: "https://images.unsplash.com/photo-1559620192-032c4bc4674e?w=400&auto=format&fit=crop&q=80" },
          { name: "Cheese-and-Ham Twist", price: 180, emoji: "🥨", image: "https://images.unsplash.com/photo-1568827999250-3f6afff96e66?w=400&auto=format&fit=crop&q=80" },
          { name: "Dark Chocolate Brownie", price: 180, emoji: "🍫", image: "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&auto=format&fit=crop&q=80" },
        ],
      },
      {
        title: "Quick Bites · counter all day",
        items: [
          { name: "Cheese-Tomato Toastie", price: 200, emoji: "🧀", image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&auto=format&fit=crop&q=80" },
          { name: "Ham & Cheese Croissant", price: 240, emoji: "🥐", image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&auto=format&fit=crop&q=80" },
          { name: "Yogurt Parfait", price: 280, emoji: "🥣", badges: ["V"], image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&auto=format&fit=crop&q=80" },
          { name: "Fruit Cup", price: 180, emoji: "🍓", badges: ["vegan", "GF"], image: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=400&auto=format&fit=crop&q=80" },
        ],
      },
    ],
    askPrompts: [
      "Coffee + croissant under KES 350?",
      "How long is the queue now?",
      "Can I order before class ends?",
      "Loyalty card — how do I start?",
    ],
    lat: -1.2197,
    lng: 36.8856,
  },
];

export function getCafe(slug: string): Cafe | undefined {
  return CAFES.find((c) => c.slug === slug);
}

// ── Hours / open-now logic ─────────────────────────────────────────────

const DAYS: (keyof Cafe["hours"])[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function isOpenNow(c: Cafe, now: Date = new Date()): boolean {
  const day = DAYS[now.getDay()];
  const range = c.hours[day];
  if (!range || range === "closed") return false;
  const [start, end] = range.split("–");
  if (!start || !end) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= toMin(start) && mins <= toMin(end);
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}
