import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/products";
import { formatKES, formatUSD, whatsappLink } from "@/lib/format";
import { fetchPublicOrder, type TimelineStep } from "@/lib/orderTracking";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
  searchParams: { token?: string };
};

export function generateMetadata({ params }: PageProps): Metadata {
  return {
    title: `Order ${params.id} · Hazina Nomads`,
    description: "Track your Hazina Nomads concierge delivery.",
  };
}

export default async function OrderTrackingPage({ params, searchParams }: PageProps) {
  const token = (searchParams.token || "").trim();
  const order =
    token.length > 0 ? await fetchPublicOrder(params.id, token) : null;

  if (!order) {
    return <InvalidTrackingLink orderRef={params.id} />;
  }

  const modifyUrl = whatsappLink(
    BRAND.whatsapp,
    `Hello Hazina Nomads — I'd like to modify order ${order.reference}.`,
  );

  return (
    <div className="max-w-page mx-auto px-5 md:px-8 py-10 md:py-16">
      {order.payment_status !== "paid" && (
        <p className="mb-8 rounded-sm border border-[#A67C52]/40 bg-[#A67C52]/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.1em] text-[#FAF8F5]/90">
          Payment {order.payment_status.replace(/_/g, " ")} — tracking updates when checkout clears
        </p>
      )}

      <header className="mb-12 md:mb-16 border-b border-white/10 pb-10">
        <p className="font-mono text-[13px] font-medium uppercase tracking-[0.14em] text-[#5C564E]">
          Order Reference
        </p>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl lg:text-6xl tracking-tight text-[#FAF8F5] leading-[1.05]">
          {order.reference}
        </h1>
        <p className="mt-4 font-serif text-lg md:text-xl italic text-[#A67C52]">
          Placed {order.placed_at}
        </p>
      </header>

      <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        <section className="lg:col-span-5 space-y-8">
          <h2 className="font-mono text-[13px] font-medium uppercase tracking-[0.14em] text-[#5C564E]">
            Delivery status
          </h2>
          <TrackingTimeline steps={order.timeline} />
        </section>

        <section className="lg:col-span-7 space-y-8">
          <DispatchCard destination={order.destination} deliveryWindow={order.delivery_window} />

          <div className="rounded-sm border border-white/10 bg-white/[0.03] p-6 md:p-8 space-y-6">
            <h2 className="font-mono text-[13px] font-medium uppercase tracking-[0.14em] text-[#5C564E]">
              Treasures Secured
            </h2>
            <ul className="space-y-4">
              {order.lines.map((line) => (
                <li
                  key={`${line.name}-${line.quantity}`}
                  className="flex items-start justify-between gap-4 text-sm md:text-base"
                >
                  <div className="min-w-0">
                    <p className="font-serif text-lg text-[#FAF8F5] leading-snug">{line.name}</p>
                    <p className="font-mono text-xs text-[#5C564E] mt-1">Qty {line.quantity}</p>
                  </div>
                  <p className="font-mono text-sm text-[#FAF8F5] shrink-0 tabular-nums">
                    {formatUSD(line.price_usd)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="pt-6 border-t-2 border-white/15">
              <p className="font-mono text-[13px] font-medium uppercase tracking-[0.14em] text-[#5C564E]">
                Total Paid
              </p>
              <p className="mt-2 font-serif text-4xl md:text-5xl text-[#FAF8F5] leading-none">
                {formatUSD(order.total_usd)}
              </p>
              <p className="mt-2 font-mono text-sm text-[#5C564E]">{formatKES(order.total_kes)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 justify-start lg:justify-end pt-2">
            <a
              href={modifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center justify-center px-8 py-3 font-mono text-sm font-medium uppercase tracking-[0.12em] border border-[#A67C52] text-[#A67C52] transition-colors duration-300 hover:bg-[#A67C52] hover:text-[#1C1A17]"
            >
              Modify Via WhatsApp
            </a>
          </div>
        </section>
      </div>

      <p className="mt-16 text-center font-mono text-xs text-[#5C564E]">
        Questions?{" "}
        <Link href={`mailto:${BRAND.email}`} className="text-[#A67C52] hover:underline underline-offset-4">
          {BRAND.email}
        </Link>
      </p>
    </div>
  );
}

function InvalidTrackingLink({ orderRef }: { orderRef: string }) {
  const whatsapp = whatsappLink(
    BRAND.whatsapp,
    `Hello Hazina Nomads — my tracking link for order ${orderRef} is not working.`,
  );

  return (
    <div className="max-w-page mx-auto px-5 md:px-8 py-24 md:py-32 text-center">
      <p className="font-mono text-[13px] font-medium uppercase tracking-[0.14em] text-[#5C564E]">
        Tracking unavailable
      </p>
      <h1 className="mt-4 font-serif text-3xl md:text-4xl text-[#FAF8F5] leading-tight max-w-lg mx-auto">
        This link has expired or is invalid
      </h1>
      <p className="mt-6 font-sans text-base text-[#5C564E] max-w-md mx-auto leading-relaxed">
        Please contact the concierge via WhatsApp — we will resend a fresh tracking link for your
        order.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[48px] items-center justify-center px-8 py-3 font-mono text-sm font-medium uppercase tracking-[0.12em] border border-[#A67C52] text-[#A67C52] transition-colors duration-300 hover:bg-[#A67C52] hover:text-[#1C1A17]"
        >
          Contact Concierge
        </a>
      </div>
    </div>
  );
}

function TrackingTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative space-y-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.id} className="relative flex gap-5 pb-10 last:pb-0">
            {!isLast && (
              <span
                className="absolute left-[7px] top-4 bottom-0 w-px bg-white/15"
                aria-hidden
              />
            )}
            <TimelineDot status={step.status} />
            <div className="flex-1 min-w-0 pt-0.5">
              <p
                className={`font-serif text-xl md:text-2xl leading-tight ${
                  step.status === "active"
                    ? "text-[#FAF8F5]"
                    : step.status === "complete"
                      ? "text-[#FAF8F5]/85"
                      : "text-[#5C564E]"
                }`}
              >
                {step.label}
              </p>
              {step.status === "active" && step.courier_note && (
                <p className="mt-2 font-mono text-sm text-[#5C564E] leading-relaxed">
                  {step.courier_note}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TimelineDot({ status }: { status: TimelineStep["status"] }) {
  if (status === "complete") {
    return (
      <span
        className="relative z-[1] mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full bg-[#A67C52]"
        aria-hidden
      />
    );
  }
  if (status === "active") {
    return (
      <span
        className="relative z-[1] mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full bg-[#FAF8F5] shadow-[0_0_14px_rgba(250,248,245,0.55)]"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="relative z-[1] mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-[#5C564E] bg-transparent"
      aria-hidden
    />
  );
}

function DispatchCard({
  destination,
  deliveryWindow,
}: {
  destination: string;
  deliveryWindow: string;
}) {
  return (
    <div className="rounded-sm border border-white/10 bg-white/5 p-6 md:p-8 space-y-5">
      <h2 className="font-mono text-[13px] font-medium uppercase tracking-[0.14em] text-[#5C564E]">
        Dispatch details
      </h2>
      <div className="space-y-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-[#5C564E]">Destination</p>
          <p className="mt-1 font-serif text-xl md:text-2xl text-[#FAF8F5] leading-snug">{destination}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-[#5C564E]">Delivery window</p>
          <p className="mt-1 font-serif text-lg text-[#FAF8F5]/90">{deliveryWindow}</p>
        </div>
      </div>
    </div>
  );
}
