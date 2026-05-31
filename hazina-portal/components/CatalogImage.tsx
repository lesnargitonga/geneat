"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  src?: string | null;
  alt?: string | null;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  sizes?: string;
};

export function CatalogImage({
  src,
  alt,
  priority,
  className = "",
  imageClassName = "",
  sizes = "(max-width: 768px) 100vw, 33vw",
}: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={`relative overflow-hidden bg-sand-dark ${className}`}
      data-image-missing={!showImage ? "true" : undefined}
    >
      {showImage ? (
        <Image
          src={src!}
          alt={alt || "Hazina Nomads product photograph"}
          fill
          className={imageClassName || "object-cover object-center"}
          sizes={sizes}
          priority={priority}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-sand-dark via-sand to-sand-dark p-6 text-center">
          <span className="font-serif text-lg text-ink-soft">Photograph loading</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-mute max-w-[14rem] leading-relaxed">
            {alt || "Image unavailable — concierge can confirm this item"}
          </span>
        </div>
      )}
    </div>
  );
}
