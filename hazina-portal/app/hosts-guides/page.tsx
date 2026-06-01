import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND_IMAGES } from "@/lib/products";

export const metadata: Metadata = {
  title: "For Hosts & Guides · Hazina Nomads",
  description:
    "A premium Kenyan gift concierge for hotels, Airbnb hosts, safari guides, and travel planners serving guests in Nairobi.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function HostsGuidesPage() {
  return (
    <>
      <section className="container-page pt-10 md:pt-16 pb-12 md:pb-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="space-y-6">
            <span className="label-mono">For hosts, guides, drivers &amp; agents</span>
            <h1 className="h-display text-5xl md:text-7xl leading-[0.95] text-obsidian">
              Earn when guests buy premium Kenyan gifts.
            </h1>
            <p className="text-lg text-ink-mute leading-relaxed max-w-xl">
              Share a QR or WhatsApp link. We curate, collect payment, package, and deliver.
              You earn a commission without holding stock.
            </p>
            <div className="grid grid-cols-3 border border-border">
              <Stat value="15%" label="host commission" />
              <Stat value="KES / USD" label="guest payment" />
              <Stat value="0 stock" label="for partners" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/partners/login" className="btn-dark">
                Join referral program
              </Link>
              <Link href="/collections" className="btn-outline">
                See guest offer
              </Link>
            </div>
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

      <section className="section-dark py-14 md:py-16">
        <div className="container-page">
          <div className="max-w-2xl mb-8">
            <span className="label-mono text-sand/40">Who it is for</span>
            <h2 className="h-display text-3xl md:text-5xl text-sand mt-3">Built around tourist moments</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            <PartnerCard title="Airbnb hosts" body="Welcome-card QR in apartments across Kilimani, Westlands, Karen." />
            <PartnerCard title="Safari guides" body="Offer gifts on the drive back to Nairobi or before JKIA." />
            <PartnerCard title="Drivers" body="Commission on last-minute orders from guests heading to flights." />
            <PartnerCard title="Travel agents" body="Add curated Kenyan gifts to itineraries and honeymoon packs." />
          </div>
        </div>
      </section>

      <section className="container-page py-14 md:py-20">
        <div className="grid lg:grid-cols-[0.8fr,1.2fr] gap-10 lg:gap-14">
          <div>
            <span className="label-mono">How money flows</span>
            <h2 className="h-display text-3xl md:text-5xl text-obsidian mt-2">Simple commission model.</h2>
            <p className="text-ink-mute mt-4 leading-relaxed">
              Each partner gets a referral code or QR. When a guest buys through it, the order is tagged
              and commission is logged for payout.
            </p>
          </div>
          <div className="grid md:grid-cols-3 border border-border">
            <PayoutStep n="01" title="Share code" body="QR card, WhatsApp link, or printed itinerary." />
            <PayoutStep n="02" title="Guest pays" body="USD card or KES M-Pesa handled by Hazina." />
            <PayoutStep n="03" title="You earn" body="15% host commission on eligible gift-box sales." />
          </div>
        </div>
      </section>

      <section className="container-page pb-20 md:pb-24">
        <div className="border border-border bg-sand-dark/60 p-6 md:p-10 grid md:grid-cols-[1.3fr,0.7fr] gap-8 items-center">
          <div>
            <span className="label-mono">Partner kit</span>
            <h2 className="font-serif text-3xl text-obsidian mt-2">
              QR cards, guest scripts, and referral tracking prepared per partner.
            </h2>
            <p className="text-ink-mute mt-4 leading-relaxed">
              We prepare the guest-facing message, your referral code, and the handoff flow.
              You introduce the option; Hazina handles the rest.
            </p>
          </div>
          <Link href="/partners/login" className="btn-outline md:justify-self-end">
            Partner login
          </Link>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="p-4 border-r border-border last:border-r-0">
      <p className="font-serif text-2xl text-obsidian">{value}</p>
      <p className="label-mono mt-1">{label}</p>
    </div>
  );
}

function PartnerCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-sand/15 p-5">
      <h3 className="font-serif text-2xl text-sand">{title}</h3>
      <p className="text-sand/65 text-sm leading-relaxed mt-3">{body}</p>
    </div>
  );
}

function PayoutStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="p-5 md:p-6 border-b md:border-b-0 md:border-r border-border last:border-0">
      <p className="label-mono text-bronze">{n}</p>
      <h3 className="font-serif text-2xl text-obsidian mt-3">{title}</h3>
      <p className="text-sm text-ink-mute leading-relaxed mt-2">{body}</p>
    </div>
  );
}
