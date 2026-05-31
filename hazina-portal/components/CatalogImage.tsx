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
          className={imageClassName || "object-contain object-center"}
          sizes={sizes}
          priority={priority}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          role="img"
          aria-label={alt || "Verified Hazina product photography pending"}
          className="absolute inset-0 flex items-center justify-center border border-border bg-sand-dark px-5 text-center"
        >
          <div>
            <p className="font-mono text-sm font-medium uppercase tracking-[0.1em] text-ink-soft">
              Verified image pending
            </p>
            <p className="mt-2 text-sm text-ink-mute">
              Exact Hazina photography needed
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
