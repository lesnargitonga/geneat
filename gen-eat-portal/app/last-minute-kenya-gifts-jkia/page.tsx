import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND, getGiftBox } from "@/lib/products";
import { formatKES, whatsappLink } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";

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
    images: [{ url: "/products/departure-drop.png", alt: "The Departure Drop gift box" }],
  },
};

export default function JkiaLandingPage() {
  const departureDrop = getGiftBox("departure-drop")!;
  const wa = whatsappLink(
    BRAND.whatsapp,
    "Hi — I need a last-minute gift delivered to JKIA. My flight departs at [time], terminal [number].",
  );

  return (
    <>
      <header className="mb-10 max-w-3xl">
        <span className="chip-ok">4-hour JKIA delivery</span>
        <h1 className="h-display text-4xl md:text-5xl mt-3 mb-4 leading-tight">
          Last-minute Kenya gifts at JKIA
        </h1>
        <p className="text-lg text-ink-soft">
          Forgot to buy souvenirs? Hazina Nomads delivers premium curated gift boxes
          directly to your JKIA terminal — usually within 4 hours of order confirmation.
        </p>
      </header>

      <section className="grid md:grid-cols-2 gap-8 mb-16">
        <div className="card p-0 overflow-hidden flex flex-col">
          <ProductImage box={departureDrop} priority className="rounded-none aspect-[16/10]" sizes="(max-width: 768px) 100vw, 50vw" />
          <div className="p-6 md:p-8 space-y-4 flex-1 flex flex-col">
            <h2 className="h-display text-2xl">The Departure Drop</h2>
            <p className="text-ink-soft text-sm">{departureDrop.contents}</p>
            <div className="flex items-baseline gap-3">
              <span className="h-display text-2xl">{formatKES(departureDrop.price_kes)}</span>
              <span className="text-ink-mute">USD {departureDrop.price_usd}</span>
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex mt-auto">
              Order for my flight →
            </a>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold mb-2">What we need from you</h3>
            <ul className="text-sm text-ink-soft space-y-2 list-disc list-inside">
              <li>JKIA terminal number (e.g. 1A, 1E)</li>
              <li>Departure time (at least 4 hours from now)</li>
              <li>Reachable WhatsApp / phone number</li>
              <li>Passenger name for the handoff</li>
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold mb-2">Also available</h3>
            <p className="text-sm text-ink-soft">
              Hotel delivery to Westlands, Kilimani, and Karen — browse our full{" "}
              <Link href="/collections" className="text-brand font-semibold hover:underline">
                collections
              </Link>{" "}
              for longer lead-time boxes with personalization.
            </p>
          </div>
          <div className="relative aspect-[16/9] rounded-3xl overflow-hidden">
            <Image
              src="/brand/safari-sunset.jpg"
              alt="Kenyan safari at sunset — the journey home with a Hazina treasure"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
            <p className="absolute bottom-4 left-4 right-4 text-cream text-sm">
              Real Kenyan coffee, Maasai beadwork, and artisan leather — not airport trinkets.
            </p>
          </div>
        </div>
      </section>

      <section className="card p-8 md:p-10 bg-sage-soft/40 mb-12">
        <h2 className="h-display text-2xl mb-4">Why travellers choose us</h2>
        <div className="grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-2xl mb-2">🎁</div>
            <strong className="block mb-1">Curated, not generic</strong>
            <p className="text-ink-soft">Real Kenyan coffee, Maasai beadwork, and artisan leather — not airport trinkets.</p>
          </div>
          <div>
            <div className="text-2xl mb-2">⏱️</div>
            <strong className="block mb-1">4-hour JKIA window</strong>
            <p className="text-ink-soft">Pre-packed Departure Drop boxes ready for fast dispatch to any terminal.</p>
          </div>
          <div>
            <div className="text-2xl mb-2">💬</div>
            <strong className="block mb-1">Concierge on WhatsApp</strong>
            <p className="text-ink-soft">Confirm terminal and payment in one chat — M-Pesa or USD card.</p>
          </div>
        </div>
      </section>

      <div className="text-center">
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Chat with concierge →
        </a>
        <p className="text-xs text-ink-mute mt-4">
          Dispatch coordination 08:00–20:00 EAT · Late requests after 20:00 incur USD 15 fee
        </p>
      </div>
    </>
  );
}
