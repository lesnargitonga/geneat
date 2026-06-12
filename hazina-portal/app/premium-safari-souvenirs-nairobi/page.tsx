import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND, getGiftBox } from "@/lib/products";
import { formatDualPrice, whatsappLink } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { FloatingSurface } from "@/components/three-d/FloatingSurface";
import { RevealGroup } from "@/components/three-d/RevealGroup";
import { RevealText } from "@/components/three-d/RevealText";
import { ScrollDepth } from "@/components/three-d/ScrollDepth";
import { SpatialPage } from "@/components/three-d/SpatialPage";
import { SpatialSection } from "@/components/three-d/SpatialSection";

export const metadata: Metadata = {
  title: "Bespoke Curation · Hazina Nomads",
  description:
    "Private Kenyan heritage curation for discerning travellers — signature collections, bespoke sourcing, seamless logistics, and global export.",
  keywords: [
    "safari souvenirs Nairobi",
    "Kenya travel gifts",
    "Maasai beadwork Nairobi",
    "luxury Kenyan souvenirs",
    "bespoke Kenyan collection",
    "The Kenya Edit",
  ],
  openGraph: {
    title: "Bespoke Curation · Hazina Nomads",
    description:
      "Private Kenyan heritage sourcing through bespoke curation, seamless logistics, and global export.",
    images: [{ url: "/brand/safari-sunset.webp", alt: "Kenyan safari sunset for Hazina Nomads" }],
  },
};

