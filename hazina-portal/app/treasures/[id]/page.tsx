import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TREASURES, CATEGORY_LABELS, getTreasure } from "@/lib/treasures";
import { BRAND } from "@/lib/products";
import { formatKES, whatsappLink } from "@/lib/format";

type Props = { params: { id: string } };

export function generateStaticParams() {
  return TREASURES.map((t) => ({ id: t.id }));
}

export function generateMetadata({ params }: Props): Metadata {
  const item = getTreasure(params.id);
  if (!item) return { title: "Treasure not found" };
  return {
    title: `${item.name} · Hazina Nomads`,
    description: item.description,
  };
}

export default function TreasureDetailPage({ params }: Props) {
  const item = getTreasure(params.id);
  if (!item) notFound();

  const wa = whatsappLink(
    BRAND.whatsapp,
    `Hi — I'd like to add "${item.name}" (${item.sku}) to my gift box.`,
  );
  const related = TREASURES.filter((t) => t.category === item.category && t.id !== item.id).slice(0, 4);

  return (
    <>
      <div className="container-page pt-10 md:pt-16 pb-16">
        <Link href="/treasures" className="label-mono text-bronze hover:text-obsidian">
          ← All treasures
        </Link>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 mt-8">
          <div className="relative aspect-[4/5] overflow-hidden bg-sand-dark shadow-editorial">
            <Image
              src={item.image}
              alt={item.imageAlt}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>

          <div className="space-y-6">
            <span className="label-mono">{CATEGORY_LABELS[item.category]} · {item.sku}</span>
            <h1 className="h-display text-4xl md:text-5xl text-obsidian">{item.name}</h1>
            <div className="font-mono text-lg text-bronze">
              {formatKES(item.price_kes)} · USD {item.price_usd}
            </div>
            <p className="text-ink-mute text-lg leading-relaxed">{item.description}</p>

            <div className="editorial-rule space-y-3 text-sm text-ink-mute">
              {item.origin && (
                <p>
                  <span className="text-obsidian font-mono text-[10px] uppercase tracking-editorial block mb-1">
                    Origin
                  </span>
                  {item.origin}
                </p>
              )}
              {item.lead_time_hours && (
                <p>
                  <span className="text-obsidian font-mono text-[10px] uppercase tracking-editorial block mb-1">
                    Lead time
                  </span>
                  {item.lead_time_hours} hours
                </p>
              )}
              {item.personalization && (
                <p>
                  <span className="text-obsidian font-mono text-[10px] uppercase tracking-editorial block mb-1">
                    Personalisation
                  </span>
                  Available — confirm details with concierge
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                href={`/build?add=${item.id}`}
                className="btn-dark"
              >
                Add to custom box
              </Link>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline">
                Ask concierge
              </a>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-20 pt-12 border-t border-border">
            <h2 className="font-serif text-2xl text-obsidian mb-8">More in {CATEGORY_LABELS[item.category]}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {related.map((r) => (
                <Link key={r.id} href={`/treasures/${r.id}`} className="group">
                  <div className="relative aspect-square overflow-hidden bg-sand-dark mb-2">
                    <Image src={r.image} alt={r.imageAlt} fill className="object-cover group-hover:scale-105 transition-transform" sizes="200px" />
                  </div>
                  <p className="font-serif text-sm">{r.name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
