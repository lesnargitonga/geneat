"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { openConciergeChat } from "@/components/ChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BRAND } from "@/lib/products";
import { whatsappLink } from "@/lib/format";

const NAV = [
  { href: "/collections", label: "Collections" },
  { href: "/build", label: "Build" },
  { href: "/premium-safari-souvenirs-nairobi", label: "Safari" },
  { href: "/about", label: "About" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(pathname !== "/");
  const wa = whatsappLink(BRAND.whatsapp, "Hello Hazina Nomads — I'd like to order a gift box.");
  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const onHero = pathname === "/" && !showStickyCta;

  useEffect(() => {
    if (pathname !== "/") {
      setShowStickyCta(true);
      return;
    }
    const onScroll = () => {
      const threshold = Math.max(420, Math.round(window.innerHeight * 0.62));
      setShowStickyCta(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-30 backdrop-blur-md transition-colors duration-500 ${
        onHero
          ? "border-b border-white/5 bg-black/25"
          : "border-b border-border bg-sand/85"
      }`}
    >
      <div className="container-page flex items-center justify-between h-16 md:h-[4.5rem]">
        <Link href="/" className="group leading-none" onClick={() => setOpen(false)}>
          <span
            className={`font-serif text-xl md:text-2xl uppercase tracking-wide ${
              onHero ? "text-stone-200" : "text-obsidian"
            }`}
          >
            Hazina{" "}
            <span
              className={`italic normal-case tracking-normal ${
                onHero ? "text-stone-400" : "text-bronze"
              }`}
            >
              Nomads
            </span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`relative py-2 font-mono text-xs font-medium uppercase tracking-[0.2em] transition-colors duration-300 ${
                onHero
                  ? isActive(n.href)
                    ? "text-stone-200 after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-px after:bg-white/30"
                    : "text-stone-400 hover:text-stone-200"
                  : isActive(n.href)
                    ? "text-obsidian after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-px after:bg-bronze"
                    : "text-ink-soft hover:text-obsidian"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-4">
          <ThemeToggle compact />
          <button
            type="button"
            onClick={openConciergeChat}
            className={onHero ? "btn-hero-link !min-h-0 !py-2" : "btn-ghost !min-h-0 !py-2.5 !px-4"}
          >
            Chat in app
          </button>
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className={
              onHero
                ? "btn-hero-glass !min-h-0 !py-2.5 !px-5"
                : showStickyCta
                  ? "btn-bronze py-2.5 px-5"
                  : "btn-hero-link !min-h-0 !py-2"
            }
          >
            Order on WhatsApp
          </a>
        </div>
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle compact />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            className="inline-flex h-10 w-10 items-center justify-center border border-border text-obsidian"
          >
            {open ? "×" : "☰"}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-sand">
          <nav className="container-page py-4 grid gap-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between border border-border px-4 py-3 font-mono text-sm uppercase tracking-[0.1em] ${
                  isActive(n.href) ? "bg-obsidian text-sand" : "text-obsidian"
                }`}
              >
              {n.label}
              <span aria-hidden="true">→</span>
            </Link>
            ))}
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-bronze w-full mt-2"
              onClick={() => setOpen(false)}
            >
              Order on WhatsApp
            </a>
            <button
              type="button"
              className="btn-outline w-full"
              onClick={() => {
                setOpen(false);
                openConciergeChat();
              }}
            >
              Chat in app
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
