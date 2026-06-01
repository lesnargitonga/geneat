import Link from "next/link";
import type { Metadata } from "next";
import { PackBuilder } from "@/components/PackBuilder";

export const metadata: Metadata = {
  title: "Curate a Private Collection · Hazina Nomads",
  description:
    "Compose Savannah treasures and Swahili Coast artifacts with optional monograms and bespoke sourcing notes for our concierge.",
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
        <span className="label-mono">Private sourcing brief</span>
        <h1 className="h-display text-5xl md:text-7xl mt-4 mb-5 text-obsidian">Curate a Private Collection</h1>
        <p className="text-ink-mute max-w-2xl text-lg leading-relaxed">
          Choose from our catalog of Savannah treasures and Swahili Coast artifacts. Request bespoke monograms, or
          submit custom sourcing notes. Your selection becomes a private brief for our concierge team. Prefer a finished
          edit?{" "}
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
