import Image from "next/image";
import Link from "next/link";
import { Cafe } from "@/lib/cafes";
import { OpenNowBadge } from "./OpenNowBadge";

export function CafeCard({ cafe }: { cafe: Cafe }) {
  return (
    <Link
      href={`/cafes/${cafe.slug}`}
      className="card group overflow-hidden flex flex-col hover:-translate-y-0.5 transition"
    >
      <div className="relative aspect-[5/3] overflow-hidden">
        <Image
          src={cafe.photo}
          alt={cafe.name}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover group-hover:scale-105 transition duration-500"
        />
        <div
          className="absolute top-3 left-3 inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-white shadow text-xl"
          aria-hidden
        >
          {cafe.hero_emoji}
        </div>
        {cafe.featured && (
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded-full bg-ink text-cream text-[10px] uppercase tracking-wider font-semibold">
            ★ Flagship demo
          </div>
        )}
        <div className="absolute top-3 right-3"><OpenNowBadge cafe={cafe} /></div>
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">
            {cafe.category}
          </div>
          <h3 className="h-display text-xl">{cafe.name}</h3>
          <p className="text-sm text-ink-soft mt-1">{cafe.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {cafe.tags.slice(0, 4).map((t) => (
            <span key={t} className="chip-mute">{t}</span>
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-ink/5">
          <span className="text-xs text-ink-mute">
            Avg prep · <strong className="text-ink">{cafe.avg_prep_minutes} min</strong>
          </span>
          <span className="text-sm font-semibold text-brand">View menu →</span>
        </div>
      </div>
    </Link>
  );
}
