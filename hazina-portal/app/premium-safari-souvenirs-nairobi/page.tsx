import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND, getGiftBox } from "@/lib/products";
import { formatDualPrice, whatsappLink } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";

export const metadata: Metadata = {
  title: "Premium Safari Souvenirs Nairobi · Hazina Nomads",
  description:
    "Curated Kenyan safari souvenirs for discerning travellers — Maasai beadwork, artisan leather, coffee, and sculpture. Hotel delivery, JKIA handoff, or insured DHL export quote.",
  keywords: [
    "safari souvenirs Nairobi",
    "Kenya travel gifts",
    "Maasai beadwork Nairobi",
    "luxury Kenyan souvenirs",
    "safari gift box Kenya",
    "The Kenya Edit",
  ],
  openGraph: {
    title: "Premium Safari Souvenirs Nairobi",
    description:
      "Editorial gift collections for safari tourists — curated in Nairobi for hotel delivery, JKIA handoff, or DHL export quote.",
    images: [{ url: "/brand/safari-sunset.jpg", alt: "Kenyan safari sunset for Hazina Nomads" }],
  },
};

export default function SafariSouvenirsPage() {
  const kenyaEdit = getGiftBox("kenya-edit")!;
  const wa = whatsappLink(
    BRAND.whatsapp,
    "Hi — I'm looking for premium safari souvenirs in Nairobi. Can you help me choose a collection?",
  );

  return (
    <>
      <section className="grid lg:grid-cols-2 min-h-[70vh]">
        <div className="relative bg-obsidian min-h-[520px] lg:min-h-[70vh]">
          <div className="absolute inset-0">
            <ProductImage
              box={kenyaEdit}
              priority
              className="rounded-none !absolute inset-0 h-full w-full"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/10" />
          </div>
          <div className="relative z-10 flex min-h-[520px] lg:min-h-[70vh] items-end p-8 md:p-12">
            <div className="max-w-md">
              <span className="label-mono !text-white/60">Safari edit · 24h lead</span>
              <h2 className="font-serif text-3xl md:text-4xl text-white mt-2">{kenyaEdit.name}</h2>
              <div className="flex items-baseline gap-4 mt-3">
                <span className="font-mono text-lg text-white">
                  {formatDualPrice(kenyaEdit.price_usd, kenyaEdit.price_kes)}
                </span>
              </div>
              <p className="text-white/75 text-sm mt-4 max-w-md leading-relaxed">{kenyaEdit.contents}</p>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline border-white/40 text-white hover:bg-white hover:text-black mt-6">
                Order on WhatsApp
              </a>
            </div>
          </div>
        </div>

        <div className="container-page lg:px-12 xl:px-16 py-12 md:py-16 lg:py-20 flex flex-col justify-center space-y-12">
          <header>
            <span className="chip-bronze">Nairobi curation</span>
            <h1 className="h-display text-4xl md:text-5xl lg:text-6xl mt-5 mb-6 leading-[1.05] text-obsidian">
              Premium safari souvenirs in Nairobi
            </h1>
            <p className="text-lg text-ink-mute leading-relaxed max-w-lg">
              After the plains and the Mara, you deserve more than airport trinkets. Hazina Nomads
              assembles editorial gift collections from trusted Nairobi artisans — coffee from the
              highlands, Maasai beadwork, leather from Kariokor, and soapstone from Kisii — delivered
              to your hotel in Westlands, Kilimani, or Karen before you fly home, or quoted for
              insured export if the parcel must follow you abroad.
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
            <h3 className="font-serif text-xl text-obsidian">Collections for safari travellers</h3>
            <p className="text-ink-mute text-sm leading-relaxed">
              Browse our full{" "}
              <Link href="/collections" className="text-bronze hover:text-bronze-dark transition-colors">
                curated collections
              </Link>{" "}
              or{" "}
              <Link href="/build" className="text-bronze hover:text-bronze-dark transition-colors">
                build a custom box
              </Link>{" "}
              from individual treasures. Flying out soon? See our{" "}
              <Link href="/last-minute-kenya-gifts-jkia" className="text-bronze hover:text-bronze-dark transition-colors">
                JKIA express service
              </Link>
              .
            </p>
          </div>

          <div className="relative aspect-[16/10] overflow-hidden shadow-soft">
            <Image
              src="/brand/safari-sunset.jpg"
              alt="Kenyan safari at sunset — curated souvenirs for the journey home"
              fill
              className="object-cover contrast-[1.05]"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
            <p className="absolute bottom-4 left-4 right-4 font-serif text-sand text-lg drop-shadow-lg">
              Treasures with provenance — not generic curio-shop fare.
            </p>
          </div>
        </div>
      </section>

      <section className="section-dark py-16 md:py-20">
        <div className="container-page">
          <span className="label-mono text-sand/40">The distinction</span>
          <h2 className="h-display text-3xl md:text-4xl mt-3 mb-10 text-sand">
            Why safari guests choose Hazina
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            <Reason
              title="Curated, never generic"
              body="Real Kenyan coffee, Maasai beadwork, and artisan leather — assembled with intention for European and US visitors."
            />
            <Reason
              title="Hotel delivery Nairobi"
              body="Westlands, Kilimani, and Karen within 24 hours. Personalisation on select leather pieces."
            />
            <Reason
              title="Concierge on WhatsApp"
              body="Confirm collection, delivery, and payment in one discreet thread — KES M-Pesa or USD card."
            />
          </div>
        </div>
      </section>

      <div className="container-page py-16 text-center space-y-4">
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-dark">
          Order on WhatsApp
        </a>
        <p className="label-mono text-ink-mute">
          Dispatch coordination 08:00–20:00 EAT · Custom boxes from 2 treasures
        </p>
      </div>
    </>
  );
}

function Reason({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-3 border-l-2 border-bronze/40 pl-6">
      <h3 className="font-serif text-xl text-sand">{title}</h3>
      <p className="text-sand/60 text-sm leading-relaxed">{body}</p>
    </div>
  );
}
