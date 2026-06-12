"use client";

import Link from "next/link";
import clsx from "clsx";
import { CatalogImage } from "@/components/CatalogImage";

type TheaterHighlight = {
  label: string;
  value?: string;
  href?: string;
};

export function ProductTheater({
  image,
  fallbackImage,
  alt,
  name,
  highlights = [],
  eyebrow = "Private collection theater",
  className,
}: {
  image?: string | null;
  fallbackImage?: string | null;
  alt: string;
  name: string;
  highlights?: TheaterHighlight[];
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={clsx("product-theater spatial-panel depth-shadow-strong", className)}>
      <div className="product-theater__backplate" />
      <div className="product-theater__rail product-theater__rail--top" />
      <div className="product-theater__rail product-theater__rail--side" />
      <div className="product-theater__image">
        <CatalogImage
          src={image}
          fallbackSrc={fallbackImage}
          alt={alt}
          tone="warm"
          fit="cover"
          className="h-full w-full"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </div>
      {highlights.length > 0 && (
        <div className="product-theater__chips" aria-label="Collection contents">
          {highlights.slice(0, 5).map((item, index) => {
            const chip = (
              <>
                <span className="product-theater__chip-index">{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <span className="product-theater__chip-label">{item.label}</span>
                  {item.value && <span className="product-theater__chip-value">{item.value}</span>}
                </span>
              </>
            );
            return item.href ? (
              <Link key={`${item.label}-${index}`} href={item.href} className="product-theater__chip">
                {chip}
              </Link>
            ) : (
              <span key={`${item.label}-${index}`} className="product-theater__chip">
                {chip}
              </span>
            );
          })}
        </div>
      )}
      <div className="product-theater__caption">
        <span className="label-mono text-bronze-light">{eyebrow}</span>
        <p className="mt-1 font-serif text-2xl leading-tight text-white">{name}</p>
      </div>
    </div>
  );
}