export default function SafariSouvenirsPage() {
  const kenyaEdit = getGiftBox("kenya-edit")!;
  const wa = whatsappLink(
    BRAND.whatsapp,
    "Hi — I'm looking for bespoke Kenyan heritage curation. Can you help me choose a collection?",
  );

  return (
    <SpatialPage ambient={false}>
      <section className="relative isolate min-h-[78svh] overflow-hidden bg-obsidian">
        <ScrollDepth className="absolute inset-0" y={36} scale={1.05}>
          <div className="absolute inset-0">
            <ProductImage
              box={kenyaEdit}
              priority
              className="rounded-none !absolute inset-0 h-full w-full"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/62 to-black/20" aria-hidden />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/22 to-black/25" aria-hidden />
        </ScrollDepth>

        <div className="relative z-10 container-page flex min-h-[78svh] items-end py-14 md:py-20">
          <div className="max-w-3xl">
            <RevealText>
              <span className="label-mono !text-white/70">Bespoke curation · 24h lead</span>
            </RevealText>
            <RevealText delay={0.08}>
              <h1 className="mt-4 font-serif text-5xl leading-[0.94] text-white md:text-7xl">
                Private Kenyan heritage, curated with intent.
              </h1>
            </RevealText>
            <RevealText delay={0.15}>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/82">
                Signature collections and private sourcing from trusted Kenyan makers, prepared for
                hotel, safari lodge, departure, residence, and international handoff.
              </p>
            </RevealText>
            <RevealGroup className="mt-7 flex flex-col gap-3 sm:flex-row" delay={0.22} stagger={0.06}>
                <Link href="/collections/kenya-edit" className="btn-bronze inline-flex justify-center">
                  View The Kenya Edit
                </Link>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline flex-col gap-0.5 border-white/50 text-white hover:bg-white/10 hover:text-white inline-flex justify-center"
                >
                  <span>Continue on WhatsApp</span>
                  <span className="text-[10px] normal-case tracking-normal opacity-75">Human concierge handoff</span>
                </a>
            </RevealGroup>
            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 border-t border-white/20 pt-5 text-white/80">
              <span className="font-serif text-2xl">{kenyaEdit.name}</span>
              <span className="font-mono text-sm">{formatDualPrice(kenyaEdit.price_usd, kenyaEdit.price_kes)}</span>
            </div>
          </div>
        </div>
      </section>

      <SpatialSection className="container-page grid gap-10 py-14 md:py-20 lg:grid-cols-[1.05fr,0.95fr] lg:gap-16">
          <header>
            <span className="chip-bronze">Private curation</span>
            <h2 className="h-display text-4xl md:text-5xl mt-5 mb-6 leading-[1.05] text-obsidian">
              A private showroom, carried through to handoff.
            </h2>
            <p className="text-lg text-ink-mute leading-relaxed max-w-lg">
              Hazina Nomads assembles editorial gift collections from trusted Kenyan makers —
              coffee from the highlands, Maasai beadwork, artisan leather, and Kisii soapstone —
              with bespoke curation, seamless logistics, and global export when the parcel must
              follow you abroad.
            </p>
          </header>

          <FloatingSurface className="route-panel p-6 md:p-8">
            <div className="editorial-rule space-y-4">
              <h3 className="font-serif text-xl text-obsidian">What makes it premium</h3>
              <ul className="text-ink-mute space-y-3 text-sm leading-relaxed">
                <li>Fixed vendor relationships — no random market quality</li>
                <li>Matte rigid boxes, cream tissue, wax seal, brand story card</li>
                <li>Optional personalisation on leather (24-hour notice)</li>
                <li>USD card or KES M-Pesa checkout through the automated concierge</li>
              </ul>
            </div>

            <div className="editorial-rule mt-8 space-y-3">
              <h3 className="font-serif text-xl text-obsidian">Collections for considered gifting</h3>
              <p className="text-ink-mute text-sm leading-relaxed">
                Browse our full{" "}
                <Link href="/collections" className="text-bronze hover:text-obsidian transition-colors">
                  curated collections
                </Link>{" "}
                or{" "}
                <Link href="/build" className="text-bronze hover:text-obsidian transition-colors">
                  open a private brief
                </Link>
                . Travelling soon? See the{" "}
                <Link href="/collections/departure-drop" className="text-bronze hover:text-obsidian transition-colors">
                  departure-ready edit
                </Link>
                .
              </p>
            </div>
          </FloatingSurface>
      </SpatialSection>

      {/* Full-width transition — photography only, caption below the fade */}
      <section className="relative w-full min-h-[38vh] md:min-h-[46vh]">
        <Image
          src="/brand/safari-sunset.webp"
          alt="Kenyan sunset for Hazina Nomads private curation"
          fill
          className="object-cover object-center"
          sizes="100vw"
          unoptimized
        />
        <div className="absolute inset-0 bg-black/40" aria-hidden />
        <div
          className="absolute inset-0 bg-gradient-to-b from-sand via-transparent to-sand"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-sand to-transparent" aria-hidden />
      </section>
      <div className="bg-sand border-b border-border/60">
        <p className="container-page py-8 md:py-10 font-serif text-2xl md:text-3xl text-obsidian text-center max-w-3xl mx-auto leading-snug">
          Treasures with provenance — not generic curio-shop fare.
        </p>
      </div>

      {/* Distinction — stays on sand to avoid another hard black band */}
      <section className="showroom-band bg-sand py-16 md:py-24">
        <div className="container-page">
          <span className="label-mono">The distinction</span>
          <h2 className="h-display text-3xl md:text-4xl mt-3 mb-10 text-obsidian">
            Why discerning guests choose Hazina
          </h2>
          <RevealGroup className="grid md:grid-cols-3 gap-10 md:gap-12">
            <Reason
              title="Curated, never generic"
              body="Real Kenyan coffee, Maasai beadwork, and artisan leather — assembled with intention for premium travellers and hosts."
            />
            <Reason
              title="Seamless handoff"
              body="Property, residence, departure, and onward-travel handoffs are confirmed before payment. Personalisation on select leather pieces."
            />
            <Reason
              title="Human concierge on WhatsApp"
              body="Continue with a person to confirm collection, delivery, and payment — KES M-Pesa or USD card."
            />
          </RevealGroup>
        </div>
      </section>

      {/* Bronze close — softer than a black slab + white button */}
      <section className="bg-bronze-dark py-16 md:py-20">
        <div className="container-page text-center max-w-lg mx-auto space-y-6">
          <p className="font-serif text-2xl md:text-3xl text-sand leading-snug">
            When you are ready, we handle the rest.
          </p>
          <p className="text-sand/75 text-sm leading-relaxed">
            Dispatch coordination 08:00–20:00 EAT · Custom boxes from 2 treasures
          </p>
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center px-8 py-3 font-mono text-sm font-medium uppercase tracking-[0.12em] border border-sand/60 text-sand transition-colors hover:bg-sand/10"
          >
            Continue on WhatsApp
          </a>
          <p className="label-mono text-sand/60">Human concierge handoff</p>
        </div>
      </section>
    </SpatialPage>
  );
}

function Reason({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-3 border-l-2 border-bronze/50 pl-6">
      <h3 className="font-serif text-xl text-obsidian">{title}</h3>
      <p className="text-ink-mute text-sm leading-relaxed">{body}</p>
    </div>
  );
}
