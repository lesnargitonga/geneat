import { CAFES } from "@/lib/cafes";
import { CafeCard } from "@/components/CafeCard";
import { ChatWidget } from "@/components/ChatWidget";

export const metadata = { title: "Cafés · Gen-Eat" };

export default function CafesPage() {
  return (
    <>
      <header className="mb-10">
        <h1 className="h-display text-4xl md:text-5xl">All cafés</h1>
        <p className="text-ink-soft mt-2">
          Four spots across USIU. Tap any to see the full menu and start a chat.
        </p>
      </header>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {CAFES.map((c) => <CafeCard key={c.slug} cafe={c} />)}
      </div>
      <ChatWidget />
    </>
  );
}
