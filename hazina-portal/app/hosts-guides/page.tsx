import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND, BRAND_IMAGES, GIFT_BOXES } from "@/lib/products";
import { whatsappLink } from "@/lib/format";
import { TrustRow } from "@/components/TrustRow";
import { CollectionCard } from "@/components/CollectionCard";

export const metadata: Metadata = {
  title: "For Hosts & Guides · Hazina Nomads",
  description:
    "A premium Kenyan gift concierge for hotels, Airbnb hosts, safari guides, and travel planners serving guests in Nairobi.",
};

export default function HostsGuidesPage() {
  const partnerMessage =
    "Hello Hazina Nomads — I host or guide travellers in Nairobi and would like to offer curated gift boxes to my guests.";
  const wa = whatsappLink(BRAND.whatsapp, partnerMessage);

  return (
    <>
      <section className="container-page pt-10 md:pt-16 pb-16 md:pb-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="space-y-7">
            <span className="label-mono">For hosts &amp; guides</span>
            <h1 className="h-display text-5xl md:text-7xl leading-[0.95] text-obsidian">
              Add a premium Kenyan gift moment to every stay.
            </h1>
            <p className="text-lg text-ink-mute leading-relaxed max-w-xl">
              Hazina gives hotels, Airbnb hosts, safari guides, drivers, and travel planners a
              polished gift concierge without carrying stock. Guests order on WhatsApp; we curate,
              pack, collect payment, and deliver to the hotel, lobby, vehicle handoff, or JKIA.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-dark">
                Partner on WhatsApp
              </a>
              <Link href="/collections" className="btn-outline">
                View collections
              </Link>
            </div>
            <TrustRow />
          </div>

          <div className="relative aspect-[4/5] overflow-hidden shadow-editorial">
            <Image
              src={BRAND_IMAGES.atelierRoom}
              alt="Curated Kenyan craft pieces in a refined interior"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6 md:p-8">
              <p className="font-serif text-2xl text-sand">
                No stock. No awkward souvenir run. Just a clean guest experience.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-dark py-16 md:py-20">
        <div className="container-page">
          <div className="max-w-2xl mb-10">
            <span className="label-mono text-sand/40">How the partnership works</span>
            <h2 className="h-display text-3xl md:text-5xl text-sand mt-3">
              Designed for real guest operations
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <PartnerStep
              title="Share a link or QR"
              body="Place Hazina on a hotel card, welcome note, safari itinerary, WhatsApp message, or concierge desk QR."
            />
            <PartnerStep
              title="Guest orders directly"
              body="The traveller chooses a collection, pays in USD or KES, and gives hotel or flight details in the checkout workflow."
            />
            <PartnerStep
              title="We deliver discreetly"
              body="Hazina handles packaging, dispatch, WhatsApp updates, and handoff timing so your team stays light."
            />
          </div>
        </div>
      </section>

      <section className="container-page py-16 md:py-24">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-10">
          <div>
            <span className="label-mono">Host-friendly picks</span>
            <h2 className="h-display text-3xl md:text-5xl text-obsidian mt-2">
              Easy recommendations for guests
            </h2>
          </div>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-dark md:self-end">
            Partner on WhatsApp
          </a>
        </div>
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          <CollectionCard box={GIFT_BOXES[0]} priority />
          <CollectionCard box={GIFT_BOXES[3]} />
          <CollectionCard box={GIFT_BOXES[4]} />
        </div>
      </section>

      <section className="container-page pb-20 md:pb-24">
        <div className="border border-border bg-sand-dark/60 p-6 md:p-10 grid md:grid-cols-[1.3fr,0.7fr] gap-8 items-center">
          <div>
            <span className="label-mono">Pilot materials</span>
            <h2 className="font-serif text-3xl text-obsidian mt-2">
              QR cards, guest scripts, and referral tracking can be prepared per host.
            </h2>
            <p className="text-ink-mute mt-4 leading-relaxed">
              We can leave blank visual slots for your property photos, safari vehicle shots, or
              welcome-desk photography, then wire the page to your preferred handoff flow.
            </p>
          </div>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline md:justify-self-end">
            Request pilot pack
          </a>
        </div>
      </section>
    </>
  );
}

function PartnerStep({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l-2 border-bronze/50 pl-6">
      <h3 className="font-serif text-2xl text-sand">{title}</h3>
      <p className="text-sand/65 text-sm md:text-base leading-relaxed mt-3">{body}</p>
    </div>
  );
}
