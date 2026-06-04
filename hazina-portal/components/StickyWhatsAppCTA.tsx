import { BRAND } from "@/lib/products";
import { whatsappLink } from "@/lib/format";

export function StickyWhatsAppCTA({
  message,
  label = "Private WhatsApp",
  phone = BRAND.whatsapp,
}: {
  message: string;
  label?: string;
  phone?: string;
}) {
  const href = whatsappLink(phone, message);

  return (
    <div className="sticky-wa-cta fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-[#111111]/72 px-3 py-2 shadow-editorial backdrop-blur-md transition-opacity duration-300 md:hidden">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-[#141414]/90 px-4 font-mono text-[11px] uppercase tracking-[0.15em] text-white transition-colors hover:bg-[#1b1b1b]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M20 12a8 8 0 0 1-11.7 7l-4.3 1.1 1.2-4.2A8 8 0 1 1 20 12Z" />
          <path d="M9.4 10.3c.2-.5.4-.5.7-.5h.4c.1 0 .3.1.3.3l.6 1.5c.1.2 0 .3-.1.5l-.4.5c-.1.1-.1.3 0 .4.3.6.9 1.2 1.5 1.5.1.1.3.1.4 0l.5-.4c.1-.1.3-.1.5-.1l1.5.6c.2.1.3.2.3.3v.4c0 .3 0 .5-.5.7-.5.2-1.1.3-1.7.1-1-.3-2-.9-2.9-1.8s-1.5-1.9-1.8-2.9c-.2-.6-.1-1.2.1-1.7Z" />
        </svg>
        <span>{label}</span>
      </a>
    </div>
  );
}
