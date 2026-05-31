import Link from "next/link";
import { BRAND } from "@/lib/products";
import { whatsappLink } from "@/lib/format";

const NAV = [
  { href: "/treasures", label: "Treasures" },
  { href: "/collections", label: "Collections" },
  { href: "/build", label: "Build" },
  { href: "/premium-safari-souvenirs-nairobi", label: "Safari" },
  { href: "/last-minute-kenya-gifts-jkia", label: "JKIA" },
  { href: "/about", label: "About" },
];

export function Nav() {
  const wa = whatsappLink(BRAND.whatsapp, "Hello — I'd like help choosing a gift box.");
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-sand/85 border-b border-border">
      <div className="container-page flex items-center justify-between h-16 md:h-[4.5rem]">
        <Link href="/" className="group leading-none">
          <span className="font-serif text-xl md:text-2xl uppercase tracking-wide text-obsidian">
            Hazina{" "}
            <span className="italic normal-case text-bronze tracking-normal">Nomads</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="font-mono text-[10px] uppercase tracking-editorial text-ink-mute hover:text-obsidian transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-dark text-[10px] py-2.5 px-5">
          Concierge
        </a>
      </div>
    </header>
  );
}
