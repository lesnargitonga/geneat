import Link from "next/link";

const NAV = [
  { href: "/cafes", label: "Cafés" },
  { href: "/map", label: "Campus map" },
  { href: "/owners", label: "For owners" },
  { href: "/about", label: "About" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-cream/80 border-b border-ink/5">
      <div className="container-page flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-brand text-white shadow-pop">
            <span className="text-lg font-bold">G</span>
          </span>
          <span className="h-display text-xl">
            Gen-<span className="text-brand">Eat</span>
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
        <Link href="/cafes" className="btn-primary text-sm py-2 px-4">
          Order now
        </Link>
      </div>
    </header>
  );
}
