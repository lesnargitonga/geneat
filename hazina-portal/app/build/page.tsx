import type { Metadata } from "next";
import { PackBuilder } from "@/components/PackBuilder";

export const metadata: Metadata = {
  title: "Choose Treasures · Hazina Nomads",
  description: "Choose Kenyan treasures directly, add packaging only if needed, and start hotel, JKIA, or export checkout.",
};

export default function BuildPage({
  searchParams,
}: {
  searchParams: { add?: string };
}) {
  const initialAddIds = searchParams.add ? [searchParams.add] : [];

  return (
    <>
      <header className="container-page pt-10 md:pt-16 mb-10 md:mb-14">
        <span className="label-mono">Choose directly</span>
        <h1 className="h-display text-5xl md:text-7xl mt-4 mb-5 text-obsidian">Pick what you want</h1>
        <p className="text-ink-mute max-w-2xl text-lg leading-relaxed">
          Select the items, set quantity, add packaging only if you need a gift box,
          then send one clean checkout request.
        </p>
      </header>
      <div className="container-page pb-20">
        <PackBuilder initialAddIds={initialAddIds} />
      </div>
    </>
  );
}
