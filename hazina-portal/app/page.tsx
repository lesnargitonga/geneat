import Image from "next/image";
import Link from "next/link";
import { BRAND, BRAND_IMAGES, DELIVERY_ZONES, GIFT_BOXES } from "@/lib/products";
import { TREASURES } from "@/lib/treasures";
import { formatKES, whatsappLink } from "@/lib/format";
import { ChatWidget } from "@/components/ChatWidget";
import { CollectionCard } from "@/components/CollectionCard";
import { TreasureCard } from "@/components/TreasureCard";

export default function HomePage() {
  const wa = whatsappLink(BRAND.whatsapp, "Hello Hazina Nomads — I'd like help choosing a gift box.");
  const heroBox = GIFT_BOXES[0];

  return (
    <>
      {/* Hero */}
      <section className="container-page pt-10 md:pt-16 pb-16 md:pb-24">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div className="space-y-8">
            <span className="label-mono">Nairobi · Hotel &amp; JKIA delivery</span>
            <h1 className="h-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] text-obsidian">
              Curated treasures
              <br />
              <span className="italic text-bronze">for the modern nomad.</span>
            </h1>
            <p className="text-lg text-ink-mute max-w-lg leading-relaxed">
              Premium Kenyan gift boxes, hand-delivered to your hotel suite or
              JKIA terminal. One discreet WhatsApp exchange — no market crowds,
              no last-minute compromise.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-dark">
                Speak with concierge
              </a>
              <Link href="/build" className="btn-outline">
                Build your box
              </Link>
            </div>
            <div className="flex items-center gap-10 pt-2">
              <Stat value={String(TREASURES.length)} label="individual treasures" />
              <Stat value="5" label="curated collections" />
              <Stat value="M-Pesa" label="USD cards" />
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden shadow-editorial">
              <Image
                src={heroBox.image}
                alt={heroBox.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 480px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-obsidian/70 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <p className="font-serif text-2xl text-sand">{heroBox.name}</p>
                <p className="font-mono text-xs text-sand/70 mt-1">{formatKES(heroBox.price_kes)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — dark section */}
      <section className="section-dark py-20 md:py-28">
        <div className="container-page">
          <div className="max-w-xl mb-14">
            <span className="label-mono text-sand/40">The experience</span>
            <h2 className="h-display text-4xl md:text-5xl mt-3 text-sand">How we serve you</h2>
            <p className="text-sand/60 mt-4 leading-relaxed">
              No app to download. A calm, high-end concierge exchange — entirely on WhatsApp.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-10 md:gap-12">
            <Step
              n="01"
              title="Browse or build"
              body="Choose a curated collection, explore individual treasures, or compose your own box from our atelier."
            />
            <Step
              n="02"
              title="Confirm your coordinates"
              body="Share your hotel and room, or JKIA terminal and departure time. We orchestrate the rest."
            />
            <Step
              n="03"
              title="Receive with ease"
              body="M-Pesa or USD card. Your box arrives beautifully packaged, precisely on schedule."
            />
          </div>
        </div>
      </section>

      {/* Treasures atelier preview — editorial, not catalog grid */}
      <section className="container-page py-20 md:py-28 border-t border-border">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-end mb-14">
          <div className="lg:col-span-7">
            <span className="label-mono">The atelier</span>
            <h2 className="h-display text-4xl md:text-6xl mt-3 text-obsidian leading-[0.95]">
              Compose from {TREASURES.length} treasures
            </h2>
          </div>
          <div className="lg:col-span-5 space-y-5">
            <p className="text-ink-mute leading-relaxed">
              Real photography from our sourcing runs — not stock imagery. Inspect each piece,
              then build a box that reflects your journey.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/treasures" className="btn-outline">
                Browse atelier
              </Link>
              <Link href="/build" className="btn-dark">
                Build your box
              </Link>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-12 gap-6 md:gap-8">
          <div className="md:col-span-7">
            <TreasureCard item={TREASURES[0]} featured priority />
          </div>
          <div className="md:col-span-5 flex flex-col gap-6 md:gap-8 md:pt-16">
            <TreasureCard item={TREASURES[4]} compact />
            <TreasureCard item={TREASURES[6]} compact />
          </div>
          <div className="md:col-span-4">
            <TreasureCard item={TREASURES[9]} compact />
          </div>
          <div className="md:col-span-4">
            <TreasureCard item={TREASURES[14]} compact />
          </div>
          <div className="md:col-span-4">
            <TreasureCard item={TREASURES[18]} compact />
          </div>
        </div>
      </section>

      {/* Collections preview */}
      <section className="container-page py-20 md:py-28">
        <div className="flex items-end justify-between mb-12 md:mb-16">
          <div>
            <span className="label-mono">The edit</span>
            <h2 className="h-display text-4xl md:text-5xl mt-2 text-obsidian">Collections</h2>
            <p className="text-ink-mute mt-3 max-w-md">
              Signature assemblies — tap to see what&apos;s inside, or swap items via concierge.
            </p>
          </div>
          <Link
            href="/collections"
            className="hidden md:inline font-mono text-[10px] uppercase tracking-editorial text-bronze hover:text-bronze-dark transition-colors"
          >
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-12 gap-x-6 gap-y-16">
          <div className="col-span-12 lg:col-span-7">
            <CollectionCard box={GIFT_BOXES[0]} priority />
          </div>
          <div className="col-span-12 lg:col-span-5 lg:mt-20">
            <CollectionCard box={GIFT_BOXES[1]} />
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-5">
            <CollectionCard box={GIFT_BOXES[2]} />
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-7 lg:-mt-10">
            <CollectionCard box={GIFT_BOXES[3]} />
          </div>
        </div>

        <div className="mt-12 text-center md:hidden">
          <Link href="/collections" className="btn-outline">
            View all collections
          </Link>
        </div>
      </section>

      {/* JKIA CTA — dark with photography */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={BRAND_IMAGES.safariSunset}
            alt="Kenyan safari landscape at sunset with acacia trees"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-obsidian/80" />
        </div>
        <div className="relative container-page py-20 md:py-28 grid md:grid-cols-[2fr,1fr] gap-10 items-end">
          <div>
            <span className="label-mono text-sand/40">Departure service</span>
            <h2 className="h-display text-4xl md:text-5xl mt-3 text-sand leading-tight">
              Flying from JKIA?
              <br />
              <span className="italic text-bronze-light">We intercept your departure.</span>
            </h2>
            <p className="text-sand/70 max-w-xl mt-5 leading-relaxed">
              The Departure Drop ships in four hours to any JKIA terminal.
              Hotel delivery to Westlands, Kilimani, and Karen also available.
            </p>
            <p className="label-mono text-sand/40 mt-4">
              {DELIVERY_ZONES.join(" · ")}
            </p>
          </div>
          <Link href="/last-minute-kenya-gifts-jkia" className="btn-outline border-sand/30 text-sand hover:bg-sand hover:text-obsidian md:justify-self-end">
            JKIA departure service
          </Link>
        </div>
      </section>

      {/* Concierge whisper */}
      <section className="container-page py-20 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="relative aspect-[4/3] overflow-hidden shadow-soft">
            <Image
              src={BRAND_IMAGES.heroBg}
              alt="Artisan hands crafting Kenyan treasures"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <div className="space-y-6">
            <span className="label-mono">WhatsApp concierge</span>
            <h2 className="h-display text-3xl md:text-4xl text-obsidian">
              A single conversation.<br />
              <span className="italic text-bronze">Everything arranged.</span>
            </h2>
            <div className="space-y-4 border-l-2 border-obsidian pl-6">
              <ConciergeLine role="guest">
                I&apos;m at Hemingways Karen — need a gift before my flight tomorrow at 6pm.
              </ConciergeLine>
              <ConciergeLine role="concierge">
                Welcome. The Kenya Edit is our signature — KES 11,500, delivered to
                your room by noon. May I confirm your room number and departure terminal?
              </ConciergeLine>
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-dark">
              Begin conversation
            </a>
          </div>
        </div>
      </section>

      <ChatWidget />
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-serif text-2xl text-obsidian">{value}</div>
      <div className="label-mono mt-0.5">{label}</div>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="space-y-4">
      <span className="font-mono text-xs text-bronze-light">{n}</span>
      <h3 className="font-serif text-2xl text-sand">{title}</h3>
      <p className="text-sand/60 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function ConciergeLine({ role, children }: { role: "guest" | "concierge"; children: React.ReactNode }) {
  const isGuest = role === "guest";
  return (
    <p className={`text-sm leading-relaxed ${isGuest ? "text-ink-mute italic" : "text-obsidian"}`}>
      {isGuest ? "— Guest" : "— Concierge"}: {children}
    </p>
  );
}
