import Link from "next/link";

export const metadata = { title: "For café owners · Gen-Eat" };

export default function OwnersPage() {
  return (
    <>
      <section className="grid md:grid-cols-[1.4fr,1fr] gap-10 items-center pb-16">
        <div className="space-y-6">
          <span className="chip-mute">For café owners & campuses</span>
          <h1 className="h-display text-5xl md:text-6xl leading-[0.95]">
            Triple your <span className="text-brand">between-class</span> orders.
          </h1>
          <p className="text-lg text-ink-soft max-w-xl">
            Gen-Eat is the chat-first ordering system built for campus cafés.
            One AI agent answers every customer on WhatsApp — taking orders,
            sending M-Pesa till numbers, and pinging students when food is
            ready. No app. No POS swap. Live in a day.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="mailto:hello@gen-eat.app?subject=Gen-Eat%20for%20my%20café" className="btn-primary">
              Talk to us →
            </a>
            <Link href="#pricing" className="btn-ghost">See pricing</Link>
          </div>
        </div>
        <div className="card p-7 space-y-4">
          <div className="flex items-baseline justify-between">
            <span className="h-display text-2xl">USIU pilot</span>
            <span className="chip-ok">live</span>
          </div>
          <Stat label="Avg pickup time" value="3 min" />
          <Stat label="Order capture rate" value="92%" sub="vs counter queues" />
          <Stat label="Lunch-hour throughput" value="2.4×" sub="for Pavilion Grill" />
          <Stat label="AI replies handled solo" value="87%" sub="no staff intervention" />
        </div>
      </section>

      {/* Benefits */}
      <section className="grid md:grid-cols-3 gap-5 mb-16">
        <Card title="Sell while you cook." body="The AI greets, takes orders, answers menu questions and quotes prep times — even while the till is slammed." />
        <Card title="M-Pesa, your till." body="Money lands directly in your existing Till or Paybill. We never touch it. Zero settlement risk." />
        <Card title="One dashboard." body="See live orders, top items, slow days, customer messages. Reply with one tap when needed." />
        <Card title="No new hardware." body="Runs on your existing phone number and WhatsApp Business. The same staff just sees clean tickets." />
        <Card title="Built for campuses." body="Per-faculty discounts, exam-week 24h mode, dorm delivery routes, group orders that split on one link." />
        <Card title="Your brand, your voice." body="Custom greetings, menu, photos. The AI talks like your café — including the local slang." />
      </section>

      {/* Pricing */}
      <section id="pricing" className="mb-20">
        <h2 className="h-display text-3xl md:text-4xl mb-2">Simple pricing</h2>
        <p className="text-ink-soft mb-8 max-w-xl">
          Designed for indie campus cafés. Free during the USIU pilot semester.
        </p>
        <div className="grid md:grid-cols-3 gap-5">
          <Plan
            name="Starter"
            price="Free"
            sub="USIU pilot semester"
            features={["AI WhatsApp ordering", "M-Pesa till linking", "Daily report", "Up to 200 orders/day"]}
            cta="Join the pilot"
          />
          <Plan
            highlight
            name="Café Pro"
            price="KES 4,900/mo"
            sub="after pilot"
            features={[
              "Unlimited orders",
              "Custom AI voice & menu",
              "Group orders + dorm delivery",
              "Live owner dashboard",
              "Priority support",
            ]}
            cta="Reserve a slot"
          />
          <Plan
            name="Campus"
            price="Custom"
            sub="entire schools"
            features={[
              "All cafés on one campus",
              "Faculty SSO + meal plans",
              "Real-time campus map",
              "Custom branding (e.g. Gen-Eat @ Strathmore)",
              "On-site setup",
            ]}
            cta="Bring us to your school"
          />
        </div>
      </section>

      <section className="card p-10 md:p-14 bg-ink text-cream border-ink/40 text-center">
        <h2 className="h-display text-3xl md:text-4xl mb-3">
          Want this at your school?
        </h2>
        <p className="text-cream/80 max-w-xl mx-auto mb-6">
          We're rolling out next to Strathmore, Daystar, Kenyatta University
          and JKUAT. Get your campus on the list.
        </p>
        <a href="mailto:hello@gen-eat.app?subject=Bring%20Gen-Eat%20to%20our%20campus" className="btn-primary">
          Email us →
        </a>
      </section>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-ink/5 pb-2 last:border-0">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="text-right">
        <span className="h-display text-lg">{value}</span>
        {sub && <span className="block text-[11px] text-ink-mute">{sub}</span>}
      </span>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-6 space-y-2">
      <h3 className="h-display text-xl">{title}</h3>
      <p className="text-sm text-ink-soft">{body}</p>
    </div>
  );
}

function Plan({
  name, price, sub, features, cta, highlight,
}: {
  name: string; price: string; sub: string; features: string[]; cta: string; highlight?: boolean;
}) {
  return (
    <div className={`card p-7 space-y-4 ${highlight ? "border-brand ring-2 ring-brand/30" : ""}`}>
      <div>
        <div className="flex items-baseline justify-between">
          <span className="h-display text-xl">{name}</span>
          {highlight && <span className="chip-ok">Most popular</span>}
        </div>
        <div className="h-display text-3xl mt-3">{price}</div>
        <div className="text-xs text-ink-mute">{sub}</div>
      </div>
      <ul className="space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-2"><span className="text-brand">✓</span>{f}</li>
        ))}
      </ul>
      <a href="mailto:hello@gen-eat.app" className={highlight ? "btn-primary w-full justify-center" : "btn-ghost w-full justify-center"}>
        {cta}
      </a>
    </div>
  );
}
