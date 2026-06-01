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
   * warm = theme sand frame; multiply blend in day mode only (night keeps full photo visibility).
   * default = flat tile background, no blend (full-bleed brand/scenic shots).
   */
  tone?: "default" | "warm";
  /** contain = show full product/box (collection heroes); cover = fill frame */
  fit?: "cover" | "contain";
};

function isLocalStaticPath(path: string) {
  return path.startsWith("/treasures/") || path.startsWith("/brand/");
}

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
  const useNativeImg = Boolean(activeSrc && isLocalStaticPath(activeSrc));
  const useProductBlend = tone === "warm";

  const frameClass = useProductBlend ? "catalog-photo-frame" : "bg-sand-dark";

  const handleError = () => {
    if (index < candidates.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    setFailed(true);
  };

  const fitClass =
    fit === "contain" ? "object-contain object-center p-2 md:p-3" : "object-cover object-center";
  const blendClass = useProductBlend ? "catalog-photo-blend" : "";
  const imgClass = [imageClassName || fitClass, blendClass].filter(Boolean).join(" ");

  return (
    <div
      className={`relative overflow-hidden ${frameClass} ${className}`}
      data-image-missing={!showImage ? "true" : undefined}
    >
      {showImage && useNativeImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={activeSrc}
          src={activeSrc}
          alt={alt || "Hazina Nomads product photograph"}
          className={`absolute inset-0 h-full w-full ${imgClass}`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={handleError}
        />
      ) : showImage ? (
        <Image
          key={activeSrc}
          src={activeSrc!}
          alt={alt || "Hazina Nomads product photograph"}
          fill
          className={imgClass}
          sizes={sizes}
          priority={priority}
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
