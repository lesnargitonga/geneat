import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND, getGiftBox } from "@/lib/products";
import { formatDualPrice, whatsappLink } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { StickyWhatsAppCTA } from "@/components/StickyWhatsAppCTA";
import { TrustRow } from "@/components/TrustRow";

export const metadata: Metadata = {
  title: "Last-Minute Kenya Gifts at JKIA · Hazina Nomads",
  description:
    "Forgot souvenirs? Premium Kenyan gift boxes delivered to JKIA in 4 hours. Coffee, beadwork, leather — curated for departing travellers.",
  keywords: [
    "JKIA gifts",
    "last minute souvenirs Nairobi",
    "airport gift delivery Kenya",
    "Kenya travel gifts",
    "Departure Drop",
  ],
  openGraph: {
    title: "Last-Minute Kenya Gifts at JKIA",
    description: "4-hour delivery to any JKIA terminal. Premium curated boxes — not airport junk.",
    images: [{ url: "/brand/safari-sunset.jpg", alt: "Kenyan safari sunset for Hazina Nomads" }],
  },
};

export default function JkiaLandingPage() {
  const departureDrop = getGiftBox("departure-drop")!;
  const orderMessage =
    "Hi Hazina Nomads — I need a last-minute gift delivered to JKIA. My flight departs at [time], terminal [number].";
  const wa = whatsappLink(BRAND.whatsapp, orderMessage);

  return (
    <>
      {/* Split-screen hero */}
      <section className="grid lg:grid-cols-2 min-h-[70vh]">
        {/* Left — product context */}
        <div className="relative bg-obsidian min-h-[520px] lg:min-h-[70vh]">
          <div className="absolute inset-0">
            <ProductImage
              box={departureDrop}
              priority
              className="rounded-none !absolute inset-0 h-full w-full"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/10" />
          </div>
          <div className="relative z-10 flex min-h-[520px] lg:min-h-[70vh] items-end p-8 md:p-12">
            <div className="max-w-md">
              <span className="label-mono !text-white/60">JKIA express · 4h lead</span>
              <h2 className="font-serif text-3xl md:text-4xl text-white mt-2">{departureDrop.name}</h2>
              <div className="flex items-baseline gap-4 mt-3">
                <span className="font-mono text-lg text-white">
                  {formatDualPrice(departureDrop.price_usd, departureDrop.price_kes)}
                </span>
              </div>
              <p className="text-white/75 text-sm mt-4 max-w-md leading-relaxed">{departureDrop.contents}</p>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline border-white/40 text-white hover:bg-white hover:text-black mt-6">
                Order on WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Right — typography blocks */}
        <div className="container-page lg:px-12 xl:px-16 py-12 md:py-16 lg:py-20 flex flex-col justify-center space-y-12">
          <header>
            <span className="chip-bronze">4-hour JKIA delivery</span>
            <h1 className="h-display text-4xl md:text-5xl lg:text-6xl mt-5 mb-6 leading-[1.05] text-obsidian">
              Last-minute Kenya gifts at JKIA
            </h1>
            <p className="text-lg text-ink-mute leading-relaxed max-w-lg">
              Time is your most valuable asset. If your journey is coming to a close and you
              missed the markets, Hazina Nomads intercepts your departure. Premium, curated Kenyan
              treasures delivered hand-to-hand directly to your terminal check-in at JKIA within a
              tight four-hour window.
            </p>
            <TrustRow className="mt-8" />
          </header>

          <div className="editorial-rule space-y-4">
            <h3 className="font-serif text-xl text-obsidian">Flight Coordinates</h3>
            <ul className="text-ink-mute space-y-3 text-sm leading-relaxed">
              <li>JKIA terminal number (e.g. 1A, 1E)</li>
              <li>Departure time — at least four hours from confirmation</li>
              <li>Reachable WhatsApp or mobile number</li>
              <li>Passenger name for the handoff</li>
            </ul>
          </div>

          <div className="editorial-rule space-y-3">
            <h3 className="font-serif text-xl text-obsidian">Beyond the terminal</h3>
            <p className="text-ink-mute text-sm leading-relaxed">
              Hotel delivery to Westlands, Kilimani, and Karen. If the flight leaves before the
              parcel does, we can quote insured DHL export instead. Explore our full{" "}
              <Link href="/collections" className="text-bronze hover:text-bronze-dark transition-colors">
                collections
              </Link>{" "}
              for longer lead-time boxes with personalisation.
            </p>
          </div>

          <div className="relative aspect-[16/10] overflow-hidden shadow-soft">
            <Image
              src="/brand/safari-sunset.jpg"
              alt="Kenyan safari at sunset — the journey home with a Hazina treasure"
              fill
              className="object-cover contrast-[1.05]"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
            <p className="absolute bottom-4 left-4 right-4 font-serif text-sand text-lg drop-shadow-lg">
              Real Kenyan coffee, Maasai beadwork, and artisan leather — not airport trinkets.
            </p>
          </div>
        </div>
      </section>

      {/* Why travellers choose us — dark section */}
      <section className="section-dark py-16 md:py-20">
        <div className="container-page">
          <span className="label-mono text-sand/40">The distinction</span>
          <h2 className="h-display text-3xl md:text-4xl mt-3 mb-10 text-sand">
            Why discerning travellers choose us
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            <Reason
              title="Curated, never generic"
              body="Real Kenyan coffee, Maasai beadwork, and artisan leather — assembled with intention, not convenience."
            />
            <Reason
              title="Four-hour JKIA window"
              body="Pre-packed Departure Drop collections ready for swift dispatch to any terminal gate."
            />
            <Reason
              title="Concierge on WhatsApp"
              body="Confirm terminal, payment, and handoff in a single discreet conversation — M-Pesa or USD card."
            />
          </div>
        </div>
      </section>

      <div className="container-page py-16 text-center space-y-4">
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-dark">
          Order on WhatsApp
        </a>
        <p className="label-mono text-ink-mute">
          Dispatch coordination 08:00–20:00 EAT · Late requests after 20:00 incur USD 15 fee
        </p>
      </div>
      <StickyWhatsAppCTA message={orderMessage} />
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
