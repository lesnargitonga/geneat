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
  { href: "/premium-safari-souvenirs-nairobi", label: "Curation" },
  { href: "/about", label: "About" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(pathname !== "/");
  const wa = whatsappLink(BRAND.whatsapp, "Hello Hazina Nomads — I'd like help with bespoke curation.");
  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`showroom-nav sticky top-0 z-30 border-b border-border bg-sand/85 backdrop-blur-md ${
        scrolled ? "showroom-nav--scrolled" : ""
      }`}
    >
      <div className="container-page flex items-center justify-between h-16 md:h-[4.5rem]">
        <Link href="/" className="group leading-none" onClick={() => setOpen(false)} data-cursor="magnetic">
          <span className="font-serif text-xl md:text-2xl uppercase tracking-wide text-obsidian">
            Hazina{" "}
            <span className="italic normal-case text-bronze tracking-normal">Nomads</span>
          </span>
        </Link>
        <nav className="hidden lg:flex items-center gap-8">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              data-cursor="magnetic"
              className="nav-link"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-5">
          <ThemeToggle compact />
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="magnetic"
            className={`font-mono text-sm uppercase tracking-[0.12em] transition-all duration-300 ${
              showStickyCta
                ? "btn-bronze py-2.5 px-5 translate-y-0 opacity-100"
                : "text-ink-soft hover:text-obsidian translate-y-0.5 opacity-90"
            }`}
          >
            Continue on WhatsApp
          </a>
        </div>
        <div className="lg:hidden flex items-center gap-2">
          <ThemeToggle compact />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            data-cursor="native"
            className="inline-flex h-10 w-10 items-center justify-center border border-border text-obsidian"
          >
            {open ? "×" : "☰"}
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-border bg-sand">
          <nav className="container-page py-4 grid gap-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                data-cursor="native"
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
              data-cursor="native"
            >
              Continue on WhatsApp
            </a>
            <button
              type="button"
              className="btn-outline w-full"
              data-cursor="native"
              onClick={() => {
                setOpen(false);
                openConciergeChat();
              }}
            >
              Open guided chat
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
