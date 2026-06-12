import Image from "next/image";
import Link from "next/link";
import { CatalogImage } from "@/components/CatalogImage";
import { ConciergeSceneCTA } from "@/components/ConciergeSceneCTA";
import { MobileMotionControl } from "@/components/MobileMotionControl";
import { VaultEntryLink } from "@/components/VaultEntryLink";
import { FloatingSurface } from "@/components/three-d/FloatingSurface";
import { LuxuryTilt } from "@/components/three-d/LuxuryTilt";
import { MobileMotionStage } from "@/components/three-d/MobileMotionStage";
import { RevealGroup } from "@/components/three-d/RevealGroup";
import { RevealText } from "@/components/three-d/RevealText";
import { ScrollDepth } from "@/components/three-d/ScrollDepth";
import { ShowroomScene } from "@/components/three-d/ShowroomScene";
import { SpatialPage } from "@/components/three-d/SpatialPage";
import { SpatialSection } from "@/components/three-d/SpatialSection";
import { getStorefrontCatalog } from "@/lib/catalog";
import { formatKES, formatUSD, whatsappLink } from "@/lib/format";
import { BRAND_IMAGES } from "@/lib/products";

export const revalidate = 300;

export default async function HomePage() {
  const catalog = await getStorefrontCatalog();
  const wa = whatsappLink(catalog.brand.whatsapp, "Hello Hazina Nomads — I'd like help with bespoke curation.");

  return (
    <SpatialPage>
      <section className="hero-showroom relative overflow-hidden">
        <ScrollDepth className="absolute inset-0" y={44} scale={1.07}>
          <Image
            src={BRAND_IMAGES.safariSunset}
            alt="Serene Kenyan landscape at sunset for Hazina Nomads"
            fill
            className="object-cover object-bottom brightness-[0.42] saturate-[0.68] contrast-[1.08]"
            sizes="100vw"
            priority
            unoptimized
          />
          <div className="absolute inset-0 hero-overlay" />
        </ScrollDepth>

        <div className="relative container-page flex min-h-[88svh] flex-col justify-center py-16 md:py-24">
          <SpatialSection className="relative z-10 max-w-3xl pt-8 md:pt-12 lg:max-w-[47rem]">
            <RevealText>
              <span className="font-mono text-sm font-medium uppercase tracking-[0.12em] text-white/70">
                BESPOKE CURATION <span className="mx-2 opacity-50">·</span> SEAMLESS LOGISTICS{" "}
                <span className="mx-2 opacity-50">·</span> GLOBAL EXPORT
              </span>
            </RevealText>
            <RevealText delay={0.08}>
              <h1 className="mt-5 font-serif text-5xl leading-[0.9] text-white md:text-7xl lg:text-8xl">
                Private Kenyan curation, delivered with discretion.
              </h1>
            </RevealText>
            <RevealText delay={0.16}>
              <p className="mt-6 max-w-2xl text-lg leading-[1.85] text-white/80 md:text-xl">
                Hazina Nomads curates premium Kenyan gifts, heritage pieces, and private sourcing requests
                for travellers, safari guests, diaspora families, and corporate clients.
              </p>
            </RevealText>
            <RevealGroup className="mt-8 flex flex-wrap gap-3" delay={0.23} stagger={0.07}>
              <VaultEntryLink />
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor="magnetic"
                className="btn-outline flex-col gap-0.5 border-white/60 text-white hover:bg-sand hover:text-obsidian"
              >
                <span>Continue on WhatsApp</span>
                <span className="text-[10px] normal-case tracking-normal opacity-75">Human concierge handoff</span>
              </a>
            </RevealGroup>
            <MobileMotionControl />
            <MobileMotionStage />
          </SpatialSection>

          <div className="hero-showroom__threshold relative z-10 mt-14 flex flex-wrap items-center gap-4 text-white/55">
            <span className="h-px w-12 bg-bronze-light/65" />
            <span className="label-mono text-white/55">Scroll to enter the showroom</span>
          </div>
        </div>
      </section>

      <ShowroomScene
        tone="dark"
        className="home-exhibit-scene"
        contentClassName="container-page py-16 md:py-24"
        depth={48}
      >
        <div className="mb-10 grid gap-6 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <span className="label-mono text-bronze-light/80">Room 01 · Signature exhibits</span>
            <h2 className="mt-3 font-serif text-4xl leading-tight text-sand md:text-6xl">
              Five finished edits, staged for the journey ahead.
            </h2>
          </div>
          <p className="text-base leading-relaxed text-sand/62 md:col-span-4 md:col-start-9">
            Move through each collection as a complete exhibit: visible price, lead time,
            contents, and a direct path to the concierge desk.
          </p>
        </div>

        <RevealGroup className="home-exhibit-rail" stagger={0.07}>
          {catalog.collections.map((box) => (
            <LuxuryTilt key={box.id} className="home-exhibit-rail__item">
              <Link href={`/collections/${box.id}`} className="home-exhibit" data-cursor="magnetic">
                <span className="home-exhibit__image">
                  <CatalogImage
                    src={box.image}
                    alt={box.imageAlt || box.name}
                    tone="warm"
                    fit="cover"
                    className="absolute inset-0"
                    sizes="(max-width: 767px) 82vw, 320px"
                  />
                </span>
                <span className="home-exhibit__label">
                  <span>
                    <span className="label-mono text-bronze-light/70">{box.sku}</span>
                    <span className="mt-1 block font-serif text-2xl leading-tight text-white">{box.name}</span>
                  </span>
                  <span className="font-mono text-xs leading-relaxed text-white/65">
                    {formatUSD(box.price_usd)}
                    <br />
                    {formatKES(box.price_kes)}
                  </span>
                </span>
              </Link>
            </LuxuryTilt>
          ))}
        </RevealGroup>
      </ShowroomScene>

      <ShowroomScene
        className="home-plaque-scene"
        contentClassName="container-page py-16 md:py-24"
        depth={30}
      >
        <div className="mb-10 max-w-2xl">
          <span className="label-mono">Room 02 · The service wall</span>
          <h2 className="h-display mt-3 text-4xl leading-tight md:text-5xl">
            A private desk carries every piece from source to handoff.
          </h2>
        </div>
        <RevealGroup className="service-plaque-grid" stagger={0.09}>
          <ServicePlaque
            number="01"
            title="Bespoke Curation"
            body="Unlisted artifacts and signature regional collections through private artisan and estate networks."
          />
          <ServicePlaque
            number="02"
            title="Seamless Logistics"
            body="Discreet nationwide fulfillment to metropolitan residences, coastal villas, and wilderness lodges."
          />
          <ServicePlaque
            number="03"
            title="Global Export"
            body="International transit and customs-ready export quotes for verified heritage pieces."
          />
        </RevealGroup>
      </ShowroomScene>

      <ShowroomScene
        className="private-desk-scene"
        contentClassName="container-page py-16 md:py-24"
        depth={40}
      >
        <div className="private-desk">
          <div className="private-desk__heading">
            <span className="label-mono text-bronze">Room 03 · Private curation desk</span>
            <h2 className="h-display mt-3 text-4xl leading-tight md:text-6xl">
              Choose the path. The desk prepares the rest.
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-mute">
              Select a finished collection, build from individual pieces, or open a brief for
              something not yet listed.
            </p>
          </div>
          <RevealGroup className="private-desk__paths" stagger={0.07}>
            <PathCard
              href="/premium-safari-souvenirs-nairobi"
              label="Private sourcing"
              title="Source the right piece"
              body="Open a concise request for a special commission, regional artifact, or unlisted object."
            />
            <PathCard
              href="/collections"
              label="Finished collections"
              title="Choose a complete edit"
              body="Five polished collections with fixed pricing, lead times, and contents visible before checkout."
            />
            <PathCard
              href="/build"
              label="Working studio"
              title="Build around the handoff"
              body="Select pieces, quantities, packaging, delivery context, and payment preference."
            />
          </RevealGroup>
        </div>
      </ShowroomScene>

      <ShowroomScene
        tone="dark"
        className="home-story-scene"
        contentClassName="container-page grid gap-10 py-16 md:grid-cols-12 md:py-24"
        depth={30}
      >
        <div className="md:col-span-5">
          <span className="label-mono text-sand/45">Room 04 · Provenance</span>
          <h2 className="mt-3 font-serif text-4xl leading-tight text-sand md:text-5xl">
            Born in Kenya. Curating Africa. Delivered to the world.
          </h2>
        </div>
        <div className="space-y-5 text-lg leading-relaxed text-sand/68 md:col-span-6 md:col-start-7">
          <p>
            Hazina Nomads begins in Kenya, where our concierge network curates premium gifts,
            travel keepsakes, heritage pieces, and private sourcing requests.
          </p>
          <p>
            We expand carefully, region by region and partner by partner, so every piece carries
            origin, craft, and meaning without losing the standard of the room it enters.
          </p>
        </div>
      </ShowroomScene>

      <ShowroomScene className="concierge-entry-scene" contentClassName="container-page py-16 md:py-24" depth={24}>
        <div className="concierge-entry">
          <div>
            <span className="label-mono text-bronze">Room 05 · Concierge</span>
            <h2 className="h-display mt-3 max-w-3xl text-4xl leading-tight md:text-6xl">
              Open the drawer. We will guide the next decision one step at a time.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <ConciergeSceneCTA />
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline flex-col gap-0.5"
              data-cursor="magnetic"
            >
              <span>Continue on WhatsApp</span>
              <span className="text-[10px] normal-case tracking-normal opacity-70">Human concierge handoff</span>
            </a>
          </div>
        </div>
      </ShowroomScene>
    </SpatialPage>
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
    <FloatingSurface className="h-full" depth="soft">
      <Link href={href} className="private-desk__card group" data-cursor="magnetic">
        <span className="label-mono text-bronze">{label}</span>
        <h3 className="mt-3 font-serif text-2xl leading-tight text-obsidian transition-colors group-hover:text-bronze">
          {title}
        </h3>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-mute">{body}</p>
        <span className="mt-6 font-mono text-sm text-bronze">Enter →</span>
      </Link>
    </FloatingSurface>
  );
}

function ServicePlaque({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <article className="service-plaque">
      <span className="service-plaque__number">{number}</span>
      <h3 className="font-serif text-3xl leading-tight text-obsidian">{title}</h3>
      <p className="mt-3 text-base leading-relaxed text-ink-mute">{body}</p>
    </article>
  );
}
