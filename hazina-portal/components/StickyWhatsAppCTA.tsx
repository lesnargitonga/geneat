import { BRAND } from "@/lib/products";
import { whatsappLink } from "@/lib/format";

export function StickyWhatsAppCTA({
  message,
  label = "Order on WhatsApp",
}: {
  message: string;
  label?: string;
}) {
  const href = whatsappLink(BRAND.whatsapp, message);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sand/95 p-3 shadow-editorial backdrop-blur md:hidden">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-dark w-full"
      >
        {label}
      </a>
    </div>
  );
}
