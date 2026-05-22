import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { CAFES, getCafe } from "@/lib/cafes";
import { OpenNowBadge } from "@/components/OpenNowBadge";
import { ChatWidget } from "@/components/ChatWidget";
import { MenuItemThumb } from "@/components/MenuItemThumb";
import { QuickOrderPrompts } from "@/components/QuickOrderPrompts";
import { formatKES, whatsappLink } from "@/lib/format";
import type { Cafe, MenuItem, MenuSection } from "@/lib/cafes";

const BACKEND_BASE =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (process.env.VERCEL ? "https://api.lesnarai.co.ke" : "http://localhost:8000");

function normalizePhotoKey(value: string) {
  return (value || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim();
}

function matchPhoto(itemName: string, photos: Record<string, string>) {
  const normalized = normalizePhotoKey(itemName);
  if (!normalized) return null;
  if (photos[normalized]) return photos[normalized];
  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));
  const keys = Object.keys(photos).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const normalizedKey = normalizePhotoKey(key);
    if (!normalizedKey) continue;
    const keyTokens = new Set(normalizedKey.split(/\s+/).filter(Boolean));
    if (normalized.includes(normalizedKey)) return photos[key];
    for (const token of keyTokens) {
      if (tokens.has(token)) return photos[key];
    }
  }
  return null;
}

function applyMenuPhotoOverrides(cafe: Cafe, photos: Record<string, string>): Cafe {
  if (!photos || Object.keys(photos).length === 0) return cafe;
  const overrideItem = (item: MenuItem): MenuItem => {
    const matched = matchPhoto(item.name, photos);
    return matched ? { ...item, image: matched } : item;
  };
  const overrideSection = (section: MenuSection): MenuSection => ({
    ...section,
    items: section.items.map(overrideItem),
  });
  return {
    ...cafe,
    menuPreview: cafe.menuPreview.map(overrideItem),
    menuFull: cafe.menuFull.map(overrideSection),
  };
}

