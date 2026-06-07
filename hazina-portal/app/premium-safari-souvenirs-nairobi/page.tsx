import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND, getGiftBox } from "@/lib/products";
import { formatDualPrice, whatsappLink } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";

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
    <>
      {/* Split hero */}
      <section className="grid lg:grid-cols-2 min-h-[70vh]">
        <div className="relative bg-obsidian min-h-[520px] lg:min-h-[70vh]">
          <div className="absolute inset-0">
            <ProductImage
              box={kenyaEdit}
              priority
              className="rounded-none !absolute inset-0 h-full w-full"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            {/* Left burn + base lift so product copy stays readable */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/55 to-black/15 lg:from-black/95 lg:via-black/65 lg:to-transparent"
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent"
              aria-hidden
            />
          </div>
          <div className="relative z-10 flex min-h-[520px] lg:min-h-[70vh] items-end p-8 md:p-12">
            <div className="max-w-md rounded-sm bg-black/45 backdrop-blur-[2px] p-6 md:p-8 border border-white/10">
              <span className="label-mono !text-white/70">Bespoke curation · 24h lead</span>
              <h2 className="font-serif text-3xl md:text-4xl text-white mt-2 drop-shadow-sm">
                {kenyaEdit.name}
              </h2>
              <div className="mt-3">
                <span className="font-mono text-lg text-white/95">
                  {formatDualPrice(kenyaEdit.price_usd, kenyaEdit.price_kes)}
                </span>
              </div>
              <p className="text-white/85 text-sm mt-4 max-w-md leading-relaxed">{kenyaEdit.contents}</p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link href="/collections/kenya-edit" className="btn-bronze inline-flex justify-center">
                  View The Kenya Edit
                </Link>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline border-white/50 text-white hover:bg-white/10 hover:text-white inline-flex justify-center"
                >
                  Order on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="container-page lg:px-12 xl:px-16 py-12 md:py-16 lg:py-20 flex flex-col justify-center space-y-10 border-l border-border/80">
          <header>
            <span className="chip-bronze">Private curation</span>
            <h1 className="h-display text-4xl md:text-5xl lg:text-6xl mt-5 mb-6 leading-[1.05] text-obsidian">
              Private Kenyan heritage, curated with intent
            </h1>
            <p className="text-lg text-ink-mute leading-relaxed max-w-lg">
              Hazina Nomads assembles editorial gift collections from trusted Kenyan makers —
              coffee from the highlands, Maasai beadwork, artisan leather, and Kisii soapstone —
              with bespoke curation, seamless logistics, and global export when the parcel must
              follow you abroad.
            </p>
          </header>

          <div className="editorial-rule space-y-4">
            <h3 className="font-serif text-xl text-obsidian">What makes it premium</h3>
            <ul className="text-ink-mute space-y-3 text-sm leading-relaxed">
              <li>Fixed vendor relationships — no random market quality</li>
              <li>Matte rigid boxes, cream tissue, wax seal, brand story card</li>
              <li>Optional personalisation on leather (24-hour notice)</li>
              <li>USD card or KES M-Pesa checkout through the automated concierge</li>
            </ul>
          </div>

          <div className="editorial-rule space-y-3">
            <h3 className="font-serif text-xl text-obsidian">Collections for considered gifting</h3>
            <p className="text-ink-mute text-sm leading-relaxed">
              Browse our full{" "}
              <Link href="/collections" className="text-bronze hover:text-obsidian transition-colors">
                curated collections
              </Link>{" "}
              or{" "}
              <Link href="/build" className="text-bronze hover:text-obsidian transition-colors">
                build a custom box
              </Link>{" "}
              from individual treasures. Travelling soon? See the{" "}
              <Link
                href="/collections/departure-drop"
                className="text-bronze hover:text-obsidian transition-colors"
              >
                departure-ready edit
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

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
      <section className="bg-sand py-16 md:py-24">
        <div className="container-page">
          <span className="label-mono">The distinction</span>
          <h2 className="h-display text-3xl md:text-4xl mt-3 mb-10 text-obsidian">
            Why discerning guests choose Hazina
          </h2>
          <div className="grid md:grid-cols-3 gap-10 md:gap-12">
            <Reason
              title="Curated, never generic"
              body="Real Kenyan coffee, Maasai beadwork, and artisan leather — assembled with intention for premium travellers and hosts."
            />
            <Reason
              title="Seamless handoff"
              body="Property, residence, departure, and onward-travel handoffs are confirmed before payment. Personalisation on select leather pieces."
            />
            <Reason
              title="Concierge on WhatsApp"
              body="Confirm collection, delivery, and payment in one discreet thread — KES M-Pesa or USD card."
            />
          </div>
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
            Order on WhatsApp
          </a>
        </div>
      </section>
    </>
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
