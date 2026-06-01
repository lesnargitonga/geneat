import Image from "next/image";
import Link from "next/link";
import { CatalogImage } from "@/components/CatalogImage";
import { ChatWidget } from "@/components/ChatWidget";
import { CollectionCard } from "@/components/CollectionCard";
import { ConciergePromptButton } from "@/components/ConciergePromptButton";
import { BRAND, BRAND_IMAGES, GIFT_BOXES } from "@/lib/products";
import { getTreasure } from "@/lib/treasures";
import { formatDualPrice, whatsappLink } from "@/lib/format";

export default function HomePage() {
  const wa = whatsappLink(BRAND.whatsapp, "Hello Hazina Nomads — I'd like help choosing a gift box.");
  const atelierHighlights = ["leather-passport", "maasai-necklace", "african-wall-art"]
    .map((id) => getTreasure(id))
    .filter(Boolean);

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={BRAND_IMAGES.safariSunset}
            alt="Serene Kenyan safari landscape at sunset"
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.38)_42%,rgba(14,13,12,0.86)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_45%,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.42)_62%,rgba(0,0,0,0.76)_100%)]" />
        </div>

        <div className="relative container-page min-h-[86svh] py-16 md:py-24 flex flex-col justify-between gap-12">
          <div className="max-w-4xl pt-8 md:pt-16">
            <span className="font-mono text-sm font-medium uppercase tracking-[0.12em] text-white/70">Nairobi hotel delivery · JKIA handoff · DHL export quotes</span>
            <h1 className="mt-5 font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.92] tracking-tight text-white">
              Treasures, delivered to your journey.
            </h1>
            <p className="mt-6 max-w-2xl text-lg md:text-xl leading-relaxed text-white/85">
              Premium Kenyan gift collections for travellers who want something more considered than a souvenir run.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/collections" className="btn-bronze">
                View collections
              </Link>
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline border-white/60 text-white hover:bg-white hover:text-black"
              >
                Order on WhatsApp
              </a>
            </div>
          </div>

          <div className="grid gap-5 border-t border-white/20 pt-6 text-white/80 sm:grid-cols-3 md:max-w-4xl">
            <HeroNote title="Hotel delivery" body="Westlands · Kilimani · Karen" />
            <HeroNote title="JKIA handoff" body="Terminal-aware departure gifts" />
            <HeroNote title="DHL export" body="Insured quotes before payment" />
          </div>
        </div>
      </section>

      <section className="container-page py-16 md:py-24 border-b border-border">
        <div className="grid gap-8 lg:grid-cols-[0.9fr,1.1fr] lg:items-end mb-12">
          <div>
            <span className="label-mono">Five signature collections</span>
            <h2 className="h-display mt-3 text-4xl md:text-6xl leading-[0.96]">
              Choose the box.
              <br />
              We handle the handoff.
            </h2>
          </div>
          <p className="text-base md:text-lg text-ink-mute leading-relaxed max-w-xl lg:justify-self-end">
            USD and KES are both visible from the start. Guests can checkout in-app,
            continue on WhatsApp, or request an insured DHL export quote.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {GIFT_BOXES.map((box, index) => (
            <CollectionCard key={box.id} box={box} priority={index < 2} />
          ))}
        </div>
      </section>

      <section className="section-dark py-16 md:py-24">
        <div className="container-page grid gap-8 md:grid-cols-3">
          <ServiceTile
            n="01"
            title="Hotel delivery"
            body="Westlands, Kilimani, and Karen deliveries coordinated with the guest or front desk."
          />
          <ServiceTile
            n="02"
            title="JKIA handoff"
            body="Terminal-aware departure drops for guests who remember gifting at the last minute."
          />
          <ServiceTile
            n="03"
            title="DHL export"
            body="For missed flights or overseas orders, we collect address details and quote insured courier before payment."
          />
        </div>
      </section>

      <section className="container-page py-16 md:py-24">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-5">
            <span className="label-mono">Build a custom box</span>
            <h2 className="h-display text-4xl md:text-5xl leading-tight">
              Pick only what belongs in the gift.
            </h2>
            <p className="text-ink-mute leading-relaxed">
              Select individual treasures, set quantities, add packaging, then checkout through the in-app concierge.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/build" className="btn-dark">
                Build your box
              </Link>
              <ConciergePromptButton
                prompt="Hello Hazina Nomads — I want help building a custom gift box."
                className="btn-outline"
              >
                Ask concierge
              </ConciergePromptButton>
            </div>
          </div>

          <div className="lg:col-span-7 grid gap-5 sm:grid-cols-3">
            {atelierHighlights.map((item) => (
              <Link
                key={item!.id}
                href={`/treasures/${item!.id}`}
                className="card-luxury overflow-hidden group"
              >
                <CatalogImage
                  src={item!.image}
                  alt={item!.imageAlt || item!.name}
                  className="aspect-[4/5]"
                  imageClassName="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 100vw, 260px"
                />
                <div className="p-4">
                  <p className="font-serif text-xl text-obsidian leading-tight">{item!.name}</p>
                  <p className="mt-2 font-mono text-sm text-bronze">{formatDualPrice(item!.price_usd, item!.price_kes)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={BRAND_IMAGES.atelierRoom}
            alt="African decor room filled with cultural craft pieces"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/72" />
        </div>
        <div className="relative container-page py-16 md:py-24 grid gap-8 md:grid-cols-[1.4fr,0.8fr] md:items-end">
          <div>
            <span className="font-mono text-sm font-medium uppercase tracking-[0.12em] text-white/60">Concierge, not a catalogue dump</span>
            <h2 className="font-serif text-4xl md:text-6xl leading-tight text-white">
              A premium order should feel handled.
            </h2>
            <p className="mt-5 max-w-2xl text-white/78 leading-relaxed">
              Use the in-app chat for guided help, or move to WhatsApp when you want the handoff saved in your travel thread.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <ConciergePromptButton
              prompt="Hello Hazina Nomads — I need concierge help with delivery timing and payment."
              className="btn-bronze"
            >
              Chat in app
            </ConciergePromptButton>
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline border-white/60 text-white hover:bg-white hover:text-black"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      <ChatWidget />
    </>
  );
}

function ServiceTile({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="min-h-[180px] border border-sand/15 p-5 md:p-6 local-scroll">
      <span className="font-mono text-sm text-bronze-light">{n}</span>
      <h3 className="mt-4 font-serif text-2xl md:text-3xl text-sand leading-tight">{title}</h3>
      <p className="mt-3 text-sand/70 text-base leading-relaxed">{body}</p>
    </div>
  );
}

function HeroNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="sm:border-l sm:border-white/20 sm:pl-5 first:border-l-0 first:pl-0">
      <p className="font-mono text-[13px] uppercase tracking-[0.14em] text-bronze-light">{title}</p>
      <p className="mt-2 text-sm md:text-base leading-relaxed text-white/72">{body}</p>
    </div>
  );
}