async function loadMenuPhotoOverrides(slug: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${BACKEND_BASE}/catalog/businesses/${slug}/menu-photos`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    const body = await res.json();
    return typeof body?.photos === "object" && body?.photos ? body.photos : {};
  } catch {
    return {};
  }
}

export function generateStaticParams() {
  return CAFES.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const c = getCafe(params.slug);
  if (!c) return { title: "Café not found" };
  return { title: `${c.name} · Gen-Eat`, description: c.tagline };
}

export default async function CafePage({ params }: { params: { slug: string } }) {
  const baseCafe = getCafe(params.slug);
  if (!baseCafe) return notFound();
  const photoOverrides = await loadMenuPhotoOverrides(params.slug);
  const cafe = applyMenuPhotoOverrides(baseCafe, photoOverrides);

  const isLilyPondDemo = cafe.slug === "lily-pond-cafe";
  const waText = isLilyPondDemo
    ? "Hi Lily Pond, I want the KES 10 demo espresso. My name is Lesnar."
    : `Hi ${cafe.name}! I'd like to order.`;
  const wa = whatsappLink(cafe.whatsapp, waText);
  const waLabel = isLilyPondDemo ? "Order KES 10 on WhatsApp" : "Order on WhatsApp";
  const photoShowcase = cafe.menuFull
    .flatMap((section) => section.items)
    .filter((item) => item.image)
    .slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="grid md:grid-cols-[1.2fr,1fr] gap-8 items-stretch mb-12">
        <div className="card overflow-hidden relative aspect-[5/3] md:aspect-auto">
          <Image src={cafe.photo} alt={cafe.name} fill className="object-cover" priority />
        </div>
        <div className="card p-7 md:p-9 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-mute mb-1">
                {cafe.category}
              </div>
              <h1 className="h-display text-3xl md:text-4xl flex items-center gap-2">
                <span>{cafe.hero_emoji}</span> {cafe.name}
              </h1>
              <p className="text-ink-soft mt-2">{cafe.tagline}</p>
            </div>
            <OpenNowBadge cafe={cafe} />
          </div>
          <ul className="text-sm text-ink-soft space-y-1.5">
            <li>📍 {cafe.location}</li>
            <li>⏱ Avg prep · <strong className="text-ink">{cafe.avg_prep_minutes} min</strong></li>
            <li>💳 M-Pesa Till <strong className="text-ink">{cafe.mpesa_till}</strong></li>
            <li>🕒 {cafe.hours_summary}</li>
          </ul>
          <div className="flex flex-wrap gap-1.5">
            {cafe.tags.map((t) => <span key={t} className="chip-mute">{t}</span>)}
          </div>
          <div className="flex flex-wrap gap-3 mt-auto pt-3">
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary">
              {waLabel} →
            </a>
            <a href="#chat" className="btn-ghost">Or chat here</a>
          </div>
        </div>
      </section>

      {isLilyPondDemo && (
        <section
          className="card p-6 md:p-8 mb-12 grid md:grid-cols-[1.2fr,auto] gap-5 items-center"
          style={{ borderTop: `3px solid ${cafe.color}` }}
        >
          <div>
            <span className="chip-ok">Live demo path</span>
            <h2 className="h-display text-2xl mt-3 mb-2">Prove WhatsApp to paid order</h2>
            <p className="text-sm text-ink-soft leading-relaxed">
              Open WhatsApp, send the prefilled KES 10 demo espresso message, accept the
              M-Pesa STK push on your phone, then verify the paid order in the admin console.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-4 md:items-end lg:items-center md:justify-end">
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Scan QR code to order the KES 10 demo espresso on WhatsApp"
              className="self-start sm:self-auto rounded-2xl border border-ink/10 bg-white p-3 shadow-soft transition-transform hover:-translate-y-0.5"
            >
              <QRCodeSVG
                value={wa}
                size={148}
                level="M"
                includeMargin
                bgColor="#FFFFFF"
                fgColor="#1F2937"
                className="h-[148px] w-[148px]"
              />
              <div className="mt-2 text-center text-xs font-semibold text-ink">
                Scan to order
              </div>
            </a>
            <div className="flex flex-wrap gap-3 sm:max-w-xs md:justify-end">
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary">
                Order KES 10 on WhatsApp →
              </a>
              <a href="#chat" className="btn-ghost">Open web chat</a>
            </div>
          </div>
        </section>
      )}

      {/* Stats strip (flagship only) */}
      {cafe.stats && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {cafe.stats.map((s) => (
            <div key={s.label} className="card p-5 text-center">
              <div className="h-display text-2xl md:text-3xl" style={{ color: cafe.color }}>
                {s.value}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-ink-mute mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Owner story (flagship only) */}
      {cafe.story && (
        <section className="card p-7 md:p-10 mb-12 grid md:grid-cols-[1.3fr,1fr] gap-8 items-center">
          <div>
            <span className="chip-mute mb-3">Our story</span>
            <h2 className="h-display text-2xl md:text-3xl mb-3">{cafe.story.headline}</h2>
            <p className="text-ink-soft leading-relaxed mb-4">{cafe.story.body}</p>
            {cafe.story.quote && (
              <blockquote
                className="border-l-2 pl-4 text-ink italic"
                style={{ borderColor: cafe.color }}
              >
                "{cafe.story.quote}"
              </blockquote>
            )}
            {cafe.story.owner && (
              <p className="text-xs uppercase tracking-wider text-ink-mute mt-4">
                — {cafe.story.owner}
              </p>
            )}
          </div>
          {cafe.gallery && cafe.gallery[0] && (
            <div className="card overflow-hidden relative aspect-[4/3]">
              <Image
                src={cafe.gallery[0].src}
                alt={cafe.gallery[0].caption ?? cafe.name}
                fill
                className="object-cover"
              />
            </div>
          )}
        </section>
      )}

      {/* Today's specials (flagship only) */}
      {cafe.todaysSpecials && cafe.todaysSpecials.length > 0 && (
        <section className="mb-12">
          <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
            <div>
              <span className="chip-ok">Today only</span>
              <h2 className="h-display text-2xl md:text-3xl mt-2">Today's specials</h2>
            </div>
            <p className="text-xs text-ink-mute">Updates every morning · pre-order on WhatsApp</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {cafe.todaysSpecials.map((s) => (
              <div
                key={s.name}
                className="card p-5 hover:-translate-y-0.5 transition-transform"
                style={{ borderTop: `3px solid ${cafe.color}` }}
              >
                <div className="text-3xl mb-2">{s.emoji ?? "✨"}</div>
                <div className="h-display text-lg">{s.name}</div>
                {s.note && <p className="text-sm text-ink-soft mt-1">{s.note}</p>}
                <div className="mt-3 font-semibold" style={{ color: cafe.color }}>
                  {formatKES(s.price)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Gallery (flagship only) */}
      {cafe.gallery && cafe.gallery.length > 1 && (
        <section className="mb-12">
          <h2 className="h-display text-2xl md:text-3xl mb-4">Inside the café</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cafe.gallery.map((g) => (
              <div
                key={g.src}
                className="card overflow-hidden relative aspect-square group"
              >
                <Image
                  src={g.src}
                  alt={g.caption ?? cafe.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(min-width: 768px) 25vw, 50vw"
                />
                {g.caption && (
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-ink/80 to-transparent text-cream text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                    {g.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Menu preview + hours */}
      <section className="grid md:grid-cols-[2fr,1fr] gap-8 mb-16">
        <div className="card p-7 md:p-9">
          <h2 className="h-display text-2xl mb-1">Popular right now</h2>
          <p className="text-sm text-ink-mute mb-5">
            A taste of what's flying off the counter — full menu below.
          </p>
          <ul className="divide-y divide-ink/5">
            {cafe.menuPreview.map((m) => (
              <li key={m.name} className="py-3 flex items-center gap-4">
                <MenuItemThumb item={m} accent={cafe.color} />
                <span className="font-medium flex-1">{m.name}</span>
                <span className="text-ink-soft">{formatKES(m.price)}</span>
              </li>
            ))}
          </ul>
          <h3 className="h-display text-lg mt-8 mb-3">Why students love it</h3>
          <ul className="space-y-2">
            {cafe.highlights.map((h) => (
              <li key={h} className="flex gap-2 text-sm">
                <span className="text-brand">✦</span>{h}
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-7 md:p-9">
          <h2 className="h-display text-2xl mb-3">Open hours</h2>
          <table className="w-full text-sm">
            <tbody>
              {(["mon","tue","wed","thu","fri","sat","sun"] as const).map((d) => (
                <tr key={d} className="border-b border-ink/5 last:border-0">
                  <td className="py-2 capitalize text-ink-soft">{d}</td>
                  <td className="py-2 text-right font-medium">{cafe.hours[d]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="h-display text-lg mt-7 mb-2">Features</h3>
          <ul className="text-sm text-ink-soft space-y-1">
            {cafe.features.map((f) => <li key={f}>· {f}</li>)}
          </ul>
        </div>
      </section>

      {/* Full menu, grouped by section */}
      <section className="mb-16">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="h-display text-3xl">The full menu</h2>
            <p className="text-ink-soft text-sm mt-1">
              Tap the chat to ask about ingredients, allergens, or today's specials.
            </p>
          </div>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary">
            {waLabel} →
          </a>
        </div>
        <div className="grid gap-8">
          {cafe.menuFull.map((sec) => (
            <div key={sec.title} className="card p-6 md:p-8">
              <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
                <h3 className="h-display text-xl" style={{ color: cafe.color }}>
                  {sec.title}
                </h3>
                <span className="text-xs text-ink-mute">{sec.items.length} items</span>
              </div>
              {sec.blurb && (
                <p className="text-sm text-ink-soft mb-4">{sec.blurb}</p>
              )}
              <ul className="grid sm:grid-cols-2 gap-4 mt-3">
                {sec.items.map((m) => (
                  <li
                    key={m.name}
                    className="flex items-start gap-4 p-3 rounded-xl hover:bg-ink/[0.02] transition-colors"
                  >
                    <MenuItemThumb item={m} accent={cafe.color} size={72} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 justify-between">
                        <span className="font-medium truncate">{m.name}</span>
                        <span className="text-ink-soft text-sm whitespace-nowrap">
                          {formatKES(m.price)}
                        </span>
                      </div>
                      {m.note && (
                        <p className="text-xs text-ink-mute mt-0.5">{m.note}</p>
                      )}
                      {m.badges && m.badges.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {m.badges.map((b) => (
                            <span key={b} className="chip-mute text-[10px] uppercase tracking-wider">
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {photoShowcase.length > 0 && (
        <section className="mb-16">
          <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
            <div>
              <span className="chip-ok">Menu photos</span>
              <h2 className="h-display text-3xl mt-2">See what you’re ordering</h2>
            </div>
            <p className="text-sm text-ink-mute">
              Ask for any of these in chat and the AI can send the photo directly.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photoShowcase.map((item) => (
              <article key={item.name} className="card overflow-hidden">
                <div className="relative aspect-[4/3]">
                  <Image
                    src={item.image!}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-base">{item.name}</h3>
                      {item.note && <p className="text-sm text-ink-soft mt-1">{item.note}</p>}
                    </div>
                    <div className="text-sm font-semibold" style={{ color: cafe.color }}>
                      {formatKES(item.price)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <a
                      href={whatsappLink(cafe.whatsapp, `Hi ${cafe.name}, I want to order ${item.name}.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary !px-4 !py-2 text-xs"
                    >
                      Order on WhatsApp
                    </a>
                    <a href="#chat" className="btn-ghost !px-4 !py-2 text-xs">
                      Ask the AI
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials (flagship only) */}
      {cafe.testimonials && cafe.testimonials.length > 0 && (
        <section className="mb-12">
          <div className="text-center mb-6">
            <span className="chip-mute">What students say</span>
            <h2 className="h-display text-2xl md:text-3xl mt-2">Loved on campus</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {cafe.testimonials.map((t) => (
              <div key={t.name} className="card p-6">
                <div className="text-amber-500 mb-2" aria-label={`${t.rating ?? 5} stars`}>
                  {"★".repeat(t.rating ?? 5)}
                </div>
                <p className="text-sm text-ink leading-relaxed">"{t.text}"</p>
                <div className="mt-4 pt-3 border-t border-ink/5">
                  <div className="font-semibold text-sm">{t.name}</div>
                  {t.role && <div className="text-xs text-ink-mute">{t.role}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ask-prompts above chat */}
      <section
        id="chat"
        className="my-12 card p-8 md:p-12 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${cafe.color}10, transparent 60%)`,
        }}
      >
        <div className="text-center mb-6 relative z-10">
          <span className="chip-ok">Live AI · 24/7</span>
          <h2 className="h-display text-3xl mt-3 mb-2">Try the AI now</h2>
          <p className="text-ink-soft">
            Tap any prompt — you're talking to {cafe.name}'s AI in seconds.
          </p>
        </div>
        <QuickOrderPrompts cafeSlug={cafe.slug} prompts={cafe.askPrompts} />
        <div className="text-center mt-8 flex flex-wrap gap-3 justify-center relative z-10">
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary">
            {waLabel} →
          </a>
          <Link href="/cafes" className="btn-ghost">← all cafés</Link>
        </div>
      </section>

      <ChatWidget cafe={cafe} />
    </>
  );
}
