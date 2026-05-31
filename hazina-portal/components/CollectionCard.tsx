import Image from "next/image";
import type { GiftBox } from "@/lib/products";
import { BRAND } from "@/lib/products";
import { formatKES, whatsappLink } from "@/lib/format";

type Props = {
  box: GiftBox;
  className?: string;
  priority?: boolean;
};

export function CollectionCard({ box, className = "", priority }: Props) {
  const wa = whatsappLink(BRAND.whatsapp, `Hi — I'd like to reserve ${box.name}`);

  return (
    <article
      className={`group flex flex-col transition-shadow duration-500 hover:shadow-editorial ${className}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-sand-dark">
        <Image
          src={box.image}
          alt={box.imageAlt}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
          priority={priority}
        />
        <div className="absolute top-4 left-4 flex flex-wrap gap-2">
          <span className="chip-dark">{box.lead_time_hours}h lead</span>
          {box.jkia_only && <span className="chip-bronze bg-sand/90">JKIA express</span>}
        </div>
      </div>

      <div className="flex flex-col flex-1 pt-5">
        <div className="flex items-end justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl text-obsidian leading-tight">
              {box.name}
            </h2>
            <p className="label-mono mt-1">{box.sku}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-sm text-obsidian">{formatKES(box.price_kes)}</div>
            <div className="font-mono text-xs text-ink-mute">USD {box.price_usd}</div>
          </div>
        </div>

        <p className="text-ink-mute text-sm mt-4 leading-relaxed line-clamp-2">{box.contents}</p>

        {box.personalization && (
          <p className="label-mono text-bronze mt-2">
            {box.personalization_note || "Personalisation available"}
          </p>
        )}

        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline mt-6 w-full md:w-auto md:self-start"
        >
          Reserve Collection
        </a>
      </div>
    </article>
  );
}
