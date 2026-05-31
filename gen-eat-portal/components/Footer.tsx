import Link from "next/link";
import { BRAND } from "@/lib/products";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink/5 bg-white/40">
      <div className="container-page py-12 grid md:grid-cols-4 gap-8 text-sm">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-brand text-white">
              <span className="font-bold">H</span>
            </span>
            <span className="h-display text-xl">
              Hazina <span className="text-brand">Nomads</span>
            </span>
          </div>
          <p className="text-ink-mute max-w-md">
            {BRAND.tagline} Premium Kenyan gift boxes for travellers — delivered
            to your hotel or JKIA terminal before you depart.
          </p>
          <p className="text-xs text-ink-mute mt-4">
            Nairobi · Westlands, Kilimani, Karen &amp; JKIA · Built by Omni AI
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Shop</h4>
          <ul className="space-y-2 text-ink-mute">
            <li><Link className="hover:text-ink" href="/collections">All collections</Link></li>
            <li><Link className="hover:text-ink" href="/last-minute-kenya-gifts-jkia">JKIA last-minute</Link></li>
            <li><Link className="hover:text-ink" href="/about">Our story</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Concierge</h4>
          <ul className="space-y-2 text-ink-mute">
            <li><a className="hover:text-ink" href={`mailto:${BRAND.email}`}>{BRAND.email}</a></li>
            <li><span>{BRAND.phone}</span></li>
            <li><span className="text-xs">Dispatch 08:00–20:00 EAT</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink/5 py-5 text-center text-xs text-ink-mute">
        © {new Date().getFullYear()} Hazina Nomads · Powered by Omni AI
      </div>
    </footer>
  );
}
