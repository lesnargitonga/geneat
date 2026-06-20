"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { CatalogImage } from "@/components/CatalogImage";
import type { GiftBox } from "@/lib/products";
import { formatKES, formatUSD } from "@/lib/format";
import type { Treasure } from "@/lib/treasures";

export function CollectionQuickView({
  box,
  items,
  packagingNote,
  waUrl,
  open,
  onClose,
}: {
  box: GiftBox;
  items: Treasure[];
  packagingNote?: string | null;
  waUrl: string;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-obsidian/55 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`What's inside ${box.name}`}
            className="relative flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-border bg-sand shadow-editorial sm:rounded-2xl"
            initial={{ y: 40, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border p-5 md:p-6">
              <div>
                <span className="label-mono text-bronze">{items.length} treasures inside</span>
                <h3 className="mt-1 font-serif text-2xl leading-tight text-obsidian">{box.name}</h3>
                <p className="mt-1 font-serif text-xl text-obsidian">{formatUSD(box.price_usd)}</p>
                <p className="font-mono text-sm text-ink-mute">{formatKES(box.price_kes)}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand-dark text-ink-soft transition hover:text-obsidian"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 overflow-y-auto p-5 local-scroll local-scroll--subtle sm:grid-cols-3 md:p-6">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/treasures/${item.id}`}
                  onClick={onClose}
                  className="group block overflow-hidden rounded-lg border border-border bg-sand transition-all hover:border-obsidian/20 hover:shadow-soft"
                >
                  <span className="relative block aspect-square bg-sand-dark">
                    <CatalogImage
                      src={item.image}
                      alt={item.imageAlt || item.name}
                      tone="warm"
                      fit="contain"
                      className="h-full w-full"
                      sizes="160px"
                    />
                  </span>
                  <span className="block p-2">
                    <span className="block truncate font-serif text-sm leading-tight text-obsidian">{item.name}</span>
                    <span className="font-mono text-[11px] text-ink-mute">{formatUSD(item.price_usd)}</span>
                  </span>
                </Link>
              ))}
            </div>

            {packagingNote && (
              <p className="border-t border-border px-5 py-3 text-sm text-ink-mute md:px-6">
                <span className="label-mono text-ink-soft">Also included</span> — {packagingNote}
              </p>
            )}

            <div className="grid gap-2 border-t border-border p-5 md:grid-cols-2 md:p-6">
              <Link href={`/collections/${box.id}`} className="btn-dark w-full" onClick={onClose}>
                View full details
              </Link>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">
                Reserve on WhatsApp
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
