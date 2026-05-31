import Link from "next/link";
import { BRAND } from "@/lib/products";
import { whatsappLink } from "@/lib/format";

const NAV = [
  { href: "/collections", label: "Collections" },
  { href: "/last-minute-kenya-gifts-jkia", label: "JKIA gifts" },
  { href: "/about", label: "About" },
];

export function Nav() {
  const wa = whatsappLink(BRAND.whatsapp, "Hello — I'd like help choosing a gift box.");
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-cream/80 border-b border-ink/5">
      <div className="container-page flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-brand text-white shadow-pop">
            <span className="text-lg font-bold">H</span>
          </span>
          <span className="h-display text-xl">
            Hazina <span className="text-brand">Nomads</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-2 rounded-xl text-sm text-ink-soft hover:text-ink hover:bg-white/70 transition"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm py-2 px-4">
          Chat concierge
        </a>
      </div>
    </header>
  );
}
