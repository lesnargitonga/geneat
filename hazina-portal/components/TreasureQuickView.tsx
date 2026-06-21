"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CatalogImage } from "@/components/CatalogImage";
import { flyToBox } from "@/lib/flyToBox";
import { formatKES, formatUSD } from "@/lib/format";
import { CATEGORY_LABELS, type Treasure } from "@/lib/treasures";

export function TreasureQuickView({
  item,
  qty,
  onSetQty,
  onClose,
  boxRef,
}: {
  item: Treasure | null;
  qty: number;
  onSetQty: (id: string, next: number) => void;
  onClose: () => void;
  boxRef: RefObject<HTMLElement | null>;
}) {
  const imageRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [item, onClose]);

  const addToBox = () => {
    if (!item) return;
    if (qty === 0) {
      flyToBox(imageRef.current?.querySelector("img") ?? imageRef.current, boxRef.current, item.image);
    }
    onSetQty(item.id, qty + 1);
  };

  if (!mounted) return null;

  // Portal to <body> so the fixed overlay isn't anchored to any transformed
  // ancestor (which would mis-size/clip it).
  return createPortal(
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-6"
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
            aria-label={`${item.name} details`}
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto local-scroll rounded-t-2xl sm:rounded-2xl border border-border bg-sand shadow-editorial"
            initial={{ y: 40, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-sand/90 text-ink-soft transition hover:text-obsidian"
            >
              ✕
            </button>

            <div ref={imageRef} className="relative h-56 w-full overflow-hidden bg-sand-dark sm:h-64">
              <CatalogImage
                src={item.image}
                alt={item.imageAlt || item.name}
                tone="default"
                fit="cover"
                className="h-full w-full"
                sizes="(max-width: 640px) 100vw, 512px"
                priority
              />
            </div>

            <div className="space-y-4 p-5 md:p-6">
              <div>
                <span className="label-mono text-bronze">{CATEGORY_LABELS[item.category]}</span>
                <h3 className="mt-1 font-serif text-2xl leading-tight text-obsidian">{item.name}</h3>
                <p className="label-mono mt-1">{item.sku}</p>
              </div>

              <p className="text-sm leading-relaxed text-ink-mute">{item.description}</p>
              {item.origin && (
                <p className="text-sm text-ink-mute">
                  <span className="label-mono text-ink-soft">Origin</span> — {item.origin}
                </p>
              )}

              <div className="flex items-end justify-between border-t border-border pt-4">
                <div>
                  <p className="font-serif text-2xl leading-none text-obsidian">{formatUSD(item.price_usd)}</p>
                  <p className="mt-1 font-mono text-sm text-ink-mute">{formatKES(item.price_kes)}</p>
                </div>
                {qty > 0 && (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSetQty(item.id, qty - 1)}
                      className="h-9 w-9 rounded-full border border-border font-mono text-ink-mute transition-transform hover:text-obsidian active:scale-75"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <motion.span
                      key={qty}
                      initial={{ scale: 0.6 }}
                      animate={{ scale: [0.6, 1.3, 1] }}
                      transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                      className="inline-block min-w-[2ch] text-center font-mono text-base text-obsidian"
                    >
                      {qty}
                    </motion.span>
                    <button
                      type="button"
                      onClick={addToBox}
                      className="h-9 w-9 rounded-full border border-border font-mono text-ink-mute transition-transform hover:text-obsidian active:scale-75"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <button type="button" onClick={addToBox} className="btn-bronze w-full">
                  {qty > 0 ? "Add another to box" : "Add to box"}
                </button>
                <Link href={`/treasures/${item.id}`} className="btn-outline w-full" onClick={onClose}>
                  View full details
                </Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
