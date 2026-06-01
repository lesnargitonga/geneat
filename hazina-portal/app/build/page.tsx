import Link from "next/link";
import type { Metadata } from "next";
import { PackBuilder } from "@/components/PackBuilder";

export const metadata: Metadata = {
  title: "Choose Treasures · Hazina Nomads",
  description: "Choose Kenyan treasures directly, add packaging only if needed, and start hotel, JKIA, or export checkout.",
};

export default function BuildPage({
  searchParams,
}: {
  searchParams: { add?: string; category?: string; q?: string };
}) {
  const initialAddIds = searchParams.add ? [searchParams.add] : [];

  return (
    <>
      <header className="container-page pt-10 md:pt-16 mb-10 md:mb-14">
        <span className="label-mono">Custom box</span>
        <h1 className="h-display text-5xl md:text-7xl mt-4 mb-5 text-obsidian">Pick what you want</h1>
        <p className="text-ink-mute max-w-2xl text-lg leading-relaxed">
          Browse every treasure, add to your box, then let guided chat collect delivery details one step at a time.
          Prefer a finished edit?{" "}
          <Link href="/collections" className="text-bronze hover:text-obsidian underline-offset-4 hover:underline">
            View collections
          </Link>
          .
        </p>
      </header>
      <div className="container-page pb-20">
        <PackBuilder
          initialAddIds={initialAddIds}
          initialCategory={searchParams.category}
          initialQuery={searchParams.q}
        />
      </div>
    </>
  );
}
