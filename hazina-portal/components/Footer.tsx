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
            {BRAND.tagline} A premium travel concierge — curated Kenyan treasures
            delivered to your hotel, JKIA terminal, or quoted for insured DHL export.
          </p>
          <p className="label-mono text-sand/40">
            Nairobi · Hotels · JKIA · DHL export quotes
          </p>
        </div>
        <div className="md:col-span-3">
          <h4 className="label-mono text-sand/50 mb-4">Collections</h4>
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
          <h4 className="label-mono text-sand/50 mb-4">Concierge</h4>
          <ul className="space-y-2.5 text-sm text-sand/70">
            <li>
              <a className="hover:text-sand transition-colors" href={`mailto:${BRAND.email}`}>
                {BRAND.email}
              </a>
            </li>
            <li>{BRAND.phone}</li>
            <li className="label-mono text-sand/40 pt-1">Dispatch 08:00–20:00 EAT · Export by quote</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-sand/10 py-6 text-center label-mono text-sand/30">
        © {new Date().getFullYear()} Hazina Nomads
      </div>
    </footer>
  );
}
