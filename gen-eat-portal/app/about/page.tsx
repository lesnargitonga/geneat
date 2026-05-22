export const metadata = { title: "About · Gen-Eat" };

export default function AboutPage() {
  return (
    <article className="prose-page max-w-3xl mx-auto space-y-10 pb-16">
      <header>
        <span className="chip-mute mb-3">About Gen-Eat</span>
        <h1 className="h-display text-5xl md:text-6xl leading-[0.95]">
          We built it because <span className="text-brand">we missed lunch.</span>
        </h1>
      </header>

      <section className="space-y-4 text-ink-soft text-lg">
        <p>
          Gen-Eat started inside a lecture hall at USIU. Three of us realised
          the same thing on the same day: there's a 12-minute gap between
          classes, four amazing cafés on campus, and a queue every time.
        </p>
        <p>
          So we built an AI agent that takes your order on WhatsApp while you
          pack your bag, sends you the till number, and pings you when your
          food is on the shelf.
        </p>
        <p>
          Now we're rolling it out café by café — starting with the four
          spots inside USIU, then Strathmore, Daystar, KU and beyond.
        </p>
      </section>

      <section id="how" className="card p-8 space-y-3">
        <h2 className="h-display text-2xl">How it works (the short version)</h2>
        <ol className="list-decimal list-inside text-ink-soft space-y-1">
          <li>Pick any café in the directory.</li>
          <li>Tap "Order on WhatsApp" or use the chat bubble.</li>
          <li>Tell the AI what you want — in English, Swahili or Sheng.</li>
          <li>Pay M-Pesa directly to the café's till.</li>
          <li>Pick up the moment your class ends.</li>
        </ol>
      </section>

      <section className="card p-8 space-y-3">
        <h2 className="h-display text-2xl">Built by Omni AI</h2>
        <p className="text-ink-soft">
          Gen-Eat is powered by Omni AI — the same multi-tenant AI customer
          platform behind salons, clinics and retailers across Kenya. Every
          café gets its own private brain trained on its menu, prices and
          policies. Nothing is shared between cafés.
        </p>
        <p className="text-ink-soft">
          Built with care in Nairobi. Open about our pricing. Honest about
          where the AI doesn't know — and instantly hands off to a real
          human when a customer asks for one.
        </p>
      </section>

      <section className="card p-8 text-center">
        <h3 className="h-display text-xl mb-2">Say hi 👋</h3>
        <a href="mailto:hello@gen-eat.app" className="text-brand font-semibold">
          hello@gen-eat.app
        </a>
      </section>
    </article>
  );
}
