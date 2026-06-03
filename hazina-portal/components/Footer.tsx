import Link from "next/link";
import { BRAND } from "@/lib/products";

export function Footer() {
  return (
    <footer className="mt-0 section-dark">
      <div className="container-page py-16 md:py-20 grid md:grid-cols-12 gap-10 md:gap-8">
        <div className="md:col-span-5 space-y-4">
          <div className="font-serif text-2xl uppercase tracking-wide text-sand">
            Hazina{" "}
            <span className="italic normal-case text-bronze-light tracking-normal">Nomads</span>
          </div>
          <p className="text-sand/70 max-w-sm leading-relaxed">
            {BRAND.tagline} A premium travel concierge for bespoke curation,
            seamless logistics, and global export of Kenyan heritage pieces.
          </p>
          <p className="label-mono text-sand/40">
            {BRAND.triad}
          </p>
        </div>
        <div className="md:col-span-3">
          <h4 className="label-mono text-sand/50 mb-4">Bespoke Curation</h4>
          <p className="text-sm leading-relaxed text-sand/70">
            Sourcing unlisted artifacts and signature regional collections through our private
            network of artisans and estates.
          </p>
          <ul className="space-y-2.5 text-sm text-sand/70">
            <li>
              <Link className="hover:text-sand transition-colors" href="/collections">
                All collections
              </Link>
            </li>
            <li>
              <Link
                className="hover:text-sand transition-colors"
                href="/premium-safari-souvenirs-nairobi"
              >
                Safari souvenirs
              </Link>
            </li>
            <li>
              <Link className="hover:text-sand transition-colors" href="/collections/kenya-edit">
                The Kenya Edit
              </Link>
            </li>
            <li>
              <Link className="hover:text-sand transition-colors" href="/collections/departure-drop">
                JKIA Departure Drop
              </Link>
            </li>
            <li>
              <Link className="hover:text-sand transition-colors" href="/build">
                Build a custom box
              </Link>
            </li>
            <li>
              <Link className="hover:text-sand transition-colors" href="/about">
                Our story
              </Link>
            </li>
          </ul>
        </div>
        <div className="md:col-span-4">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h4 className="label-mono text-sand/50 mb-4">Seamless Logistics</h4>
              <p className="text-sm leading-relaxed text-sand/70">
                Discreet, nationwide fulfillment directly to your metropolitan residence,
                coastal villa, or private wilderness lodge.
              </p>
            </div>
            <div>
              <h4 className="label-mono text-sand/50 mb-4">Global Export</h4>
              <p className="text-sm leading-relaxed text-sand/70">
                End-to-end international transit and customs-ready export quotes, delivering
                verified heritage pieces to your home or corporate headquarters.
              </p>
            </div>
          </div>
          <ul className="mt-8 space-y-2.5 text-sm text-sand/70">
            <li>
              <a className="hover:text-sand transition-colors" href={`mailto:${BRAND.email}`}>
                {BRAND.email}
              </a>
            </li>
            <li>{BRAND.phone}</li>
            <li className="label-mono text-sand/40 pt-1">Concierge desk 08:00–20:00 EAT · Export by quote</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-sand/10 py-6 text-center label-mono text-sand/30">
        © {new Date().getFullYear()} Hazina Nomads
      </div>
    </footer>
  );
}
