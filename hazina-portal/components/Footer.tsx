import Link from "next/link";
import { MotionSafe } from "@/components/three-d/MotionSafe";
import { SpatialSection } from "@/components/three-d/SpatialSection";
import { BRAND } from "@/lib/products";

export function Footer() {
  return (
    <footer className="showroom-final-plaque mt-0 section-dark">
      <SpatialSection className="container-page py-16 md:py-20 grid md:grid-cols-12 gap-10 md:gap-8">
        <MotionSafe className="md:col-span-5 space-y-4">
          <div className="font-serif text-2xl uppercase tracking-wide text-sand">
            Hazina{" "}
            <span className="italic normal-case text-bronze-light tracking-normal">Nomads</span>
          </div>
          <p className="text-sand/70 max-w-sm leading-relaxed">
            A private sourcing house for refined African treasures, beginning in Kenya. We curate
            premium gifts, heritage pieces, travel keepsakes, and corporate gifting with discreet
            handoff and export by quote.
          </p>
          <p className="label-mono text-sand/40">
            {BRAND.triad}
          </p>
        </MotionSafe>
        <MotionSafe className="md:col-span-3" delay={0.08}>
          <h4 className="label-mono text-sand/50 mb-4">Bespoke Curation</h4>
          <p className="text-sm leading-relaxed text-sand/70">
            Sourcing premium gifts, heritage pieces, and private requests through a careful
            Kenyan concierge network.
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
                Curation brief
              </Link>
            </li>
            <li>
              <Link className="hover:text-sand transition-colors" href="/collections/kenya-edit">
                The Kenya Edit
              </Link>
            </li>
            <li>
              <Link className="hover:text-sand transition-colors" href="/collections/departure-drop">
                Departure-ready edit
              </Link>
            </li>
            <li>
              <Link className="hover:text-sand transition-colors" href="/build">
                Open a private brief
              </Link>
            </li>
            <li>
              <Link className="hover:text-sand transition-colors" href="/about">
                Our story
              </Link>
            </li>
          </ul>
        </MotionSafe>
        <MotionSafe className="md:col-span-4" delay={0.14}>
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h4 className="label-mono text-sand/50 mb-4">Seamless Logistics</h4>
              <p className="text-sm leading-relaxed text-sand/70">
                Discreet handoff to hotels, safari lodges, residences, JKIA departure points,
                and partner locations by arrangement.
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
            {BRAND.phone && <li>{BRAND.phone}</li>}
            <li className="label-mono text-sand/40 pt-1">Concierge desk 08:00–20:00 EAT · Export by quote</li>
          </ul>
        </MotionSafe>
      </SpatialSection>
      <div className="border-t border-sand/10 py-6 text-center label-mono text-sand/30">
        © {new Date().getFullYear()} Hazina Nomads
      </div>
    </footer>
  );
}
