import Image from "next/image";
import Link from "next/link";
import { ChatWidget } from "@/components/ChatWidget";
import { CatalogImage } from "@/components/CatalogImage";
import { BRAND, BRAND_IMAGES, GIFT_BOXES } from "@/lib/products";
import { formatKES, formatUSD, whatsappLink } from "@/lib/format";

export default function HomePage() {
  const wa = whatsappLink(BRAND.whatsapp, "Hello Hazina Nomads — I'd like help choosing a gift box.");

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
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.32)_0%,rgba(0,0,0,0.55)_45%,rgba(7,7,6,0.88)_100%)]" />
        </div>

        <div className="relative container-page min-h-[86svh] py-16 md:py-24 flex flex-col justify-between gap-12">
          <div className="max-w-4xl pt-8 md:pt-16">
            <span className="font-mono text-sm font-medium uppercase tracking-[0.12em] text-white/70">
              Nairobi hotel delivery · JKIA handoff · DHL export quotes
            </span>
            <h1 className="mt-5 font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.9] tracking-[-0.02em] text-white">
              Treasures, delivered to your journey.
            </h1>
            <p className="mt-6 max-w-2xl text-lg md:text-xl leading-[1.85] text-white/84">
              Premium Kenyan gift collections for travellers who want something more considered than a
              souvenir run.
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

          <div className="-mx-5 overflow-x-auto px-5 pb-2 local-scroll-x lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0">
            <div className="glass-strip flex min-w-max gap-4 p-3 lg:grid lg:min-w-0 lg:grid-cols-5">
              {GIFT_BOXES.map((box) => (
                <Link
                  key={box.id}
                  href={`/collections/${box.id}`}
                  className="group relative w-[min(78vw,300px)] shrink-0 overflow-hidden rounded-2xl text-white transition duration-500 hover:-translate-y-1 lg:w-auto"
                >
                  <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.05]">
                    <CatalogImage
                      src={box.image}
                      alt={box.imageAlt || box.name}
                      tone="warm"
                      fit="cover"
                      className="h-52 w-full lg:h-56"
                      sizes="300px"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/5" />
                  <span className="relative z-10 flex h-52 flex-col justify-end p-4 lg:h-56">
                    <span className="block font-serif text-lg leading-tight text-white group-hover:text-bronze-light">
                      {box.name}
                    </span>
                    <span className="mt-1 block font-mono text-sm leading-relaxed text-white/85">
                      {formatUSD(box.price_usd)} · {formatKES(box.price_kes)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-5 border-t border-white/20 pt-6 text-white/80 sm:grid-cols-3 md:max-w-4xl">
            <HeroNote title="Hotel delivery" body="Westlands · Kilimani · Karen" icon="hotel" />
            <HeroNote title="JKIA handoff" body="Terminal-aware departure gifts" icon="jkia" />
            <HeroNote title="DHL export" body="Insured quotes before payment" icon="dhl" />
          </div>
        </div>
      </section>

      <section className="container-page py-16 md:py-24">
        <div className="max-w-2xl mb-10 md:mb-12">
          <span className="label-mono">How to order</span>
          <h2 className="h-display mt-3 text-4xl md:text-5xl text-obsidian leading-tight">
            One catalog. Two ways in.
          </h2>
          <p className="text-ink-mute mt-4 text-lg leading-relaxed">
            Choose a finished collection or pick individual treasures — same concierge, same delivery
            zones, same checkout.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <PathCard
            href="/premium-safari-souvenirs-nairobi"
            label="Safari travellers"
            title="Premium safari souvenirs"
            body="Editorial Nairobi curation for guests after the Mara — hotel delivery or insured export."
          />
          <PathCard
            href="/collections"
            label="Curated collections"
            title="Ready-made gift boxes"
            body="Five signature edits with fixed pricing, lead times, and what is inside each box."
          />
          <PathCard
            href="/build"
            label="Custom box"
            title="Pick your own treasures"
            body="Select items, set quantities, add packaging only if you need it, then enter delivery details."
          />
          <PathCard
            href="/collections/departure-drop"
            label="Flying from JKIA"
            title="Departure Drop · 4h lead"
            body="Pre-packed for last-minute terminal handoff — our express collection for departing guests."
          />
        </div>
      </section>

      <ChatWidget />
    </>
  );
}

function PathCard({
  href,
  label,
  title,
  body,
}: {
  href: string;
  label: string;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="card-luxury p-6 md:p-8 flex flex-col min-h-[220px] group">
      <span className="label-mono text-bronze">{label}</span>
      <h3 className="font-serif text-2xl text-obsidian mt-3 leading-tight group-hover:text-bronze transition-colors">
        {title}
      </h3>
      <p className="text-ink-mute text-sm mt-3 leading-relaxed flex-1">{body}</p>
      <span className="font-mono text-sm text-bronze mt-6 group-hover:underline underline-offset-4">
        Continue →
      </span>
    </Link>
  );
}

function HeroNote({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: "hotel" | "jkia" | "dhl";
}) {
  return (
    <div className="sm:border-l sm:border-white/20 sm:pl-5 first:border-l-0 first:pl-0">
      <ServiceIcon kind={icon} />
      <p className="font-mono text-[13px] uppercase tracking-[0.14em] text-bronze-light">{title}</p>
      <p className="mt-2 text-sm md:text-base leading-relaxed text-white/72">{body}</p>
    </div>
  );
}

function ServiceIcon({ kind }: { kind: "hotel" | "jkia" | "dhl" }) {
  if (kind === "hotel") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="mb-2 h-5 w-5 text-bronze-light/90"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
      >
        <path d="M3 19v-7h18v7" />
        <path d="M6 12V7h12v5" />
        <path d="M9 10h.01M15 10h.01" />
      </svg>
    );
  }
  if (kind === "jkia") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="mb-2 h-5 w-5 text-bronze-light/90"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
      >
        <path d="M4 19h16" />
        <path d="M3 14l9-2 9 2" />
        <path d="M12 5v7" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="mb-2 h-5 w-5 text-bronze-light/90"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
    >
      <path d="M4 8h16v10H4z" />
      <path d="M4 12h16" />
      <path d="M9 8l3 4 3-4" />
    </svg>
  );
}
