import Image from "next/image";
import Link from "next/link";
import { BRAND, BRAND_IMAGES, DELIVERY_ZONES, GIFT_BOXES } from "@/lib/products";
import { formatKES, whatsappLink } from "@/lib/format";
import { ChatWidget } from "@/components/ChatWidget";
import { ProductImage } from "@/components/ProductImage";

export default function HomePage() {
  const wa = whatsappLink(BRAND.whatsapp, "Hello Hazina Nomads — I'd like help choosing a gift box.");
  const heroBox = GIFT_BOXES[0];
  return (
    <>
      <section className="grid md:grid-cols-2 gap-10 items-center pb-16 md:pb-24">
        <div className="space-y-6">
          <span className="chip-mute">Nairobi · Hotel &amp; JKIA delivery</span>
          <h1 className="h-display text-5xl md:text-7xl leading-[0.95]">
            Curated treasures<br />
            <span className="text-brand">for the modern nomad.</span>
          </h1>
          <p className="text-lg text-ink-soft max-w-lg">
            Premium Kenyan gift boxes, concierge-delivered to your hotel room or
            JKIA terminal before you fly home. One WhatsApp chat — no souvenir-shop stress.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Chat with concierge →
            </a>
            <Link href="/collections" className="btn-ghost">Browse collections</Link>
          </div>
          <p className="text-xs text-ink-mute -mt-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 align-middle animate-pulse" />
            AI concierge online · M-Pesa &amp; card accepted
          </p>
          <div className="flex items-center gap-6 pt-3 text-sm text-ink-mute">
            <div>
              <div className="h-display text-2xl text-ink">5</div>
              curated boxes
            </div>
            <div>
              <div className="h-display text-2xl text-ink">4h</div>
              JKIA express
            </div>
            <div>
              <div className="h-display text-2xl text-ink">M-Pesa</div>
              &amp; USD cards
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -top-6 -right-2 rotate-3 chip-ok text-sm z-10">JKIA ready</div>
          <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-pop">
            <Image
              src={heroBox.image}
              alt={heroBox.imageAlt}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 480px"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
          </div>
          <div className="card p-4 max-w-sm ml-auto -mt-8 relative z-10 mx-4 md:mx-6">
            <div className="flex items-center gap-3 pb-3 border-b border-ink/5">
              <div className="w-10 h-10 rounded-2xl bg-brand-light flex items-center justify-center text-xl">🎁</div>
              <div className="leading-tight">
                <div className="h-display text-base">Hazina Nomads</div>
                <div className="text-[11px] text-ink-mute">concierge · typically replies in seconds</div>
              </div>
            </div>
            <div className="space-y-2 py-3">
              <Outgoing>I'm at Hemingways Karen — need a gift box before my flight tomorrow 6pm</Outgoing>
              <Incoming>
                Welcome. The Kenya Edit is our signature — KES 11,500, delivered to
                your room by noon. May I confirm your room number and departure terminal?
              </Incoming>
            </div>
            <div className="pt-2 border-t border-ink/5 text-xs text-ink-mute flex items-center justify-between">
              <span>Live AI · 08:00–20:00 EAT</span>
              <span className="text-brand font-semibold">WhatsApp concierge →</span>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="card p-8 md:p-12 mb-20">
        <h2 className="h-display text-3xl md:text-4xl mb-2">How it works</h2>
        <p className="text-ink-soft mb-8 max-w-2xl">
          No app to download. Your hotel concierge experience, on WhatsApp.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <Step n={1} title="Choose a collection" body="Browse five curated gift boxes — from safari keepsakes to last-minute JKIA departures." />
          <Step n={2} title="Confirm delivery" body="Tell us your hotel and room, or JKIA terminal and departure time. We handle the rest." />
          <Step n={3} title="Pay & receive" body="M-Pesa STK or USD card link. Your box arrives beautifully packaged, on time." />
        </div>
      </section>

      <section className="pb-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="h-display text-3xl md:text-4xl">The collections</h2>
            <p className="text-ink-mute">Five boxes. No custom orders at launch — pure curation.</p>
          </div>
          <Link href="/collections" className="text-sm font-semibold text-brand hidden md:inline">
            See all →
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {GIFT_BOXES.slice(0, 3).map((box) => (
            <GiftCard key={box.id} box={box} />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-5 mt-5">
          {GIFT_BOXES.slice(3).map((box) => (
            <GiftCard key={box.id} box={box} />
          ))}
        </div>
      </section>

      <section className="my-16 relative rounded-3xl overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={BRAND_IMAGES.safariSunset}
            alt="Kenyan safari landscape at sunset with acacia trees"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-ink/75" />
        </div>
        <div className="relative p-8 md:p-12 grid md:grid-cols-[2fr,1fr] gap-8 items-center text-cream">
          <div>
            <h2 className="h-display text-3xl md:text-4xl mb-3">
              Flying from JKIA? <span className="text-brand-light">We&apos;ve got you.</span>
            </h2>
            <p className="text-cream/80 max-w-xl">
              The Departure Drop ships in 4 hours to any JKIA terminal.
              Westlands, Kilimani, Karen hotel delivery also available.
            </p>
            <p className="text-xs text-cream/60 mt-3">
              Zones: {DELIVERY_ZONES.join(" · ")}
            </p>
          </div>
          <Link href="/last-minute-kenya-gifts-jkia" className="btn-primary justify-self-start md:justify-self-end">
            JKIA last-minute →
          </Link>
        </div>
      </section>

      <ChatWidget />
    </>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="space-y-2">
      <div className="w-10 h-10 rounded-2xl bg-brand-light text-brand-dark flex items-center justify-center h-display text-lg">
        {n}
      </div>
      <h3 className="h-display text-xl">{title}</h3>
      <p className="text-ink-soft text-sm">{body}</p>
    </div>
  );
}

function GiftCard({ box }: { box: (typeof GIFT_BOXES)[number] }) {
  const wa = whatsappLink(BRAND.whatsapp, `Hi — I'm interested in ${box.name}`);
  return (
    <div className="card p-0 flex flex-col overflow-hidden">
      <ProductImage box={box} className="rounded-none aspect-[16/10]" />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="h-display text-xl">{box.name}</h3>
          {box.jkia_only && <span className="chip-ok text-[10px] shrink-0">JKIA express</span>}
        </div>
        <p className="text-sm text-ink-mute line-clamp-2">{box.contents}</p>
        <div className="flex items-center justify-between mt-auto pt-2">
          <div className="text-sm">
            <span className="font-semibold">{formatKES(box.price_kes)}</span>
            <span className="text-ink-mute ml-2">USD {box.price_usd}</span>
          </div>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand hover:underline">
            Order →
          </a>
        </div>
      </div>
    </div>
  );
}

function Outgoing({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="bg-brand text-white text-sm px-3 py-2 rounded-2xl rounded-br-md max-w-[80%]">
        {children}
      </div>
    </div>
  );
}
function Incoming({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-ink/5 text-ink text-sm px-3 py-2 rounded-2xl rounded-bl-md max-w-[85%]">
        {children}
      </div>
    </div>
  );
}
