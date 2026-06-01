import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/products";
import { whatsappLink } from "@/lib/format";

export const metadata: Metadata = {
  title: "Order tracking · Hazina Nomads",
  description: "Track your Hazina Nomads delivery with the secure link from WhatsApp.",
  robots: { index: false, follow: false },
};

/** Magic-link entry — guests arrive via /orders/HN-ORD-…?token=… from WhatsApp. */
export default function OrdersIndexPage() {
  const concierge = whatsappLink(
    BRAND.whatsapp,
    "Hello Hazina Nomads — I need help with my order tracking link.",
  );

  return (
    <div className="max-w-page mx-auto px-5 md:px-8 py-24 md:py-32 text-center">
      <p className="font-mono text-[13px] font-medium uppercase tracking-[0.14em] text-[#5C564E]">
        Order tracking
      </p>
      <h1 className="mt-4 font-serif text-3xl md:text-4xl text-[#FAF8F5] leading-tight max-w-lg mx-auto">
        Open the secure link we sent you
      </h1>
      <p className="mt-6 font-sans text-base text-[#5C564E] max-w-md mx-auto leading-relaxed">
        After checkout, your WhatsApp confirmation includes a personal tracking URL
        (reference + token). Paste that full link here — it is not listed in the main menu.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link
          href="/"
          className="inline-flex min-h-[48px] items-center justify-center px-8 py-3 font-mono text-sm font-medium uppercase tracking-[0.12em] border border-white/20 text-[#FAF8F5]/90 hover:border-white/40 transition-colors"
        >
          Back to home
        </Link>
        <a
          href={concierge}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[48px] items-center justify-center px-8 py-3 font-mono text-sm font-medium uppercase tracking-[0.12em] border border-[#A67C52] text-[#A67C52] transition-colors duration-300 hover:bg-[#A67C52] hover:text-[#1C1A17]"
        >
          WhatsApp concierge
        </a>
      </div>
    </div>
  );
}
