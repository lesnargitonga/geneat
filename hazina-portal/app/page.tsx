import Image from "next/image";
import Link from "next/link";
import { ChatWidget } from "@/components/ChatWidget";
import { CatalogImage } from "@/components/CatalogImage";
import { HeroGiftStageLoader } from "@/components/three-d/HeroGiftStageLoader";
import { LuxuryTilt } from "@/components/three-d/LuxuryTilt";
import { SpatialCard } from "@/components/three-d/SpatialCard";
import { SpatialSection } from "@/components/three-d/SpatialSection";
import { BRAND_IMAGES } from "@/lib/products";
import { getStorefrontCatalog } from "@/lib/catalog";
import { formatKES, formatUSD, whatsappLink } from "@/lib/format";

export const revalidate = 300;

export default async function HomePage() {
  const catalog = await getStorefrontCatalog();
  const wa = whatsappLink(catalog.brand.whatsapp, "Hello Hazina Nomads — I'd like help with bespoke curation.");

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={BRAND_IMAGES.safariSunset}
            alt="Serene Kenyan landscape at sunset for Hazina Nomads"
            fill
            className="object-cover object-bottom brightness-[0.48] saturate-[0.75] contrast-[1.05]"
            sizes="100vw"
            priority
            unoptimized
          />
          <div className="absolute inset-0 hero-overlay" />
        </div>

        <div className="relative container-page min-h-[86svh] py-16 md:py-24 flex flex-col justify-between gap-12">
          <div className="pointer-events-none absolute right-[-4rem] top-24 z-0 hidden h-[520px] w-[min(46vw,680px)] lg:block xl:right-0">
            <HeroGiftStageLoader />
          </div>

          <div className="relative z-10 max-w-3xl pt-8 md:pt-16">
            <span className="font-mono text-sm font-medium uppercase tracking-[0.12em] text-white/70">
              BESPOKE CURATION <span className="mx-2 opacity-50">·</span> SEAMLESS LOGISTICS{" "}
              <span className="mx-2 opacity-50">·</span> GLOBAL EXPORT
            </span>
            <h1 className="mt-5 font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.9] tracking-[-0.02em] text-white">
              Private Kenyan curation, delivered with discretion.
            </h1>
            <p className="mt-6 max-w-2xl text-lg md:text-xl leading-[1.85] text-white/84">
              Hazina Nomads curates premium Kenyan gifts, heritage pieces, and private sourcing requests
              for travellers, safari guests, diaspora families, and corporate clients — beginning
              in Kenya and growing toward refined African sourcing.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/collections" className="btn-bronze">
                Explore Collections
              </Link>
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline border-white/60 text-white hover:bg-sand hover:text-obsidian"
              >
                Speak with Concierge
              </a>
            </div>
          </div>

          <div className="relative z-10 -mx-5 overflow-x-auto px-5 pb-2 local-scroll-x lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0">
            <div className="flex min-w-max gap-4 lg:grid lg:min-w-0 lg:grid-cols-5">
              {catalog.collections.map((box, index) => (
                <LuxuryTilt key={box.id} className="w-[min(78vw,300px)] shrink-0 lg:w-auto">
                  <Link
                    href={`/collections/${box.id}`}
                    className="group relative block overflow-hidden border border-white/20 text-white transition duration-500 hover:-translate-y-1"
                  >
                    <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.05]">
                      <CatalogImage
                        src={box.image}
                        alt={box.imageAlt || box.name}
                        tone="warm"
                        fit="cover"
                        className="h-52 w-full lg:h-56"
                        sizes="(max-width: 1024px) 78vw, 280px"
                        priority={false}
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
                </LuxuryTilt>
              ))}
            </div>
          </div>

          <div className="relative z-10 grid gap-5 border-t border-white/20 pt-6 text-white/80 sm:grid-cols-3 md:max-w-4xl">
            <HeroNote
              title="Bespoke Curation"
              body="Unlisted artifacts and signature regional collections through private artisan and estate networks."
              icon="curation"
            />
            <HeroNote
              title="Seamless Logistics"
              body="Discreet nationwide fulfillment to metropolitan residences, coastal villas, and wilderness lodges."
              icon="logistics"
            />
            <HeroNote
              title="Global Export"
              body="International transit and customs-ready export quotes for verified heritage pieces."
              icon="export"
            />
          </div>
        </div>
      </section>

      <SpatialSection className="container-page py-16 md:py-24">
        <div className="max-w-2xl mb-10 md:mb-12">
          <span className="label-mono">How to order</span>
          <h2 className="h-display mt-3 text-4xl md:text-5xl text-obsidian leading-tight">
            Choose a collection. Open a brief. We prepare the handoff.
          </h2>
          <p className="text-ink-mute mt-4 text-lg leading-relaxed">
            Select a finished collection, request something specific, or arrange a hotel, safari lodge,
            JKIA, residence, or international handoff. The same concierge desk carries the work
            from selection to delivery.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <PathCard
            href="/premium-safari-souvenirs-nairobi"
            label="Bespoke Curation"
            title="Source the right piece"
            body="Signature collections and unlisted requests handled through a private artisan and estate network."
          />
          <PathCard
            href="/collections"
            label="Signature Collections"
            title="Choose a finished edit"
            body="Five polished collections with fixed USD/KES pricing, lead times, and contents visible before checkout."
          />
          <PathCard
            href="/build"
            label="Seamless Logistics"
            title="Build around the handoff"
            body="Select items, set quantities, then let the guided checkout collect location, timing, and payment step by step."
          />
          <PathCard
            href="/collections/departure-drop"
            label="Global Export"
            title="Prepare for onward travel"
            body="Quote insured international transit before payment, with customs-ready details captured by the concierge."
          />
        </div>
      </SpatialSection>

      <section className="section-dark py-16 md:py-24">
        <SpatialSection className="container-page grid gap-10 md:grid-cols-12 md:items-start">
          <div className="md:col-span-4">
            <span className="label-mono text-sand/40">From Kenya, across Africa</span>
            <h2 className="h-display mt-3 text-4xl md:text-5xl text-sand leading-tight">
              Born in Kenya. Curating Africa. Delivered to the world.
            </h2>
          </div>
          <div className="md:col-span-8 space-y-5 text-sand/70 text-lg leading-relaxed">
            <p>
              Hazina Nomads begins in Kenya, where our concierge network curates premium gifts,
              travel keepsakes, heritage pieces, and private sourcing requests for guests and
              global clients.
            </p>
            <p>
              Our ambition is continental: to become a trusted sourcing house for refined African
              treasures, connecting travellers, diaspora families, hosts, and corporate teams with
              pieces that carry origin, craft, and meaning.
            </p>
            <p>
              We expand carefully, region by region, partner by partner — ensuring every piece is
              sourced with respect and presented with the standard it deserves.
            </p>
          </div>
        </SpatialSection>
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
    <SpatialCard className="h-full" contentClassName="h-full" intensity="soft">
      <Link href={href} className="card-luxury p-6 md:p-8 flex h-full flex-col min-h-[220px] group">
        <span className="label-mono text-bronze">{label}</span>
        <h3 className="font-serif text-2xl text-obsidian mt-3 leading-tight group-hover:text-bronze transition-colors">
          {title}
        </h3>
        <p className="text-ink-mute text-sm mt-3 leading-relaxed flex-1">{body}</p>
        <span className="font-mono text-sm text-bronze mt-6 group-hover:underline underline-offset-4">
          Continue →
        </span>
      </Link>
    </SpatialCard>
  );
}

function HeroNote({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: "curation" | "logistics" | "export";
}) {
  return (
    <div className="sm:border-l sm:border-white/20 sm:pl-5 first:border-l-0 first:pl-0">
      <ServiceIcon kind={icon} />
      <p className="font-mono text-[13px] uppercase tracking-[0.14em] text-bronze-light">{title}</p>
      <p className="mt-2 text-sm md:text-base leading-relaxed text-white/72">{body}</p>
    </div>
  );
}

function ServiceIcon({ kind }: { kind: "curation" | "logistics" | "export" }) {
  if (kind === "curation") {
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
  if (kind === "logistics") {
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
