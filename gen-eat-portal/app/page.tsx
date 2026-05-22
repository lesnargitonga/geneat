import Link from "next/link";
import { CAFES } from "@/lib/cafes";
import { CafeCard } from "@/components/CafeCard";
import { ChatWidget } from "@/components/ChatWidget";

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="grid md:grid-cols-2 gap-10 items-center pb-16 md:pb-24">
        <div className="space-y-6">
          <span className="chip-mute">USIU-Africa · Pilot live</span>
          <h1 className="h-display text-5xl md:text-7xl leading-[0.95]">
            Eat between<br />
            <span className="text-brand">classes.</span>
          </h1>
          <p className="text-lg text-ink-soft max-w-lg">
            One chat. Every café on campus. Order on WhatsApp while the
            lecturer's wrapping up — pick it up the moment you walk out.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/cafes/lily-pond-cafe" className="btn-primary">
              Try the live demo →
            </Link>
            <Link href="/cafes" className="btn-ghost">Browse all cafés</Link>
          </div>
          <p className="text-xs text-ink-mute -mt-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 align-middle animate-pulse" />
            Lily Pond Café · USIU · AI is answering right now
          </p>
          <div className="flex items-center gap-6 pt-3 text-sm text-ink-mute">
            <div>
              <div className="h-display text-2xl text-ink">4</div>
              campus cafés
            </div>
            <div>
              <div className="h-display text-2xl text-ink">3 min</div>
              avg pickup time
            </div>
            <div>
              <div className="h-display text-2xl text-ink">M-Pesa</div>
              direct to café
            </div>
          </div>
        </div>

        {/* Visual: stylised chat preview */}
        <div className="relative">
          <div className="absolute -top-6 -right-2 rotate-3 chip-ok text-sm">Open now</div>
          <div className="card p-5 max-w-md ml-auto">
            <div className="flex items-center gap-3 pb-3 border-b border-ink/5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-xl">☕</div>
              <div className="leading-tight">
                <div className="h-display text-base">Lily Pond Café</div>
                <div className="text-[11px] text-ink-mute">typically replies in seconds</div>
              </div>
            </div>
            <div className="space-y-2 py-4">
              <Outgoing>morning, flat white + almond croissant for 9:15?</Outgoing>
              <Incoming>
                Sasa 👋 Flat white + almond croissant for 9:15 — booked.
                KES 470, M-Pesa Till <strong>522001</strong>. I'll text you
                when it's on the shelf.
              </Incoming>
              <Outgoing>paying now</Outgoing>
              <Incoming>Got the green tick ✅ Ready by 9:13. Karibu!</Incoming>
            </div>
            <div className="pt-3 border-t border-ink/5 text-xs text-ink-mute flex items-center justify-between">
              <span>Live AI · 24/7</span>
              <span className="text-brand font-semibold">Order on WhatsApp →</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how" className="card p-8 md:p-12 mb-20">
        <h2 className="h-display text-3xl md:text-4xl mb-2">How it works</h2>
        <p className="text-ink-soft mb-8 max-w-2xl">
          No app to download. Use the chat you already have.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <Step n={1} title="Pick a café" body="Browse all cafés on campus by what's open, what's quick, or what you're craving." />
          <Step n={2} title="Chat your order" body="Tell the café what you want in plain words. They reply with a price and an M-Pesa till." />
          <Step n={3} title="Walk out, grab, go" body="Pay on M-Pesa, get a 'ready' ping, pick it up between classes. No queue." />
        </div>
      </section>

      {/* ── Café grid ────────────────────────────────────────────────── */}
      <section className="pb-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="h-display text-3xl md:text-4xl">On campus right now</h2>
            <p className="text-ink-mute">All four USIU cafés, one chat away.</p>
          </div>
          <Link href="/cafes" className="text-sm font-semibold text-brand hidden md:inline">
            See all →
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {CAFES.map((c) => (
            <CafeCard key={c.slug} cafe={c} />
          ))}
        </div>
      </section>

      {/* ── Owner CTA strip ──────────────────────────────────────────── */}
      <section className="my-16">
        <div className="card p-8 md:p-12 grid md:grid-cols-[2fr,1fr] gap-8 items-center bg-ink text-cream border-ink/40">
          <div>
            <h2 className="h-display text-3xl md:text-4xl mb-3">
              Run a campus café? <span className="text-brand">List it free.</span>
            </h2>
            <p className="text-cream/80 max-w-xl">
              Get an AI agent that answers every order on WhatsApp, M-Pesa
              receipts straight to your till, and a dashboard that shows
              what's selling. We set you up in a day.
            </p>
          </div>
          <Link href="/owners" className="btn-primary justify-self-start md:justify-self-end">
            Get started →
          </Link>
        </div>
      </section>

      <ChatWidget />
    </>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="space-y-2">
      <div className="w-10 h-10 rounded-2xl bg-brand-light text-brand-dark flex items-center justify-center h-display text-lg">
        {n}
      </div>
      <h3 className="h-display text-xl">{title}</h3>
      <p className="text-ink-soft text-sm">{body}</p>
    </div>
  );
}

function Outgoing({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="bg-brand text-white text-sm px-3 py-2 rounded-2xl rounded-br-md max-w-[80%]">
        {children}
      </div>
    </div>
  );
}
function Incoming({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-ink/5 text-ink text-sm px-3 py-2 rounded-2xl rounded-bl-md max-w-[85%]">
        {children}
      </div>
    </div>
  );
}
