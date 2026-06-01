import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Order tracking · Hazina Nomads",
  robots: { index: false, follow: false },
};

/** Full-viewport tracking shell — no auth; sits above main site chrome. */
export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#1C1A17] text-[#FAF8F5] font-sans antialiased">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1C1A17]/95 backdrop-blur-sm">
        <div className="max-w-page mx-auto px-5 md:px-8 h-14 flex items-center">
          <Link
            href="/"
            className="font-serif text-lg tracking-wide text-[#FAF8F5]/90 hover:text-[#FAF8F5] transition-colors"
          >
            Hazina <span className="italic text-[#A67C52]">Nomads</span>
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
