"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Props = {
  src?: string | null;
  /** Used if primary src fails (e.g. first treasure in a collection). */
  fallbackSrc?: string | null;
  alt?: string | null;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  /**
   * warm = cream lightbox frame (white photo edges match; product at full brightness).
   * default = flat tile background (full-bleed brand/scenic shots).
   */
  tone?: "default" | "warm";
  /** contain = show full product/box (collection heroes); cover = fill frame */
  fit?: "cover" | "contain";
};

export function CatalogImage({
  src,
  fallbackSrc,
  alt,
  priority,
  className = "",
  imageClassName = "",
  sizes = "(max-width: 768px) 100vw, 33vw",
  tone = "default",
  fit = "cover",
}: Props) {
  const candidates = useMemo(
    () => [src, fallbackSrc].filter((p): p is string => Boolean(p)),
    [src, fallbackSrc],
  );
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [src, fallbackSrc]);

  const activeSrc = candidates[index];
  const showImage = Boolean(activeSrc) && !failed;
  const useLightbox = tone === "warm";

  const frameClass = useLightbox ? "catalog-photo-frame bg-[#f5f0e8]" : "bg-sand-dark";

  const handleError = () => {
    if (index < candidates.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    setFailed(true);
  };

  const fitClass =
    fit === "contain" ? "object-contain object-center p-2 md:p-3" : "object-cover object-center";
  const imgClass = [imageClassName || fitClass, useLightbox ? "catalog-photo-img" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`relative overflow-hidden ${frameClass} ${className}`}
      data-image-missing={!showImage ? "true" : undefined}
    >
      {showImage ? (
        <Image
          key={activeSrc}
          src={activeSrc!}
          alt={alt || "Hazina Nomads product photograph"}
          fill
          className={imgClass}
          sizes={sizes}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          quality={priority ? 80 : 68}
          onError={handleError}
        />
      ) : (
        <div
          role="img"
          aria-label={alt || "Product photograph loading"}
          className="absolute inset-0 flex items-center justify-center border border-border bg-sand-dark px-5 text-center"
        >
          <div>
            <p className="font-mono text-sm font-medium uppercase tracking-[0.1em] text-ink-soft">
              Image unavailable
            </p>
            <p className="mt-2 text-sm text-ink-mute">
              Refresh the page or ask the concierge for photos
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
