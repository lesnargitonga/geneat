import Link from "next/link";
import { CAFES } from "@/lib/cafes";
import { OpenNowBadge } from "@/components/OpenNowBadge";

export const metadata = { title: "Campus map · Gen-Eat" };

export default function MapPage() {
  // Bounding box around USIU main campus
  const bbox = "36.8830,-1.2215,36.8885,-1.2175";
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`;

  return (
    <>
      <header className="mb-10">
        <h1 className="h-display text-4xl md:text-5xl">USIU campus map</h1>
        <p className="text-ink-soft mt-2 max-w-xl">
          All four Gen-Eat partner cafés on one map. Tap a café for its full menu.
        </p>
      </header>

      <div className="grid lg:grid-cols-[1.4fr,1fr] gap-6">
        <div className="card overflow-hidden">
          <iframe
            title="USIU campus map"
            src={src}
            className="w-full h-[500px] border-0"
            loading="lazy"
          />
        </div>
        <ul className="space-y-3">
          {CAFES.map((c) => (
            <li key={c.slug}>
              <Link href={`/cafes/${c.slug}`} className="card p-5 flex items-center gap-4 hover:-translate-y-0.5 transition">
                <div className="w-12 h-12 rounded-2xl bg-cream flex items-center justify-center text-2xl">
                  {c.hero_emoji}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="h-display text-lg">{c.name}</span>
                    <OpenNowBadge cafe={c} />
                  </div>
                  <div className="text-xs text-ink-mute">{c.location}</div>
                </div>
                <span className="text-brand text-sm font-semibold">View →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
