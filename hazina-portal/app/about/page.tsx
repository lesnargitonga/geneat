import type { Metadata } from "next";
import { BRAND } from "@/lib/products";
import { whatsappLink } from "@/lib/format";

export const metadata: Metadata = {
  title: "About · Hazina Nomads",
  description:
    "Hazina Nomads is a private sourcing house for refined African treasures, beginning in Kenya.",
};

export default function AboutPage() {
  const wa = whatsappLink(BRAND.whatsapp, "Hello Hazina Nomads — I would like to speak with a concierge.");

  return (
    <>
      <article className="container-page pt-10 md:pt-16 pb-16 md:pb-24 max-w-4xl">
        <header className="mb-12 md:mb-16">
          <span className="label-mono">About Hazina Nomads</span>
          <h1 className="h-display text-5xl md:text-7xl leading-[0.95] mt-4 text-obsidian">
            Born in Kenya. Curating Africa. Delivered to the world.
          </h1>
        </header>

        <section className="space-y-6 text-ink-mute text-lg leading-relaxed max-w-3xl">
          <p>
            <em className="text-obsidian not-italic font-serif text-xl">Hazina</em> means treasure.
          </p>
          <p>
            Hazina Nomads is a private sourcing house for refined African treasures, beginning in Kenya.
          </p>
          <p>
            We curate premium gifts, heritage pieces, travel keepsakes, and corporate gifting for
            travellers, safari guests, diaspora families, hotels, and global clients who want meaningful
            African pieces without the uncertainty of crowded markets, rushed shopping, inconsistent quality,
            or complicated logistics.
          </p>
        </section>
      </article>

      <section className="section-dark py-16 md:py-20">
        <div className="container-page grid gap-10 md:grid-cols-3">
          {[
            {
              title: "Bespoke Curation",
              body: "We help clients choose finished collections or open a private sourcing brief for something specific, meaningful, and properly presented.",
            },
            {
              title: "Seamless Logistics",
              body: "We coordinate handoff to hotels, safari lodges, residences, JKIA departure points, partner hosts, and other approved locations.",
            },
            {
              title: "Global Export",
              body: "For clients sending gifts abroad, we prepare export by quote and avoid promises until logistics and eligibility are confirmed.",
            },
          ].map((item) => (
            <div key={item.title} className="border border-sand/10 p-6 md:p-8">
              <span className="label-mono text-bronze-light">{item.title}</span>
              <p className="mt-4 text-sand/70 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-16 md:py-20 max-w-4xl">
        <span className="label-mono">What we believe</span>
        <h2 className="h-display text-3xl md:text-4xl mt-3 text-obsidian">
          African craft deserves a refined, trustworthy bridge to the world.
        </h2>
        <div className="mt-6 grid gap-6 text-ink-mute leading-relaxed md:grid-cols-2">
          <p>
            We begin with Kenya because it is our home market and our proof point. Every collection,
            partner relationship, and handoff process is built carefully before expansion.
          </p>
          <p>
            Our ambition is continental, but our method is disciplined: region by region, partner by
            partner, with respect for origin, quality, and client trust.
          </p>
        </div>
      </section>

      <section className="container-page pb-20 max-w-4xl">
        <div className="panel-luxury p-8 md:p-10 text-center">
          <span className="label-mono">Who we serve</span>
          <h3 className="font-serif text-3xl text-obsidian mt-3">
            Travellers, safari guests, diaspora families, hosts, hotels, and corporate teams.
          </h3>
          <p className="text-ink-mute leading-relaxed mt-4 max-w-2xl mx-auto">
            Whether you need a finished Kenyan collection, a departure-sensitive gift, a corporate
            brief, or a private sourcing request, the concierge desk helps shape the brief before
            payment or preparation.
          </p>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-dark mt-8 inline-flex">
            Speak with Concierge
          </a>
          <p className="text-sm text-ink-mute mt-5">
            <a href={`mailto:${BRAND.email}`} className="hover:text-obsidian transition-colors">
              {BRAND.email}
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
